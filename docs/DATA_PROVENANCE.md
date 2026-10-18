# EcoSentinel — Data Provenance & Environmental Observation Registry

## 1. Primary Datasets & Earth Observation Collections

EcoSentinel strictly integrates authenticated Earth Observation datasets without synthetic fabrication:

### 1.1 Harmonized Sentinel-2 Surface Reflectance
- **Earth Engine Collection:** `COPERNICUS/S2_SR_HARMONIZED`
- **Spatial Resolution:** 10 meters (Bands 2 Blue, 3 Green, 4 Red, 8 NIR)
- **Spectral Indices Computed:**
  - **NDVI:** $(B8 - B4) / (B8 + B4)$ (Vegetation vigor & canopy density)
  - **NDWI:** $(B3 - B8) / (B3 + B8)$ (Surface water bodies & moisture)
- **Quality Filters:** Cloud Masking (`QA60` + SCL Scene Classification Layer), valid pixel coverage $\ge 75\%$.

### 1.2 Hansen Global Forest Change Archive
- **Earth Engine Collection:** `UMD/hansen/global_forest_change_2023_v1_11`
- **Provider:** University of Maryland / Google / USGS / NASA
- **Spatial Resolution:** 30 meters
- **Attributes:** Annual forest loss year (`lossyear`), tree canopy cover threshold ($\ge 30\%$).

### 1.3 Dynamic World Near Real-Time Land Cover
- **Earth Engine Collection:** `GOOGLE/DYNAMICWORLD/V1`
- **Provider:** Google / World Resources Institute
- **Spatial Resolution:** 10 meters
- **Classes Screened:** Water, Trees, Flooded Vegetation, Crops, Shrub & Scrub, Built, Bare Ground, Snow/Ice.

---

## 2. Primary Showcase: Ketapang Regency, West Kalimantan (Borneo, Indonesia)

- **Centroid Coordinates:** Latitude `-1.850° S`, Longitude `109.970° E`
- **Spatial Bounds:** Geodesic 5.0 km radius buffer (7,853.98 ha)
- **Temporal Baseline Epoch:** March 2021 (Dry Season Composite, Mean NDVI 0.82)
- **Disturbance Epoch:** September 2022 – March 2023 (Canopy drop to 0.44)
- **Latest Usable Checkpoint:** July 2024 (Scene ID: `S2A_MSIL2A_20240720T030541`, Cloud: 5.2%)
- **Hansen Loss Year Corroboration:** 18.4 ha canopy disturbance registered in the 2022 annual layer.

---

## 3. Data Integrity & Disclaimers

1. **Spectral Changes $\neq$ Legal Guilt:** A candidate decline in vegetation index represents a physical change in reflectance, not proof of illegal activity.
2. **Atmospheric & Phenological Sensitivity:** Monsoon cloud masking and seasonal leaf drop are explicitly examined in ProofLoop as alternative explanations.
