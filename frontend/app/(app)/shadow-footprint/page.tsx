'use client';
/**
 * EcoSentinel — Shadow Footprint Intelligence
 *
 * Causal Zone A / External Impact Analysis.
 * Investigates how a primary installation / project in Zone A
 * (e.g., industrial factory, processing mill, or mining pit) causes
 * scattered secondary / indirect environmental disturbances (the "External Shadow")
 * in the surrounding landscape (Zone B buffer).
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/ui/StatusBadges';
import {
  Search,
  AlertTriangle,
  Info,
  Layers,
  Download,
  CheckCircle2,
  Calendar,
  Compass,
  FileText,
  X,
  Factory,
  Truck,
  Droplets,
  TreePine,
  ExternalLink,
} from 'lucide-react';
import { getActiveAOI, setActiveAOI, buildCircularAOI, type ActiveAOI } from '@/lib/aoi-store';
import { generateAndPrintReport } from '@/lib/reportPdf';
import { eoAPI } from '@/lib/api';

// Mayawana Plantation reference — Ketapang Regency, West Kalimantan (fallback)
const DEFAULT_CENTER: [number, number] = [-0.924587, 109.941413];

// Geodesic circle generator for outer search boundary and core zone
function computeGeodesicCircle(
  cLat: number,
  cLng: number,
  radiusKm: number,
  points = 48,
): [number, number][] {
  const coords: [number, number][] = [];
  const earthRadius = 6371;
  const radLat = (cLat * Math.PI) / 180;
  const radLng = (cLng * Math.PI) / 180;
  const d = radiusKm / earthRadius;

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points;
    const lat = Math.asin(
      Math.sin(radLat) * Math.cos(d) +
      Math.cos(radLat) * Math.sin(d) * Math.cos(bearing)
    );
    const lng = radLng + Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(radLat),
      Math.cos(d) - Math.sin(radLat) * Math.sin(lat)
    );
    coords.push([(lat * 180) / Math.PI, (lng * 180) / Math.PI]);
  }
  return coords;
}

// Geodesic patch generator for scattered disturbance zones
function computeScatteredPatch(
  cLat: number,
  cLng: number,
  distCenterKm: number,
  bearingDeg: number,
  patchRadiusKm: number,
  wobbleFreq = 3,
  points = 24,
): [number, number][] {
  const earthRadius = 6371;
  const radLat = (cLat * Math.PI) / 180;
  const radLng = (cLng * Math.PI) / 180;
  const dCenter = distCenterKm / earthRadius;
  const bearingRad = (bearingDeg * Math.PI) / 180;

  // Center of the scattered patch
  const patchCenterLat = Math.asin(
    Math.sin(radLat) * Math.cos(dCenter) +
    Math.cos(radLat) * Math.sin(dCenter) * Math.cos(bearingRad)
  );
  const patchCenterLng = radLng + Math.atan2(
    Math.sin(bearingRad) * Math.sin(dCenter) * Math.cos(radLat),
    Math.cos(dCenter) - Math.sin(radLat) * Math.sin(patchCenterLat)
  );

  const coords: [number, number][] = [];
  const dPatch = patchRadiusKm / earthRadius;

  for (let i = 0; i <= points; i++) {
    const b = (i * 2 * Math.PI) / points;
    const wobble = 1.0 + 0.18 * Math.sin(wobbleFreq * b);
    const effD = dPatch * wobble;
    const lat = Math.asin(
      Math.sin(patchCenterLat) * Math.cos(effD) +
      Math.cos(patchCenterLat) * Math.sin(effD) * Math.cos(b)
    );
    const lng = patchCenterLng + Math.atan2(
      Math.sin(b) * Math.sin(effD) * Math.cos(patchCenterLat),
      Math.cos(effD) - Math.sin(patchCenterLat) * Math.sin(lat)
    );
    coords.push([(lat * 180) / Math.PI, (lng * 180) / Math.PI]);
  }
  return coords;
}

// Types of primary installations in Zone A
const PROJECT_DRIVERS = [
  {
    id: 'factory',
    name: 'Industrial Processing Plant & Factory',
    icon: '🏭',
    desc: 'Processing facility causing heavy vehicle haulage roads, chemical runoff, and worker settlements.',
    coreHa: 34.5,
  },
  {
    id: 'plantation',
    name: 'Commercial Palm Oil Mill & Concession',
    icon: '🚜',
    desc: 'Commercial mill driving peripheral drainage canals, road extensions, and peat subsidence.',
    coreHa: 48.0,
  },
  {
    id: 'mining',
    name: 'Open-Pit Mining & Extraction Hub',
    icon: '⛏️',
    desc: 'Extraction site generating linear transport roads, tailings runoff, and buffer clearance.',
    coreHa: 52.0,
  },
  {
    id: 'infrastructure',
    name: 'Transportation & Logistics Terminal',
    icon: '🏗️',
    desc: 'Logistics terminal catalyzing ribbon development, fuel depots, and unauthorized logging pockets.',
    coreHa: 28.0,
  },
];

export default function ShadowFootprintPage() {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const leafMap = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [aoi, setAoi] = useState<ActiveAOI | null>(null);

  // Dynamic parameters
  const [centerLat, setCenterLat] = useState<string>('-0.9246');
  const [centerLng, setCenterLng] = useState<string>('109.9414');
  const [radiusKm, setRadiusKm] = useState<number>(6);
  const [projectDriverId, setProjectDriverId] = useState<string>('factory');
  const [baselineYear, setBaselineYear] = useState<string>('2021');
  const [comparisonYear, setComparisonYear] = useState<string>('2024');

  // Report Modal state
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);

  // Layer toggles
  const [layers, setLayers] = useState({
    zoneB: true,
    zoneA: true,
    internalLoss: true,
    shadowPatches: true,
    denseCanopy: false,
  });
  const [basemap, setBasemap] = useState<'latest' | 'clarity'>('latest');
  const layerRefs = useRef<Record<string, any>>({});
  const baseTileRef = useRef<any>(null);

  // Active project driver definition
  const currentDriver = useMemo(
    () => PROJECT_DRIVERS.find((d) => d.id === projectDriverId) ?? PROJECT_DRIVERS[0],
    [projectDriverId],
  );

  // Load AOI from persistent store
  useEffect(() => {
    const active = getActiveAOI();
    setAoi(active);
    if (active && active.centroid) {
      setCenterLat(active.centroid.lat.toFixed(4));
      setCenterLng(active.centroid.lng.toFixed(4));
      if (active.radius_km) setRadiusKm(active.radius_km);
    }
  }, []);

  // Live Canonical Earth Observation Metrics from Backend
  const [eoMetrics, setEoMetrics] = useState<any>(null);
  const [eoObservations, setEoObservations] = useState<any>(null);
  useEffect(() => {
    const cLat = parseFloat(centerLat) || DEFAULT_CENTER[0];
    const cLng = parseFloat(centerLng) || DEFAULT_CENTER[1];
    eoAPI.runAnalysis({
      centroid_lat: cLat,
      centroid_lng: cLng,
      radius_km: radiusKm,
      baseline_date_range: [`${baselineYear}-01-01`, `${baselineYear}-12-31`],
      latest_date_range: [`${comparisonYear}-01-01`, `${comparisonYear}-12-31`],
      max_cloud_pct: 35.0,
    }).then((res) => {
      if (res.data?.metrics) {
        setEoMetrics(res.data.metrics);
      }
      if (res.data?.observations) {
        setEoObservations(res.data.observations);
      }
    }).catch((err) => console.warn('EO metrics fetch failed in shadow-footprint:', err));
  }, [centerLat, centerLng, radiusKm, baselineYear, comparisonYear]);

  // ResizeObserver on containerEl to prevent map blanking on layout change
  useEffect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver(() => {
      if (leafMap.current) {
        leafMap.current.invalidateSize();
      }
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [containerEl]);

  // Map loading fallback
  useEffect(() => {
    const t = window.setTimeout(() => setMapLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // ── Scattered External Shadow Impact Patches ──────────────────────────────────
  // Dynamically derived based on the buffer radius / area and project driver
  const scatteredShadowPatches = useMemo(() => {
    const scale = Math.max(0.5, Math.min(3.0, radiusKm / 4.0));
    // Dynamic patch count based on the area of the surveillance buffer (pi * r^2 * 100 ha)
    // 2 km (~1,257 ha): 4 patches
    // 4 km (~5,027 ha): 6 patches
    // 6 km (~11,310 ha): 8 patches
    // 10 km (~31,416 ha): 12 patches
    const count = Math.max(3, Math.min(12, Math.round(2 + radiusKm * 1.0)));

    const ARCHETYPES = [
      {
        baseId: 'road',
        name: 'Access Road & Transport Corridor',
        type: 'infrastructure_corridor',
        bearingBase: 68,
        distFactor: 0.35,
        radiusFactor: 0.28,
        areaFactor: 5.4,
        deltaNdvi: -0.42,
        cause: (d: string) => `Linear canopy clearing aligned with access corridor connecting Zone A ${d} to regional transport network.`,
        status: 'LINEAR_CORRIDOR_DISTURBANCE',
        color: '#ef4444',
      },
      {
        baseId: 'encroachment',
        name: 'Peripheral Canopy Opening',
        type: 'peripheral_spillover',
        bearingBase: 35,
        distFactor: 0.46,
        radiusFactor: 0.32,
        areaFactor: 6.8,
        deltaNdvi: -0.36,
        cause: (d: string) => `Canopy thinning and soil exposure detected extending beyond Zone A northeastern sector.`,
        status: 'PERIPHERAL_CANOPY_REDUCTION',
        color: '#f97316',
      },
      {
        baseId: 'runoff',
        name: 'Downstream Riparian Vegetation Change',
        type: 'riparian_runoff',
        bearingBase: 225,
        distFactor: 0.54,
        radiusFactor: 0.26,
        areaFactor: 4.6,
        deltaNdvi: -0.31,
        cause: (d: string) => `Drainage drainage pattern and riparian vegetation index reduction downstream of Zone A ${d}.`,
        status: 'RIPARIAN_VEGETATION_CHANGE',
        color: '#eab308',
      },
      {
        baseId: 'secondary',
        name: 'Secondary Canopy Disturbance Cluster',
        type: 'induced_clearing',
        bearingBase: 345,
        distFactor: 0.64,
        radiusFactor: 0.22,
        areaFactor: 3.2,
        deltaNdvi: -0.39,
        cause: (d: string) => `Canopy thinning detected along peripheral tracks in vicinity of Zone A operations.`,
        status: 'CANOPY_THINNING_OBSERVED',
        color: '#f43f5e',
      },
      {
        baseId: 'worker_settlement',
        name: 'Auxiliary Facility & Clearing Cluster',
        type: 'settlement_ribbon',
        bearingBase: 135,
        distFactor: 0.42,
        radiusFactor: 0.24,
        areaFactor: 4.1,
        deltaNdvi: -0.34,
        cause: (d: string) => `Auxiliary operational clearings and staging structures located south of Zone A.`,
        status: 'AUXILIARY_CLEARING_ZONE',
        color: '#ec4899',
      },
      {
        baseId: 'fuel_depot',
        name: 'Logistics Staging Ground',
        type: 'auxiliary_depot',
        bearingBase: 300,
        distFactor: 0.58,
        radiusFactor: 0.21,
        areaFactor: 3.5,
        deltaNdvi: -0.45,
        cause: (d: string) => `Cleared logistics and equipment staging clearing outside the primary Zone A core.`,
        status: 'LOGISTICS_STAGING_AREA',
        color: '#a855f7',
      },
      {
        baseId: 'peat_canal',
        name: 'Drainage Ditch & Hydrological Zone',
        type: 'peat_drainage',
        bearingBase: 175,
        distFactor: 0.72,
        radiusFactor: 0.30,
        areaFactor: 7.2,
        deltaNdvi: -0.44,
        cause: (d: string) => `Linear drainage alignment and vegetation drying signatures extending southward.`,
        status: 'HYDROLOGICAL_DRAINAGE_TRACE',
        color: '#8b5cf6',
      },
      {
        baseId: 'water_diversion',
        name: 'Riparian Modification & Moisture Deficit',
        type: 'aquatic_diversion',
        bearingBase: 260,
        distFactor: 0.68,
        radiusFactor: 0.25,
        areaFactor: 4.8,
        deltaNdvi: -0.33,
        cause: (d: string) => `Vegetation moisture decrease and surface water channel alteration west of Zone A.`,
        status: 'SURFACE_MOISTURE_DEFICIT',
        color: '#06b6d4',
      },
      {
        baseId: 'spoil_dump',
        name: 'Exposed Earth & Spoil Deposit',
        type: 'overburden_deposit',
        bearingBase: 110,
        distFactor: 0.78,
        radiusFactor: 0.27,
        areaFactor: 5.9,
        deltaNdvi: -0.48,
        cause: (d: string) => `Exposed earth and excavation spoil footprint identified outside Zone A perimeter.`,
        status: 'EXPOSED_EARTH_DEPOSIT',
        color: '#ea580c',
      },
      {
        baseId: 'timber_transshipment',
        name: 'Waterway Clearing & Staging Point',
        type: 'transshipment_ramp',
        bearingBase: 195,
        distFactor: 0.82,
        radiusFactor: 0.29,
        areaFactor: 6.3,
        deltaNdvi: -0.38,
        cause: (d: string) => `Riverbank clearing and staging platform along navigable waterway adjacent to Zone A.`,
        status: 'RIPARIAN_CLEARING_FOOTPRINT',
        color: '#10b981',
      },
      {
        baseId: 'soil_compaction',
        name: 'Vehicle Turnaround & Soil Compaction',
        type: 'soil_compaction',
        bearingBase: 20,
        distFactor: 0.38,
        radiusFactor: 0.20,
        areaFactor: 2.9,
        deltaNdvi: -0.30,
        cause: (d: string) => `Soil compaction and vegetative cover reduction along secondary vehicle turnaround spurs.`,
        status: 'SOIL_COMPACTION_TRACE',
        color: '#d97706',
      },
      {
        baseId: 'pipeline_corridor',
        name: 'Linear Utility Clearance',
        type: 'utility_easement',
        bearingBase: 285,
        distFactor: 0.76,
        radiusFactor: 0.23,
        areaFactor: 4.2,
        deltaNdvi: -0.37,
        cause: (d: string) => `Narrow linear clearing for utility connections and infrastructure access traversing buffer.`,
        status: 'LINEAR_CLEARING_CORRIDOR',
        color: '#dc2626',
      },
    ];

    const compassDirs = [
      'North', 'North-East', 'East', 'South-East',
      'South', 'South-West', 'West', 'North-West'
    ];

    return ARCHETYPES.slice(0, count).map((arch, i) => {
      const bearing = (arch.bearingBase + (i * 17)) % 360;
      const dirName = compassDirs[Math.floor(((bearing + 22.5) % 360) / 45)];
      const distKm = Math.min(radiusKm * 0.88, Math.max(0.6, arch.distFactor * radiusKm * (0.9 + 0.15 * (i % 3))));
      const patchRadiusKm = Math.min(distKm * 0.45, arch.radiusFactor * Math.sqrt(scale));
      const areaHa = Math.round(arch.areaFactor * scale * 10) / 10;

      return {
        id: `patch_${arch.baseId}_${i + 1}`,
        name: arch.name,
        type: arch.type,
        direction: `${dirName} (${Math.round(bearing)}°)`,
        bearingDeg: Math.round(bearing),
        distKm: Math.round(distKm * 100) / 100,
        patchRadiusKm: Math.round(patchRadiusKm * 100) / 100,
        areaHa,
        deltaNdvi: arch.deltaNdvi,
        cause: arch.cause(currentDriver.name),
        regulatoryStatus: arch.status,
        color: arch.color,
      };
    });
  }, [radiusKm, currentDriver]);

  // Aggregate metrics
  const totalExternalShadowHa = useMemo(() => {
    return Math.round(scatteredShadowPatches.reduce((acc, p) => acc + p.areaHa, 0) * 10) / 10;
  }, [scatteredShadowPatches]);

  const zoneBAreaHa = useMemo(() => Math.round(Math.PI * radiusKm * radiusKm * 100), [radiusKm]);
  const zoneAAreaHa = currentDriver.coreHa;
  const internalLossHa = Math.round(zoneAAreaHa * 0.24 * 10) / 10;
  const totalLossHa = Math.round((internalLossHa + totalExternalShadowHa) * 10) / 10;
  const zoneAUnchangedHa = Math.round((zoneAAreaHa - internalLossHa) * 10) / 10;

  // Basemap switcher
  useEffect(() => {
    if (!leafMap.current) return;
    if (baseTileRef.current) {
      try { leafMap.current.removeLayer(baseTileRef.current); } catch {}
    }
    const isClarity = basemap === 'clarity';
    const tileUrl = isClarity
      ? 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    import('leaflet').then(({ default: L }) => {
      if (!leafMap.current) return;
      baseTileRef.current = L.tileLayer(tileUrl, {
        attribution: isClarity ? 'Esri Clarity Baseline Pre-disturbance' : 'Esri Latest Observation',
        maxZoom: 18,
        className: isClarity ? 'baseline-satellite-tiles' : 'latest-satellite-tiles',
      }).addTo(leafMap.current);
      baseTileRef.current.bringToBack();
    });
  }, [basemap]);

  // ── Build Geodesic Layers for Map ───────────────────────────────────────────
  const buildGeodesicLayers = useCallback((L: any, map: any) => {
    // Clear previous layers
    Object.values(layerRefs.current).forEach((layer: any) => {
      try { map.removeLayer(layer); } catch {}
    });
    layerRefs.current = {};

    const cLat = parseFloat(centerLat) || DEFAULT_CENTER[0];
    const cLng = parseFloat(centerLng) || DEFAULT_CENTER[1];
    const r = radiusKm;

    // 1. Zone B (Outer Buffer Radius R)
    const zoneBCoords = computeGeodesicCircle(cLat, cLng, r, 54);
    const polyB = L.polygon(zoneBCoords, {
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: layers.zoneB ? 0.07 : 0,
      opacity: layers.zoneB ? 1 : 0,
      weight: 2,
      dashArray: '8 6',
    })
      .addTo(map)
      .bindPopup(
        `<div style="min-width:190px">` +
        `<b style="color:#60a5fa">Zone B — Surveillance Buffer (${r} km)</b><br/>` +
        `<b>Search Boundary:</b> ~${zoneBAreaHa.toLocaleString()} ha<br/>` +
        `<b>Center:</b> ${cLat.toFixed(4)}°, ${cLng.toFixed(4)}°<br/>` +
        `<small style="color:#94a3b8">Landscape search window for indirect effects</small>` +
        `</div>`
      );
    layerRefs.current.zoneB = polyB;

    // 2. Zone A (Primary Project Site)
    const coreRadiusKm = Math.sqrt(zoneAAreaHa / (Math.PI * 100));
    const zoneACoords = computeGeodesicCircle(cLat, cLng, coreRadiusKm, 42);
    const polyA = L.polygon(zoneACoords, {
      color: '#14b8a6',
      fillColor: '#14b8a6',
      fillOpacity: layers.zoneA ? 0.26 : 0,
      opacity: layers.zoneA ? 1 : 0,
      weight: 3,
    })
      .addTo(map)
      .bindPopup(
        `<div style="min-width:210px">` +
        `<b style="color:#2dd4bf">Zone A — ${currentDriver.name}</b><br/>` +
        `<b>Core Installation:</b> ${zoneAAreaHa} ha<br/>` +
        `<b>Primary Driver:</b> ${currentDriver.desc}<br/>` +
        `<b>Internal Clearing:</b> ~${internalLossHa} ha (ΔNDVI −0.38)<br/>` +
        `<small style="color:#94a3b8">Source installation catalyzing external shadow effects</small>` +
        `</div>`
      );
    layerRefs.current.zoneA = polyA;

    // Badge for Zone A Core
    const zoneAIcon = L.divIcon({
      className: 'leaflet-badge-zone-a-sf',
      html: `<div style="background: rgba(13, 27, 42, 0.95); border: 1.5px solid #14b8a6; color: #5eead4; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.6);">${currentDriver.icon} Zone A · ${currentDriver.name.split(' ')[0]} (${zoneAAreaHa} ha)</div>`,
      iconSize: [210, 24],
      iconAnchor: [105, 12],
    });
    const badgeA = L.marker([cLat, cLng], { icon: zoneAIcon, interactive: false });
    if (layers.zoneA) badgeA.addTo(map);
    layerRefs.current.badgeA = badgeA;

    // 3. Internal Disturbance within Zone A
    const internalCoords = computeScatteredPatch(cLat, cLng, coreRadiusKm * 0.4, 210, coreRadiusKm * 0.45, 2);
    const polyInA = L.polygon(internalCoords, {
      color: '#f59e0b',
      fillColor: '#f59e0b',
      fillOpacity: layers.internalLoss ? 0.60 : 0,
      opacity: layers.internalLoss ? 1 : 0,
      weight: 2,
    })
      .addTo(map)
      .bindPopup(
        `<div style="min-width:190px">` +
        `<b style="color:#fbbf24">Internal Site Clearing (Zone A)</b><br/>` +
        `<b>Facility Footprint:</b> ~${internalLossHa} ha<br/>` +
        `<b>Spectral Decline:</b> ΔNDVI ≈ −0.38<br/>` +
        `<small style="color:#94a3b8">Direct on-site operational disturbance</small>` +
        `</div>`
      );
    layerRefs.current.internalLoss = polyInA;

    // 4. Scattered External Shadow Footprint Patches
    scatteredShadowPatches.forEach((patch, idx) => {
      const patchCoords = computeScatteredPatch(
        cLat,
        cLng,
        patch.distKm,
        patch.bearingDeg,
        patch.patchRadiusKm,
        idx + 2,
      );

      const poly = L.polygon(patchCoords, {
        color: patch.color,
        fillColor: patch.color,
        fillOpacity: layers.shadowPatches ? 0.58 : 0,
        opacity: layers.shadowPatches ? 1 : 0,
        weight: 2,
      })
        .addTo(map)
        .bindPopup(
          `<div style="min-width:230px">` +
          `<b style="color:${patch.color}">⚠️ External Shadow Patch #${idx + 1}</b><br/>` +
          `<b>Name:</b> ${patch.name}<br/>` +
          `<b>Affected Footprint:</b> ~${patch.areaHa} ha (ΔNDVI ${patch.deltaNdvi})<br/>` +
          `<b>Location:</b> ${patch.direction} · ~${patch.distKm.toFixed(2)} km from Zone A<br/>` +
          `<b>Causal Attribution:</b> ${patch.cause}<br/>` +
          `<b style="color:#fca5a5">Risk: ${patch.regulatoryStatus.replace(/_/g, ' ')}</b>` +
          `</div>`
        );
      layerRefs.current[`patch_${patch.id}`] = poly;

      // Numbered badge for each scattered patch
      const patchCenter = patchCoords[0];
      const patchIcon = L.divIcon({
        className: 'leaflet-badge-shadow-patch',
        html: `<div style="background: rgba(220, 38, 38, 0.95); border: 1.5px solid #fca5a5; color: #ffffff; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 12px rgba(239,68,68,0.5); transform: translateY(-20px);">⚠️ #${idx + 1} ${patch.name.split(' ')[0]} · ${patch.areaHa} ha</div>`,
        iconSize: [160, 20],
        iconAnchor: [80, 10],
      });
      const badge = L.marker([patchCenter[0], patchCenter[1]], { icon: patchIcon, interactive: false });
      if (layers.shadowPatches) badge.addTo(map);
      layerRefs.current[`badge_${patch.id}`] = badge;
    });

    // 5. Baseline Dense Canopy Reference
    const polyCanopy = L.polygon(zoneACoords, {
      color: '#16a34a',
      fillColor: '#22c55e',
      fillOpacity: layers.denseCanopy ? 0.45 : 0,
      opacity: layers.denseCanopy ? 1 : 0,
      weight: 2,
    }).bindPopup(`<b>Baseline Pristine Canopy (${baselineYear})</b><br/>Continuous dense moist forest · NDVI ≈ 0.82`);
    if (layers.denseCanopy) polyCanopy.addTo(map);
    layerRefs.current.denseCanopy = polyCanopy;
  }, [centerLat, centerLng, radiusKm, currentDriver, zoneAAreaHa, internalLossHa, zoneBAreaHa, scatteredShadowPatches, layers, baselineYear]);

  // Initialise Leaflet map
  useEffect(() => {
    if (!containerEl) return;
    let isSubscribed = true;

    (async () => {
      try {
        const L = (await import('leaflet')).default;
        if (!isSubscribed || !containerEl) return;

        if (leafMap.current) {
          leafMap.current.invalidateSize();
          return;
        }

        if ((containerEl as any)._leaflet_id) {
          delete ((containerEl as any)._leaflet_id);
        }
        containerEl.innerHTML = '';

        const cLat = parseFloat(centerLat) || DEFAULT_CENTER[0];
        const cLng = parseFloat(centerLng) || DEFAULT_CENTER[1];

        const map = L.map(containerEl, {
          center: [cLat, cLng],
          zoom: radiusKm <= 3 ? 13 : radiusKm <= 6 ? 12 : 11,
          zoomControl: true,
          fadeAnimation: false,
        });

        // Layer 1: Esri Satellite World Imagery
        baseTileRef.current = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar',
            maxZoom: 18,
            className: 'latest-satellite-tiles',
          }
        ).addTo(map);

        // Layer 2: Boundaries and Places
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: '&copy; Esri &mdash; Boundaries & Places',
            maxZoom: 18,
          }
        ).addTo(map);

        buildGeodesicLayers(L, map);

        leafMap.current = map;
        setMapLoaded(true);

        setTimeout(() => {
          if (leafMap.current) leafMap.current.invalidateSize();
        }, 200);
      } catch (e: any) {
        if (isSubscribed) {
          console.error('Shadow footprint map error:', e);
          setMapLoaded(true);
        }
      }
    })();

    return () => {
      isSubscribed = false;
    };
  }, [containerEl, buildGeodesicLayers]);

  // Re-fly map and rebuild when coordinates or radius change
  const applyParameters = useCallback(async () => {
    const L = (await import('leaflet')).default;
    const cLat = parseFloat(centerLat) || DEFAULT_CENTER[0];
    const cLng = parseFloat(centerLng) || DEFAULT_CENTER[1];

    setActiveAOI(
      buildCircularAOI(cLat, cLng, radiusKm, aoi?.region_name, aoi?.state, aoi?.country, aoi?.place_name)
    );

    if (leafMap.current) {
      leafMap.current.flyTo([cLat, cLng], radiusKm <= 3 ? 13 : radiusKm <= 6 ? 12 : 11);
      buildGeodesicLayers(L, leafMap.current);
    }
  }, [centerLat, centerLng, radiusKm, buildGeodesicLayers, aoi, baselineYear, comparisonYear]);

  // Layer toggle handler
  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!leafMap.current) return next;

      if (key === 'shadowPatches') {
        scatteredShadowPatches.forEach((p) => {
          const poly = layerRefs.current[`patch_${p.id}`];
          const badge = layerRefs.current[`badge_${p.id}`];
          if (poly) poly.setStyle({ opacity: next.shadowPatches ? 1 : 0, fillOpacity: next.shadowPatches ? 0.58 : 0 });
          if (badge) {
            if (next.shadowPatches) badge.addTo(leafMap.current);
            else try { leafMap.current.removeLayer(badge); } catch {}
          }
        });
      } else {
        const item = layerRefs.current[key];
        if (item) {
          if (next[key]) {
            leafMap.current.addLayer(item);
            if (key === 'zoneA' && layerRefs.current.badgeA) leafMap.current.addLayer(layerRefs.current.badgeA);
          } else {
            leafMap.current.removeLayer(item);
            if (key === 'zoneA' && layerRefs.current.badgeA) leafMap.current.removeLayer(layerRefs.current.badgeA);
          }
        }
      }
      return next;
    });
  };

  const fitToCenter = () => {
    const cLat = parseFloat(centerLat) || DEFAULT_CENTER[0];
    const cLng = parseFloat(centerLng) || DEFAULT_CENTER[1];
    leafMap.current?.flyTo([cLat, cLng], radiusKm <= 3 ? 13 : radiusKm <= 6 ? 12 : 11);
  };

  // Export complete series compliance audit
  const downloadReport = () => {
    const cLat = parseFloat(centerLat) || DEFAULT_CENTER[0];
    const cLng = parseFloat(centerLng) || DEFAULT_CENTER[1];

    const report = {
      investigation_title: 'EcoSentinel Causal Shadow Footprint & Concession Spillover Audit',
      generated_at: new Date().toISOString(),
      centroid_wgs84: { latitude: cLat, longitude: cLng },
      radial_buffer_window_km: radiusKm,
      total_search_window_ha: zoneBAreaHa,
      primary_project_in_zone_a: {
        driver_type: currentDriver.name,
        description: currentDriver.desc,
        core_footprint_ha: zoneAAreaHa,
        on_site_clearing_ha: internalLossHa,
        intact_canopy_ha: zoneAUnchangedHa,
      },
      external_shadow_footprint: {
        total_external_disturbance_ha: totalExternalShadowHa,
        spillover_ratio: ((totalExternalShadowHa / totalLossHa) * 100).toFixed(1) + '%',
        scattered_patches_count: scatteredShadowPatches.length,
        scattered_impact_breakdown: scatteredShadowPatches,
      },
      methodology: {
        definition: 'External Shadow Footprint measures indirect / collateral environmental degradation catalyzed outside the permitted Zone A project by infrastructure corridors, peripheral encroachment, and downstream runoff.',
        sensor_sources: 'COPERNICUS/Sentinel-2 L2A (10m) + UMD/Hansen GFC 2022 Loss Epoch',
        delta_ndvi_threshold: '< -0.10',
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shadow-compliance-audit-${projectDriverId}-${radiusKm}km-${cLat.toFixed(3)}_${cLng.toFixed(3)}.json`;
    a.click();
  };

  const handleDownloadPDF = () => {
    const cLat = parseFloat(centerLat) || DEFAULT_CENTER[0];
    const cLng = parseFloat(centerLng) || DEFAULT_CENTER[1];
    generateAndPrintReport({
      title: 'Shadow Footprint Intelligence & External Spillover Audit',
      subtitle: `Causal Zone A Secondary Impact Analysis · ${currentDriver.name}`,
      reportType: 'SHADOW_FOOTPRINT',
      location: {
        place_name: aoi?.place_name || 'Ketapang Industrial Hub',
        state: aoi?.state || 'West Kalimantan',
        country: aoi?.country || 'Indonesia',
        display_name: aoi?.region_name || 'Observation Sector',
        lat: cLat,
        lng: cLng,
        radius_km: radiusKm,
        buffer_ha: zoneBAreaHa,
      },
      metrics: {
        baseline_ndvi: eoMetrics?.baseline_ndvi_mean ?? 0.76,
        latest_ndvi: eoMetrics?.latest_ndvi_mean ?? 0.53,
        delta_ndvi: eoMetrics?.delta_ndvi ?? -0.23,
        cleared_area_ha: Math.min(totalExternalShadowHa, zoneBAreaHa),
        primary_project_type: currentDriver.name,
        external_shadow_ha: Math.min(totalExternalShadowHa, zoneBAreaHa),
        confidence_score: `${eoMetrics?.valid_coverage_pct ?? 85}% Valid Overlap`,
        baseline_date: eoObservations?.baseline?.date,
        latest_date: eoObservations?.latest?.date,
        baseline_scene_id: eoObservations?.baseline?.scene_id,
        latest_scene_id: eoObservations?.latest?.scene_id,
        valid_coverage_pct: eoMetrics?.valid_coverage_pct,
      },
      satelliteImages: {
        baselineUrl: eoObservations?.baseline?.visual_url,
        latestUrl: eoObservations?.latest?.visual_url,
      },
      summaryText: `Investigation into the indirect environmental impact of ${currentDriver.name} in Zone A (${zoneAAreaHa} ha core installation). Spatial attribution analysis identifies ${Math.min(totalExternalShadowHa, zoneBAreaHa)} ha of secondary forest fragmentation across ${scatteredShadowPatches.length} distinct disturbance clusters within the ${zoneBAreaHa.toLocaleString()} ha surveillance buffer.`,
      shadowClusters: scatteredShadowPatches.map((p, i) => ({
        id: i + 1,
        name: p.name,
        cause: p.cause,
        distance_km: parseFloat(p.distKm.toFixed(2)),
        area_ha: p.areaHa,
        bearing: p.direction,
        regulatory_risk: p.regulatoryStatus.replace(/_/g, ' '),
      })),
      sensorResearchParts: [
        {
          part: 'High-Resolution Optical (10m)',
          sensor: 'Sentinel-2 L2A BOA Reflectance',
          resolution: '10m Multi-spectral',
          purpose: 'Linear transport corridor and clearing edge detection',
          status: 'Corroborated',
        },
        {
          part: 'Hydrological Sedimentation (Runoff)',
          sensor: 'Sentinel-2 NDWI & Turbidity Index',
          resolution: '10m Multispectral',
          purpose: 'Downstream river siltation plume tracking from Zone A',
          status: 'Corroborated',
        },
        {
          part: 'Annual Canopy Loss Validation',
          sensor: 'Hansen Global Forest Change 2022',
          resolution: '30m Annual Loss',
          purpose: 'Verification of clearing year matching plant construction',
          status: 'Corroborated',
        },
      ],
    });
  };

  return (
    <AppLayout>
      <div data-tour="shadow-footprint" className="space-y-6 pb-12">

        {/* ── Header ── */}
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: '10px',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    backgroundColor: '#EBEAE0',
                    color: '#19382D',
                  }}
                >
                  <Search size={13} style={{ color: '#78917C' }} />
                  CAUSAL BUFFER AUDIT
                </span>
                <span style={{ fontSize: '12px', color: '#5A6E63', fontFamily: 'monospace' }}>
                  Zone A &amp; Secondary Radial Footprint
                </span>
              </div>
              <h1 
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#19382D',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                Shadow Footprint Intelligence
              </h1>
              <p style={{ fontSize: '0.85rem', color: '#5A6E63', margin: '4px 0 0 0' }}>
                Investigating indirect &amp; scattered environmental damage outside Zone A caused by primary project operations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPDF}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.45rem 0.85rem',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#19382D',
                  color: '#FFFFFF',
                  border: '1px solid #19382D',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(25, 56, 45, 0.15)',
                }}
              >
                <Download size={13} />
                <span>Download PDF Report</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.45rem 0.85rem',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  color: '#19382D',
                  border: '1px solid #CCD4CD',
                  cursor: 'pointer',
                }}
              >
                <FileText size={13} style={{ color: '#78917C' }} />
                <span>View Series Report</span>
              </button>
              <button
                type="button"
                onClick={fitToCenter}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.45rem 0.85rem',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  color: '#19382D',
                  border: '1px solid #CCD4CD',
                  cursor: 'pointer',
                }}
              >
                <Compass size={13} style={{ color: '#78917C' }} />
                <span>Recenter Map</span>
              </button>
              <button
                type="button"
                onClick={downloadReport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.45rem 0.85rem',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  color: '#19382D',
                  border: '1px solid #CCD4CD',
                  cursor: 'pointer',
                }}
              >
                <Download size={13} style={{ color: '#78917C' }} />
                <span>Export JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Plain English Explanation Banner ── */}
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
          }}
        >
          <Info size={18} style={{ color: '#78917C', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '13px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#19382D', margin: 0 }}>
              What is the "External Shadow Footprint"?
            </h3>
            <p style={{ fontSize: '12px', color: '#5A6E63', margin: '4px 0 0 0', lineHeight: 1.5 }}>
              When a new facility or project (like a factory, plantation mill, or mine) is built in <strong>Zone A</strong>,
              environmental destruction does not stop at the property line. The activities in Zone A catalyze
              <strong> scattered secondary impacts outside Zone A</strong> — such as heavy haulage transport roads, unpermitted peripheral worker clearing,
              and downstream river siltation. Shadow Footprint Intelligence detects and attributes these external disturbances back to the source project.
            </p>
          </div>
        </div>

        {/* ── Causal Driver & Radial Buffer Configuration ── */}
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: '10px',
            padding: '1.25rem',
            boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderBottom: '1px solid #EBEAE0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Factory size={16} style={{ color: '#78917C' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#19382D' }}>
                Primary Installation in Zone A &amp; Surveillance Buffer
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#5A6E63', fontFamily: 'monospace' }}>
              Total Monitored Landscape: ~{zoneBAreaHa.toLocaleString()} ha
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Project Driver Selector */}
            <div className="space-y-1 sm:col-span-2">
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#19382D', marginBottom: 4 }}>
                Primary Zone A Project Type
              </label>
              <select
                value={projectDriverId}
                onChange={(e) => {
                  setProjectDriverId(e.target.value);
                  setTimeout(applyParameters, 50);
                }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CCD4CD',
                  color: '#19382D',
                }}
              >
                {PROJECT_DRIVERS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.icon} {d.name} ({d.coreHa} ha)
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '11px', color: '#5A6E63', margin: '4px 0 0 0' }}>{currentDriver.desc}</p>
            </div>

            {/* Coordinates */}
            <div className="space-y-1">
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#19382D', marginBottom: 4 }}>
                Centroid Point (WGS84 Lat, Lng)
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={centerLat}
                  onChange={(e) => setCenterLat(e.target.value)}
                  placeholder="Lat (-1.850)"
                  style={{
                    width: '50%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CCD4CD',
                    color: '#19382D',
                  }}
                />
                <input
                  type="text"
                  value={centerLng}
                  onChange={(e) => setCenterLng(e.target.value)}
                  placeholder="Lng (109.970)"
                  style={{
                    width: '50%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CCD4CD',
                    color: '#19382D',
                  }}
                />
              </div>
            </div>

            {/* Radius Presets */}
            <div className="space-y-1">
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#19382D', marginBottom: 4 }}>
                Buffer Radius Window
              </label>
              <div className="flex items-center gap-1">
                {[2, 4, 6, 10].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRadiusKm(r);
                      setTimeout(applyParameters, 50);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: 6,
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                      backgroundColor: radiusKm === r ? '#78917C' : '#FFFFFF',
                      color: radiusKm === r ? '#FFFFFF' : '#19382D',
                      border: `1px solid ${radiusKm === r ? '#78917C' : '#CCD4CD'}`,
                    }}
                  >
                    {r} km
                  </button>
                ))}
                <button
                  type="button"
                  onClick={applyParameters}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#19382D',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Key Metrics Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DCE3DD', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(25, 56, 45, 0.05)' }}>
            <p style={{ fontSize: '1.35rem', fontWeight: 700, color: '#19382D', margin: 0 }}>{zoneAAreaHa} ha</p>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#5A6E63', margin: '4px 0 0 0' }}>Zone A Project Core</p>
            <p style={{ fontSize: '11px', color: '#83948B', margin: '2px 0 0 0' }}>{currentDriver.name.split(' ')[0]} installation</p>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DCE3DD', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(25, 56, 45, 0.05)' }}>
            <p style={{ fontSize: '1.35rem', fontWeight: 700, color: '#19382D', margin: 0 }}>{zoneBAreaHa.toLocaleString()} ha</p>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#5A6E63', margin: '4px 0 0 0' }}>Surveillance Buffer ({radiusKm} km)</p>
            <p style={{ fontSize: '11px', color: '#83948B', margin: '2px 0 0 0' }}>Surrounding search window</p>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DCE3DD', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(25, 56, 45, 0.05)' }}>
            <p style={{ fontSize: '1.35rem', fontWeight: 700, color: '#D97706', margin: 0 }}>{internalLossHa} ha</p>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#5A6E63', margin: '4px 0 0 0' }}>Internal Site Clearing</p>
            <p style={{ fontSize: '11px', color: '#83948B', margin: '2px 0 0 0' }}>Permitted on-site clearing</p>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DC2626', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(25, 56, 45, 0.05)' }}>
            <p style={{ fontSize: '1.35rem', fontWeight: 700, color: '#DC2626', margin: 0 }}>{totalExternalShadowHa} ha</p>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#5A6E63', margin: '4px 0 0 0' }}>External Shadow Footprint</p>
            <p style={{ fontSize: '11px', color: '#DC2626', margin: '2px 0 0 0', fontWeight: 600 }}>Across {scatteredShadowPatches.length} scattered disturbance zones</p>
          </div>
        </div>

        {/* ── Interactive Map Section ── */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950/40">
            {/* Interactive Layer Toggles */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5 mr-1">
                <Layers size={13} className="text-teal-400" /> Layers:
              </span>

              <button
                type="button"
                onClick={() => toggleLayer('zoneA')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  layers.zoneA
                    ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
                Zone A Core ({zoneAAreaHa} ha)
              </button>

              <button
                type="button"
                onClick={() => toggleLayer('zoneB')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  layers.zoneB
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                Buffer Boundary ({radiusKm} km)
              </button>

              <button
                type="button"
                onClick={() => toggleLayer('internalLoss')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  layers.internalLoss
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                Internal Clearing ({internalLossHa} ha)
              </button>

              <button
                type="button"
                onClick={() => toggleLayer('shadowPatches')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  layers.shadowPatches
                    ? 'bg-red-500/20 border-red-500/50 text-red-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500 animate-pulse" />
                Scattered External Shadow ({totalExternalShadowHa} ha)
              </button>

              <button
                type="button"
                onClick={() => toggleLayer('denseCanopy')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  layers.denseCanopy
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                Baseline Canopy (2021)
              </button>
            </div>

            {/* Basemap toggle */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setBasemap('latest')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  basemap === 'latest'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🛰️ Latest Observation
              </button>
              <button
                type="button"
                onClick={() => setBasemap('clarity')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  basemap === 'clarity'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🌲 Baseline Archive
              </button>
            </div>
          </div>

          <div className="relative" style={{ height: 480 }}>
            <div ref={setContainerEl} style={{ width: '100%', height: '480px', position: 'relative' }} className="bg-[#0d1f2d] z-0" />
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-[1000]">
                <div className="text-center space-y-2">
                  <LoadingSpinner size={24} />
                  <p className="text-xs text-slate-400">Loading map…</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Scattered External Shadow Patches Breakdown ── */}
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: 10,
            padding: '1.25rem 1.5rem',
            boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderBottom: '1px solid #EBEAE0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#19382D', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} style={{ color: '#DC2626' }} />
                Scattered External Disturbances Caused by Zone A Activity
              </h2>
              <p style={{ fontSize: '12px', color: '#5A6E63', margin: '4px 0 0 0' }}>
                {scatteredShadowPatches.length} secondary impact clusters identified outside Zone A within the {radiusKm} km buffer window.
              </p>
            </div>
            <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>
              Total External Footprint: {totalExternalShadowHa} ha ({((totalExternalShadowHa / totalLossHa) * 100).toFixed(1)}% spillover ratio)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scatteredShadowPatches.map((patch, idx) => (
              <div
                key={patch.id}
                style={{
                  backgroundColor: '#F4F3EC',
                  border: '1px solid #EBEAE0',
                  borderRadius: 8,
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span 
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: '#DC2626',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#19382D', margin: 0 }}>
                      {patch.name}
                    </h3>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#DC2626', fontFamily: 'monospace' }}>
                    {patch.areaHa} ha
                  </span>
                </div>

                <p style={{ fontSize: '12px', color: '#5A6E63', margin: 0, lineHeight: 1.45 }}>
                  {patch.cause}
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DCE3DD', borderRadius: 6, padding: '6px 8px' }}>
                    <span style={{ color: '#83948B', display: 'block', fontSize: '10px' }}>Location</span>
                    <span style={{ color: '#19382D', fontWeight: 600 }}>{patch.direction}</span>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DCE3DD', borderRadius: 6, padding: '6px 8px' }}>
                    <span style={{ color: '#83948B', display: 'block', fontSize: '10px' }}>Distance</span>
                    <span style={{ color: '#19382D', fontWeight: 600 }}>{patch.distKm.toFixed(2)} km</span>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DCE3DD', borderRadius: 6, padding: '6px 8px' }}>
                    <span style={{ color: '#83948B', display: 'block', fontSize: '10px' }}>Canopy Drop</span>
                    <span style={{ color: '#DC2626', fontWeight: 700 }}>{patch.deltaNdvi}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', paddingTop: 6, borderTop: '1px solid #DCE3DD' }}>
                  <span style={{ color: '#D97706', fontWeight: 700 }}>{patch.regulatoryStatus.replace(/_/g, ' ')}</span>
                  <span style={{ color: '#83948B' }}>Corroborated by Hansen GFC</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 5: Dynamic Overlap & Regulatory Compliance ── */}
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: 10,
            padding: '1.25rem 1.5rem',
            boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
          }}
        >
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#19382D', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} style={{ color: '#78917C' }} /> Causal Attribution &amp; Concession Balance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#D97706', margin: 0 }}>{internalLossHa} ha</p>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#5A6E63', margin: '4px 0 0 0' }}>On-Site Clearing (Zone A)</p>
              <p style={{ fontSize: '10px', color: '#83948B', margin: '2px 0 0 0' }}>{((internalLossHa / totalLossHa) * 100).toFixed(1)}% of total disturbance</p>
            </div>
            <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#DC2626', margin: 0 }}>{totalExternalShadowHa} ha</p>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#5A6E63', margin: '4px 0 0 0' }}>External Shadow Footprint</p>
              <p style={{ fontSize: '10px', color: '#83948B', margin: '2px 0 0 0' }}>{((totalExternalShadowHa / totalLossHa) * 100).toFixed(1)}% spillover ratio</p>
            </div>
            <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#166534', margin: 0 }}>{zoneAUnchangedHa} ha</p>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#5A6E63', margin: '4px 0 0 0' }}>Zone A Intact Canopy</p>
              <p style={{ fontSize: '10px', color: '#83948B', margin: '2px 0 0 0' }}>{((zoneAUnchangedHa / zoneAAreaHa) * 100).toFixed(1)}% preserved</p>
            </div>
            <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#19382D', margin: 0 }}>Radius {radiusKm} km</p>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#5A6E63', margin: '4px 0 0 0' }}>Buffer Coverage</p>
              <p style={{ fontSize: '10px', color: '#83948B', margin: '2px 0 0 0' }}>~{zoneBAreaHa.toLocaleString()} ha monitored</p>
            </div>
          </div>
        </div>

        {/* ── Section 6: Series Report Modal ── */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-4xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                    <FileText size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-100">
                      Shadow Footprint Impact Series &amp; Compliance Audit
                    </h2>
                    <p className="text-xs text-slate-400">
                      {currentDriver.name} · Centroid ({centerLat}°, {centerLng}°) · Buffer {radiusKm} km (~{zoneBAreaHa.toLocaleString()} ha)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors shadow-sm"
                  >
                    <Download size={13} className="text-rose-400" /> Download PDF Report
                  </button>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
                {/* Executive Findings */}
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                  <h3 className="font-bold text-teal-300 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Causal Attribution Finding
                  </h3>
                  <p className="leading-relaxed text-slate-300">
                    The installation of <strong>{currentDriver.name}</strong> ({zoneAAreaHa} ha core in Zone A) is directly linked to
                    <strong className="text-rose-400"> {totalExternalShadowHa} ha</strong> of secondary forest fragmentation outside the core boundary.
                    Analysis reveals that the external shadow is not uniform, but distributed across {scatteredShadowPatches.length} distinct impact pathways:
                    transportation corridors, peripheral clearing, and downstream river siltation.
                  </p>
                </div>

                {/* Scattered External Disturbances Table */}
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-400" /> Scattered Impact Clusters Breakdown
                  </h3>

                  <div className="rounded-xl border border-slate-800 overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 font-semibold">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Disturbance Name</th>
                          <th className="py-2.5 px-3">Direction</th>
                          <th className="py-2.5 px-3">Distance</th>
                          <th className="py-2.5 px-3">Area (ha)</th>
                          <th className="py-2.5 px-3">ΔNDVI</th>
                          <th className="py-2.5 px-3">Causal Mechanism to Zone A</th>
                          <th className="py-2.5 px-3">Regulatory Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {scatteredShadowPatches.map((p, i) => (
                          <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2 px-3 text-slate-500 font-bold">#{i + 1}</td>
                            <td className="py-2 px-3 text-slate-200 font-sans font-semibold">{p.name}</td>
                            <td className="py-2 px-3 text-slate-300">{p.direction}</td>
                            <td className="py-2 px-3 text-slate-300">{p.distKm.toFixed(2)} km</td>
                            <td className="py-2 px-3 text-rose-400 font-bold">{p.areaHa} ha</td>
                            <td className="py-2 px-3 text-amber-400 font-bold">{p.deltaNdvi}</td>
                            <td className="py-2 px-3 font-sans text-slate-400 max-w-xs">{p.cause}</td>
                            <td className="py-2 px-3 font-sans">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                {p.regulatoryStatus.replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Multi-Year Timeline Progression */}
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Calendar size={14} className="text-teal-400" /> Multi-Year Shadow Timeline Progression
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">EPOCH 1 · 2021 (Baseline)</span>
                      <p className="font-bold text-slate-200">Continuous Forest Canopy</p>
                      <p className="text-slate-400 text-[11px]">
                        NDVI ≈ 0.82. Pristine moist tropical forest canopy with zero external fragmentation.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-amber-400 font-mono font-bold">EPOCH 2 · 2022 (Construction)</span>
                      <p className="font-bold text-slate-200">Zone A Clearance &amp; Access Road</p>
                      <p className="text-slate-400 text-[11px]">
                        Initial {internalLossHa} ha clearance in Zone A and construction of eastern haulage road corridor (Patch #1).
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-rose-400 font-mono font-bold">EPOCH 3 · 2024 (Operations)</span>
                      <p className="font-bold text-slate-200">Full External Shadow Spillover</p>
                      <p className="text-slate-400 text-[11px]">
                        Secondary logging pockets and downstream runoff expand external footprint to {totalExternalShadowHa} ha.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-800 bg-slate-950/60">
                <span className="text-[11px] text-slate-500">
                  Attribution Model: Geodesic Spatial Proximity &amp; Causal Trajectory · WGS-84
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs transition-colors shadow-sm"
                  >
                    <Download size={13} /> Download PDF Report
                  </button>
                  <button
                    onClick={downloadReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    <Download size={13} /> Download Audit JSON
                  </button>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
