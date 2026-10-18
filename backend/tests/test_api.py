import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"

def test_system_status():
    res = client.get("/api/v1/system/status")
    assert res.status_code == 200
    data = res.json()
    assert "services" in data
    assert "application_mode" in data
    assert any(s["name"] == "database" for s in data["services"])

def test_auth_login_admin():
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@ecosentinel.io",
        "password": "Admin@1234",
    })
    assert res.status_code == 200
    token_data = res.json()
    assert "access_token" in token_data

    # Test authenticated me endpoint
    me_res = client.get("/api/v1/auth/me", headers={
        "Authorization": f"Bearer {token_data['access_token']}"
    })
    assert me_res.status_code == 200
    user_data = me_res.json()
    assert user_data["email"] == "admin@ecosentinel.io"

def test_projects_list():
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@ecosentinel.io",
        "password": "Admin@1234",
    })
    token = res.json()["access_token"]

    proj_res = client.get("/api/v1/projects", headers={
        "Authorization": f"Bearer {token}"
    })
    assert proj_res.status_code == 200
    projects = proj_res.json()
    assert isinstance(projects, list)
    assert len(projects) >= 1
    assert any("Mandrem" in p["project_name"] for p in projects)

def test_fer_and_findings():
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@ecosentinel.io",
        "password": "Admin@1234",
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    proj_res = client.get("/api/v1/projects", headers=headers)
    project_id = proj_res.json()[0]["id"]

    fer_res = client.get(f"/api/v1/fer/{project_id}", headers=headers)
    assert fer_res.status_code in [200, 404]  # generated or can be generated

    findings_res = client.get(f"/api/v1/findings/project/{project_id}", headers=headers)
    assert findings_res.status_code == 200

def test_chat_interaction():
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@ecosentinel.io",
        "password": "Admin@1234",
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    chat_res = client.post("/api/v1/cases/chat", json={
        "question": "What is the status of Zone A in the Mandrem demonstration case?",
    }, headers=headers)
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert "answer" in data
    assert len(data["answer"]) > 10

def test_kalimantan_showcase_endpoints():
    # Test JSON bundle
    res = client.get("/api/v1/system/showcase/kalimantan")
    assert res.status_code == 200
    data = res.json()
    assert "West Kalimantan" in data["aoi"]["region_name"]
    assert "timeline_checkpoints" in data

    # Test CSV download
    csv_res = client.get("/api/v1/system/showcase/kalimantan/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "COPERNICUS/S2_SR_HARMONIZED" in csv_res.text

    # Test GeoJSON download
    geo_res = client.get("/api/v1/system/showcase/kalimantan/geojson")
    assert geo_res.status_code == 200
    geo_data = geo_res.json()
    assert geo_data["type"] == "FeatureCollection"
    assert len(geo_data["features"]) >= 3
