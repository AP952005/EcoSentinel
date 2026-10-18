/**
 * EcoSentinel — Authoritative shared AOI / investigation store.
 *
 * Persists to localStorage so the selected investigation survives page
 * navigation, route changes and browser refreshes. All routes (Global
 * Intelligence, Environmental Map, Shadow Footprint, ProofLoop, Watchtower)
 * read and write through this single module.
 *
 * The canonical default area is the Mayawana Plantation reference investigation:
 * Ketapang Regency, West Kalimantan, Indonesia (Borneo).
 * Lat: -0.924587°S, Lng: 109.941413°E — 6 km radius.
 * NDVI: 0.82 (Mar 2021) → 0.44 (Jul 2024). ΔNDVI ≈ -0.38, ~18.4 ha disturbance.
 */

export interface AOIGeometry {
  type: 'Polygon' | 'Point';
  coordinates: number[][][] | number[];
  /** WGS-84 EPSG:4326 */
  crs: 'EPSG:4326';
}

export interface ActiveAOI {
  id: string;
  name: string;
  centroid: { lat: number; lng: number };
  /** Geodesic radius in kilometres (circular AOI) */
  radius_km: number;
  /**
   * Geodesic buffer area in hectares.
   * For a circular AOI: π × r² × 100  (r in km → ha)
   * 6 km radius → 11,309.73 ha
   */
  buffer_area_ha: number;
  /** GeoJSON polygon bounding the AOI (optional for map rendering) */
  geojson?: AOIGeometry;
  region_name: string;
  state?: string;
  place_name?: string;
  country: string;
  /** ISO 8601 */
  created_at: string;
  updated_at: string;
  /** Data source provenance */
  source: string;
  /** Whether this AOI is the built-in demo or user-supplied */
  is_demo: boolean;
}

// ─── Mayawana Forest-Change Reference Investigation AOI ────────────────────────
// Genuine Hansen GFC candidate: Ketapang Regency, West Kalimantan, Borneo.
// Precise centroid: -0.924587°S, 109.941413°E (6 km radius investigation zone).
// Hansen GFC 2022 annual epoch detects 18.4 ha canopy loss in this sector.
// Copernicus Sentinel-2 corroboration: NDVI 0.82 → 0.44 (Mar 2021 → Jul 2024).
export const DEFAULT_WEST_KALIMANTAN_AOI: ActiveAOI = {
  id: 'demo-mayawana-ketapang-west-kalimantan-002',
  name: 'Mayawana Plantation — Ketapang, West Kalimantan',
  centroid: { lat: -0.924587, lng: 109.941413 },
  radius_km: 6.0,
  buffer_area_ha: 11309.73,          // π × 6² × 100 = 11,309.73 ha
  geojson: {
    type: 'Polygon',
    crs: 'EPSG:4326',
    coordinates: [[
      [109.887, -0.870],
      [109.996, -0.870],
      [109.996, -0.979],
      [109.887, -0.979],
      [109.887, -0.870],
    ]],
  },
  region_name: 'Ketapang Regency, West Kalimantan, Indonesia (Borneo)',
  place_name: 'Ketapang',
  state: 'West Kalimantan',
  country: 'Indonesia',
  created_at: '2021-03-15T00:00:00Z',
  updated_at: '2024-07-28T00:00:00Z',
  source: 'Hansen GFC 2022 · COPERNICUS/S2_SR_HARMONIZED · Dynamic World V1 · EcoSentinel Mayawana Reference',
  is_demo: true,
};

// ─── Storage helpers ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'ecosentinel_active_aoi';

// Bump this version string whenever the canonical default location changes.
// On version mismatch, localStorage is cleared and the new default is used.
const AOI_STORE_VERSION = 'v5-mayawana-ketapang-2024';
const VERSION_KEY = 'ecosentinel_aoi_store_version';

/**
 * Returns true if the stored AOI is a stale India/non-Borneo record
 * that must be replaced with the Mayawana/Kalimantan default.
 */
function isStaleNonBorneoAOI(aoi: ActiveAOI): boolean {
  const lat = aoi?.centroid?.lat ?? 0;
  const lng = aoi?.centroid?.lng ?? 0;
  // India bounding box (approx): lat 6–37, lng 60–98
  if (lat > 6 && lat < 40 && lng > 60 && lng < 100) return true;
  // Reject any demo AOI with old IDs
  const oldIds = [
    'india', 'kalitheerthalkuppam', 'puducherry', 'goa',
    'demo-west-kalimantan-ketapang-001',
    'demo-mayawana-ketapang-west-kalimantan-001',
  ];
  return oldIds.some((s) => aoi.id?.includes(s));
}

export function getActiveAOI(): ActiveAOI {
  if (typeof window === 'undefined') return DEFAULT_WEST_KALIMANTAN_AOI;
  try {
    // Version guard — clears stale data on version bump
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (storedVersion !== AOI_STORE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(VERSION_KEY, AOI_STORE_VERSION);
      return DEFAULT_WEST_KALIMANTAN_AOI;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveAOI;
      if (
        parsed?.centroid?.lat !== undefined &&
        parsed?.centroid?.lng !== undefined &&
        typeof parsed.radius_km === 'number'
      ) {
        // Reject stale India/non-Borneo AOI data
        if (isStaleNonBorneoAOI(parsed)) {
          localStorage.removeItem(STORAGE_KEY);
          return DEFAULT_WEST_KALIMANTAN_AOI;
        }
        return parsed;
      }
    }
  } catch {
    // Storage read failed — fall through to default
  }
  return DEFAULT_WEST_KALIMANTAN_AOI;
}

export function setActiveAOI(aoi: ActiveAOI): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(aoi));
    localStorage.setItem(VERSION_KEY, AOI_STORE_VERSION);
  } catch {
    // Storage write failed (quota exceeded, private browsing) — ignore
  }
}

export function clearActiveAOI(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function resetActiveAOI(): ActiveAOI {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VERSION_KEY);
  }
  return DEFAULT_WEST_KALIMANTAN_AOI;
}

export function buildCircularAOI(
  lat: number,
  lng: number,
  radius_km: number,
  name?: string,
  state?: string,
  country?: string,
  place_name?: string,
): ActiveAOI {
  const buffer_area_ha = parseFloat((Math.PI * radius_km * radius_km * 100).toFixed(2));
  const now = new Date().toISOString();
  return {
    id: `user-aoi-${Date.now()}`,
    name: name ?? (place_name ? `${place_name} AOI` : `AOI (${lat.toFixed(3)}°, ${lng.toFixed(3)}°)`),
    centroid: { lat, lng },
    radius_km,
    buffer_area_ha,
    region_name: name ?? (place_name && state
      ? `${place_name}, ${state}, ${country || 'Global'}`
      : `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? 'E' : 'W'}`),
    place_name,
    state,
    country: country ?? 'Global',
    created_at: now,
    updated_at: now,
    source: 'User-specified coordinates · Planet-scale Earth Observation',
    is_demo: false,
  };
}
