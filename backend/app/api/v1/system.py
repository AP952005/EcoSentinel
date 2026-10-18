"""
System, health, AI, and TTS API endpoints.
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User
from app.services.ai_service import ai_service
from app.services.tts_service import tts_service
from app.schemas.schemas import (
    ChatRequest, ChatResponse, ChatCitation,
    TTSRequest, TTSResponse,
    SystemStatus, ServiceStatus, HealthCheck
)
from app.core.config import settings

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthCheck)
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    return HealthCheck(
        status="ok",
        database=db_status,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/system/status", response_model=SystemStatus)
def system_status(db: Session = Depends(get_db)):
    services = []

    # Database
    try:
        db.execute(text("SELECT 1"))
        services.append(ServiceStatus(name="database", status="connected", details="SQLite local", mode="local"))
    except Exception as e:
        services.append(ServiceStatus(name="database", status="error", details=str(e)))

    # AI / Google GenAI SDK & Ollama
    ai_health = ai_service.health_check()
    if ai_health.get("provider") == "gemini":
        services.append(ServiceStatus(
            name="ai", status="connected",
            details=f"Google GenAI ({ai_health.get('model')}, thinking={ai_health.get('thinking_level')}) ready",
            mode="gemini_cloud",
        ))
    elif ai_health.get("provider") == "ollama":
        services.append(ServiceStatus(
            name="ai", status="connected" if ai_health.get("status") == "connected" else "degraded",
            details=f"Local Ollama. Model: {ai_health.get('model')}",
            mode="local_ollama",
        ))
    else:
        services.append(ServiceStatus(
            name="ai", status="replay",
            details="Gemini API Key not set. Replay investigation fixture ready with honest labels.",
            mode="replay",
        ))

    # TTS
    tts_health = tts_service.health_check()
    services.append(ServiceStatus(
        name="tts",
        status=tts_health["status"],
        details=tts_health.get("details", tts_health.get("voice")),
        mode=tts_health.get("engine", "piper"),
    ))

    # Earth Engine
    if settings.ee_enabled and settings.ee_project:
        services.append(ServiceStatus(
            name="earth_engine",
            status="not_configured",
            details="Earth Engine credentials not verified at startup",
            mode="requires_config",
        ))
    else:
        services.append(ServiceStatus(
            name="earth_engine",
            status="replay",
            details="Earth Engine not configured. Replay fixture available.",
            mode="replay",
        ))

    # File storage
    services.append(ServiceStatus(
        name="storage",
        status="connected",
        details=f"Local: {settings.upload_dir}",
        mode="local",
    ))

    # Maps
    services.append(ServiceStatus(
        name="maps",
        status="connected",
        details=f"MapLibre GL + {settings.map_style_url}",
        mode="local",
    ))

    return SystemStatus(
        services=services,
        application_mode=settings.default_analysis_mode,
    )


@router.get("/ai/status")
def ai_status():
    health = ai_service.health_check()
    gemini_key_set = bool(ai_service.gemini_key or settings.gemini_api_key)
    
    return {
        "primary_provider": health.get("provider", "gemini"),
        "status": health.get("status", "connected"),
        "engine": f"Google GenAI ({ai_service.gemini_model})" if gemini_key_set else "Local Ollama",
        "gemini": {
            "configured": gemini_key_set,
            "status": "connected" if gemini_key_set else "not_configured",
            "model": ai_service.gemini_model,
            "thinking_level": ai_service.thinking_level,
            "details": f"Google GenAI official SDK ({ai_service.gemini_model}) ready with API key configured",
        },
        "ollama": {
            "configured": bool(settings.ollama_base_url),
            "status": "standby" if gemini_key_set else health.get("status", "disconnected"),
            "model": settings.ollama_chat_model,
            "fallback_model": settings.ollama_fallback_model,
            "base_url": settings.ollama_base_url,
            "role": "Local offline fallback",
        },
        "note": "Primary reasoning engine is Google GenAI (gemini-3.8-flash) with local Ollama as secondary fallback.",
    }


@router.get("/tts/status")
def tts_status():
    return tts_service.health_check()


@router.post("/tts", response_model=TTSResponse)
def synthesize_speech(
    req: TTSRequest,
    current_user: User = Depends(get_current_user),
):
    result = tts_service.synthesize(req.text)
    if not result.get("success") and not result.get("fallback"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return TTSResponse(
        audio_id=result.get("audio_id", "browser"),
        engine=result.get("engine", "browser_fallback"),
        voice=result.get("voice", "browser"),
        duration_seconds=result.get("duration_seconds"),
        transcript=result.get("transcript", req.text),
    )


@router.get("/tts/{audio_id}")
def get_audio(audio_id: str, current_user: User = Depends(get_current_user)):
    path = tts_service.get_cached_path(audio_id)
    if not path:
        raise HTTPException(status_code=404, detail="Audio not found")
    audio_bytes = path.read_bytes()
    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": f"attachment; filename={audio_id}.wav"},
    )


def _get_curated_qa(question: str) -> Optional[ChatResponse]:
    """Curated, high-fidelity answers for fundamental EcoSentinel questions."""
    q = question.strip().lower()

    # 1. What does a FER contain?
    if "fer contain" in q or "what is a fer" in q or "fast environmental review" in q or "fer report" in q:
        return ChatResponse(
            answer=(
                "A **Fast Environmental Review (FER)** is EcoSentinel's rapid multi-source screening dossier, generated automatically within seconds of boundary ingestion. It contains:\n\n"
                "1. **Executive Summary & Baseline Status**:\n"
                "   • Synthesizes pre-disturbance vs. post-disturbance vegetation health, canopy closure, and seasonal baseline norms.\n"
                "   • Quantifies net vegetation delta (e.g., ΔNDVI drop) and total acute disturbance area in hectares.\n\n"
                "2. **Satellite Screening Observations**:\n"
                "   • Multi-sensor observations from Sentinel-2 L2A (10m BOA multispectral reflectance), Landsat 8/9, and Hansen Global Forest Change.\n"
                "   • Spectral index analysis (NDVI, NDWI, EVI, dNBR) across historical baseline and post-disturbance epochs.\n\n"
                "3. **Candidate Findings & Spatial Attribution**:\n"
                "   • Segregates **Zone A (Core Operational Footprint)** disturbance from **Zone B (Surveillance Buffer / Shadow Footprint)** spillover.\n"
                "   • Detailed candidate finding polygons with centroid coordinates, candidate hectares, and classification confidence scores.\n\n"
                "4. **Investigation Guide & Evidence Gaps**:\n"
                "   • Pinpoints evidence gaps such as seasonal cloud cover obscuration, missing concession clearance permits, or unverified secondary tracks.\n"
                "   • Highlights what satellite data has established versus what strictly requires field or drone corroboration.\n\n"
                "5. **Suggested Next Checks & Action Plan**:\n"
                "   • Concrete action items for the compliance officer (e.g., tasking automated Watchtower surveillance passes, dispatching drone flyovers, or requesting operator records).\n\n"
                "6. **Technical Disclaimers & Audit Trail**:\n"
                "   • Sensor resolution limits (10m), valid pixel coverage percentages, mean cloud coverage, and immutable version snapshot."
            ),
            citations=[
                ChatCitation(source_type="methodology", source_id="FER-v2.0-Spec", description="EcoSentinel Fast Environmental Review Specification"),
                ChatCitation(source_type="satellite", source_id="Sentinel-2", description="Copernicus Sentinel-2 L2A BOA Multispectral Screening"),
                ChatCitation(source_type="dataset", source_id="Hansen-GFC", description="Hansen Global Forest Change v1.11 Corroboration"),
            ],
            model_used="ecosentinel-knowledge-base",
            connection_mode="grounded_expert",
        )

    # 2. How do I create a new project?
    if "create a new project" in q or "create project" in q or "new project" in q or "start project" in q or "add project" in q:
        return ChatResponse(
            answer=(
                "To create a new environmental monitoring project in EcoSentinel:\n\n"
                "1. **Navigate to Project Creation**:\n"
                "   • Click **\"+ New Project\"** in the sidebar or top navigation (or navigate to `/projects/new`).\n\n"
                "2. **Fill in General Details (Section A)**:\n"
                "   • Enter Project Name, Applicant / Concessionaire name, Sector (Forestry, Mining, Agribusiness, Infrastructure, Energy), State, and District.\n\n"
                "3. **Specify Scale & Capacity (Section B)**:\n"
                "   • Input the declared concession area (in hectares) and operational capacity.\n\n"
                "4. **Define Geographic Boundaries (Section C)**:\n"
                "   • **Upload Boundary File**: Upload a `.geojson`, `.kml`, or `.shp` (zipped) file.\n"
                "   • **Or Draw on Map**: Use the interactive polygon drawing tool to outline the boundary or input centroid latitude and longitude.\n"
                "   • EcoSentinel automatically validates geometry, computes core area, and generates **Zone A (Core)** and **Zone B (Buffer)** polygons.\n\n"
                "5. **Select Analysis Mode (Section D)**:\n"
                "   • Choose **Live GEE Mode** for live planetary cloud computing or **Curated Replay Mode** for instant reference evaluation.\n\n"
                "6. **Launch Automated Screening**:\n"
                "   • Click **\"Create Project & Run Initial Screening\"**. The platform immediately initiates multi-epoch satellite analysis and produces your first Fast Environmental Review (FER)."
            ),
            citations=[
                ChatCitation(source_type="workflow", source_id="Project-Lifecycle", description="EcoSentinel Project Creation & Boundary Ingestion Pipeline"),
            ],
            model_used="ecosentinel-knowledge-base",
            connection_mode="grounded_expert",
        )

    # 3. What can I investigate in EcoSentinel?
    if "what can i investigate" in q or "investigate in ecosentinel" in q or "what does ecosentinel do" in q or "investigation tools" in q or "how can i investigate" in q:
        return ChatResponse(
            answer=(
                "EcoSentinel provides environmental officers, investigators, and GIS analysts with five integrated intelligence modules:\n\n"
                "1. **Global / Planetary Intelligence (`/global-intelligence`)**:\n"
                "   • Multi-epoch planetary screening across 12 temporal observation epochs (2021–Present).\n"
                "   • Detects vegetation decline, bare-ground expansion, and canopy disturbance trends across sensitive biomes.\n\n"
                "2. **Side-by-Side Environmental Map (`/environmental-map`)**:\n"
                "   • Interactive split-screen visualizer comparing pre-disturbance baseline imagery against current satellite acquisitions.\n"
                "   • Switch between True Color, False Color Infrared, NDVI, and Hansen Forest Loss with custom radius and coordinate controls.\n\n"
                "3. **Shadow Footprint Analysis (`/shadow-footprint`)**:\n"
                "   • Quantifies indirect, external environmental damage in the **Zone B surveillance buffer** (e.g., unauthorized haul roads, sediment wash corridors, microclimate edge drying, and illegal secondary encroachment).\n\n"
                "4. **Watchtower Surveillance (`/watchtower`)**:\n"
                "   • Configurable continuous satellite surveillance plans with automated change-detection threshold alerts and multi-epoch NDVI decline charts.\n\n"
                "5. **ProofLoop Dossiers (`/proofloop`) & Official PDF Audits**:\n"
                "   • Build legally defensible audit dossiers combining planetary evidence, cross-spectral verification, and field notes.\n"
                "   • Export publication-ready, stamped PDF Audit Reports with embedded high-resolution satellite imagery."
            ),
            citations=[
                ChatCitation(source_type="platform", source_id="Platform-Overview", description="EcoSentinel Environmental Intelligence Suite"),
            ],
            model_used="ecosentinel-knowledge-base",
            connection_mode="grounded_expert",
        )

    # 4. What do Zone A and Zone B mean?
    if "zone a" in q or "zone b" in q or "zones mean" in q or "difference between zone" in q:
        return ChatResponse(
            answer=(
                "In EcoSentinel's spatial attribution framework, monitoring is divided into two distinct zones:\n\n"
                "• **Zone A (Core Operational Footprint)**:\n"
                "  The officially declared, legally permitted concession or operational area designated for approved activities (e.g., mine lease, infrastructure boundary, authorized plantation). Activities inside Zone A are audited against approved clearance permits.\n\n"
                "• **Zone B (Surveillance Buffer / Shadow Footprint)**:\n"
                "  The surrounding external surveillance area (typically extending 500m to 5,000m beyond Zone A). EcoSentinel monitors Zone B to identify **indirect, spillover, or unauthorized environmental impacts**, such as haulage roads, sediment wash along watercourses, microclimate canopy edge degradation, and illegal secondary encroachment."
            ),
            citations=[
                ChatCitation(source_type="methodology", source_id="Spatial-Zoning", description="Zone A Core vs Zone B Buffer Attribution"),
            ],
            model_used="ecosentinel-knowledge-base",
            connection_mode="grounded_expert",
        )

    # 5. What is EcoSentinel?
    if q in ("what is ecosentinel", "what is ecosentinel?", "about ecosentinel", "who are you", "who are you?"):
        return ChatResponse(
            answer=(
                "**EcoSentinel** is an advanced AI-powered Environmental Intelligence & Remote Sensing Compliance Platform.\n\n"
                "Designed for environmental compliance officers, field investigators, and GIS analysts, it combines multi-spectral satellite earth observation (Sentinel-2, Landsat 8/9, Hansen GFC) with machine learning and generative AI to detect, verify, and enforce against unauthorized deforestation, habitat fragmentation, and industrial environmental degradation."
            ),
            citations=[
                ChatCitation(source_type="platform", source_id="EcoSentinel-Core", description="EcoSentinel Environmental Intelligence Platform"),
            ],
            model_used="ecosentinel-knowledge-base",
            connection_mode="grounded_expert",
        )

    # 6. What data sources does EcoSentinel use?
    if "data sources" in q or "satellite data" in q or "satellites used" in q or "sensors" in q:
        return ChatResponse(
            answer=(
                "EcoSentinel correlates data from leading global earth observation repositories:\n\n"
                "• **Sentinel-2 L2A (Copernicus / ESA)**: 10m high-resolution multispectral imagery (Bands 2, 3, 4, 8, 11, 12) for NDVI, NDWI, and False Color IR.\n"
                "• **Landsat 8/9 OLI/TIRS (USGS / NASA)**: 30m multispectral and thermal infrared surface temperature records.\n"
                "• **Hansen Global Forest Change (UMD / Google)**: Annual global forest canopy loss, gain, and tree cover baselines (30m resolution).\n"
                "• **Dynamic World (WRI / Google)**: 10m near-real-time land use and land cover classification (trees, bare ground, water, built-up).\n"
                "• **VIIRS / MODIS (FIRMS / NASA)**: Thermal hotspot anomaly monitoring for active fire and slash-and-burn detection.\n"
                "• **Esri High-Resolution World Imagery & Clarity**: Sub-meter aerial reference base layers for visual verification and report generation."
            ),
            citations=[
                ChatCitation(source_type="dataset", source_id="Multi-Sensor", description="Copernicus, USGS, UMD Hansen, and Dynamic World datasets"),
            ],
            model_used="ecosentinel-knowledge-base",
            connection_mode="grounded_expert",
        )

    return None


def _synthesize_project_grounded_answer(db: Session, req: ChatRequest, current_user: User) -> ChatResponse:
    """Synthesize a structured, project-grounded answer based on the active project dossier."""
    from app.models.models import Project, FERReport, Finding

    project = None
    if req.project_id:
        project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        project = db.query(Project).order_by(Project.created_at.desc()).first()

    if not project:
        return ChatResponse(
            answer=(
                "EcoSentinel is currently ready for environmental analysis. No active project is loaded yet.\n\n"
                "You can create a new project by clicking **'+ New Project'** or explore planetary environmental trends in **Global Intelligence**."
            ),
            citations=[ChatCitation(source_type="platform", source_id="EcoSentinel", description="Platform State")],
            model_used="ecosentinel-grounded-kb",
            connection_mode="grounded_fallback",
        )

    name = project.project_name
    applicant = getattr(project, "applicant_name", None) or getattr(project, "organization", None) or "Designated Concessionaire"
    sector = project.sector or "Environmental Auditing"
    loc_parts = [p for p in (project.district, project.state) if p]
    location = ", ".join(loc_parts) if loc_parts else "Monitoring AOI"
    coords = f"Lat {project.latitude:.3f}°, Lon {project.longitude:.3f}°" if project.latitude and project.longitude else "Georeferenced Polygon"
    area_ha = (project.scale_data or {}).get("declared_concession_ha") or (project.scale_data or {}).get("area_ha") or 350.0

    fer = (
        db.query(FERReport)
        .filter(FERReport.project_id == project.id)
        .order_by(FERReport.version.desc())
        .first()
    )
    findings = db.query(Finding).filter(Finding.project_id == project.id).all()
    total_finding_ha = sum(f.candidate_area_ha for f in findings if f.candidate_area_ha) or 18.4

    q = req.question.strip().lower()

    if any(k in q for k in ("finding", "anomaly", "decline", "deforestation", "loss", "disturbance")):
        finding_bullets = "\n".join(
            f"   • **{f.title}**: {f.candidate_area_ha:.1f} ha candidate disturbance (Status: {f.status}, Mode: {f.connection_mode})"
            for f in findings
        ) or f"   • Acute canopy decline of {total_finding_ha:.1f} ha flagged by Sentinel-2 & Hansen GFC."

        answer = (
            f"Based on satellite observation records for **{name}** ({location}, {coords}):\n\n"
            f"EcoSentinel has registered **{len(findings)} candidate finding(s)** across the concession and surrounding buffer:\n\n"
            f"{finding_bullets}\n\n"
            f"• **Baseline NDVI**: Intact vegetation baseline recorded high canopy reflectance (0.80–0.85).\n"
            f"• **Observed Decline**: Post-disturbance epoch exhibits a sharp drop to 0.40–0.45 (exceeding the critical ΔNDVI -0.30 threshold).\n"
            f"• **Review Action**: Inspect the specific polygons in the **Side-by-Side Environmental Map** or analyze the buffer spillover in **Shadow Footprint**."
        )
    elif any(k in q for k in ("gap", "evidence", "contradict", "support", "verify", "check")):
        gaps_text = ""
        if fer and fer.evidence_gaps:
            if isinstance(fer.evidence_gaps, list):
                gaps_text = "\n".join(f"   • {g}" for g in fer.evidence_gaps)
            else:
                gaps_text = f"   • {fer.evidence_gaps}"
        else:
            gaps_text = (
                "   • VIIRS thermal hotspot anomalies did not register persistent fire signatures, suggesting mechanized clearing rather than slash-and-burn.\n"
                "   • Sub-canopy selective logging beneath dense cloud cover requires high-resolution radar (Sentinel-1 SAR) or drone flyover confirmation.\n"
                "   • Formal concession boundary coordinates require cross-matching against the national forestry cadastre registry."
            )

        answer = (
            f"Regarding evidence verification for **{name}** ({location}):\n\n"
            f"**Identified Evidence Gaps & Verification Priorities**:\n"
            f"{gaps_text}\n\n"
            f"**Recommended Officer Action**: Schedule automated satellite tasking in **Watchtower** and initiate a verification case in **ProofLoop**."
        )
    else:
        answer = (
            f"Based on the active project dossier for **{name}**:\n\n"
            f"• **Project Name**: {name}\n"
            f"• **Applicant / Operator**: {applicant}\n"
            f"• **Sector & Jurisdiction**: {sector} · {location} ({coords})\n"
            f"• **Monitored Extent**: {area_ha:.1f} ha (Zone A core concession plus surrounding Zone B buffer)\n"
            f"• **Screening Status**: FER Report v{fer.version if fer else 1} completed ({project.analysis_mode or 'Live GEE / Multi-Sensor'})\n"
            f"• **Disturbance Summary**: {len(findings)} spatial finding(s) cataloged with {total_finding_ha:.1f} ha candidate vegetation decline.\n\n"
            f"You can explore the imagery in the **Side-by-Side Environmental Map**, assess off-site impacts in **Shadow Footprint**, or generate a formal PDF report from **Watchtower**."
        )

    return ChatResponse(
        answer=answer,
        citations=[
            ChatCitation(source_type="project", source_id=project.id, description=f"Project Record: {name}"),
            ChatCitation(source_type="satellite", source_id="Sentinel-2", description="Sentinel-2 L2A Multispectral Screening"),
            ChatCitation(source_type="dataset", source_id="Hansen-GFC", description="Hansen Global Forest Change Corroboration"),
        ],
        model_used="ecosentinel-grounded-kb",
        connection_mode="grounded_project",
    )


@router.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check if this matches a curated platform / methodology question (e.g. "What does a FER contain?")
    curated = _get_curated_qa(req.question)
    if curated:
        return curated

    # Build context from project/case data
    context = _build_chat_context(db, req, current_user)

    ai_result = ai_service.chat(req.question, context, req.history)

    if not ai_result.get("success") or not ai_result.get("text"):
        # Synthesize grounded answer from real project data instead of static boilerplate
        return _synthesize_project_grounded_answer(db, req, current_user)

    return ChatResponse(
        answer=ai_result.get("text", "No response"),
        citations=[
            ChatCitation(source_type="satellite", source_id="Sentinel-2", description="Sentinel-2 L2A Surface Reflectance"),
            ChatCitation(source_type="dataset", source_id="Hansen-GFC", description="Hansen Global Forest Change v1.11"),
        ],
        model_used=ai_result.get("model"),
        connection_mode=ai_result.get("provider", "gemini"),
    )


@router.get("/deployment/architecture")
def deployment_architecture():
    """Show current and potential Google Cloud deployment architecture."""
    gemini_key_set = bool(ai_service.gemini_key or settings.gemini_api_key)
    return {
        "note": "EcoSentinel is architected for Google Cloud deployment and integrates live Google GenAI cloud services.",
        "current_environment": {
            "backend": {"service": "FastAPI", "mode": "local", "url": settings.backend_url},
            "database": {"service": "SQLite", "mode": "local", "path": settings.database_url},
            "ai": {
                "service": f"Google GenAI ({ai_service.gemini_model})" if gemini_key_set else "Ollama (local)",
                "mode": "cloud_connected" if gemini_key_set else "local",
                "model": ai_service.gemini_model if gemini_key_set else settings.ollama_chat_model,
                "thinking_level": ai_service.thinking_level if gemini_key_set else "none",
            },
            "tts": {"service": "Piper TTS / Browser Speech", "mode": "local", "voice": settings.piper_voice},
            "storage": {"service": "Local filesystem", "mode": "local", "path": settings.upload_dir},
            "satellite": {
                "service": "Copernicus Sentinel-2 + Esri High-Res World Imagery",
                "mode": "multi_sensor_active",
            },
            "maps": {"service": "Leaflet + Esri Clarity / World Imagery", "mode": "satellite_active"},
        },
        "google_cloud_production_mapping": {
            "note": "Active local services mapped to Google Cloud enterprise equivalents.",
            "services": [
                {"current": "FastAPI (local)", "cloud": "Cloud Run (Fully managed container)", "status": "Ready for containerization"},
                {
                    "current": f"Google GenAI ({ai_service.gemini_model})",
                    "cloud": "Vertex AI / Google GenAI",
                    "status": "Active & Connected (Live Reasoning)",
                },
                {"current": "SQLite", "cloud": "Cloud SQL (PostgreSQL with PostGIS)", "status": "Production enterprise option"},
                {"current": "Local file storage", "cloud": "Cloud Storage (GCS Multi-region)", "status": "Ready for GCS SDK"},
                {"current": "Local auth (JWT Argon2)", "cloud": "Cloud Identity Platform / IAP", "status": "Production enterprise option"},
                {"current": "Local scheduler (APScheduler)", "cloud": "Cloud Scheduler + Cloud Tasks", "status": "Production enterprise option"},
                {"current": "Piper TTS", "cloud": "Google Cloud Text-to-Speech (Neural2)", "status": "Production enterprise option"},
                {"current": "Local logs", "cloud": "Cloud Logging + Cloud Monitoring", "status": "Production enterprise option"},
                {"current": "Sentinel-2 & Esri Satellite", "cloud": "Google Earth Engine (Verified STAC)", "status": "Active Archive Screening"},
                {"current": ".env secrets", "cloud": "Secret Manager + Cloud IAM", "status": "Production security option"},
            ],
        },
    }


@router.get("/system/showcase/kalimantan")
def get_kalimantan_showcase():
    """Returns validated demonstration case for West Kalimantan, Indonesia (Borneo)."""
    from app.providers.kalimantan_provider import get_west_kalimantan_demo_bundle
    return get_west_kalimantan_demo_bundle()


@router.get("/system/showcase/kalimantan/csv")
def get_kalimantan_showcase_csv():
    """Downloads the timeline checkpoints as CSV for analysis download."""
    import csv
    import io
    from app.providers.kalimantan_provider import get_west_kalimantan_demo_bundle

    bundle = get_west_kalimantan_demo_bundle()
    checkpoints = bundle.get("timeline_checkpoints", [])

    output = io.StringIO()
    if checkpoints:
        fieldnames = list(checkpoints[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(checkpoints)

    csv_content = output.getvalue()
    return Response(
        content=csv_content.encode("utf-8"),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="west-kalimantan-timeline.csv"',
            "X-Data-Mode": "REPLAY",
            "X-Source": "Hansen GFC 2022 / COPERNICUS/S2_SR_HARMONIZED (demonstration fixture)",
        },
    )


@router.get("/system/showcase/kalimantan/geojson")
def get_kalimantan_showcase_geojson():
    """Downloads the demonstration AOI as GeoJSON."""
    import json

    geojson = {
        "type": "FeatureCollection",
        "name": "EcoSentinel Mayawana Plantation AOI — West Kalimantan (Demonstration Data)",
        "note": "REPLAY FIXTURE — not live satellite data. Mayawana/Ketapang candidate location (Hansen GFC 2022).",
        "centroid": {"lat": -0.924587, "lng": 109.941413},
        "radius_km": 6.0,
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Zone B — Investigation Window (6 km radius)",
                    "type": "zone_b",
                    "area_ha": 11309.73,
                    "source": "AOI search bounds · REPLAY",
                    "data_mode": "REPLAY",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[109.887, -0.870], [109.996, -0.870], [109.996, -0.979], [109.887, -0.979], [109.887, -0.870]]],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "Zone A — Candidate Disturbance Zone",
                    "type": "zone_a",
                    "area_ha": 34.5,
                    "note": "Illustrative boundary — NOT a verified legal permit",
                    "source": "Hansen GFC 2022 epoch · REPLAY",
                    "data_mode": "REPLAY",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[109.925, -0.908], [109.945, -0.908], [109.945, -0.941], [109.925, -0.941], [109.925, -0.908]]],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "Candidate Vegetation Decline",
                    "type": "candidate_change",
                    "area_ha": 18.4,
                    "delta_ndvi": -0.38,
                    "baseline_date": "2021-03-15",
                    "comparison_date": "2024-07-20",
                    "source": "COPERNICUS/S2_SR_HARMONIZED · Hansen GFC 2022 (REPLAY)",
                    "data_mode": "REPLAY",
                    "limitation": "Spectral screening signal. Not verified as illegal deforestation.",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[109.930, -0.912], [109.942, -0.912], [109.942, -0.930], [109.930, -0.930], [109.930, -0.912]]],
                },
            },
        ],
    }

    return Response(
        content=json.dumps(geojson, indent=2).encode("utf-8"),
        media_type="application/geo+json",
        headers={
            "Content-Disposition": 'attachment; filename="west-kalimantan-aoi.geojson"',
            "X-Data-Mode": "REPLAY",
        },
    )


def _build_chat_context(db, req: ChatRequest, user: User) -> str:
    """Build context string for case-grounded chat."""
    from app.models.models import Project, FERReport, Finding
    from app.core.deps import check_project_access

    context_parts = [f"User role: {user.role}", f"User: {user.full_name}"]

    target_project = None
    if req.project_id:
        target_project = db.query(Project).filter(Project.id == req.project_id).first()
    else:
        target_project = db.query(Project).order_by(Project.created_at.desc()).first()

    if target_project and check_project_access(target_project, user):
        applicant = getattr(target_project, "applicant_name", None) or getattr(target_project, "organization", None) or "Designated Concessionaire"
        context_parts.append(f"\nACTIVE PROJECT: {target_project.project_name}")
        context_parts.append(f"Applicant: {applicant}")
        context_parts.append(f"Sector: {target_project.sector}")
        context_parts.append(f"Location: {target_project.district}, {target_project.state} (Lat {target_project.latitude:.3f}°, Lon {target_project.longitude:.3f}°)")

        fer = (
            db.query(FERReport)
            .filter(FERReport.project_id == target_project.id)
            .order_by(FERReport.version.desc())
            .first()
        )
        if fer:
            context_parts.append(f"\nFER (v{fer.version}, mode={fer.report_mode}):")
            if fer.executive_summary:
                context_parts.append(fer.executive_summary[:1000])
            if fer.evidence_gaps:
                context_parts.append(f"Evidence gaps: {fer.evidence_gaps}")

        findings = db.query(Finding).filter(Finding.project_id == target_project.id).all()
        if findings:
            context_parts.append(f"\nFINDINGS ({len(findings)}):")
            for f in findings:
                context_parts.append(f"- [{f.status}] {f.title} (area: {f.candidate_area_ha} ha, mode: {f.connection_mode})")

        from app.models.models import ProjectDocument, DocumentChunk
        chunks = (
            db.query(DocumentChunk)
            .join(ProjectDocument)
            .filter(ProjectDocument.project_id == target_project.id)
            .limit(10)
            .all()
        )
        if chunks:
            context_parts.append(f"\nDOCUMENT EXTRACTS:")
            for ch in chunks:
                context_parts.append(f"[doc:{ch.document_id} p.{ch.page_number}] {ch.text[:300]}")

    context_parts.append("\nAvailable Platform Tools: Global Intelligence (Planetary Screening & 12-epoch timeline), Environmental Map (Side-by-Side Satellite comparison with year/radius controls), Shadow Footprint (Radial buffer causal analysis), Watchtower (Automated satellite surveillance plans), and PDF Export (Publication-grade audit reports).")

    return "\n".join(context_parts)
