# 🌍 EcoSentinel — Accountable Environmental Intelligence Platform

> **Google Cloud AI Builder Cup 2026** (Sustainability & Social Impact)  
> Combining multi-temporal Earth Observation (Sentinel-2, Hansen GFC, Dynamic World) with **ProofLoop™** — bounded, counter-evidence AI investigation powered by **Gemini 3.8 Flash**.

---

## 🚀 Quick Start — How to Run the Project

EcoSentinel consists of a **FastAPI backend** (Python) and a **Next.js frontend** (React / Tailwind CSS).

### 1. Prerequisites
- **Python:** 3.11 or 3.12+ (virtual environment installed in `backend/.venv`)
- **Node.js:** v18+ or v20+ with `npm`

---

### 2. Start the Backend API (FastAPI)

1. Open a terminal and navigate to the backend directory:
   ```powershell
   cd c:\Users\Lenovo\Desktop\EcoSentinal\backend
   ```
2. Activate the virtual environment:
   ```powershell
   .venv\Scripts\Activate.ps1
   ```
3. Start the FastAPI Uvicorn server:
   ```powershell
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. Verify the backend is running:
   - **API Health:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
   - **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 3. Start the Frontend (Next.js)

1. Open a second terminal and navigate to the frontend directory:
   ```powershell
   cd c:\Users\Lenovo\Desktop\EcoSentinal\frontend
   ```
2. Start the Next.js development server:
   ```powershell
   npm run dev
   ```
3. Open your browser and navigate to:
   - **Application UI:** [http://localhost:3000](http://localhost:3000)

---

### 4. Demo Login Credentials

The database is pre-seeded with test accounts:

| Role | Email | Password | Access Rights |
|---|---|---|---|
| **Admin** | `admin@ecosentinel.io` | `Admin@1234` | Full platform oversight & architecture |
| **Officer** | `officer@ecosentinel.io` | `Officer@1234` | Review findings, challenge analysis, Watchtower |
| **Applicant** | `applicant@ecosentinel.io` | `Applicant@1234` | Project intake & FER generation |

---

## 🗺️ Key Workflows

### 1. Global Intelligence (`/global-intelligence`)
- Interactive 3D round globe with coordinate inputs and geodesic radius calculations.
- Centered on the primary demonstration case in **Ketapang Regency, West Kalimantan (Borneo, Indonesia)**.
- 4 real investigation catalogue modules:
  - *Sentinel-2 Surface Reflectance & Vegetation Trend* (`COPERNICUS/S2_SR_HARMONIZED`)
  - *Hansen Global Forest Change* (`UMD/hansen/global_forest_change_2023_v1_11`)
  - *Dynamic World Land Cover Transition* (`GOOGLE/DYNAMICWORLD/V1`)
  - *Disturbance Context* (FIRMS VIIRS & rainfall)
- **12-Point Chronological Observation Timeline:** Interactive scrubber tracking vegetation transition from 2021 to 2024.
- **Side-by-Side Comparison:** 2021 dense forest baseline vs 2024 latest usable observation.

### 2. ProofLoop™ Signature AI Investigation
- Launches structured counter-evidence analysis powered by **Gemini 3.8 Flash** with low-token reasoning (`thinking_level="low"`).
- Separates pro-finding indicators from contradictory noise and sensor limitations.
- Identifies missing cadastral files and recommends the **Next-Best Evidence** (e.g. requesting official concession decrees and UAV drone verification).

### 3. First Environmental Report (FER) & Shadow Footprint (`/shadow-footprint`, `/projects/[id]`)
- Automated screening of applicant project filings.
- Measures approved **Zone A** footprints against 500m **Zone B** surveillance buffers.
- Flags unauthorized clearing outside approved boundaries.
- **High-Resolution PDF Download:** ReportLab-generated visual evidence reports with tables and disclaimers.

### 4. Watchtower Continuous Surveillance (`/watchtower`)
- Convert any completed investigation into an automated, persistent monitoring cadence.
- Logs every observation run with idempotent triggers.

### 5. Movable Avatar Assistant & Voice Narration
- Persistent mascot avatar across all pages with 8 custom poses (`Hi`, `Investigator`, `Processing`, `Scanner`, `Success`, `general`, `cycling`).
- Click-to-chat grounded in current page and project evidence context.
- Guided walkthrough tour with voice narration.

---

## ⚙️ Environment Configuration (`.env`)

```env
APP_ENV=development
GOOGLE_CLOUD_PROJECT=environmental-guardian-poc
EARTH_ENGINE_PROJECT=environmental-guardian-poc

# Gemini API (Google GenAI SDK)
GEMINI_API_KEY=your_google_ai_studio_api_key_here
GEMINI_MODEL=gemini-3.8-flash
GEMINI_THINKING_LEVEL=low

# Fallback Local AI (Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen3:8b

# Map Tiles
MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
DATABASE_URL=sqlite:///./data/ecosentinel.db
```

---

## 🧪 Testing & Validation

Run the automated backend test suite:
```powershell
cd backend
.venv\Scripts\python.exe -m pytest
```

Test the production frontend build:
```powershell
cd frontend
npm run build
```

---

## 📚 Competition Documentation (`docs/`)

- [`docs/FEATURE_AUDIT.md`](docs/FEATURE_AUDIT.md) — System audit & live/replay matrix
- [`docs/DATA_PROVENANCE.md`](docs/DATA_PROVENANCE.md) — S2, Hansen GFC, Dynamic World registry
- [`docs/PROOFLOOP_DESIGN.md`](docs/PROOFLOOP_DESIGN.md) — Gemini 3.8 Flash AI investigation design
- [`docs/FER_SPECIFICATION.md`](docs/FER_SPECIFICATION.md) — First Environmental Report standard
- [`docs/WATCHTOWER_SPECIFICATION.md`](docs/WATCHTOWER_SPECIFICATION.md) — Continuous monitoring specification
- [`docs/SECURITY.md`](docs/SECURITY.md) — RBAC, password security, credential isolation
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Cloud Run Docker containerization
- [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) — Spatial, atmospheric, and cadastral constraints
- [`docs/THREE_MINUTE_DEMO_SCRIPT.md`](docs/THREE_MINUTE_DEMO_SCRIPT.md) — 2m 45s timed video script
- [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) — Google Cloud AI Builder Cup compliance
- [`docs/SLIDE_DECK_OUTLINE.md`](docs/SLIDE_DECK_OUTLINE.md) — 8-slide presentation outline
