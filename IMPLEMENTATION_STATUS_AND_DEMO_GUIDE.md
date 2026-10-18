# EcoSentinel — Implementation Status, Feature Matrix & Demo Walkthrough Guide

> **Platform Version**: 2.4.0-Production  
> **Backend Service**: `http://127.0.0.1:8000` (FastAPI / Uvicorn)  
> **Frontend Web App**: `http://localhost:3000` (Next.js 16.4 Turbopack / React 19)  
> **Documentation Date**: October 2026  
> **Active Target Biome**: West Kalimantan Peatland Buffer & Tropical Rainforest Concessions  
> **Canonical Reference Case**: Mayawana Forest-Change Investigation (Ketapang, West Kalimantan: -0.924587°S, 109.941413°E, 6 km radius)  

---

## 1. Executive Summary

**EcoSentinel** is an enterprise-grade Environmental Intelligence & Remote Sensing Compliance Platform designed for environmental protection agencies, forestry audit officers, concession regulators, and GIS analysts.

The platform bridges planetary satellite earth observation (**Copernicus Sentinel-2 L2A**, **USGS Landsat 8/9**, **UMD Hansen Global Forest Change**, **Dynamic World**, and **FIRMS VIIRS**) with machine learning and generative AI to detect, attribute, and legally substantiate unauthorized deforestation, peatland drainage, and industrial footprint spillover beyond permitted concession boundaries.

---

## 2. System Architecture & Runtime Status

| Component | Technology Stack | Runtime Port | Status | Health Check URL |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | FastAPI, SQLAlchemy, SQLite, Pydantic v2, ReportLab, Google GenAI SDK | `8000` | **ONLINE (HTTP 200)** | `http://127.0.0.1:8000/api/v1/health` |
| **Frontend Application** | Next.js 16.4 (Turbopack), React 19, Tailwind CSS v4, Lucide Icons | `3000` | **ONLINE (HTTP 200)** | `http://localhost:3000/dashboard` |
| **Spatial Engine** | Leaflet 1.9, MapLibre GL, Esri World Imagery REST API, Esri Clarity Export | Embedded | **ACTIVE** | Sub-meter satellite imagery feeds |
| **AI Intelligence** | Google GenAI (`gemini-3.8-flash`, `gemini-3-flash-preview`) with Grounded Knowledge Base | Integrated | **ONLINE** | Fallback to project-grounded synthesis |
| **Voice / TTS Engine** | Edge-TTS neural speech synthesis with single-flight audio caching | Embedded | **ACTIVE** | `http://127.0.0.1:8000/api/v1/tts/{id}` |

### Demo Accounts & Credentials

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@ecosentinel.local` | `Admin@123456` | Full platform administration, service health, all dossiers |
| **Compliance Officer** | `officer@ecosentinel.local` | `Officer@123456` | Investigation workflows, FER generation, Watchtower, ProofLoop |
| **Concession Applicant** | `applicant@ecosentinel.local` | `Applicant@123456` | Self-submission, boundary uploads, project draft reviews |

---

## 3. Comprehensive Feature Implementation Matrix

### 3.1. EcoSentinel AI Assistant (Large View & Curated Q&A)
* **Expandable Chat Console**:
  * Added **Maximize / Compact** toggle button in the assistant header (`Maximize2` / `Minimize2` icons).
  * Switches smoothly between standard compact mode (`384px`) and spacious **Expanded Console** mode (`w-[94vw] sm:w-[680px] md:w-[740px]`, height up to `min(760px, calc(100vh - 80px))`).
  * Expands message view height to `500px` with formatted markdown rendering (bold headers, bullet points, numbered workflows, and code tags).
* **Curated Grounded Knowledge Base**:
  * **"What does a FER contain?"**: Provides the exact 6-part specification (*Executive Summary, Satellite Screening, Candidate Findings, Evidence Gaps, Suggested Next Checks, and Technical Disclaimers*).
  * **"How do I create a new project?"**: Complete step-by-step guidance covering Form Sections A–D, boundary uploads, analysis mode selection, and automated FER triggering.
  * **"What can I investigate in EcoSentinel?"**: Full breakdown of all 5 intelligence modules (*Global Intelligence, Environmental Map, Shadow Footprint, Watchtower, and ProofLoop*).
  * **"What do Zone A and Zone B mean?"**: Clear operational distinction between Zone A (core concession footprint) and Zone B (surveillance buffer / external shadow harm).
  * **"What data sources does EcoSentinel use?"**: Multi-sensor inventory (Sentinel-2, Landsat, Hansen GFC, Dynamic World, VIIRS, Esri World Imagery).
* **Project-Grounded Dynamic Synthesis**:
  * For project-specific questions (summaries, findings, evidence gaps, next steps), the assistant queries the live project dossier in the database (e.g. *Bukit Baka Raya Peatland Restoration & Buffer Concession Audit*) and returns actual hectares, applicant names, sector, coordinates, and verified findings instead of generic text.

### 3.2. Global / Planetary Intelligence (`/global-intelligence`)
* **12-Epoch Multi-Temporal Timeline (2021 to Present)**:
  * Full chronological satellite screening across 12 distinct observation epochs.
  * Visualizes the progressive decline of mean canopy NDVI from **0.82** (intact rainforest baseline) down to **0.44** (post-disturbance clearing).
* **Planetary Metrics**:
  * Tracks total disturbance hectares (**18.4 ha** core, **20.0 ha** buffer).
  * Bare ground expansion index (+38% surge) corroborated with Hansen 2022 loss data.
* **Instant Mode Switching**: Toggle between Live GEE analysis and Curated Replay benchmarks.

### 3.3. Project Management & Multi-Part Ingestion (`/projects/new`, `/projects`)
* **Multi-Section Registration**:
  * **Section A (General Info)**: Project Name, Applicant / Concessionaire, Sector, District, State.
  * **Section B (Scale & Capacity)**: Declared concession area (ha) and operational capacity.
  * **Section C (Geographic Boundaries)**: Interactive polygon drawing or file upload (`.geojson`, `.kml`, `.shp`).
  * **Section D (Analysis Mode)**: Live GEE vs. Curated Replay.
* **Automated Spatial Attribution**:
  * Automatically calculates centroid latitude/longitude and area.
  * Generates **Zone A (Core Footprint)** and **Zone B (Surveillance Buffer)** spatial geometry.

### 3.4. Fast Environmental Review (FER) Engine
* **Automated Generation**: Produces a preliminary environmental risk assessment within seconds of boundary submission.
* **Multi-Sensor Screening**:
  * Baseline vs. post-disturbance vegetation indices (NDVI, NDWI, EVI, dNBR).
  * Cloud cover obscuration and valid pixel percentage scoring.
* **Evidence Gap Identification**: Flags unverified concession boundaries, missing aerial drone coverage, and thermal fire anomaly registers.
* **Actionable Next Steps**: Generates prioritized checks for compliance officers.

### 3.5. Side-by-Side Environmental Map (`/environmental-map`)
* **Dual Split-Screen Synchronized View**:
  * Simultaneously renders pre-disturbance baseline satellite imagery side-by-side with post-disturbance imagery.
  * Panning, zooming, and rotating on either map is synchronized with sub-pixel alignment.
* **Multi-Band & Spectral Layers**:
  * **True Color (RGB)**: Visual-spectrum satellite imagery.
  * **False Color Infrared (NIR-Red-Green)**: Highlights photosynthetic biomass and chlorophyll health.
  * **NDVI Heatmap**: Quantitative gradient of canopy vigour.
  * **Hansen Forest Loss**: Annual tree loss flags corroborated by the University of Maryland.
* **Interactive Radius & Coordinate Controls**: Real-time slider (500m to 10,000m) and coordinate inputs update the inspection view instantly.

### 3.6. Shadow Footprint Analysis (`/shadow-footprint`)
* **Radial Buffer Causal Screening**:
  * Analyzes indirect off-site degradation occurring in the **Zone B surveillance buffer**.
* **Area-Proportional Dynamic Disturbance Clustering**:
  * Replaced static 4-patch displays with an area-based algorithm scaling from **3 to 12 distinct disturbance clusters** based on the inspected buffer radius and acreage.
* **Causal Factor Breakdown**:
  * *Unauthorized Haulage Roads & Access Tracks*
  * *Sediment Runoff Corridors & Watercourse Siltation*
  * *Microclimate Canopy Edge Drying & Desiccation*
  * *Secondary Illegal Clearing & Encroachment*

### 3.7. Watchtower Automated Surveillance (`/watchtower`)
* **Configurable Surveillance Plans**:
  * Continuous orbital pass scheduling (Sentinel-2 5-day revisit cycle).
  * Automated threshold alerting (e.g., alert when $\Delta\text{NDVI} < -0.15$).
* **12-Epoch Historical-to-Now Spectral Decline Graph**:
  * Dynamic SVG visualization displaying the progressive multi-year NDVI trend line from 2021 through the latest 2024/2026 observation epoch.
  * Interactive tooltips with exact dates, NDVI values, and percentage decline badges.

### 3.8. ProofLoop Case Management & PDF Audit Reports
* **Legally Defensible Evidence Packages**:
  * Chains satellite observation records, sensor metadata, and officer field notes into tamper-evident dossiers.
* **Publication-Grade PDF Reports**:
  * Generated with Python ReportLab.
  * **Real Satellite Aerial Photography**: Directly exports and embeds high-resolution aerial photographs from public Esri World Imagery & Esri Clarity REST APIs.
  * Includes the 12-epoch spectral decline graph, spatial boundary coordinates, compliance stamps, and officer sign-off lines.

### 3.9. Guided Audio Tour (`GuidedTour.tsx`)
* **Single-Flight Idempotent Voice Engine**:
  * Fixed prior audio repetition bugs using `activeNarrationIdRef` locks and route transition guards.
  * Provides smooth, synchronized speech narration accompanying the visual tour across all key modules.

---

## 4. End-to-End Live Demo Walkthrough Script

Follow these steps to conduct an executive or technical demonstration of the platform:

### Phase 1: Authentication & Dashboard
1. Open Google Chrome or any modern browser and navigate to `http://localhost:3000`.
2. Log in using the compliance officer credentials:
   * **Email**: `officer@ecosentinel.local`
   * **Password**: `Officer@123456`
3. You will land on `/dashboard`. Notice:
   * The live status banner showing **Active Monitoring: Mayawana Plantation / Ketapang Peatland Buffer** (-0.9246°S, 109.9414°E).
   * High-level metrics: Core Canopy Loss (**18.4 ha**), External Shadow Footprint (**20.0 ha**), and Net Vegetation Delta ($\Delta\text{NDVI} = -0.38$).

### Phase 2: EcoSentinel AI Assistant (Expanded Console)
1. In the bottom-right corner, click on the **EcoSentinel Assistant** mascot / trigger button.
2. In the assistant header, click the **Maximize** button (between Refresh and Minimize).
   * *Notice*: The assistant smoothly expands into a wide, spacious **Expanded Console** (`w-[740px]`).
3. Click the starter chip: **"What does a FER contain?"**
   * *Notice*: The assistant immediately returns a clean, structured breakdown detailing the 6 sections of a Fast Environmental Review with bold section headers and bullet points.
4. Type in: **"Tell me about the latest findings"**
   * *Notice*: The assistant answers directly with the active project dossier (*Bukit Baka Raya Peatland Restoration & Buffer Concession Audit*), citing the 18.4 ha core loss and 20.0 ha buffer degradation.

### Phase 3: Global / Planetary Intelligence
1. In the top navigation, click **Global Intelligence** (or navigate to `/global-intelligence`).
2. Interact with the **12-Epoch Observation Timeline** (slider at the top).
3. Drag between **2021 Baseline** (NDVI 0.82) and **2024 Disturbance Epoch** (NDVI 0.44).
4. Review the satellite corroboration cards showing **Sentinel-2 L2A BOA Reflectance** and **Hansen Global Forest Change v1.11**.

### Phase 4: Side-by-Side Environmental Map
1. Navigate to **Environmental Map** in the navigation bar.
2. Inspect the dual split-screen view:
   * Left: Pre-disturbance baseline imagery.
   * Right: Current satellite observations with disturbance overlays.
3. Pan and zoom on the map—both viewports remain in perfect synchronous lockstep.
4. Toggle the layer selector to **False Color Infrared** and **NDVI Heatmap** to reveal photosynthetic chlorophyll degradation.
5. Adjust the **Inspection Radius** slider (e.g. 2.5 km) to dynamically expand the screening buffer.

### Phase 5: Shadow Footprint Buffer Analysis
1. Navigate to **Shadow Footprint** (`/shadow-footprint`).
2. Observe the **Zone A (Core Footprint)** boundary surrounded by the radial **Zone B (Surveillance Buffer)**.
3. Notice the dynamically calculated external disturbance clusters (scattered external degradation).
4. Adjust the radius slider from 1 km to 4 km and observe how the number of clusters dynamically scales based on the monitored area.

### Phase 6: Watchtower Surveillance & 12-Epoch Graph
1. Navigate to **Watchtower** (`/watchtower`).
2. Review the active surveillance plan:
   * Revisit frequency: Every 5 days.
   * Threshold: Alert triggered when $\Delta\text{NDVI} < -0.15$.
3. Scroll down to inspect the **12-Epoch Historical-to-Now Spectral Decline Graph**:
   * Shows continuous NDVI tracking from 2021 (0.82) to 2024 (0.44).
   * Hover over the data points to view exact acquisition dates and decline percentages.

### Phase 7: Exporting the Official PDF Audit Report
1. In Watchtower or ProofLoop, click **"Export Official PDF Audit Report"**.
2. The browser will download an official, stamped PDF report.
3. Open the downloaded PDF:
   * Verify the high-resolution satellite imagery exported directly from public Esri World Imagery & Clarity REST APIs.
   * Verify the 12-epoch spectral trend curve, geospatial coordinates, candidate findings table, evidence gaps, and officer signature blocks.

---

## 5. Technical Troubleshooting & Command Reference

### If Port 3000 is Reported in Use
If starting `npm run dev` reports that Port 3000 is already in use by process `19740`:
```powershell
# Stop the existing process:
taskkill /PID 19740 /F

# Or restart Next.js in the frontend directory:
cd C:\Users\Lenovo\Desktop\EcoSentinal\frontend
npm run dev
```

### Starting the Services Manually

**Backend (FastAPI)**:
```powershell
cd C:\Users\Lenovo\Desktop\EcoSentinal\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend (Next.js)**:
```powershell
cd C:\Users\Lenovo\Desktop\EcoSentinal\frontend
npm run dev
```

### Verifying Service Health
```powershell
# Check backend health:
curl.exe http://127.0.0.1:8000/api/v1/health

# Check system service integrations:
curl.exe http://127.0.0.1:8000/api/v1/system/status
```

---

*EcoSentinel Environmental Intelligence Platform — Engineered for Planetary Integrity.*
