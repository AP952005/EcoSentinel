"""
Pydantic schemas for API request/response validation.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, model_validator
import re


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    organization: Optional[str] = None
    role: Optional[str] = "applicant"

    @model_validator(mode="after")
    def password_strength(self):
        pwd = self.password
        if len(pwd) < 6:
            raise ValueError("Password must be at least 6 characters")
        return self


class FirebaseLoginRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[str] = "applicant"
    firebase_uid: Optional[str] = None
    organization: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserPublic"


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    organization: Optional[str]
    is_first_login: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ─── Project Schemas ──────────────────────────────────────────────────────────

class ScaleData(BaseModel):
    capital_cost_crores: Optional[float] = None
    capacity_value: Optional[float] = None
    capacity_unit: Optional[str] = None
    land_area_ha: Optional[float] = None
    project_length_km: Optional[float] = None
    power_mw: Optional[float] = None
    extra: Optional[Dict[str, Any]] = None


class ProjectCreate(BaseModel):
    # Section A
    application_stage: Optional[str] = None
    project_category: Optional[str] = None
    proposal_number: Optional[str] = None
    has_prior_approval: bool = False
    prior_approval_reference: Optional[str] = None
    # Section B
    project_name: str = Field(min_length=3, max_length=500)
    applicant_name: str = Field(min_length=2, max_length=500)
    organization: Optional[str] = None
    sector: str
    activity: Optional[str] = None
    eia_category: Optional[str] = None
    project_summary: Optional[str] = None
    # Section C
    scale_data: Optional[ScaleData] = None
    # Section D
    country: str = "India"
    state: Optional[str] = None
    district: Optional[str] = None
    sub_district: Optional[str] = None
    village: Optional[str] = None
    survey_details: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    location_description: Optional[str] = None
    # Section F & G
    parameters: Optional[Dict[str, Any]] = None
    previous_approvals: Optional[Dict[str, Any]] = None


class ProjectOut(BaseModel):
    id: str
    project_name: str
    applicant_name: str
    sector: str
    status: str
    analysis_mode: str
    latitude: Optional[float]
    longitude: Optional[float]
    state: Optional[str]
    district: Optional[str]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ProjectDetail(ProjectOut):
    application_stage: Optional[str]
    project_category: Optional[str]
    proposal_number: Optional[str]
    has_prior_approval: bool
    activity: Optional[str]
    eia_category: Optional[str]
    project_summary: Optional[str]
    scale_data: Optional[Dict[str, Any]]
    parameters: Optional[Dict[str, Any]]
    organization: Optional[str]
    country: str
    sub_district: Optional[str]
    village: Optional[str]
    location_description: Optional[str]
    submitted_at: Optional[datetime]


# ─── Boundary Schemas ─────────────────────────────────────────────────────────

class BoundaryCreate(BaseModel):
    zone_type: str = Field(pattern="^(A|B|candidate)$")
    geometry_geojson: Dict[str, Any]
    source: str = "uploaded"
    status: str = "proposed"
    buffer_distance_m: Optional[float] = None
    notes: Optional[str] = None


class BoundaryOut(BaseModel):
    id: str
    project_id: str
    zone_type: str
    source: str
    status: str
    area_ha: Optional[float]
    perimeter_km: Optional[float]
    is_valid: bool
    validation_errors: Optional[str]
    created_at: datetime
    geometry_geojson: Optional[Dict[str, Any]]
    model_config = {"from_attributes": True}


# ─── FER Schemas ──────────────────────────────────────────────────────────────

class FEROut(BaseModel):
    id: str
    project_id: str
    version: int
    report_mode: str
    status: str
    summary: Optional[str]
    executive_summary: Optional[str]
    environmental_baseline: Optional[Dict[str, Any]]
    screening_observations: Optional[List[Any]]
    candidate_findings: Optional[List[Any]]
    investigation_guide: Optional[List[Any]]
    evidence_gaps: Optional[List[Any]]
    data_availability: Optional[Dict[str, Any]]
    suggested_next_checks: Optional[List[Any]]
    source_references: Optional[List[Any]]
    limitations: Optional[List[Any]]
    analysis_metadata: Optional[Dict[str, Any]]
    generated_by_model: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Finding Schemas ──────────────────────────────────────────────────────────

class FindingOut(BaseModel):
    id: str
    project_id: str
    finding_type: str
    title: str
    description: Optional[str]
    status: str
    zone_classification: Optional[str]
    candidate_area_ha: Optional[float]
    ndvi_delta: Optional[float]
    connection_mode: str
    observation_start_date: Optional[datetime]
    observation_end_date: Optional[datetime]
    created_at: datetime
    model_config = {"from_attributes": True}


class ChallengeRequest(BaseModel):
    notes: Optional[str] = None


class ChallengeOut(BaseModel):
    id: str
    finding_id: str
    observation_summary: Optional[str]
    supporting_evidence: Optional[List[Any]]
    contradictory_evidence: Optional[List[Any]]
    alternative_explanations: Optional[List[Any]]
    data_quality_notes: Optional[List[Any]]
    limitations: Optional[List[Any]]
    unresolved_questions: Optional[List[Any]]
    suggested_next_checks: Optional[List[Any]]
    recommended_review_action: Optional[str]
    priority_rationale: Optional[str]
    review_status: str
    generated_by_model: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    action_type: str
    notes: Optional[str] = None
    new_status: Optional[str] = None


# ─── Watch Plan Schemas ───────────────────────────────────────────────────────

class WatchPlanCreate(BaseModel):
    name: str = Field(min_length=3, max_length=500)
    project_id: str
    analysis_type: str = "ndvi_change"
    provider: str = "replay"
    cadence_days: int = Field(default=30, ge=1, le=365)
    quality_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    minimum_coverage_pct: float = Field(default=70.0, ge=0.0, le=100.0)
    ndvi_threshold: float = Field(default=-0.15, le=0.0)
    notification_email: Optional[str] = None


class WatchPlanOut(BaseModel):
    id: str
    project_id: str
    name: str
    status: str
    analysis_type: str
    provider: str
    cadence_days: int
    last_run_at: Optional[datetime]
    last_run_status: Optional[str]
    next_run_at: Optional[datetime]
    created_at: datetime
    model_config = {"from_attributes": True}


class JobRunOut(BaseModel):
    id: str
    watch_plan_id: str
    status: str
    connection_mode: str
    started_at: datetime
    completed_at: Optional[datetime]
    new_observations: int
    findings_created: int
    error_message: Optional[str]
    result_summary: Optional[Dict[str, Any]]
    model_config = {"from_attributes": True}


# ─── Case Schemas ─────────────────────────────────────────────────────────────

class CaseOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str]
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class CaseEventCreate(BaseModel):
    event_type: str
    description: str
    metadata: Optional[Dict[str, Any]] = None


class CaseEventOut(BaseModel):
    id: str
    event_type: str
    description: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Chat Schemas ─────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    project_id: Optional[str] = None
    case_id: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None


class ChatCitation(BaseModel):
    source_type: str
    source_id: str
    description: str
    page_reference: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    citations: List[ChatCitation] = []
    model_used: Optional[str] = None
    connection_mode: str = "REPLAY"


# ─── TTS Schemas ─────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice: Optional[str] = None


class TTSResponse(BaseModel):
    audio_id: str
    engine: str
    voice: str
    duration_seconds: Optional[float]
    transcript: str


# ─── System Schemas ───────────────────────────────────────────────────────────

class ServiceStatus(BaseModel):
    name: str
    status: str  # connected | unavailable | replay | not_configured
    details: Optional[str] = None
    mode: Optional[str] = None


class SystemStatus(BaseModel):
    services: List[ServiceStatus]
    application_mode: str
    version: str = "1.0.0"


class HealthCheck(BaseModel):
    status: str = "ok"
    database: str
    timestamp: datetime


TokenResponse.model_rebuild()
