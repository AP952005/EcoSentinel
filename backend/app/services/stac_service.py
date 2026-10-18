"""
EcoSentinel STAC & Earth Observation Service.
Queries public Element84 Earth Search STAC catalog for Sentinel-2 L2A observations,
validates observation compatibility, and computes verifiable NDVI change and disturbance metrics.
"""
import math
import logging
import json
import io
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from shapely.geometry import box, shape, mapping, Polygon
import rasterio
from rasterio.windows import from_bounds
from rasterio.warp import transform_bounds, transform_geom
from rasterio.enums import Resampling
import rasterio.features
from pyproj import Transformer
from PIL import Image

logger = logging.getLogger(__name__)

EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"


class STACService:
    def __init__(self, endpoint_url: str = EARTH_SEARCH_URL, timeout: int = 12):
        self.endpoint_url = endpoint_url
        self.timeout = timeout

    def search_sentinel2_scenes(
        self,
        bbox: List[float],
        start_date: str,
        end_date: str,
        max_cloud_pct: float = 30.0,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """
        Search for real Sentinel-2 L2A observations via Element 84 Earth Search STAC.
        bbox format: [min_lng, min_lat, max_lng, max_lat]
        """
        # Validate bbox coordinates
        if len(bbox) != 4:
            return {"success": False, "error": "Invalid bounding box; must be [min_lng, min_lat, max_lng, max_lat]"}
        min_lng, min_lat, max_lng, max_lat = bbox
        if not (-180 <= min_lng <= 180 and -180 <= max_lng <= 180 and -90 <= min_lat <= 90 and -90 <= max_lat <= 90):
            return {"success": False, "error": f"Coordinates out of range: {bbox}"}
        if min_lng > max_lng or min_lat > max_lat:
            return {"success": False, "error": f"Inverted bounding box: min coordinates exceed max: {bbox}"}

        payload = {
            "collections": ["sentinel-2-l2a"],
            "bbox": [round(min_lng, 4), round(min_lat, 4), round(max_lng, 4), round(max_lat, 4)],
            "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
            "query": {"eo:cloud_cover": {"lt": max_cloud_pct}},
            "sortby": [{"field": "properties.datetime", "direction": "desc"}],
            "limit": limit,
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self.endpoint_url,
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "EcoSentinel-EO/1.0",
                },
            )
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                if resp.status != 200:
                    return {
                        "success": False,
                        "error": f"STAC API returned status {resp.status}",
                        "source": "earth-search-stac",
                    }
                data = json.loads(resp.read().decode("utf-8"))

            features = data.get("features", [])
            scenes = []
            for feat in features:
                props = feat.get("properties", {})
                assets = feat.get("assets", {})
                scene_info = {
                    "scene_id": feat.get("id"),
                    "datetime": props.get("datetime"),
                    "date": props.get("datetime", "")[:10] if props.get("datetime") else "",
                    "cloud_cover_pct": round(float(props.get("eo:cloud_cover", 0.0)), 2),
                    "nodata_pixel_pct": round(float(props.get("s2:nodata_pixel_percentage", 0.0)), 2),
                    "platform": props.get("platform", "Sentinel-2"),
                    "processing_level": "L2A_BOA_SURFACE_REFLECTANCE",
                    "bbox": feat.get("bbox"),
                    "geometry": feat.get("geometry"),
                    "thumbnail_url": assets.get("thumbnail", {}).get("href"),
                    "visual_url": assets.get("visual", {}).get("href"),
                    "red_band_url": assets.get("red", {}).get("href"),
                    "nir_band_url": assets.get("nir", {}).get("href"),
                    "scl_band_url": assets.get("scl", {}).get("href"),
                }
                scenes.append(scene_info)

            return {
                "success": True,
                "count": len(scenes),
                "scenes": scenes,
                "source": "https://earth-search.aws.element84.com/v1",
                "collection": "sentinel-2-l2a",
                "query_bbox": bbox,
                "query_period": f"{start_date} to {end_date}",
            }
        except urllib.error.URLError as e:
            logger.warning(f"STAC request network error: {e}")
            return {
                "success": False,
                "error": f"STAC service network unreachable: {e.reason if hasattr(e, 'reason') else str(e)}",
                "source": "earth-search-stac",
            }
        except Exception as e:
            logger.error(f"Unexpected error in STAC search: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"STAC observation search failed: {str(e)}",
                "source": "earth-search-stac",
            }

    @staticmethod
    def validate_observation_pair(
        baseline_scene: Dict[str, Any],
        latest_scene: Dict[str, Any],
        max_cloud_allowance: float = 35.0,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates whether two observations form a compatible, trustworthy pair for change analysis.
        Rejects incompatible, high-cloud, or chronologically inverted observation pairs.
        """
        if not baseline_scene or not latest_scene:
            return False, "Missing observation metadata for comparison pair"

        b_date_str = baseline_scene.get("date") or baseline_scene.get("datetime", "")[:10]
        l_date_str = latest_scene.get("date") or latest_scene.get("datetime", "")[:10]

        if not b_date_str or not l_date_str:
            return False, "Missing valid acquisition date on one or both observation scenes"

        try:
            b_date = datetime.strptime(b_date_str, "%Y-%m-%d")
            l_date = datetime.strptime(l_date_str, "%Y-%m-%d")
        except ValueError:
            return False, f"Invalid date formatting: '{b_date_str}' or '{l_date_str}'"

        if b_date >= l_date:
            return False, f"Chronological inversion: Baseline date ({b_date_str}) must precede Latest date ({l_date_str})"

        b_cloud = float(baseline_scene.get("cloud_cover_pct", 0.0))
        l_cloud = float(latest_scene.get("cloud_cover_pct", 0.0))

        if b_cloud > max_cloud_allowance:
            return False, f"Baseline scene cloud cover ({b_cloud}%) exceeds allowable threshold ({max_cloud_allowance}%)"

        if l_cloud > max_cloud_allowance:
            return False, f"Latest scene cloud cover ({l_cloud}%) exceeds allowable threshold ({max_cloud_allowance}%)"

        # Check spatial bounding boxes overlap if both present
        b_bbox = baseline_scene.get("bbox")
        l_bbox = latest_scene.get("bbox")
        if b_bbox and l_bbox and len(b_bbox) == 4 and len(l_bbox) == 4:
            b_geom = box(*b_bbox)
            l_geom = box(*l_bbox)
            if not b_geom.intersects(l_geom):
                return False, "Spatial mismatch: Baseline and Latest observation footprints do not overlap"

        return True, "Observation pair is chronologically, spatially, and cloud-compatible"

    @staticmethod
    def compute_ndvi_array(
        red: np.ndarray,
        nir: np.ndarray,
        nodata: Optional[float] = None,
        scl: Optional[np.ndarray] = None,
    ) -> Dict[str, Any]:
        """
        Pure NumPy NDVI computation from Red (B04) and NIR (B08) arrays.
        NDVI = (NIR - Red) / (NIR + Red)
        Safely handles:
        1. Zero denominators (where NIR + Red == 0)
        2. Nodata values
        3. Cloud/shadow masking via SCL (Scene Classification Layer) if provided.
        """
        red = np.asarray(red, dtype=np.float32)
        nir = np.asarray(nir, dtype=np.float32)

        if red.shape != nir.shape:
            raise ValueError(f"Shape mismatch: red shape {red.shape} != nir shape {nir.shape}")

        valid_mask = np.ones(red.shape, dtype=bool)

        # Mask nodata
        if nodata is not None:
            valid_mask &= (red != nodata) & (nir != nodata)

        # Mask non-finite numbers (NaN or inf)
        valid_mask &= np.isfinite(red) & np.isfinite(nir)

        # Mask physical range (surface reflectance must be >= 0)
        valid_mask &= (red >= 0) & (nir >= 0)

        # Cloud mask via SCL (3: Cloud shadow, 8: Cloud med prob, 9: Cloud high prob, 10: Cirrus)
        if scl is not None:
            scl = np.asarray(scl)
            cloud_pixels = np.isin(scl, [3, 8, 9, 10])
            valid_mask &= ~cloud_pixels

        denom = nir + red
        valid_mask &= (denom > 0)

        total_pixels = red.size
        valid_pixel_count = int(np.count_nonzero(valid_mask))

        if valid_pixel_count == 0:
            return {
                "valid": False,
                "error": "No valid pixels remaining after cloud and nodata masking",
                "valid_pixel_count": 0,
                "total_pixels": total_pixels,
                "mean_ndvi": 0.0,
            }

        ndvi = np.zeros(red.shape, dtype=np.float32)
        ndvi[valid_mask] = (nir[valid_mask] - red[valid_mask]) / denom[valid_mask]

        # Clip to valid index bounds [-1.0, 1.0]
        ndvi[valid_mask] = np.clip(ndvi[valid_mask], -1.0, 1.0)

        valid_values = ndvi[valid_mask]
        mean_val = float(np.mean(valid_values))
        min_val = float(np.min(valid_values))
        max_val = float(np.max(valid_values))
        std_val = float(np.std(valid_values))

        return {
            "valid": True,
            "mean_ndvi": round(mean_val, 4),
            "min_ndvi": round(min_val, 4),
            "max_ndvi": round(max_val, 4),
            "std_ndvi": round(std_val, 4),
            "valid_pixel_count": valid_pixel_count,
            "total_pixels": total_pixels,
            "valid_coverage_pct": round((valid_pixel_count / total_pixels) * 100.0, 2),
            "ndvi_array": ndvi,
            "valid_mask": valid_mask,
        }

    @staticmethod
    def calculate_disturbance_area(
        pixel_count: int,
        pixel_size_m: float = 10.0,
    ) -> float:
        """
        Calculate disturbance area in hectares from confirmed disturbance pixel count.
        For Sentinel-2 10m bands (B04, B08): 1 pixel = 100 m² = 0.01 ha.
        """
        if pixel_count <= 0 or pixel_size_m <= 0:
            return 0.0
        area_m2 = pixel_count * (pixel_size_m ** 2)
        return round(area_m2 / 10000.0, 2)

    query_sentinel2_stac = search_sentinel2_scenes

    @staticmethod
    def calculate_transparent_ndvi_change(
        baseline_b08: float,
        baseline_b04: float,
        latest_b08: float,
        latest_b04: float,
        threshold: float = -0.15,
    ) -> Dict[str, Any]:
        """
        Computes transparent point/mean NDVI and change metric.
        NDVI = (NIR - Red) / (NIR + Red)
        B08: Near-Infrared (NIR)
        B04: Red
        """
        b_denom = baseline_b08 + baseline_b04
        l_denom = latest_b08 + latest_b04

        b_ndvi = round((baseline_b08 - baseline_b04) / b_denom, 4) if b_denom != 0 else 0.0
        l_ndvi = round((latest_b08 - latest_b04) / l_denom, 4) if l_denom != 0 else 0.0
        delta_ndvi = round(l_ndvi - b_ndvi, 4)

        return {
            "baseline_ndvi": round(b_ndvi, 2),
            "latest_ndvi": round(l_ndvi, 2),
            "delta_ndvi": round(delta_ndvi, 2),
            "formula": "NDVI = (B08 - B04) / (B08 + B04)",
            "change_detected": delta_ndvi <= threshold,
            "severity": "severe" if delta_ndvi <= -0.30 else ("moderate" if delta_ndvi <= -0.15 else "nominal"),
        }

    def process_change_raster(
        self,
        baseline_scene: Dict[str, Any],
        latest_scene: Dict[str, Any],
        bbox: List[float],
        centroid_lat: float,
        centroid_lng: float,
        radius_km: float = 6.0,
        threshold: float = -0.15,
    ) -> Dict[str, Any]:
        """
        Executes real Sentinel-2 raster processing directly from STAC COG assets.
        Retrieves actual B04 (Red), B08 (NIR), and SCL (Scene Classification Layer) bands,
        clips precisely to the circular AOI, computes pixel-wise NDVI arrays,
        and calculates disturbance metrics bounded by exact geometric constraints.
        """
        # 1. Enforce strict geometric limit: 6 km radius = max 11,309.73 ha
        buffer_area_ha = round(math.pi * (radius_km ** 2) * 100.0, 2)

        # 2. Extract asset URLs
        b_red_url = baseline_scene.get("red_band_url")
        b_nir_url = baseline_scene.get("nir_band_url")
        b_scl_url = baseline_scene.get("scl_band_url")

        l_red_url = latest_scene.get("red_band_url")
        l_nir_url = latest_scene.get("nir_band_url")
        l_scl_url = latest_scene.get("scl_band_url")

        if not (b_red_url and b_nir_url and l_red_url and l_nir_url):
            return {
                "success": False,
                "error": "Missing one or more required Sentinel-2 COG band assets (B04/B08) in scene metadata",
            }

        try:
            # 3. Read Baseline Bands from COG
            with rasterio.open(b_red_url) as s_b4, rasterio.open(b_nir_url) as s_b8:
                bounds_b = transform_bounds("EPSG:4326", s_b4.crs, *bbox)
                win_b = from_bounds(*bounds_b, transform=s_b4.transform)
                b04_b = s_b4.read(1, window=win_b).astype(np.float32)
                b08_b = s_b8.read(1, window=win_b).astype(np.float32)
                base_transform = rasterio.windows.transform(win_b, s_b4.transform)
                base_crs = s_b4.crs

            # Baseline SCL (20m native resolution, resample to 10m window)
            if b_scl_url:
                with rasterio.open(b_scl_url) as s_bscl:
                    win_bscl = from_bounds(*bounds_b, transform=s_bscl.transform)
                    scl_b = s_bscl.read(1, window=win_bscl, out_shape=b04_b.shape, resampling=Resampling.nearest)
            else:
                scl_b = np.full(b04_b.shape, 4, dtype=np.uint8)

            # 4. Read Latest Bands from COG
            with rasterio.open(l_red_url) as s_l4, rasterio.open(l_nir_url) as s_l8:
                bounds_l = transform_bounds("EPSG:4326", s_l4.crs, *bbox)
                win_l = from_bounds(*bounds_l, transform=s_l4.transform)
                b04_l = s_l4.read(1, window=win_l, out_shape=b04_b.shape, resampling=Resampling.bilinear).astype(np.float32)
                b08_l = s_l8.read(1, window=win_l, out_shape=b04_b.shape, resampling=Resampling.bilinear).astype(np.float32)

            # Latest SCL
            if l_scl_url:
                with rasterio.open(l_scl_url) as s_lscl:
                    win_lscl = from_bounds(*bounds_l, transform=s_lscl.transform)
                    scl_l = s_lscl.read(1, window=win_lscl, out_shape=b04_b.shape, resampling=Resampling.nearest)
            else:
                scl_l = np.full(b04_b.shape, 4, dtype=np.uint8)

            # 5. Build Circular AOI Mask
            h, w = b04_b.shape
            t_to_utm = Transformer.from_crs("EPSG:4326", base_crs, always_xy=True)
            c_x, c_y = t_to_utm.transform(centroid_lng, centroid_lat)
            
            xs = base_transform.c + (np.arange(w) + 0.5) * base_transform.a
            ys = base_transform.f + (np.arange(h) + 0.5) * base_transform.e
            grid_x, grid_y = np.meshgrid(xs, ys)
            dist_m = np.sqrt((grid_x - c_x) ** 2 + (grid_y - c_y) ** 2)
            circle_mask = dist_m <= (radius_km * 1000.0)

            total_aoi_pixels = int(np.count_nonzero(circle_mask))
            if total_aoi_pixels == 0:
                return {
                    "success": False,
                    "error": f"Calculated zero pixels within AOI radius ({radius_km} km)",
                }

            # 6. Apply Valid & Cloud Masking
            # SCL masked: 0 (No data), 1 (Defective), 3 (Cloud shadow), 8 (Med cloud), 9 (High cloud), 10 (Cirrus)
            valid_b = (
                (b04_b > 0)
                & (b08_b > 0)
                & np.isfinite(b04_b)
                & np.isfinite(b08_b)
                & (~np.isin(scl_b, [0, 1, 3, 8, 9, 10]))
            )
            valid_l = (
                (b04_l > 0)
                & (b08_l > 0)
                & np.isfinite(b04_l)
                & np.isfinite(b08_l)
                & (~np.isin(scl_l, [0, 1, 3, 8, 9, 10]))
            )

            # Denominators must be positive
            denom_b = b08_b + b04_b
            denom_l = b08_l + b04_l
            valid_b &= denom_b > 0
            valid_l &= denom_l > 0

            # 7. Compute NDVI arrays
            ndvi_b = np.full(b04_b.shape, np.nan, dtype=np.float32)
            ndvi_l = np.full(b04_b.shape, np.nan, dtype=np.float32)
            ndvi_b[valid_b] = np.clip((b08_b[valid_b] - b04_b[valid_b]) / denom_b[valid_b], -1.0, 1.0)
            ndvi_l[valid_l] = np.clip((b08_l[valid_l] - b04_l[valid_l]) / denom_l[valid_l], -1.0, 1.0)

            # Evaluate within circular AOI
            base_aoi_valid = circle_mask & valid_b
            latest_aoi_valid = circle_mask & valid_l
            both_aoi_valid = base_aoi_valid & latest_aoi_valid

            base_valid_count = int(np.count_nonzero(base_aoi_valid))
            latest_valid_count = int(np.count_nonzero(latest_aoi_valid))
            overlap_valid_count = int(np.count_nonzero(both_aoi_valid))

            base_coverage_pct = round((base_valid_count / total_aoi_pixels) * 100.0, 2)
            latest_coverage_pct = round((latest_valid_count / total_aoi_pixels) * 100.0, 2)
            valid_coverage_pct = round((overlap_valid_count / total_aoi_pixels) * 100.0, 2)

            if valid_coverage_pct < 5.0:
                return {
                    "success": False,
                    "error": (
                        f"Insufficient cloud-free observation coverage ({valid_coverage_pct}% valid overlap) "
                        f"within AOI. Baseline valid coverage: {base_coverage_pct}%, Latest valid coverage: {latest_coverage_pct}%."
                    ),
                    "coverage": {
                        "baseline_valid_pct": base_coverage_pct,
                        "latest_valid_pct": latest_coverage_pct,
                        "overlap_valid_pct": valid_coverage_pct,
                    },
                }

            b_mean = float(np.mean(ndvi_b[base_aoi_valid])) if base_valid_count > 0 else 0.0
            l_mean = float(np.mean(ndvi_l[latest_aoi_valid])) if latest_valid_count > 0 else 0.0
            delta_ndvi = round(l_mean - b_mean, 4)

            # 8. Compute Canopy Disturbance
            delta_array = np.full(b04_b.shape, np.nan, dtype=np.float32)
            delta_array[both_aoi_valid] = ndvi_l[both_aoi_valid] - ndvi_b[both_aoi_valid]

            disturbed_mask = both_aoi_valid & (delta_array <= threshold)
            disturbed_pixels = int(np.count_nonzero(disturbed_mask))
            pixel_area_ha = (abs(base_transform.a) * abs(base_transform.e)) / 10000.0
            disturbed_area_ha = round(disturbed_pixels * pixel_area_ha, 2)

            # Strict geometry enforcement
            disturbed_area_ha = min(disturbed_area_ha, buffer_area_ha)

            # 9. Extract Actual Disturbance Geometry Polygons
            disturbed_polygons = []
            try:
                geom_mask = disturbed_mask.astype(np.uint8)
                t_to_wgs84 = Transformer.from_crs(base_crs, "EPSG:4326", always_xy=True)
                for geom_dict, val in rasterio.features.shapes(geom_mask, mask=(geom_mask == 1), transform=base_transform):
                    if val != 1:
                        continue
                    # Transform coordinates to EPSG:4326
                    ring_coords = geom_dict.get("coordinates", [])
                    wgs84_coords = []
                    for ring in ring_coords:
                        wgs_ring = [list(t_to_wgs84.transform(x, y)) for x, y in ring]
                        if len(wgs_ring) >= 4:
                            wgs84_coords.append(wgs_ring)
                    if wgs84_coords:
                        poly_geom = {"type": "Polygon", "coordinates": wgs84_coords}
                        poly_shape = shape(poly_geom)
                        if poly_shape.is_valid and poly_shape.area > 0:
                            disturbed_polygons.append({
                                "geometry": poly_geom,
                                "area_approx_ha": round((poly_shape.area * 111.0 * 111.0) * 100.0, 2),
                            })
                # Sort largest first, take top 12
                disturbed_polygons.sort(key=lambda p: p["area_approx_ha"], reverse=True)
                disturbed_polygons = disturbed_polygons[:12]
            except Exception as e:
                logger.warning(f"Polygon extraction from disturbance mask failed: {e}")

            return {
                "success": True,
                "metrics": {
                    "baseline_ndvi_mean": round(b_mean, 4),
                    "latest_ndvi_mean": round(l_mean, 4),
                    "delta_ndvi": delta_ndvi,
                    "disturbed_pixel_count": disturbed_pixels,
                    "disturbed_area_ha": disturbed_area_ha,
                    "buffer_area_ha": buffer_area_ha,
                    "threshold_used": threshold,
                    "vegetation_loss_detected": bool(delta_ndvi <= threshold),
                    "valid_coverage_pct": valid_coverage_pct,
                    "baseline_coverage_pct": base_coverage_pct,
                    "latest_coverage_pct": latest_coverage_pct,
                    "total_aoi_pixels": total_aoi_pixels,
                },
                "classification_context": {
                    "status_label": (
                        "Vegetation Decline / Canopy Disturbance Detected"
                        if delta_ndvi <= threshold
                        else "Stable / Minor Spectral Fluctuation"
                    ),
                    "evidence_disclaimer": (
                        "Measured NDVI delta reflects spectral canopy disturbance within the AOI. "
                        "Independent ground or aerial verification is required before attributing "
                        "legal culpability, logging authorization status, or intentional deforestation."
                    ),
                },
                "polygons": disturbed_polygons,
            }

        except Exception as e:
            logger.error(f"Error during raster processing: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Raster processing failed: {str(e)}",
            }

    def render_true_color_image(
        self,
        visual_url: str,
        bbox: List[float],
        max_size: int = 1024,
    ) -> Optional[bytes]:
        """
        Renders a true-color (RGB) JPEG thumbnail or image overlay directly from a
        Sentinel-2 True Color Image (TCI) Cloud-Optimized GeoTIFF.
        """
        try:
            with rasterio.open(visual_url) as src:
                bounds = transform_bounds("EPSG:4326", src.crs, *bbox)
                win = from_bounds(*bounds, transform=src.transform)
                rgb = src.read([1, 2, 3], window=win)

            # Transpose from (3, H, W) to (H, W, 3)
            rgb_arr = rgb.transpose(1, 2, 0)
            img = Image.fromarray(rgb_arr)
            if max(img.size) > max_size:
                img.thumbnail((max_size, max_size), Image.Resampling.BILINEAR)

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            return buf.getvalue()
        except Exception as e:
            logger.error(f"Failed to render true color image from {visual_url}: {e}")
            return None


stac_service = STACService()
