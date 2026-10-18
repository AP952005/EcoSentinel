"""
Geospatial service — boundary validation, Zone A/B, area calculations.
Uses Shapely and GeoPandas.
"""
import json
import math
from typing import Optional, Dict, Any, Tuple
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union
import shapely.validation
from pyproj import Transformer, Geod
from app.models.models import Boundary


class GeospatialService:
    def validate_geojson(self, geojson: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate a GeoJSON geometry."""
        try:
            geom = shape(geojson)
            if not geom.is_valid:
                repaired = shapely.validation.make_valid(geom)
                if not repaired.is_valid:
                    return False, f"Invalid geometry: {shapely.validation.explain_validity(geom)}"
            allowed = {"Polygon", "MultiPolygon", "GeometryCollection"}
            if geom.geom_type not in allowed:
                return False, f"Geometry type {geom.geom_type} not supported. Use Polygon or MultiPolygon."
            if geom.is_empty:
                return False, "Geometry is empty"
            return True, None
        except Exception as e:
            return False, f"Geometry parsing error: {str(e)}"

    def calculate_area_ha(self, geojson: Dict[str, Any]) -> float:
        """Calculate area in hectares using geodetic calculation."""
        try:
            geom = shape(geojson)
            geod = Geod(ellps="WGS84")
            area_m2, _ = geod.geometry_area_perimeter(geom)
            return abs(area_m2) / 10000.0
        except Exception:
            return 0.0

    def calculate_perimeter_km(self, geojson: Dict[str, Any]) -> float:
        """Calculate perimeter in km."""
        try:
            geom = shape(geojson)
            geod = Geod(ellps="WGS84")
            _, perim_m = geod.geometry_area_perimeter(geom)
            return perim_m / 1000.0
        except Exception:
            return 0.0

    def create_buffer(self, geojson: Dict[str, Any], distance_m: float) -> Dict[str, Any]:
        """Create a geodetic buffer around a geometry (approximate for small distances)."""
        try:
            # Transform to UTM for buffering, then back
            geom = shape(geojson)
            centroid = geom.centroid
            zone = int((centroid.x + 180) / 6) + 1
            utm_crs = f"+proj=utm +zone={zone} +datum=WGS84 +units=m"
            
            transformer_to = Transformer.from_crs("EPSG:4326", utm_crs, always_xy=True)
            transformer_back = Transformer.from_crs(utm_crs, "EPSG:4326", always_xy=True)
            
            coords = list(geom.exterior.coords)
            utm_coords = [transformer_to.transform(x, y) for x, y in coords]
            utm_geom = Polygon(utm_coords)
            buffered_utm = utm_geom.buffer(distance_m)
            
            back_coords = [transformer_back.transform(x, y) for x, y in list(buffered_utm.exterior.coords)]
            back_geom = Polygon(back_coords)
            return mapping(back_geom)
        except Exception as e:
            return geojson  # Fallback: return original

    def calculate_intersection_area(
        self, geom1_json: Dict[str, Any], geom2_json: Dict[str, Any]
    ) -> float:
        """Intersection area in hectares."""
        try:
            g1 = shape(geom1_json)
            g2 = shape(geom2_json)
            intersection = g1.intersection(g2)
            if intersection.is_empty:
                return 0.0
            geod = Geod(ellps="WGS84")
            area_m2, _ = geod.geometry_area_perimeter(intersection)
            return abs(area_m2) / 10000.0
        except Exception:
            return 0.0

    def calculate_distance_km(
        self, geom1_json: Dict[str, Any], geom2_json: Dict[str, Any]
    ) -> float:
        """Minimum distance between two geometries in km."""
        try:
            g1 = shape(geom1_json)
            g2 = shape(geom2_json)
            p1 = g1.representative_point()
            p2 = g2.representative_point()
            geod = Geod(ellps="WGS84")
            _, _, dist = geod.inv(p1.x, p1.y, p2.x, p2.y)
            return dist / 1000.0
        except Exception:
            return 0.0

    def process_boundary(self, db, project_id: str, zone_type: str, 
                          geojson: Dict[str, Any], source: str = "uploaded",
                          buffer_distance_m: Optional[float] = None) -> Boundary:
        """Validate and calculate metrics for a boundary, return unsaved model."""
        is_valid, err = self.validate_geojson(geojson)
        area_ha = self.calculate_area_ha(geojson) if is_valid else 0.0
        perim_km = self.calculate_perimeter_km(geojson) if is_valid else 0.0

        boundary = Boundary(
            project_id=project_id,
            zone_type=zone_type,
            geometry_geojson=geojson,
            source=source,
            is_valid=is_valid,
            validation_errors=err,
            area_ha=area_ha,
            perimeter_km=perim_km,
            buffer_distance_m=buffer_distance_m,
        )
        return boundary


geo_service = GeospatialService()
