import httpx
import json
import uuid
import sys

FRONTEND_URL = "https://ecosentinel-frontend-cz4cwc3wta-uc.a.run.app"
BACKEND_URL = "https://ecosentinel-backend-cz4cwc3wta-uc.a.run.app"

print("======================================================================")
print("ECOSENTINEL PRODUCTION DEPLOYMENT VERIFICATION SUITE")
print("======================================================================")

client = httpx.Client(timeout=90.0)

# 1. Test Backend Direct Health & Root
print("\n[1/7] Direct Backend Health Probe:")
r_health = client.get(f"{BACKEND_URL}/health")
print(f"  GET {BACKEND_URL}/health -> HTTP {r_health.status_code}")
print(f"  Response: {r_health.json()}")
assert r_health.status_code == 200, f"Expected 200, got {r_health.status_code}"

# 2. Test Frontend Root
print("\n[2/7] Frontend Landing Page:")
r_front = client.get(FRONTEND_URL)
print(f"  GET {FRONTEND_URL}/ -> HTTP {r_front.status_code} ({len(r_front.text)} bytes)")
assert r_front.status_code == 200, f"Expected 200, got {r_front.status_code}"

# 3. Test Frontend-to-Backend Reverse Proxy
print("\n[3/7] Frontend-to-Backend Reverse Proxy:")
r_proxy = client.get(f"{FRONTEND_URL}/api/v1/system/status")
print(f"  GET {FRONTEND_URL}/api/v1/system/status -> HTTP {r_proxy.status_code}")
print(f"  Response: {r_proxy.json()}")
assert r_proxy.status_code == 200, f"Expected 200, got {r_proxy.status_code}"

# 4. Test User Registration and Login via Frontend Proxy
print("\n[4/7] Authentication Flow:")
test_email = f"qa_officer_{uuid.uuid4().hex[:6]}@ecosentinel.io"
test_pwd = "SecurePassword123!@#"
r_reg = client.post(
    f"{FRONTEND_URL}/api/v1/auth/register",
    json={
        "email": test_email,
        "password": test_pwd,
        "full_name": "Officer QA Tester",
        "organization": "EcoSentinel Authority",
        "role": "officer",
    },
)
print(f"  POST /api/v1/auth/register -> HTTP {r_reg.status_code}")
assert r_reg.status_code == 201, f"Registration failed: {r_reg.text}"

r_login = client.post(
    f"{FRONTEND_URL}/api/v1/auth/login",
    json={"email": test_email, "password": test_pwd},
)
print(f"  POST /api/v1/auth/login -> HTTP {r_login.status_code}")
assert r_login.status_code == 200, f"Login failed: {r_login.text}"
token = r_login.json().get("access_token")
assert token, "No access token in response"
print("  JWT Token successfully received.")

auth_headers = {"Authorization": f"Bearer {token}"}
r_me = client.get(f"{FRONTEND_URL}/api/v1/auth/me", headers=auth_headers)
print(f"  GET /api/v1/auth/me -> HTTP {r_me.status_code} ({r_me.json().get('email')})")
assert r_me.status_code == 200

# 5. Test Projects Listing & Seeded Project
print("\n[5/7] Projects Listing & Concession Database:")
r_projects = client.get(f"{FRONTEND_URL}/api/v1/projects", headers=auth_headers)
projects = r_projects.json()
print(f"  GET /api/v1/projects -> HTTP {r_projects.status_code} ({len(projects)} projects)")
assert len(projects) > 0, "Expected at least 1 project seeded"
project = projects[0]
project_id = project["id"]
print(f"  Active Reference Project: {project_id}")
print(f"  Project Name: {project.get('project_name')}")

# 6. Test Real Sentinel-2 Earth Observation Analysis & Visual Overlay
print("\n[6/7] Real Earth Observation & STAC Analysis:")
bbox = [109.88, -0.98, 110.00, -0.86]

# Test Real STAC Catalog Search
stac_search_url = f"{FRONTEND_URL}/api/v1/eo/stac/search"
r_stac = client.post(
    stac_search_url,
    json={
        "bbox": bbox,
        "start_date": "2021-01-01",
        "end_date": "2021-06-30",
        "max_cloud_pct": 30.0,
        "limit": 5,
    },
    headers=auth_headers,
)
print(f"  POST /api/v1/eo/stac/search -> HTTP {r_stac.status_code}")
assert r_stac.status_code == 200, f"STAC search failed: {r_stac.text}"
stac_data = r_stac.json()
scenes = stac_data.get("scenes", [])
print(f"  STAC Catalog Result: found {len(scenes)} real Sentinel-2 scenes")
assert len(scenes) > 0, "Expected to discover real Sentinel-2 scenes in bbox"
first_scene = scenes[0]
first_scene_id = first_scene.get("scene_id")
first_visual_url = first_scene.get("visual_url")
print(f"  First Real Scene ID: {first_scene_id}")
print(f"  Acquisition Date: {first_scene.get('datetime')}")

# Test Visual Overlay with real scene and bbox
overlay_url = (
    f"{FRONTEND_URL}/api/v1/eo/visual-overlay"
    f"?min_lng={bbox[0]}&min_lat={bbox[1]}&max_lng={bbox[2]}&max_lat={bbox[3]}"
    f"&scene_id={first_scene_id}&visual_url={first_visual_url}"
)
r_overlay = client.get(overlay_url, headers=auth_headers)
print(
    f"  GET /api/v1/eo/visual-overlay -> HTTP {r_overlay.status_code}"
    f" (Type: {r_overlay.headers.get('content-type')}, {len(r_overlay.content)} bytes)"
)
assert r_overlay.status_code == 200, f"Overlay failed: {r_overlay.text}"

# 7. Test FER Report & GeoJSON Export
print("\n[7/7] Fast Environmental Review (FER) & Dossier Exports:")
r_findings = client.get(f"{FRONTEND_URL}/api/v1/projects/{project_id}/findings", headers=auth_headers)
findings = r_findings.json() if r_findings.status_code == 200 else []
print(f"  GET /api/v1/projects/{project_id}/findings -> HTTP {r_findings.status_code} ({len(findings)} findings)")
assert r_findings.status_code == 200, f"Findings failed: {r_findings.text}"
assert len(findings) > 0, "Expected at least 1 verified finding"
print(f"  First Finding Title: {findings[0].get('title')}")
print(f"  Severity / Area: {findings[0].get('candidate_area_ha')} ha, NDVI delta: {findings[0].get('ndvi_delta')}")

r_fer = client.get(f"{FRONTEND_URL}/api/v1/projects/{project_id}/fer", headers=auth_headers)
print(f"  GET /api/v1/projects/{project_id}/fer -> HTTP {r_fer.status_code}")
assert r_fer.status_code == 200, f"FER list failed: {r_fer.text}"
fers = r_fer.json()
print(f"  FER Reports found: {len(fers)}")
if fers:
    first_fer = fers[0]
    print(f"  FER Summary: {first_fer.get('summary')[:80]}...")

r_export = client.get(
    f"{FRONTEND_URL}/api/v1/eo/geojson/export?lat=-0.924587&lng=109.941413&radius_km=6.0",
    headers=auth_headers,
)
print(f"  GET /api/v1/eo/geojson/export -> HTTP {r_export.status_code} ({len(r_export.content)} bytes)")
assert r_export.status_code == 200, f"Export failed: {r_export.text}"

print("\n======================================================================")
print("VERIFICATION COMPLETE: ALL LIVE ENDPOINTS FUNCTIONAL ON CLOUD RUN!")
print("======================================================================")
