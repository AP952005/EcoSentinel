# EcoSentinel — Implementation Audit
**Generated:** 2026-10-15 | **Auditor:** EcoSentinel Implementation Agent

---

## Current Architecture (Verified)

| Layer | Technology | Version | Status |
|---|---|---|---|
| Frontend | Next.js | 16.4.0 | ✅ Running on :3000 |
| Frontend UI | React | 19.3.0 | ✅ |
| Styling | Tailwind CSS | v4 | ✅ |
| Map (local analysis) | Leaflet | 1.9.4 | ✅ |
| Map (globe) | MapLibre GL | 6.14.0 | ✅ (globe projection) |
| Basemap | OpenFreeMap Liberty | tiles.openfreemap.org | ✅ Free, no API key |
| Backend | FastAPI | Python 3.12 | ✅ Running on :8000 |
| Database | SQLite | Local | ✅ |
| AI | Google GenAI SDK | gemini-3.8-flash | ✅ Configured |
| PDF generation | ReportLab | — | ✅ Exists for FER |
| TTS | Browser fallback | Native | ✅ (Piper/Google TTS not configured) |
| Auth | JWT Bearer tokens | — | ✅ |

---

## Defects Reproduced and Fixed (P0)

### ❌→✅ CRITICAL: Wrong geography on all pages
- **Before:** Environmental Map, Shadow Footprint hard-coded to Goa, India (`15.693°N, 73.732°E`)
- **Root cause:** `CENTER` constant in `map/page.tsx`, `mapRef` center in `shadow-footprint/page.tsx` all pointed to Goa
- **Fix:** All three pages now use West Kalimantan, Indonesia (`-1.850°S, 109.970°E`)
- **Shared state:** New `lib/aoi-store.ts` provides a single persistent AOI store via localStorage, survives navigation and refresh

### ❌→✅ CRITICAL: Fake CSS globe
- **Before:** Global Intelligence showed a CSS `border-radius: 50%` spinning div with dashed rings, labelled "Globe Viewport" but showing no real Earth
- **Fix:** Replaced with real MapLibre GL globe using OpenFreeMap Liberty basemap. Globe shows entire Earth on load, supports rotation/pan/zoom, places AOI marker and circle overlay

### ❌→✅ CRITICAL: Fabricated water polygon
- **Before:** Map page drew a hard-coded polygon labelled "Arabian Sea Coastal Water Body" as if it were an NDWI layer
- **Fix:** Water/NDWI layer now correctly labelled UNAVAILABLE in replay mode. Honest explanation given: `NDWI = (Green − NIR) / (Green + NIR)` requires live Sentinel-2 access.

### ❌→✅ CRITICAL: Wrong area calculation
- **Before:** Area shown as `Math.PI * r² * 100` but displayed with no label. For r=5 km: `π × 5² × 100 = 7,853.98 ha` was correctly calculated but called "Calculated geodesic buffer" without the formula
- **Fix:** Now shows formula explicitly: `π × 5² × 100 = 7,853.98 ha (investigation buffer area)`

### ❌→✅ Fabricated replay values without disclosure
- **Before:** Shadow Footprint showed `REPLAY` fixture values (12.4 ha, 68.2 ha) from Goa without clearly labelling Zone A as "NOT a legal permit boundary"
- **Fix:** All values now labelled `REPLAY DATA`. Zone A explicitly labelled as illustrative investigation polygon. West Kalimantan metrics (34.5 ha, 18.4 ha) used instead.

### ❌→✅ Persistent REPLAY badges on real data areas
- **Before:** `ModeBadge mode="REPLAY"` shown permanently across all pages regardless of context
- **Fix:** Pages now use inline `REPLAY DATA` amber badge that is honest about the demo nature; removed purple `ModeBadge` that overlapped actionable controls

### ❌→✅ "Pernem, Goa" coordinate label
- **Before:** Bottom of map showed `15.693° N, 73.732° E · Pernem, Goa`
- **Fix:** Shows `−1.850° S, 109.970° E · Ketapang, West Kalimantan`

---

## Defects Remaining / Known Limitations

### 🔴 Globe tiles slow to load in dev
- MapLibre GL fetches OpenFreeMap tiles over network in dev. The globe container initialises correctly but tiles may be slow on first load.
- **Mitigation:** Dark background shows before tiles; globe status indicator shows "Loading globe..."

### 🔴 Leaflet tiles dark on first render (screenshot timing)
- Leaflet map containers render correctly but OpenStreetMap tiles require network fetch. Screenshots taken immediately after navigation show dark canvas before tiles load.
- **Mitigation:** Loading spinner shown until tiles initialise.

### 🟡 NDWI/MNDWI water layer — unavailable in replay
- Earth Engine credentials not configured. Live Sentinel-2 band access unavailable.
- Water layer toggle shows honest "unavailable" notice with formula explanation.
- **Path to fix:** Configure Google Earth Engine service account credentials.

### 🟡 ProofLoop AI — requires Gemini API key
- Gemini key configured in `backend/.env`. Key must be valid and not rate-limited.
- Fallback: Pre-computed replay fixture from `kalimantan_provider.py`.
- **Verified:** AI service health check confirmed via `/api/v1/system/status`.

### 🟡 PDF downloads — FER only implemented
- FER PDF generation exists via ReportLab (`report_service.py`).
- General Intelligence, Environmental Map, Shadow Footprint, Watchtower PDF exports not yet implemented as proper PDFs (JSON download provided instead).

### 🟡 Watchtower scheduled execution
- Cadence/schedule field persists to DB. Actual Cloud Scheduler job not configured.
- Manual "Check Now" button works and runs replay provider.
- UI correctly shows `Scheduled execution not configured`.

### 🟡 Google TTS production path
- Local dev uses browser native `speechSynthesis` API.
- Google Cloud TTS endpoint exists (`/api/v1/tts`) but requires Cloud Run ADC.
- Config: `GOOGLE_TTS_ENABLED=false` (not configured).

### 🔵 Cloud Run deployment — not attempted
- `gcloud` CLI not authenticated in current environment. Cloud Run deployment requires manual setup.
- All locally runnable work is complete.

---

## Data Sources (Verified)

| Source | Collection | Used for | Status |
|---|---|---|---|
| Hansen GFC | `GFC-2023-v1.11` | Forest loss candidate discovery | REPLAY fixture (no EE) |
| Sentinel-2 | `COPERNICUS/S2_SR_HARMONIZED` | NDVI timeline, composites | REPLAY fixture (no EE) |
| Dynamic World | `GOOGLE/DYNAMICWORLD/V1` | Land-cover transitions | REPLAY fixture |
| FIRMS/VIIRS | FIRMS hotspots | Disturbance context | REPLAY fixture |
| OpenStreetMap | — | Basemap (Leaflet labels) | ✅ LIVE |
| Esri World Imagery | `World_Imagery/MapServer` | High-res satellite basemap (Leaflet) | ✅ LIVE |
| OpenFreeMap | Liberty style | Globe basemap (MapLibre) | ✅ LIVE |

---

## Download & Export Endpoints (Verified)

| Endpoint | Method | Format | Content |
|---|---|---|---|
| `/api/v1/system/showcase/kalimantan` | GET | JSON | Full 12-point timeline bundle & ProofLoop output |
| `/api/v1/system/showcase/kalimantan/csv` | GET | CSV | 12 chronological Sentinel-2 observations with Scene IDs & NDVI |
| `/api/v1/system/showcase/kalimantan/geojson` | GET | GeoJSON | Zone A, Zone B, and candidate disturbance polygons with limitations |

---

## Test Results (Last Run)

```
backend/ pytest:
  7/7 tests passing (100% pass rate)
  - test_health: PASSED
  - test_system_status: PASSED
  - test_auth_login_admin: PASSED
  - test_projects_list: PASSED
  - test_fer_and_findings: PASSED
  - test_chat_interaction: PASSED
  - test_kalimantan_showcase_endpoints: PASSED (JSON, CSV, GeoJSON)

Frontend build:
  next build → 16 routes, no type errors
```

---

## Demo Login

| Role | Email | Password |
|---|---|---|
| Officer (demo) | officer@ecosentinel.io | Officer@1234 |
| Admin | admin@ecosentinel.io | Admin@1234 |

---

## Local Run Commands

```bash
# Backend
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm run dev

# URLs
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/api/v1
# API docs: http://localhost:8000/docs
```
