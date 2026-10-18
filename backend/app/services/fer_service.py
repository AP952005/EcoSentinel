"""
FER generation service — orchestrates the multi-step report pipeline.
"""
import time
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.models import FERReport, FERReportVersion, Finding, CaseEvent, AnalysisRun, DataAvailability
from app.services.ai_service import ai_service
from app.providers.replay_provider import (
    get_replay_fer_content, get_replay_analysis_result,
    get_replay_finding_geometry, REPLAY_MODE
)
from app.services.geo_service import geo_service
from app.core.config import settings


class FERService:
    def generate_fer(
        self,
        db: Session,
        project,
        user_id: str,
    ) -> FERReport:
        """
        Full FER generation pipeline.
        Returns a persisted FERReport.
        """
        start_time = time.time()

        # Determine mode
        mode = project.analysis_mode or settings.default_analysis_mode

        # Step 1: Get latest version number
        existing = (
            db.query(FERReport)
            .filter(FERReport.project_id == project.id)
            .order_by(FERReport.version.desc())
            .first()
        )
        new_version = (existing.version + 1) if existing else 1

        # Step 2: Create FER record in "generating" state
        fer = FERReport(
            project_id=project.id,
            version=new_version,
            report_mode=mode,
            status="generating",
        )
        db.add(fer)
        db.flush()

        try:
            if mode == REPLAY_MODE:
                content = self._generate_replay_fer(db, project, fer)
            else:
                content = self._generate_live_fer(db, project, fer)

            # Apply content to FER (ensure Text columns are strings)
            raw_summary = content.get("summary")
            fer.summary = json.dumps(raw_summary) if isinstance(raw_summary, (dict, list)) else (raw_summary or "")
            raw_exec = content.get("executive_summary")
            fer.executive_summary = json.dumps(raw_exec) if isinstance(raw_exec, (dict, list)) else (raw_exec or "")
            fer.environmental_baseline = content.get("environmental_baseline")
            fer.screening_observations = content.get("screening_observations", [])
            fer.candidate_findings = content.get("candidate_findings", [])
            fer.investigation_guide = content.get("investigation_guide", [])
            fer.evidence_gaps = content.get("evidence_gaps", [])
            fer.data_availability = content.get("data_availability")
            fer.suggested_next_checks = content.get("suggested_next_checks", [])
            fer.source_references = content.get("source_references", [])
            fer.limitations = content.get("limitations", [])
            fer.analysis_metadata = content.get("analysis_metadata")
            fer.generated_by_model = content.get("generated_by_model")
            fer.generation_time_seconds = round(time.time() - start_time, 2)
            fer.status = "ready"

        except Exception as e:
            fer.status = "error"
            fer.analysis_metadata = {"error": str(e)}
            db.commit()
            raise

        # Save version snapshot
        version = FERReportVersion(
            report_id=fer.id,
            version_number=new_version,
            snapshot={
                "summary": fer.summary,
                "executive_summary": fer.executive_summary,
                "screening_observations": fer.screening_observations,
                "investigation_guide": fer.investigation_guide,
                "evidence_gaps": fer.evidence_gaps,
                "report_mode": fer.report_mode,
            },
            change_reason=f"Initial FER generation (v{new_version})",
            created_by=user_id,
        )
        db.add(version)

        # Create timeline event
        db.add(CaseEvent(
            project_id=project.id,
            event_type="fer_generated",
            description=f"FER v{new_version} generated in {mode} mode",
            actor_id=user_id,
            metadata={"fer_id": fer.id, "version": new_version, "mode": mode},
        ))

        db.commit()
        db.refresh(fer)
        return fer

    def _generate_replay_fer(self, db: Session, project, fer: FERReport) -> Dict[str, Any]:
        """Generate FER from replay fixture."""
        content = get_replay_fer_content()
        replay_result = get_replay_analysis_result()

        # Create an analysis run record for the replay
        run = AnalysisRun(
            project_id=project.id,
            analysis_type="ndvi_change",
            provider="ReplayObservationProvider",
            connection_mode=REPLAY_MODE,
            dataset_id=replay_result["dataset_id"],
            parameters=replay_result.get("metrics"),
            status="completed",
            result=replay_result,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            valid_pixel_coverage_pct=replay_result["comparison_period"].get("valid_pixel_coverage_pct"),
            cloud_coverage_pct=replay_result["comparison_period"].get("mean_cloud_cover_pct"),
            resolution_m=10,
            acquisition_dates=replay_result["comparison_period"].get("acquisition_dates"),
            source_item_ids=replay_result["comparison_period"].get("source_item_ids"),
        )
        db.add(run)
        db.flush()

        # Create a candidate finding
        metrics = replay_result.get("metrics", {})
        finding = Finding(
            project_id=project.id,
            analysis_run_id=run.id,
            fer_report_id=fer.id,
            finding_type="vegetation_index_change",
            title="Candidate vegetation-index decline outside declared core footprint",
            description=(
                f"Candidate NDVI decline (ΔNDVI ≈ {metrics.get('ndvi_delta_mean', -0.15)}) "
                f"detected over approximately {metrics.get('candidate_area_ha', 4.3)} ha. "
                f"Of this, {metrics.get('candidate_area_in_zone_a_ha', 1.2)} ha is within Zone A "
                f"and {metrics.get('candidate_area_outside_zone_a_ha', 3.1)} ha is outside the declared boundary. "
                "REPLAY FIXTURE — illustrative values only."
            ),
            status="candidate_change",
            zone_classification="A_and_B",
            candidate_area_ha=metrics.get("candidate_area_ha"),
            area_in_zone_a_ha=metrics.get("candidate_area_in_zone_a_ha"),
            area_in_zone_b_ha=metrics.get("candidate_area_in_zone_b_ha"),
            geometry_geojson=get_replay_finding_geometry(),
            ndvi_delta=metrics.get("ndvi_delta_mean"),
            threshold_used=metrics.get("ndvi_threshold_used"),
            connection_mode=REPLAY_MODE,
            source_references=content.get("source_references", []),
            limitations=replay_result.get("limitations", []),
        )
        db.add(finding)

        # Record data availability
        db.add(DataAvailability(
            project_id=project.id,
            provider="ReplayObservationProvider",
            dataset_id="REPLAY/DEMO/NDVI_COMPARISON_V1",
            status="replay",
            details={"note": "Replay fixture; configure Earth Engine for live data"},
        ))

        content["analysis_metadata"] = {
            "analysis_run_id": run.id,
            "mode": REPLAY_MODE,
            "method": metrics.get("method"),
            "generation_time_note": "Replay fixture — no live computation",
        }
        content["generated_by_model"] = "REPLAY (no AI model required)"
        content["candidate_findings"] = [
            {
                "finding_id": finding.id,
                "title": finding.title,
                "area_ha": finding.candidate_area_ha,
                "ndvi_delta": finding.ndvi_delta,
                "connection_mode": REPLAY_MODE,
            }
        ]
        return content

    def _generate_live_fer(self, db: Session, project, fer: FERReport) -> Dict[str, Any]:
        """Generate FER with live AI when available."""
        # Try AI generation
        project_data = {
            "project_name": project.project_name,
            "sector": project.sector,
            "activity": project.activity,
            "state": project.state,
            "district": project.district,
            "latitude": project.latitude,
            "longitude": project.longitude,
            "scale_data": project.scale_data,
            "project_summary": project.project_summary,
        }
        analysis_result = {"connection_mode": "SYNTHETIC", "note": "No satellite data configured"}

        ai_result = ai_service.generate_fer_content(project_data, analysis_result)

        if ai_result.get("success") and ai_result.get("data"):
            data = ai_result["data"]
            return {
                **data,
                "generated_by_model": ai_result.get("model"),
                "analysis_metadata": {"mode": "LIVE", "ai_generated": True},
            }
        else:
            # Fall back to replay content with a note
            content = get_replay_fer_content()
            content["summary"] = (
                f"FER generated for project: {project.project_name}. "
                "AI generation unavailable; replay template applied. "
                f"Error: {ai_result.get('error', 'Unknown')}"
            )
            content["generated_by_model"] = "unavailable"
            return content


fer_service = FERService()
