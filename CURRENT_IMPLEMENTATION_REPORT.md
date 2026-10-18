# 🌍 EcoSentinel — Master Implementation, Architecture & Feature Status Report

**Date:** October 2026  
**Project:** EcoSentinel — Accountable Environmental Intelligence Platform  
**Target Environment:** Local Node.js / FastAPI + Google Cloud Platform (Cloud Run, Vertex AI, GEE)  
**Repository Path:** `c:\Users\Lenovo\Desktop\EcoSentinal`  
**Primary AI Engine:** Gemini 3.8 Flash (`thinking_level="low"`) + Local Fallback Provider  
**Signature Experiences:** ProofLoop™ Counter-Evidence AI, Shadow Footprint Analysis, Movable Voice Investigator  

---

## 1. Executive Summary

EcoSentinel is an AI-powered environmental monitoring, regulatory screening, and investigation platform built for accountable environmental intelligence. It equips regulatory officers, compliance auditors, and sustainability applicants with automated multi-temporal Earth Observation (EO) capabilities:

1. **Automated First Environmental Report (FER):** Rapid ingestion of development filings to evaluate approved core development footprints (**Zone A**) against statutory surveillance buffer zones (**Zone B**).
2. **ProofLoop™ Counter-Evidence Reasoning:** Bounded, adversarial AI interrogation powered by **Gemini 3.8 Flash** that tests environmental disturbance hypotheses against sensor limitations, seasonal phenology, and alternative explanations.
3. **Shadow Footprint Surveillance:** Spatial overlay detecting unapproved vegetation clearing and earthworks that spill outside statutory concessions.
4. **Movable Avatar & Guided Voice Investigator:** A persistent, draggable assistant mascot that accompanies the investigator across the entire platform, providing audio narration and context-grounded inquiry.

---

## 2. Technology Stack & Live Runtime Infrastructure

The platform runs as a coordinated distributed system across two local development servers:

| Component | Technology | Host / Port | Operational Status | Key Responsibilities |
|---|---|---|---|---|
| **Frontend UI** | Next.js 16.4 (App Router, Turbopack), React 19, Tailwind CSS v4, Lucide Icons | `http://localhost:3000` | **ONLINE (Daemon)** | Responsive interface, Leaflet spatial maps, 3D globe, mascot avatar, tour narration |
| **Backend API** | FastAPI (Python 3.12), SQLAlchemy, Pydantic, Uvicorn | `http://localhost:8000` | **ONLINE (Daemon)** | Spatial calculations, FER synthesis, database ORM, Gemini 3.8 Flash integration, Piper TTS fallback |
| **Database** | SQLite (`backend/data/ecosentinel.db`) with relational schema | Embedded | **ONLINE** | Multi-tenant auth, projects, FER documents, candidate findings, watch cadences, audit logs |
| **Mapping Engine** | Leaflet 1.9.4 + Esri World Imagery + Vector GeoJSON Polygons | Browser Client | **CALIBRATED** | Satellite tile rendering, Zone A / Zone B polygons, disturbance badges, side-by-side comparison |
| **AI Engine** | Google GenAI SDK (Gemini 3.8 Flash) + Ollama Local Fallback | API Service | **ONLINE** | ProofLoop counter-evidence challenges, executive summaries, AI Case Assistant chat |
| **Audio / TTS** | Local Piper TTS (`/api/v1/system/tts`) + Web Speech API fallback | Port 8000 + Browser | **ONLINE** | Voice narration for guided tour steps and mascot speech |

---

## 3. Demo Credentials & Access Roles

The system is pre-seeded with 4 role-based accounts (managed in `scripts/seed_demo.py` and `backend/data/ecosentinel.db`):

| Role | Username / Email | Password | Access Rights & Views |
|---|---|---|---|
| **Regulatory Officer** | `officer@ecosentinel.io` | `Officer@1234` | Full investigation review, challenge findings, Watchtower surveillance setup, FER sign-off |
| **Administrator** | `admin@ecosentinel.io` | `Admin@1234` | System health monitoring, deployment architecture, global platform configuration |
| **Applicant** | `applicant@ecosentinel.io` | `Applicant@1234` | Project intake wizard, application status tracking, initial FER document submission |
| **Test User** | `test@ecosentinel.io` | `testpassword123` | General exploratory testing, guided tour walkthrough, and sandbox evaluation |

*Quick login buttons are available on `/login` to switch between roles with a single click.*

---

## 4. Key Resolved Issues & Calibrations

### 4.1 Leaflet Satellite Maps (`/map` & `/shadow-footprint`)
- **Root Cause of Blank Tiles:** 
  1. *React 19 Ref Hydration:* Concurrent rendering initialized `useRef(null)` before the DOM element mounted, causing layer builders to exit prematurely.
  2. *Async Cleanup Interruption:* React StrictMode double-mounted the effect, and an async IIFE cancellation pattern removed the active map instance.
  3. *Watermark Tile Interruption:* Third-party CartoDB tiles required API keys and displayed watermark notices.
  4. *CSS Tile Distortion:* Strict CSS width/height constraints distorted Leaflet coordinate transforms.
- **Implemented Fixes:**
  - Migrated to React callback state refs (`const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);` with `<div ref={setContainerEl} />`), guaranteeing execution upon DOM attachment.
  - Replaced basemap tiles with **Esri World Imagery** (`World_Imagery/MapServer/tile/{z}/{y}/{x}`) combined with official **Esri Reference Boundaries & Places** (`Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`), providing crisp satellite imagery with labels and no watermarks.
  - Added global CSS overrides ensuring `.leaflet-tile { max-width: none !important; max-height: none !important; }`.
  - Added explicit container dimensions (`width: 100%`, `height: 520px` / `440px`).

### 4.2 Spatial Annotations & Calibrated Badges
- **Search Window (Zone B):** High-visibility dashed blue boundary (`#3b82f6`) representing the ~3,025 ha surveillance perimeter.
- **Core Area (Zone A):** Distinct teal perimeter (`#14b8a6`) with interactive divIcon badge: `🌱 Core Area (Zone A) · 34.5 ha`.
- **Vegetation Disturbance Finding:** High-contrast amber/red polygon (`#ef4444` / `#f59e0b`) showing candidate clearing with badge: `🚨 ΔNDVI −0.38 Loss · 18.4 ha`.
- **Shadow Footprint:** Split into internal disturbance (8.2 ha) and unauthorized external clearing (10.2 ha) with warning badge: `⚠️ External Disturbance · 10.2 ha`.
- **Water Body Mask:** Azure polygon (`#0284c7`) delineating coastal and wetland water boundaries.

### 4.3 Movable Avatar & Mascot Assistant (`EcoSentinelAssistant.tsx`)
- **Root Cause of Drag Stutter:** Event listeners were originally bound to the avatar element itself. Moving the cursor quickly caused it to leave the element bounding box, dropping pointer events.
- **Implemented Fixes:**
  - Replaced element listeners with global `window.addEventListener('pointermove')` and `window.addEventListener('pointerup')` on pointer down.
  - Added viewport coordinate clamping (`Math.max(10, Math.min(window.innerWidth - 80, ...))`) to ensure the avatar never leaves the screen.
  - Persisted coordinates to `localStorage` (`eco-assistant-pos`) across page navigation.
  - Added drag threshold detection (5px) to differentiate click events from drag gestures, allowing click-to-open chat.

### 4.4 Guided Tour Cross-Page Persistence (`GuidedTour.tsx` & `AppLayout.tsx`)
- **Root Cause of Disappearance:** Individual page components unmounted the tour state when navigating across routes via `router.push()`.
- **Implemented Fixes:**
  - Persisted tour running state and step index in `localStorage` (`eco-tour-in-progress`, `eco-tour-step`).
  - Integrated auto-resume logic into the shared `AppLayout.tsx` wrapper, restoring tour modals immediately when target pages mount.
  - Provided dual TTS support (FastAPI Piper backend audio with automatic browser `speechSynthesis` fallback).

---

## 5. Detailed Page-by-Page Feature Directory

### 5.1 Landing Page (`/`)
- Public showcase outlining the platform vision, Earth Observation pipeline, and ProofLoop architecture.
- Direct quick-navigation buttons to Launch Demo, Sign In, or View Documentation.

### 5.2 Dashboard (`/dashboard`)
- **Personalized Header:** Welcomes user with active role badge and organization details.
- **KPI Stat Cards:** Total Projects, Active Monitors, Open Disturbance Cases, and Scheduled Watch Plans.
- **Recent Projects Table:** Fast links to active projects with status chips (Under Review, Approved, Flagged).
- **Watchtower Quick Activity:** Real-time stream of latest satellite observation checks.
- **Launch Tour Action:** Immediate trigger for the 12-step guided walkthrough.

### 5.3 Leaflet Environmental Map (`/map`)
- **Satellite Basemap:** High-resolution Esri World Imagery with placename references.
- **Layer Controls:** Toggle Zone A, Zone B, ΔNDVI disturbance findings, and NDWI water masks.
- **Baseline vs. Observation:** Visual side-by-side comparison between 2020 dense vegetation and 2023 disturbance.
- **Geographic Centering:** Quick "Fit AOI" button targeting Mandrem/Pernem coordinate bounds (`15.693° N, 73.732° E`).
- **Interactive Badges:** Hoverable and clickable markers detailing area in hectares and vegetation delta.

### 5.4 Shadow Footprint Analysis (`/shadow-footprint`)
- **Core vs. Buffer Breakdown:**
  - Approved Core Footprint: `14.2 ha` (or `34.5 ha` scaled).
  - External Buffer Clearing: `4.3 ha` (or `10.2 ha` scaled).
  - Total Unapproved Encroachment percentage calculation.
- **Spectral Sliders:** Interactive controls for NDVI, NDBI (built-up), NDWI (water), and Canopy Height.
- **Spatial Discrepancy Heatmap:** Visualizes clearing extending across the concession boundary.

### 5.5 Global Intelligence (`/global-intelligence`)
- **Interactive 3D Globe:** WebGL globe centered on **Ketapang Regency, West Kalimantan, Indonesia** (`-1.825° S, 109.970° E`).
- **4 Earth Observation Modules:**
  1. *Sentinel-2 Surface Reflectance* (`COPERNICUS/S2_SR_HARMONIZED`): Multi-spectral band ratios.
  2. *Hansen Global Forest Change* (`UMD/hansen/global_forest_change_2023_v1_11`): Annual tree cover loss.
  3. *Dynamic World Land Cover* (`GOOGLE/DYNAMICWORLD/V1`): Real-time land cover class transitions.
  4. *Contextual Disturbance* (FIRMS VIIRS thermal anomalies + precipitation records).
- **12-Point Timeline Scrubber:** Chronological playback from 2021 pre-disturbance to 2024 post-clearing.
- **Dual Visual Comparison:** Dense primary forest baseline vs. current landscape fragmentation.

### 5.6 Project Intake Wizard (`/projects/new`)
- Multi-step guided application submission:
  - Step 1: Context & Application Stage (Category A / Category B).
  - Step 2: Project Identity & Sector (Mining, Infrastructure, Energy, Resort).
  - Step 3: Spatial Coordinates & Land Requirements.
  - Step 4: Submission & Automated FER Generation.

### 5.7 Project Detail & ProofLoop™ Investigation (`/projects/[id]`)
- **FER Executive Summary:** Automated screening conclusions, risk rating, and data completeness scores.
- **Regulatory Officer Guide:** Curated inspection checklist and statutory questions.
- **Evidence Gaps Tab:** Highlights missing boundary surveys, high-cloud days, or uncalibrated sensors.
- **ProofLoop™ Counter-Evidence Challenge:**
  - AI-powered adversarial evaluation testing alternative explanations (seasonal drought, sensor dropouts).
  - Recommends actionable **Next-Best Evidence** (e.g., UAV orthomosaics, ground survey logs).

### 5.8 Watchtower Continuous Surveillance (`/watchtower`)
- **Surveillance Cadences:** Create and manage automated satellite revisit schedules (3-day, 7-day, 14-day).
- **Sensitivity Thresholds:** Configure minimum ΔNDVI drop triggers and cloud cover allowances.
- **Simulate Run:** On-demand triggering of satellite change detection passes.
- **Execution History:** Timestamped audit trail of past observation checks.

### 5.9 Deployment & Architecture (`/deployment`)
- Live heartbeat status of database, API, mapping tiles, and AI endpoints.
- Visual diagram of the Google Cloud target production architecture (Cloud Run, Cloud SQL, Vertex AI, GEE).

### 5.10 AI Case Assistant (`/chat` & Mascot Drawer)
- Conversational interface grounded in project case files and spatial observations.
- Quick prompts for regulatory inquiries, statutory definitions, and report drafting.

---

## 6. Complete Backend API Directory (FastAPI)

All endpoints are registered under `/api/v1` and accessible via Swagger UI at `http://localhost:8000/api/docs`:

### Auth Router (`/api/v1/auth`)
- `POST /login` — Authenticates user via OAuth2 password flow, returns JWT bearer token.
- `GET /me` — Retrieves currently authenticated user profile and permissions.
- `POST /register` — Registers a new user account.

### Projects Router (`/api/v1/projects`)
- `GET /` — Lists all projects with optional sector/status filtering.
- `POST /` — Creates a new project and triggers automated FER creation.
- `GET /{id}` — Fetches single project detail, geographic center, and metadata.
- `GET /{id}/boundaries` — Returns Zone A and Zone B GeoJSON geometries.
- `POST /{id}/fer` — Manually regenerates First Environmental Report.

### Investigation & FER Router (`/api/v1/fer`, `/api/v1/findings`, `/api/v1/cases`)
- `GET /fer/{project_id}` — Retrieves the current FER document and screening score.
- `GET /findings/{project_id}` — Lists candidate disturbance findings for a project.
- `POST /findings/{id}/challenge` — Invokes Gemini 3.8 Flash ProofLoop counter-evidence analysis.
- `GET /cases` — Lists open disturbance investigation cases.
- `GET /cases/{id}` — Retrieves comprehensive case file with evidence timeline.

### Watchtower Router (`/api/v1/watchtower`)
- `GET /plans` — Lists all active surveillance plans.
- `POST /plans` — Creates a new scheduled surveillance plan.
- `POST /plans/{id}/trigger` — Manually executes a satellite surveillance pass.
- `GET /logs` — Returns historical surveillance execution logs.

### System Router (`/api/v1/system`)
- `GET /health` — Simple healthcheck endpoint (`{"status": "healthy"}`).
- `GET /status` — Detailed system diagnostic (database latency, AI provider status, disk).
- `POST /tts` — Generates audio speech via Piper TTS engine for tour narration.

---

## 7. Primary Case Study Georeferencing

The platform incorporates two georeferenced environmental scenarios:

### Case Study 1: Ketapang Regency, West Kalimantan, Indonesia (Primary)
- **Coordinates:** `-1.8250° S, 109.9700° E`
- **Context:** Tropical peatland and primary rainforest disturbance candidate.
- **Evidence Sources:**
  - Sentinel-2 Surface Reflectance (harmonized 10m bands).
  - Hansen Global Forest Change (annual tree canopy loss mask).
  - Dynamic World Land Cover (transition from 'trees' to 'shrub_and_scrub' / 'bare_ground').
  - NASA FIRMS VIIRS Thermal Anomalies (active fire detection).

### Case Study 2: Mandrem Coastal Concession, Pernem, Goa, India (Benchmark)
- **Coordinates:** `15.6930° N, 73.7320° E`
- **Context:** Coastal Regulation Zone (CRZ) eco-tourism development.
- **Parameters:**
  - Approved Zone A Footprint: `14.2 ha` (expanded to `34.5 ha`).
  - 500m Zone B Search Window: `68.2 ha` (expanded to `3,025 ha`).
  - Observed Disturbance: `4.3 ha` candidate vegetation decline (`ΔNDVI ≈ -0.38`).
  - Coastal Water Boundary: High-tide water line along the Arabian Sea.

---

## 8. Audit of Missing Features & Production Roadmap

The platform is fully operable in local demonstration/replay mode. The following items represent the migration roadmap to complete a full enterprise production deployment on Google Cloud:

1. **Live Google Earth Engine Service Account Connection:**
   - *Current State:* High-fidelity replay fixtures derived from genuine Sentinel-2, Hansen GFC, and Dynamic World assets.
   - *Production Goal:* Direct GEE Python API authentication using a Google Cloud Service Account to stream live cloud-masked composite tiles.
2. **CAD / KML Shapefile Drag-and-Drop Ingestion:**
   - *Current State:* Intake coordinates and pre-computed vector boundaries.
   - *Production Goal:* Client-side GeoJSON/KML/Shapefile parser with automated geometry validation and projection reprojection (EPSG:4326).
3. **Automated High-Resolution PDF Export:**
   - *Current State:* Complete structured FER exportable as JSON.
   - *Production Goal:* ReportLab/WeasyPrint server-side PDF generator embedding high-res map tiles, tabular findings, and cryptographic signature blocks.
4. **Google Cloud Run Deployment:**
   - *Current State:* Running locally on ports 3000 and 8000.
   - *Production Goal:* Multi-stage Docker containers deployed to Cloud Run with Cloud SQL (PostgreSQL + PostGIS) and Cloud Storage evidence buckets.

---

## 9. Verification & Quality Checklist

- [x] **Backend API:** Online on `http://localhost:8000` (`/api/v1/health` returns `healthy`).
- [x] **Frontend Web App:** Online on `http://localhost:3000` (Next.js 16.4 Turbopack dev server).
- [x] **Leaflet Basemap:** Live Esri World Imagery + Reference labels rendering smoothly without blank tiles or watermarks.
- [x] **Spatial Layers & Badges:** Zone A, Zone B, ΔNDVI disturbance, and water body clearly outlined with interactive badges.
- [x] **Character Avatar:** Freely draggable across the viewport with boundary clamping and click-to-chat.
- [x] **Guided Tour:** Cross-route navigation persistence verified without modal drops.
- [x] **ProofLoop™ AI Engine:** Gemini 3.8 Flash adversarial challenge functioning with fallback safety.
- [x] **Documentation:** Comprehensive architecture and implementation report finalized.
