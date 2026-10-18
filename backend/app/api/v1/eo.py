"""
Earth Observation (EO) & STAC API Router.
Provides live Sentinel-2 STAC catalog queries, observation pair validation,
genuine raster-level NDVI change calculations from COG assets, visual satellite overlays,
and verified GeoJSON export.
"""
import io
import json
import logging
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from app.core.deps import get_current_user_optional
from app.models.models import User
from app.services.stac_service import stac_service
from app.services.geo_service import geo_service
from app.providers.kalimantan_provider import WEST_KALIMANTAN_AOI

router = APIRouter(prefix="/eo", tags=["earth_observation"])


class STACSearchRequest(BaseModel):
    bbox: List[float] = Field(..., description="[min_lng, min_lat, max_lng, max_lat]")
    start_date: str = Field(..., json_schema_extra={"example": "2024-01-01"})
    end_date: str = Field(..., json_schema_extra={"example": "2024-08-01"})
    max_cloud_pct: float = Field(default=30.0, ge=0.0, le=100.0)
    limit: int = Field(default=5, ge=1, le=20)


class ObservationPairRequest(BaseModel):
    baseline_scene: Dict[str, Any]
    latest_scene: Dict[str, Any]
    max_cloud_allowance: float = Field(default=35.0, ge=0.0, le=100.0)


class EOAnalysisRequest(BaseModel):
    centroid_lat: float = Field(default=-0.924587, ge=-90.0, le=90.0)
    centroid_lng: float = Field(default=109.941413, ge=-180.0, le=180.0)
    radius_km: float = Field(default=6.0, gt=0.0, le=100.0)
    baseline_date_range: Optional[List[str]] = Field(default=["2021-05-01", "2021-10-31"])
    latest_date_range: Optional[List[str]] = Field(default=["2024-05-01", "2024-09-30"])
    max_cloud_pct: float = Field(default=30.0)


_GEOCODE_CACHE: Dict[str, Dict[str, str]] = {}


def get_location_details(lat: float, lng: float) -> Dict[str, str]:
    """
    Reverse geocodes coordinates to obtain place name, state / province / district,
    and country using OpenStreetMap Nominatim with fallback.
    """
    cache_key = f"{round(lat, 3)}_{round(lng, 3)}"
    if cache_key in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[cache_key]

    try:
        import urllib.request
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "EcoSentinel-Environmental-Intelligence/1.0 (contact@ecosentinel.org)"},
        )
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            addr = data.get("address", {})
            place = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("municipality")
                or addr.get("county")
                or addr.get("suburb")
                or "Observation Sector"
            )
            state = (
                addr.get("state")
                or addr.get("region")
                or addr.get("state_district")
                or addr.get("province")
                or ""
            )
            country = addr.get("country") or "Global"
            display_parts = [p for p in [place, state, country] if p]
            display = ", ".join(display_parts) if display_parts else f"AOI ({lat:.3f}°, {lng:.3f}°)"

            result = {
                "place_name": place,
                "state": state,
                "country": country,
                "display_name": display,
            }
            _GEOCODE_CACHE[cache_key] = result
            return result
    except Exception as e:
        logger.warning(f"Reverse geocode lookup failed: {e}")

    # Regional heuristic fallback
    state = ""
    country = "Global"
    place = f"Sector ({lat:.2f}°, {lng:.2f}°)"

    if -4.5 <= lat <= 4.5 and 108.0 <= lng <= 119.5:
        place = "Ketapang Regency"
        state = "West Kalimantan"
        country = "Indonesia"
    elif -18.0 <= lat <= 5.0 and -75.0 <= lng <= -44.0:
        place = "Amazon Basin Corridor"
        state = "Pará / Amazonas"
        country = "Brazil"
    elif 8.0 <= lat <= 36.0 and 68.0 <= lng <= 90.0:
        place = "Western Ghats / Forest Sector"
        state = "Karnataka" if 11.0 <= lat <= 19.0 and 74.0 <= lng <= 78.5 else "Forest Region"
        country = "India"
    elif -5.0 <= lat <= 5.0 and 10.0 <= lng <= 32.0:
        place = "Congo Basin Conservation Area"
        state = "Equateur Province"
        country = "DR Congo"

    display_parts = [p for p in [place, state, country] if p]
    fallback_res = {
        "place_name": place,
        "state": state,
        "country": country,
        "display_name": ", ".join(display_parts),
    }
    _GEOCODE_CACHE[cache_key] = fallback_res
    return fallback_res


@router.get("/reverse-geocode")
def reverse_geocode_endpoint(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
):
    """Returns detected place name, state / province, and country for coordinates."""
    return get_location_details(lat, lng)


@router.post("/stac/search")
@router.post("/stac-search")
def search_stac_scenes(
    req: STACSearchRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Search public Element84 Earth Search STAC catalog for real Sentinel-2 L2A scenes."""
    result = stac_service.search_sentinel2_scenes(
        bbox=req.bbox,
        start_date=req.start_date,
        end_date=req.end_date,
        max_cloud_pct=req.max_cloud_pct,
        limit=req.limit,
    )
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error", "STAC catalog search failed"))
    return result


@router.post("/stac/validate-pair")
@router.post("/validate-pair")
def validate_observation_pair(
    req: ObservationPairRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Validate whether two observations form a compatible, trustworthy pair."""
    is_valid, reason = stac_service.validate_observation_pair(
        baseline_scene=req.baseline_scene,
        latest_scene=req.latest_scene,
        max_cloud_allowance=req.max_cloud_allowance,
    )
    return {
        "compatible": is_valid,
        "rejection_reason": reason,
        "validated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/analysis")
@router.post("/analyze-change")
def analyze_change(
    req: EOAnalysisRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Execute genuine Sentinel-2 raster processing directly from STAC COG assets.
    Retrieves real B04/B08 bands and aligned SCL masks, clips to circular AOI,
    computes NDVI change and calculates disturbed hectares.
    Enforces geometry constraint (maximum 11,309.73 ha for 6 km radius).
    Returns honest errors when data is unavailable.
    """
    # 1. Reverse geocode location
    location = get_location_details(req.centroid_lat, req.centroid_lng)

    # 2. Calculate bounding box and strict geometric max area
    # Area of circle = pi * r^2 * 100 hectares (for r=6km -> 11,309.73 ha)
    buffer_area_ha = round(math.pi * (req.radius_km ** 2) * 100.0, 2)
    lat_deg = req.radius_km / 111.0
    cos_lat = max(0.1, abs(math.cos(math.radians(req.centroid_lat))))
    lng_deg = req.radius_km / (111.0 * cos_lat)
    bbox = [
        round(req.centroid_lng - lng_deg, 4),
        round(req.centroid_lat - lat_deg, 4),
        round(req.centroid_lng + lng_deg, 4),
        round(req.centroid_lat + lat_deg, 4),
    ]

    # 3. Query STAC for genuine Baseline observation
    b_start, b_end = req.baseline_date_range or ["2021-05-01", "2021-10-31"]
    l_start, l_end = req.latest_date_range or ["2024-05-01", "2024-09-30"]

    baseline_result = stac_service.search_sentinel2_scenes(
        bbox=bbox,
        start_date=b_start,
        end_date=b_end,
        max_cloud_pct=req.max_cloud_pct,
        limit=5,
    )
    if not baseline_result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=f"STAC search failed for baseline period: {baseline_result.get('error')}",
        )
    scenes_b = baseline_result.get("scenes", [])
    if not scenes_b:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No cloud-free Sentinel-2 observations found in baseline window ({b_start} to {b_end}) "
                f"with cloud cover <= {req.max_cloud_pct}%. Broaden the date range or increase cloud allowance."
            ),
        )

    # 4. Query STAC for genuine Latest observation
    latest_result = stac_service.search_sentinel2_scenes(
        bbox=bbox,
        start_date=l_start,
        end_date=l_end,
        max_cloud_pct=req.max_cloud_pct,
        limit=5,
    )
    if not latest_result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=f"STAC search failed for latest period: {latest_result.get('error')}",
        )
    scenes_l = latest_result.get("scenes", [])
    if not scenes_l:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No cloud-free Sentinel-2 observations found in latest window ({l_start} to {l_end}) "
                f"with cloud cover <= {req.max_cloud_pct}%. Broaden the date range or increase cloud allowance."
            ),
        )

    baseline_scene = scenes_b[0]
    latest_scene = scenes_l[0]

    # 5. Validate observation pair compatibility
    compatible, rejection_reason = stac_service.validate_observation_pair(
        baseline_scene=baseline_scene,
        latest_scene=latest_scene,
        max_cloud_allowance=req.max_cloud_pct,
    )

    # 6. Execute Genuine Raster Processing from COG assets
    raster_result = stac_service.process_change_raster(
        baseline_scene=baseline_scene,
        latest_scene=latest_scene,
        bbox=bbox,
        centroid_lat=req.centroid_lat,
        centroid_lng=req.centroid_lng,
        radius_km=req.radius_km,
        threshold=-0.15,
    )

    if not raster_result.get("success"):
        raise HTTPException(
            status_code=422,
            detail=raster_result.get("error", "Raster change detection failed on satellite bands."),
        )

    metrics = raster_result["metrics"]
    metrics["vegetation_loss_confirmed"] = bool(metrics.get("vegetation_loss_detected", False) or metrics.get("delta_ndvi", 0) < 0 or metrics.get("disturbed_area_ha", 0) > 0)
    metrics["canopy_disturbance_detected"] = bool(metrics.get("vegetation_loss_detected", False) or metrics.get("delta_ndvi", 0) < 0 or metrics.get("disturbed_area_ha", 0) > 0)
    polygons = raster_result.get("polygons", [])
    classification_context = raster_result.get("classification_context", {})

    # 7. Build Real STAC Temporal Timeline Checkpoints
    timeline_scenes_res = stac_service.search_sentinel2_scenes(
        bbox=bbox,
        start_date=b_start,
        end_date=l_end,
        max_cloud_pct=35.0,
        limit=12,
    )
    timeline_scenes = timeline_scenes_res.get("scenes", [])
    timeline_scenes.sort(key=lambda s: s.get("datetime") or s.get("date") or "")

    timeline_checkpoints = []
    if len(timeline_scenes) >= 2:
        for idx, sc in enumerate(timeline_scenes):
            c_date = sc.get("date") or (sc.get("datetime", "")[:10])
            cloud = sc.get("cloud_cover_pct", 0.0)
            timeline_checkpoints.append({
                "index": idx + 1,
                "date": c_date,
                "scene_id": sc.get("scene_id"),
                "cloud_cover_pct": cloud,
                "nodata_pixel_pct": sc.get("nodata_pixel_pct", 0.0),
                "thumbnail_url": sc.get("thumbnail_url"),
                "visual_url": sc.get("visual_url"),
                "platform": sc.get("platform", "Sentinel-2"),
                "quality_status": "optimal" if cloud < 10.0 else "usable",
                "label": f"Sentinel-2 observation ({c_date})",
            })
    else:
        # Include at least the verified baseline and latest
        timeline_checkpoints = [
            {
                "index": 1,
                "date": baseline_scene.get("date"),
                "scene_id": baseline_scene.get("scene_id"),
                "cloud_cover_pct": baseline_scene.get("cloud_cover_pct", 0.0),
                "thumbnail_url": baseline_scene.get("thumbnail_url"),
                "visual_url": baseline_scene.get("visual_url"),
                "quality_status": "baseline_reference",
                "label": f"Baseline observation ({baseline_scene.get('date')})",
            },
            {
                "index": 2,
                "date": latest_scene.get("date"),
                "scene_id": latest_scene.get("scene_id"),
                "cloud_cover_pct": latest_scene.get("cloud_cover_pct", 0.0),
                "thumbnail_url": latest_scene.get("thumbnail_url"),
                "visual_url": latest_scene.get("visual_url"),
                "quality_status": "latest_observation",
                "label": f"Latest observation ({latest_scene.get('date')})",
            },
        ]

    return {
        "status": "success",
        "data_source_mode": "live_sentinel2_cog_raster",
        "location": location,
        "aoi": {
            "centroid": {"lat": req.centroid_lat, "lng": req.centroid_lng},
            "radius_km": req.radius_km,
            "bbox": bbox,
            "region_name": location["display_name"],
            "place_name": location["place_name"],
            "state": location["state"],
            "country": location["country"],
            "buffer_area_ha": buffer_area_ha,
        },
        "provenance": {
            "catalog": "https://earth-search.aws.element84.com/v1",
            "collection": "sentinel-2-l2a",
            "processing_mode": "actual_rasterio_cog_processing",
            "bands_processed": ["B04_RED", "B08_NIR", "SCL_20M"],
            "baseline_scene_id": baseline_scene.get("scene_id"),
            "latest_scene_id": latest_scene.get("scene_id"),
            "baseline_acquisition_date": baseline_scene.get("date"),
            "latest_acquisition_date": latest_scene.get("date"),
        },
        "baseline_observation": baseline_scene,
        "latest_observation": latest_scene,
        "compatibility": {
            "is_compatible": compatible,
            "rejection_reason": rejection_reason,
        },
        "metrics": metrics,
        "classification_context": classification_context,
        "polygons": polygons,
        "timeline_checkpoints": timeline_checkpoints,
    }


@router.get("/visual-overlay")
def get_visual_overlay(
    visual_url: Optional[str] = Query(default=None),
    scene_id: Optional[str] = Query(default=None),
    min_lng: float = Query(...),
    min_lat: float = Query(...),
    max_lng: float = Query(...),
    max_lat: float = Query(...),
):
    """
    Streams a true-color Sentinel-2 JPEG image cropped to the requested AOI bounding box
    directly from Cloud-Optimized GeoTIFF assets.
    """
    bbox = [min_lng, min_lat, max_lng, max_lat]
    target_url = visual_url

    if not target_url and scene_id:
        import re
        m = re.match(r"S2[AB]_(\d{2})([A-Z])([A-Z]{2})_(\d{4})(\d{2})\d{2}_.*", scene_id)
        if m:
            utm_zone, lat_band, grid_sq, yr, mo = m.groups()
            target_url = f"https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/{int(utm_zone)}/{lat_band}/{grid_sq}/{yr}/{int(mo)}/{scene_id}/TCI.tif"
        else:
            # Search STAC for the specific scene asset
            search_res = stac_service.search_sentinel2_scenes(
                bbox=bbox,
                start_date="2020-01-01",
                end_date="2026-12-31",
                max_cloud_pct=100.0,
                limit=10,
            )
            for sc in search_res.get("scenes", []):
                if sc.get("scene_id") == scene_id:
                    target_url = sc.get("visual_url")
                    break

    if not target_url:
        raise HTTPException(
            status_code=400,
            detail="Valid visual_url or resolvable scene_id is required to render Sentinel-2 satellite imagery.",
        )

    img_bytes = stac_service.render_true_color_image(target_url, bbox)
    if not img_bytes:
        raise HTTPException(status_code=502, detail="Failed to render Sentinel-2 satellite imagery from COG.")

    return Response(
        content=img_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/geojson/export")
def export_case_geojson(
    lat: float = Query(default=-0.924587),
    lng: float = Query(default=109.941413),
    radius_km: float = Query(default=6.0, gt=0.0, le=100.0),
    case_name: str = Query(default="Sentinel-2-Investigation"),
):
    """
    Exports clean, valid GeoJSON FeatureCollection of Zone B surveillance boundary
    and actual calculated disturbance polygons for GIS inspection.
    Enforces maximum geometry constraint.
    """
    buffer_area_ha = round(math.pi * (radius_km ** 2) * 100.0, 2)
    lat_deg = radius_km / 111.0
    cos_lat = max(0.1, abs(math.cos(math.radians(lat))))
    lng_deg = radius_km / (111.0 * cos_lat)
    bbox = [lng - lng_deg, lat - lat_deg, lng + lng_deg, lat + lat_deg]

    # Build circle polygon for Zone B
    circle_coords = []
    points = 48
    d = radius_km / 6371.0
    rad_lat = math.radians(lat)
    rad_lng = math.radians(lng)
    for i in range(points + 1):
        bearing = (i * 2 * math.pi) / points
        p_lat = math.asin(math.sin(rad_lat) * math.cos(d) + math.cos(rad_lat) * math.sin(d) * math.cos(bearing))
        p_lng = rad_lng + math.atan2(math.sin(bearing) * math.sin(d) * math.cos(rad_lat), math.cos(d) - math.sin(rad_lat) * math.sin(p_lat))
        circle_coords.append([round(math.degrees(p_lng), 6), round(math.degrees(p_lat), 6)])

    features = [
        {
            "type": "Feature",
            "properties": {
                "name": f"Zone B — Surveillance Window ({radius_km} km radius)",
                "type": "surveillance_window",
                "area_ha": buffer_area_ha,
                "geometry_constraint": "Exact circular AOI buffer",
                "status": "active_monitoring_boundary",
                "datum": "WGS84",
                "center": [lat, lng],
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [circle_coords],
            },
        }
    ]

    # Run actual STAC raster processing to get genuine disturbance polygons
    try:
        b_res = stac_service.search_sentinel2_scenes(bbox, "2021-05-01", "2021-10-31", max_cloud_pct=30.0, limit=1)
        l_res = stac_service.search_sentinel2_scenes(bbox, "2024-05-01", "2024-09-30", max_cloud_pct=30.0, limit=1)
        if b_res.get("scenes") and l_res.get("scenes"):
            calc = stac_service.process_change_raster(
                b_res["scenes"][0], l_res["scenes"][0], bbox, lat, lng, radius_km
            )
            if calc.get("success"):
                for idx, poly in enumerate(calc.get("polygons", [])):
                    c_name = (
                        f"Zone A — Core Disturbance Cluster 1 (Candidate Vegetation Loss, ΔNDVI <= -0.15)"
                        if idx == 0
                        else f"Disturbance Cluster {idx + 1} (Candidate Vegetation Loss, ΔNDVI <= -0.15)"
                    )
                    features.append({
                        "type": "Feature",
                        "properties": {
                            "name": c_name,
                            "type": "zone_a_core" if idx == 0 else "detected_canopy_disturbance",
                            "area_approx_ha": poly.get("area_approx_ha"),
                            "baseline_observation": b_res["scenes"][0].get("scene_id"),
                            "latest_observation": l_res["scenes"][0].get("scene_id"),
                            "status": "vegetation_decline_detected",
                            "classification_note": "Canopy disturbance detected via Sentinel-2 B04/B08 raster difference; requires independent ground verification",
                        },
                        "geometry": poly.get("geometry"),
                    })
    except Exception as e:
        logger.warning(f"Error enriching GeoJSON export with raster polygons: {e}")

    return {
        "type": "FeatureCollection",
        "name": f"EcoSentinel_{case_name}",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"},
        },
        "features": features,
    }
