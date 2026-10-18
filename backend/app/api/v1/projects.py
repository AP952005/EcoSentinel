"""
Projects and FER API endpoints.
"""
import os
import hashlib
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, check_project_access
from app.models.models import Project, ProjectDocument, FERReport, Boundary, CaseEvent, User
from app.schemas.schemas import (
    ProjectCreate, ProjectOut, ProjectDetail, BoundaryCreate, BoundaryOut, FEROut
)
from app.services.fer_service import fer_service
from app.services.geo_service import geo_service
from app.core.config import settings

router = APIRouter(prefix="/projects", tags=["projects"])

ALLOWED_DOC_TYPES = {
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.google-earth.kml+xml",
    "application/json", "text/plain",
    "image/jpeg", "image/png",
}
MAX_FILE_SIZE_MB = 50


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    req: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(
        owner_id=current_user.id,
        **req.model_dump(exclude={"scale_data"}),
        scale_data=req.scale_data.model_dump() if req.scale_data else None,
        status="active",
    )
    db.add(project)
    db.flush()
    db.add(CaseEvent(
        project_id=project.id,
        event_type="project_created",
        description=f"Project created: {project.project_name}",
        actor_id=current_user.id,
    ))
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=List[ProjectOut])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role in ("admin", "officer"):
        all_projects = db.query(Project).order_by(Project.created_at.desc()).all()
    else:
        all_projects = (
            db.query(Project)
            .filter(
                (Project.owner_id == current_user.id) |
                (Project.id == "demo-mayawana-ketapang-west-kalimantan-002") |
                (Project.project_name.like("%Mayawana%"))
            )
            .order_by(Project.created_at.desc())
            .all()
        )
    # Ensure Mayawana reference project appears at the top if present
    mayawana = [p for p in all_projects if "Mayawana" in p.project_name or p.id == "demo-mayawana-ketapang-west-kalimantan-002"]
    others = [p for p in all_projects if p not in mayawana]
    return mayawana + others


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return project


@router.patch("/{project_id}", response_model=ProjectDetail)
def update_project(
    project_id: str,
    req: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    if not check_project_access(project, current_user, require_write=True):
        raise HTTPException(status_code=403, detail="Access denied")
    for k, v in req.model_dump(exclude={"scale_data"}, exclude_unset=True).items():
        setattr(project, k, v)
    if req.scale_data:
        project.scale_data = req.scale_data.model_dump()
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/documents")
async def upload_document(
    project_id: str,
    document_type: str = "other",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    if not check_project_access(project, current_user, require_write=True):
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate mime type
    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {file.content_type}")

    # Read and check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_FILE_SIZE_MB}MB)")

    # Safe filename
    safe_name = Path(file.filename).name
    safe_name = "".join(c for c in safe_name if c.isalnum() or c in "._-")[:200]
    file_hash = hashlib.sha256(content).hexdigest()

    # Store file
    upload_path = Path(settings.upload_dir) / project_id
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / f"{file_hash[:16]}_{safe_name}"
    file_path.write_bytes(content)

    doc = ProjectDocument(
        project_id=project_id,
        filename=file_path.name,
        original_filename=safe_name,
        document_type=document_type,
        file_path=str(file_path),
        file_size_bytes=len(content),
        mime_type=file.content_type,
        file_hash=file_hash,
        extraction_status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "filename": doc.original_filename, "status": "uploaded"}


@router.post("/{project_id}/boundaries", response_model=BoundaryOut, status_code=status.HTTP_201_CREATED)
def add_boundary(
    project_id: str,
    req: BoundaryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    if not check_project_access(project, current_user, require_write=True):
        raise HTTPException(status_code=403, detail="Access denied")

    boundary = geo_service.process_boundary(
        db, project_id, req.zone_type, req.geometry_geojson,
        source=req.source, buffer_distance_m=req.buffer_distance_m
    )
    boundary.notes = req.notes
    db.add(boundary)
    db.commit()
    db.refresh(boundary)
    return boundary


@router.get("/{project_id}/boundaries", response_model=List[BoundaryOut])
def list_boundaries(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Boundary).filter(Boundary.project_id == project_id).all()


@router.post("/{project_id}/generate-fer", response_model=FEROut, status_code=status.HTTP_201_CREATED)
def generate_fer(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        fer = fer_service.generate_fer(db, project, current_user.id)
        return fer
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FER generation failed: {str(e)}")


@router.get("/{project_id}/fer", response_model=List[FEROut])
def list_fers(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(db, project_id)
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return (
        db.query(FERReport)
        .filter(FERReport.project_id == project_id)
        .order_by(FERReport.version.desc())
        .all()
    )


@router.get("/{project_id}/findings")
def list_findings(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.models import Finding
    from app.schemas.schemas import FindingOut
    project = _get_project_or_404(db, project_id)
    if not check_project_access(project, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    findings = db.query(Finding).filter(Finding.project_id == project_id).all()
    return [FindingOut.model_validate(f) for f in findings]


def _get_project_or_404(db: Session, project_id: str) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
