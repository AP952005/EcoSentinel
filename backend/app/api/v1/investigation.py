"""
Findings, challenges, watch plans, and cases API.
"""
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, check_project_access
from app.models.models import (
    Finding, FindingChallenge, FindingEvidence, ReviewAction,
    WatchPlan, JobRun, Case, CaseEvent, User, Project
)
from app.schemas.schemas import (
    FindingOut, ChallengeRequest, ChallengeOut, ReviewRequest,
    WatchPlanCreate, WatchPlanOut, JobRunOut, CaseOut, CaseEventCreate, CaseEventOut,
    ChatRequest, ChatResponse,
)
from app.services.ai_service import ai_service
from app.providers.replay_provider import get_replay_challenge_result, REPLAY_MODE
from app.api.v1.system import chat as case_chat

router = APIRouter(tags=["investigation"])

fer_router = APIRouter(prefix="/fer", tags=["fer"])
findings_router = APIRouter(prefix="/findings", tags=["findings"])
watch_router = APIRouter(prefix="/watch-plans", tags=["watchtower"])
cases_router = APIRouter(prefix="/cases", tags=["cases"])


# ─── FER ─────────────────────────────────────────────────────────────────────

@fer_router.get("/{fer_id}")
def get_fer(fer_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.models import FERReport
    from app.schemas.schemas import FEROut
    fer = db.query(FERReport).filter(FERReport.id == fer_id).first()
    if not fer:
        raise HTTPException(status_code=404, detail="FER not found")
    project = db.query(Project).filter(Project.id == fer.project_id).first()
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return FEROut.model_validate(fer)


@fer_router.get("/{fer_id}/versions")
def list_fer_versions(fer_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.models import FERReport, FERReportVersion
    fer = db.query(FERReport).filter(FERReport.id == fer_id).first()
    if not fer:
        raise HTTPException(status_code=404, detail="FER not found")
    project = db.query(Project).filter(Project.id == fer.project_id).first()
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    versions = (
        db.query(FERReportVersion)
        .filter(FERReportVersion.report_id == fer_id)
        .order_by(FERReportVersion.version_number)
        .all()
    )
    return [{"version_number": v.version_number, "created_at": v.created_at, "change_reason": v.change_reason} for v in versions]


@fer_router.get("/{fer_id}/pdf")
@fer_router.post("/{fer_id}/export")
def export_fer(
    fer_id: str,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.models import FERReport, Finding, FindingChallenge
    from app.services.report_service import generate_fer_pdf
    from fastapi.responses import Response

    fer = db.query(FERReport).filter(FERReport.id == fer_id).first()
    if not fer:
        raise HTTPException(status_code=404, detail="FER not found")
    project = db.query(Project).filter(Project.id == fer.project_id).first()
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    findings = db.query(Finding).filter(Finding.project_id == fer.project_id).all()
    challenge = None
    if findings:
        challenge = db.query(FindingChallenge).filter(FindingChallenge.finding_id == findings[0].id).order_by(FindingChallenge.created_at.desc()).first()

    if format == "pdf":
        pdf_bytes = generate_fer_pdf(fer=fer, project=project, findings=findings, challenge=challenge)
        filename = f"FER-{fer.project_id[:8]}-v{fer.version}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    # Return structured JSON
    return {
        "fer_id": fer.id,
        "project_id": fer.project_id,
        "version": fer.version,
        "report_mode": fer.report_mode,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user.email,
        "note": fer.report_mode == REPLAY_MODE and "REPLAY FIXTURE — not real project data" or "Live report",
        "content": {
            "summary": fer.summary,
            "executive_summary": fer.executive_summary,
            "screening_observations": fer.screening_observations,
            "investigation_guide": fer.investigation_guide,
            "evidence_gaps": fer.evidence_gaps,
            "limitations": fer.limitations,
            "source_references": fer.source_references,
        },
    }


# ─── Findings ─────────────────────────────────────────────────────────────────

@findings_router.get("/project/{project_id}", response_model=List[FindingOut])
def list_project_findings(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compatibility route for project-scoped finding lists."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Finding).filter(Finding.project_id == project_id).all()

@findings_router.get("/{finding_id}", response_model=FindingOut)
def get_finding(finding_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    finding = _get_finding_or_404(db, finding_id)
    project = db.query(Project).filter(Project.id == finding.project_id).first()
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return finding


@findings_router.post("/{finding_id}/challenge", response_model=ChallengeOut, status_code=status.HTTP_201_CREATED)
def challenge_finding(
    finding_id: str,
    req: ChallengeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    finding = _get_finding_or_404(db, finding_id)
    project = db.query(Project).filter(Project.id == finding.project_id).first()
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    # Use replay result for REPLAY mode, otherwise try AI
    if finding.connection_mode == REPLAY_MODE:
        result_data = get_replay_challenge_result()
        model_used = "REPLAY (fixed fixture)"
    else:
        finding_dict = {
            "id": finding.id,
            "title": finding.title,
            "description": finding.description,
            "ndvi_delta": finding.ndvi_delta,
            "candidate_area_ha": finding.candidate_area_ha,
            "connection_mode": finding.connection_mode,
            "limitations": finding.limitations,
        }
        context = {"project_sector": project.sector, "notes": req.notes}
        ai_result = ai_service.challenge_finding_proofloop(finding_dict, context)
        if ai_result.get("success"):
            result_data = ai_result["data"]
            model_used = f"{ai_result.get('provider', 'AI')}:{ai_result.get('model', 'unknown')}"
        else:
            result_data = get_replay_challenge_result()
            model_used = f"REPLAY fallback (AI error: {ai_result.get('error')})"

    challenge = FindingChallenge(
        finding_id=finding_id,
        challenger_id=current_user.id,
        observation_summary=result_data.get("observation_summary"),
        supporting_evidence=result_data.get("supporting_evidence", []),
        contradictory_evidence=result_data.get("contradictory_evidence", []),
        alternative_explanations=result_data.get("alternative_explanations", []),
        data_quality_notes=result_data.get("data_quality_notes", []),
        limitations=result_data.get("limitations", []),
        unresolved_questions=result_data.get("unresolved_questions", []),
        suggested_next_checks=result_data.get("suggested_next_checks", []),
        recommended_review_action=result_data.get("recommended_review_action"),
        priority_rationale=result_data.get("priority_rationale"),
        review_status="under_human_review",
        analysis_version=result_data.get("analysis_version", "v1.0"),
        generated_by_model=model_used,
    )
    db.add(challenge)

    # Update finding status
    finding.status = "under_human_review"

    # Timeline event
    db.add(CaseEvent(
        project_id=finding.project_id,
        event_type="challenge_completed",
        description=f"Challenge analysis completed for finding: {finding.title}",
        actor_id=current_user.id,
        metadata={"finding_id": finding_id, "challenge_id": challenge.id},
    ))
    db.commit()
    db.refresh(challenge)
    return challenge


@findings_router.post("/{finding_id}/review")
def review_finding(
    finding_id: str,
    req: ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    finding = _get_finding_or_404(db, finding_id)
    project = db.query(Project).filter(Project.id == finding.project_id).first()
    if not check_project_access(project, current_user, require_write=True):
        raise HTTPException(status_code=403, detail="Access denied")

    action = ReviewAction(
        finding_id=finding_id,
        reviewer_id=current_user.id,
        action_type=req.action_type,
        notes=req.notes,
        new_status=req.new_status,
    )
    if req.new_status:
        finding.status = req.new_status
    db.add(action)
    db.add(CaseEvent(
        project_id=finding.project_id,
        event_type="review_action",
        description=f"Reviewer action: {req.action_type}",
        actor_id=current_user.id,
    ))
    db.commit()
    return {"message": "Review action recorded", "action_id": action.id}


# ─── Watch Plans ──────────────────────────────────────────────────────────────

@watch_router.post("", response_model=WatchPlanOut, status_code=status.HTTP_201_CREATED)
def create_watch_plan(
    req: WatchPlanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    plan = WatchPlan(
        project_id=req.project_id,
        name=req.name,
        analysis_type=req.analysis_type,
        provider=req.provider,
        cadence_days=req.cadence_days,
        quality_threshold=req.quality_threshold,
        minimum_coverage_pct=req.minimum_coverage_pct,
        ndvi_threshold=req.ndvi_threshold,
        owner_id=current_user.id,
        notification_email=req.notification_email,
    )
    db.add(plan)
    db.add(CaseEvent(
        project_id=req.project_id,
        event_type="watch_plan_created",
        description=f"Monitoring plan created: {req.name}",
        actor_id=current_user.id,
    ))
    db.commit()
    db.refresh(plan)
    return plan


@watch_router.get("", response_model=List[WatchPlanOut])
def list_watch_plans(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role in ("admin", "officer"):
        plans = db.query(WatchPlan).order_by(WatchPlan.created_at.desc()).all()
    else:
        plans = db.query(WatchPlan).filter(WatchPlan.owner_id == current_user.id).all()
    return plans


@watch_router.post("/{watch_id}/run", response_model=JobRunOut)
def run_watch_now(
    watch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(WatchPlan).filter(WatchPlan.id == watch_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Watch plan not found")

    # Create job run
    run = JobRun(
        watch_plan_id=watch_id,
        status="running",
        connection_mode=REPLAY_MODE,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.flush()

    # Run replay check
    from app.providers.replay_provider import get_replay_analysis_result
    result = get_replay_analysis_result()

    run.status = "completed"
    run.completed_at = datetime.now(timezone.utc)
    run.connection_mode = REPLAY_MODE
    run.new_observations = len(result.get("comparison_period", {}).get("acquisition_dates", []))
    run.findings_created = 0
    run.result_summary = {
        "note": "REPLAY — no new findings created (existing replay finding used)",
        "ndvi_delta": result.get("metrics", {}).get("ndvi_delta_mean"),
        "connection_mode": REPLAY_MODE,
    }

    plan.last_run_at = datetime.now(timezone.utc)
    plan.last_run_status = "completed_replay"

    db.add(CaseEvent(
        project_id=plan.project_id,
        event_type="watch_run_completed",
        description=f"Monitoring check completed ({REPLAY_MODE} mode)",
        actor_id=current_user.id,
        metadata={"job_run_id": run.id, "connection_mode": REPLAY_MODE},
    ))
    db.commit()
    db.refresh(run)
    return run


@watch_router.get("/{watch_id}/history", response_model=List[JobRunOut])
def watch_history(watch_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    runs = db.query(JobRun).filter(JobRun.watch_plan_id == watch_id).order_by(JobRun.started_at.desc()).all()
    return runs


# ─── Cases ────────────────────────────────────────────────────────────────────

@cases_router.post("/chat", response_model=ChatResponse)
def case_scoped_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Backwards-compatible case chat endpoint.

    The web client uses ``/chat``; older clients used ``/cases/chat``.
    Both routes delegate to the same case-grounded implementation.
    """
    return case_chat(req=req, current_user=current_user, db=db)

@cases_router.get("", response_model=List[CaseOut])
def list_cases(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role in ("admin", "officer"):
        cases = db.query(Case).order_by(Case.created_at.desc()).all()
    else:
        cases = db.query(Case).filter(Case.created_by == current_user.id).all()
    return cases


@cases_router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@cases_router.post("/{case_id}/events", response_model=CaseEventOut, status_code=status.HTTP_201_CREATED)
def add_case_event(
    case_id: str,
    req: CaseEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    event = CaseEvent(
        case_id=case_id,
        project_id=case.project_id,
        event_type=req.event_type,
        description=req.description,
        actor_id=current_user.id,
        metadata=req.metadata,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def _get_finding_or_404(db: Session, finding_id: str) -> Finding:
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return finding
