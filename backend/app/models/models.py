"""
EcoSentinel SQLAlchemy Models
All entities required for the full EcoSentinel workflow.
"""
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Integer, JSON, String, Text, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship, mapped_column, Mapped
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def gen_uuid():
    return str(uuid.uuid4())


# ─── Users & Auth ─────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(512), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("admin", "officer", "applicant", "viewer", name="user_role"),
        nullable=False, default="applicant"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_first_login: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    organization: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Login rate limiting
    login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    login_locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    tour_progress = relationship("TourProgress", back_populates="user", uselist=False, cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="owner")
    audit_events = relationship("AuditEvent", back_populates="user")


class UserSession(Base):
    __tablename__ = "user_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    invalidated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(512))
    user = relationship("User", back_populates="sessions")


class TourProgress(Base):
    __tablename__ = "tour_progress"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    user = relationship("User", back_populates="tour_progress")


# ─── Projects ─────────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    # Section A
    application_stage: Mapped[Optional[str]] = mapped_column(String(100))
    project_category: Mapped[Optional[str]] = mapped_column(String(100))
    proposal_number: Mapped[Optional[str]] = mapped_column(String(255))
    has_prior_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    prior_approval_reference: Mapped[Optional[str]] = mapped_column(String(500))

    # Section B
    project_name: Mapped[str] = mapped_column(String(500), nullable=False)
    applicant_name: Mapped[str] = mapped_column(String(500), nullable=False)
    organization: Mapped[Optional[str]] = mapped_column(String(500))
    sector: Mapped[str] = mapped_column(String(100), nullable=False)
    activity: Mapped[Optional[str]] = mapped_column(String(200))
    eia_category: Mapped[Optional[str]] = mapped_column(String(100))
    project_summary: Mapped[Optional[str]] = mapped_column(Text)

    # Section C - Scale (flexible JSON)
    scale_data: Mapped[Optional[dict]] = mapped_column(JSON)

    # Section D - Location
    country: Mapped[str] = mapped_column(String(100), default="India")
    state: Mapped[Optional[str]] = mapped_column(String(100))
    district: Mapped[Optional[str]] = mapped_column(String(100))
    sub_district: Mapped[Optional[str]] = mapped_column(String(100))
    village: Mapped[Optional[str]] = mapped_column(String(200))
    survey_details: Mapped[Optional[str]] = mapped_column(Text)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    location_description: Mapped[Optional[str]] = mapped_column(Text)

    # Section F - Parameters (sector-specific JSON)
    parameters: Mapped[Optional[dict]] = mapped_column(JSON)

    # Section G - Approvals
    previous_approvals: Mapped[Optional[dict]] = mapped_column(JSON)

    # Status
    status: Mapped[str] = mapped_column(String(50), default="draft")
    analysis_mode: Mapped[str] = mapped_column(String(20), default="REPLAY")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    owner = relationship("User", back_populates="projects")
    documents = relationship("ProjectDocument", back_populates="project", cascade="all, delete-orphan")
    boundaries = relationship("Boundary", back_populates="project", cascade="all, delete-orphan")
    fer_reports = relationship("FERReport", back_populates="project", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="project", cascade="all, delete-orphan")
    watch_plans = relationship("WatchPlan", back_populates="project", cascade="all, delete-orphan")
    cases = relationship("Case", back_populates="project", cascade="all, delete-orphan")
    analysis_runs = relationship("AnalysisRun", back_populates="project", cascade="all, delete-orphan")
    case_events = relationship("CaseEvent", back_populates="project")


class ProjectDocument(Base):
    __tablename__ = "project_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    document_type: Mapped[str] = mapped_column(String(100), default="other")
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    mime_type: Mapped[str] = mapped_column(String(100), default="application/octet-stream")
    file_hash: Mapped[Optional[str]] = mapped_column(String(128))
    extraction_status: Mapped[str] = mapped_column(String(50), default="pending")
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project = relationship("Project", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    document_id: Mapped[str] = mapped_column(ForeignKey("project_documents.id"), nullable=False, index=True)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    extraction_warnings: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    document = relationship("ProjectDocument", back_populates="chunks")


# ─── Geography ────────────────────────────────────────────────────────────────

class Boundary(Base):
    __tablename__ = "boundaries"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    zone_type: Mapped[str] = mapped_column(String(10), nullable=False)  # A, B, candidate
    geometry_geojson: Mapped[Optional[dict]] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(100), default="uploaded")
    status: Mapped[str] = mapped_column(String(50), default="proposed")
    version: Mapped[int] = mapped_column(Integer, default=1)
    crs: Mapped[str] = mapped_column(String(50), default="EPSG:4326")
    area_ha: Mapped[Optional[float]] = mapped_column(Float)
    perimeter_km: Mapped[Optional[float]] = mapped_column(Float)
    buffer_distance_m: Mapped[Optional[float]] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    validation_errors: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    boundary_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    project = relationship("Project", back_populates="boundaries")


# ─── Analysis & Observations ─────────────────────────────────────────────────

class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    analysis_type: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    connection_mode: Mapped[str] = mapped_column(String(20), nullable=False)  # LIVE, REPLAY, SYNTHETIC
    dataset_id: Mapped[Optional[str]] = mapped_column(String(500))
    aoi_geojson: Mapped[Optional[dict]] = mapped_column(JSON)
    baseline_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    baseline_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    comparison_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    comparison_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    parameters: Mapped[Optional[dict]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    result: Mapped[Optional[dict]] = mapped_column(JSON)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    source_item_ids: Mapped[Optional[list]] = mapped_column(JSON)
    acquisition_dates: Mapped[Optional[list]] = mapped_column(JSON)
    cloud_coverage_pct: Mapped[Optional[float]] = mapped_column(Float)
    valid_pixel_coverage_pct: Mapped[Optional[float]] = mapped_column(Float)
    resolution_m: Mapped[Optional[float]] = mapped_column(Float)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    retrieval_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    project = relationship("Project", back_populates="analysis_runs")
    findings = relationship("Finding", back_populates="analysis_run")


# ─── FER Reports ─────────────────────────────────────────────────────────────

class FERReport(Base):
    __tablename__ = "fer_reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    report_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="REPLAY")
    status: Mapped[str] = mapped_column(String(50), default="generating")

    # Structured content (versioned JSON)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    executive_summary: Mapped[Optional[str]] = mapped_column(Text)
    environmental_baseline: Mapped[Optional[dict]] = mapped_column(JSON)
    screening_observations: Mapped[Optional[list]] = mapped_column(JSON)
    candidate_findings: Mapped[Optional[list]] = mapped_column(JSON)
    investigation_guide: Mapped[Optional[list]] = mapped_column(JSON)
    evidence_gaps: Mapped[Optional[list]] = mapped_column(JSON)
    data_availability: Mapped[Optional[dict]] = mapped_column(JSON)
    suggested_next_checks: Mapped[Optional[list]] = mapped_column(JSON)
    source_references: Mapped[Optional[list]] = mapped_column(JSON)
    limitations: Mapped[Optional[list]] = mapped_column(JSON)
    analysis_metadata: Mapped[Optional[dict]] = mapped_column(JSON)

    generated_by_model: Mapped[Optional[str]] = mapped_column(String(200))
    generation_time_seconds: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="fer_reports")
    versions = relationship("FERReportVersion", back_populates="report", cascade="all, delete-orphan")
    generated_reports = relationship("GeneratedReport", back_populates="fer")


class FERReportVersion(Base):
    __tablename__ = "fer_report_versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    report_id: Mapped[str] = mapped_column(ForeignKey("fer_reports.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    change_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    report = relationship("FERReport", back_populates="versions")


# ─── Findings ─────────────────────────────────────────────────────────────────

class Finding(Base):
    __tablename__ = "findings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    analysis_run_id: Mapped[Optional[str]] = mapped_column(ForeignKey("analysis_runs.id"))
    fer_report_id: Mapped[Optional[str]] = mapped_column(ForeignKey("fer_reports.id"))

    finding_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    status: Mapped[str] = mapped_column(
        String(50), default="candidate_change"
    )

    zone_classification: Mapped[Optional[str]] = mapped_column(String(10))  # A, B, outside
    candidate_area_ha: Mapped[Optional[float]] = mapped_column(Float)
    area_in_zone_a_ha: Mapped[Optional[float]] = mapped_column(Float)
    area_in_zone_b_ha: Mapped[Optional[float]] = mapped_column(Float)
    geometry_geojson: Mapped[Optional[dict]] = mapped_column(JSON)
    ndvi_delta: Mapped[Optional[float]] = mapped_column(Float)
    threshold_used: Mapped[Optional[float]] = mapped_column(Float)

    observation_start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    observation_end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    connection_mode: Mapped[str] = mapped_column(String(20), default="REPLAY")
    source_references: Mapped[Optional[list]] = mapped_column(JSON)
    data_quality_notes: Mapped[Optional[list]] = mapped_column(JSON)
    limitations: Mapped[Optional[list]] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="findings")
    analysis_run = relationship("AnalysisRun", back_populates="findings")
    evidence = relationship("FindingEvidence", back_populates="finding", cascade="all, delete-orphan")
    challenges = relationship("FindingChallenge", back_populates="finding", cascade="all, delete-orphan")
    review_actions = relationship("ReviewAction", back_populates="finding")


class FindingEvidence(Base):
    __tablename__ = "finding_evidence"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    finding_id: Mapped[str] = mapped_column(ForeignKey("findings.id"), nullable=False, index=True)
    evidence_type: Mapped[str] = mapped_column(String(50), nullable=False)  # supporting | contradictory
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # document | observation | calculation
    source_id: Mapped[Optional[str]] = mapped_column(String(36))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    page_reference: Mapped[Optional[str]] = mapped_column(String(100))
    confidence: Mapped[Optional[str]] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finding = relationship("Finding", back_populates="evidence")


class FindingChallenge(Base):
    __tablename__ = "finding_challenges"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    finding_id: Mapped[str] = mapped_column(ForeignKey("findings.id"), nullable=False, index=True)
    challenger_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    observation_summary: Mapped[Optional[str]] = mapped_column(Text)
    supporting_evidence: Mapped[Optional[list]] = mapped_column(JSON)
    contradictory_evidence: Mapped[Optional[list]] = mapped_column(JSON)
    alternative_explanations: Mapped[Optional[list]] = mapped_column(JSON)
    data_quality_notes: Mapped[Optional[list]] = mapped_column(JSON)
    limitations: Mapped[Optional[list]] = mapped_column(JSON)
    unresolved_questions: Mapped[Optional[list]] = mapped_column(JSON)
    suggested_next_checks: Mapped[Optional[list]] = mapped_column(JSON)
    recommended_review_action: Mapped[Optional[str]] = mapped_column(Text)
    priority_rationale: Mapped[Optional[str]] = mapped_column(Text)
    review_status: Mapped[str] = mapped_column(String(50), default="under_human_review")
    analysis_version: Mapped[Optional[str]] = mapped_column(String(50))
    generated_by_model: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finding = relationship("Finding", back_populates="challenges")


class ReviewAction(Base):
    __tablename__ = "review_actions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    finding_id: Mapped[Optional[str]] = mapped_column(ForeignKey("findings.id"))
    case_id: Mapped[Optional[str]] = mapped_column(ForeignKey("cases.id"))
    reviewer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    new_status: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finding = relationship("Finding", back_populates="review_actions")
    case = relationship("Case", back_populates="review_actions")


# ─── Cases ────────────────────────────────────────────────────────────────────

class Case(Base):
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="open")
    assigned_to: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    project = relationship("Project", back_populates="cases")
    events = relationship("CaseEvent", back_populates="case", cascade="all, delete-orphan")
    review_actions = relationship("ReviewAction", back_populates="case")
    watch_plans = relationship("WatchPlan", back_populates="case")


class CaseEvent(Base):
    __tablename__ = "case_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    case_id: Mapped[Optional[str]] = mapped_column(ForeignKey("cases.id"), index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    actor_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    details: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    def __init__(self, **kwargs):
        if "metadata" in kwargs:
            kwargs["details"] = kwargs.pop("metadata")
        super().__init__(**kwargs)

    case = relationship("Case", back_populates="events")
    project = relationship("Project", back_populates="case_events")


# ─── Watch Plans ──────────────────────────────────────────────────────────────

class WatchPlan(Base):
    __tablename__ = "watch_plans"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    case_id: Mapped[Optional[str]] = mapped_column(ForeignKey("cases.id"))
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    analysis_type: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    zone_a_boundary_id: Mapped[Optional[str]] = mapped_column(ForeignKey("boundaries.id"))
    zone_b_boundary_id: Mapped[Optional[str]] = mapped_column(ForeignKey("boundaries.id"))
    baseline_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    baseline_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    cadence_days: Mapped[int] = mapped_column(Integer, default=30)
    quality_threshold: Mapped[float] = mapped_column(Float, default=0.7)
    minimum_coverage_pct: Mapped[float] = mapped_column(Float, default=70.0)
    ndvi_threshold: Mapped[float] = mapped_column(Float, default=-0.15)
    status: Mapped[str] = mapped_column(String(20), default="active")
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_run_status: Mapped[Optional[str]] = mapped_column(String(50))
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notification_email: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="watch_plans")
    case = relationship("Case", back_populates="watch_plans")
    job_runs = relationship("JobRun", back_populates="watch_plan", cascade="all, delete-orphan")


class JobRun(Base):
    __tablename__ = "job_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    watch_plan_id: Mapped[str] = mapped_column(ForeignKey("watch_plans.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="running")
    connection_mode: Mapped[str] = mapped_column(String(20), default="REPLAY")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sources_queried: Mapped[Optional[list]] = mapped_column(JSON)
    new_observations: Mapped[int] = mapped_column(Integer, default=0)
    findings_created: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    result_summary: Mapped[Optional[dict]] = mapped_column(JSON)
    watch_plan = relationship("WatchPlan", back_populates="job_runs")


# ─── Generated Outputs ────────────────────────────────────────────────────────

class GeneratedReport(Base):
    __tablename__ = "generated_reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    fer_id: Mapped[Optional[str]] = mapped_column(ForeignKey("fer_reports.id"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    report_type: Mapped[str] = mapped_column(String(50), nullable=False)  # fer_pdf, dossier_pdf, json, csv
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_hash: Mapped[Optional[str]] = mapped_column(String(128))
    analysis_mode: Mapped[str] = mapped_column(String(20), default="REPLAY")
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    generated_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    fer = relationship("FERReport", back_populates="generated_reports")


class AudioAsset(Base):
    __tablename__ = "audio_assets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    text_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    voice: Mapped[str] = mapped_column(String(100), nullable=False)
    engine: Mapped[str] = mapped_column(String(50), nullable=False)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EvidenceManifest(Base):
    __tablename__ = "evidence_manifests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    fer_report_id: Mapped[Optional[str]] = mapped_column(ForeignKey("fer_reports.id"))
    manifest_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    canonical_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    hash_algorithm: Mapped[str] = mapped_column(String(20), default="sha256")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[Optional[str]] = mapped_column(String(100))
    resource_id: Mapped[Optional[str]] = mapped_column(String(36))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    details: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    def __init__(self, **kwargs):
        if "metadata" in kwargs:
            kwargs["details"] = kwargs.pop("metadata")
        super().__init__(**kwargs)

    user = relationship("User", back_populates="audit_events")


class DataAvailability(Base):
    __tablename__ = "data_availability"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    dataset_id: Mapped[Optional[str]] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # available | unavailable | replay
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    details: Mapped[Optional[dict]] = mapped_column(JSON)
