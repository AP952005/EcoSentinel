"""
Unit and integration tests for STAC service and Earth Observation (EO) API.
Validates live STAC fallback, observation pair validation, NDVI calculation,
and GeoJSON exports.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.stac_service import stac_service

client = TestClient(app)


def test_stac_service_mock_and_fallback():
    """Verify STAC queries return structured Sentinel-2 observations."""
    bbox = [109.940, -1.875, 109.995, -1.820]
    res = stac_service.query_sentinel2_stac(
        bbox=bbox,
        start_date="2024-01-01",
        end_date="2024-08-01",
        max_cloud_pct=30.0,
        limit=5,
    )
    assert res.get("success") is True
    scenes = res.get("scenes", [])
    assert len(scenes) >= 1
    scene = scenes[0]
    assert "scene_id" in scene
    assert "date" in scene
    assert "cloud_cover_pct" in scene
    assert scene["cloud_cover_pct"] <= 30.0


def test_stac_observation_pair_validation():
    """Verify observation pair validator rejects high cloud and accepts valid pairs."""
    baseline = {
        "scene_id": "S2A_MSIL2A_20210315",
        "date": "2021-03-15",
        "cloud_cover_pct": 12.0,
        "bbox": [109.940, -1.875, 109.995, -1.820],
    }
    latest_valid = {
        "scene_id": "S2B_MSIL2A_20240720",
        "date": "2024-07-20",
        "cloud_cover_pct": 14.5,
        "bbox": [109.940, -1.875, 109.995, -1.820],
    }
    latest_cloudy = {
        "scene_id": "S2B_MSIL2A_20240725",
        "date": "2024-07-25",
        "cloud_cover_pct": 78.0,
        "bbox": [109.940, -1.875, 109.995, -1.820],
    }

    # Valid pair
    valid, reason = stac_service.validate_observation_pair(baseline, latest_valid, max_cloud_allowance=35.0)
    assert valid is True
    assert "compatible" in reason.lower()

    # Cloudy pair rejection
    valid_cloud, reason_cloud = stac_service.validate_observation_pair(baseline, latest_cloudy, max_cloud_allowance=35.0)
    assert valid_cloud is False
    assert "cloud cover" in reason_cloud.lower()


def test_transparent_ndvi_change():
    """Verify transparent NDVI change calculation formula."""
    res = stac_service.calculate_transparent_ndvi_change(
        baseline_b08=0.72,
        baseline_b04=0.08,
        latest_b08=0.38,
        latest_b04=0.22,
    )
    assert res["baseline_ndvi"] == 0.80
    assert res["latest_ndvi"] == 0.27
    assert res["delta_ndvi"] == -0.53
    assert res["change_detected"] is True
    assert "formula" in res


def test_eo_api_analysis_endpoint():
    """Verify /api/v1/eo/analysis endpoint returns structured response."""
    res = client.post("/api/v1/eo/analysis", json={
        "centroid_lat": -1.850,
        "centroid_lng": 109.970,
        "radius_km": 5.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert "baseline_observation" in data
    assert "latest_observation" in data
    assert "metrics" in data
    assert data["metrics"]["delta_ndvi"] < 0
    assert data["metrics"]["vegetation_loss_confirmed"] is True


def test_eo_api_geojson_export():
    """Verify /api/v1/eo/geojson/export produces valid FeatureCollection."""
    res = client.get("/api/v1/eo/geojson/export")
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) >= 3
    names = [f["properties"]["name"] for f in data["features"]]
    assert any("Zone B" in name for name in names)
    assert any("Zone A" in name for name in names)
    assert any("Candidate Vegetation Loss" in name for name in names)
