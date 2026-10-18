# First Environmental Report (FER) Specification

## 1. Overview & Objective

The **First Environmental Report (FER)** is the foundational intake and screening instrument in EcoSentinel. It bridges declared project application parameters with preliminary multi-temporal Earth observations to help regulatory officers prioritize on-ground verification.

## 2. Core Sections of the FER

1. **Document Identity & Versioning:** Report ID, immutable version number, timestamp, generation mode (`LIVE` vs `REPLAY`).
2. **Project Identity & Spatial Bounds:** Applicant name, sector, proposed land area, geographic center coordinates, and geodesic buffer radius.
3. **Zonal Partitioning:**
   - **Zone A (Approved Footprint):** Declared core boundary submitted in application.
   - **Zone B (Surveillance Buffer):** 500m surrounding buffer monitored for external leakage, canopy decline, or unauthorized access roads.
4. **Multi-Temporal Satellite Observations Register:**
   - Pre-construction baseline epoch vs current operational epoch.
   - Spectral difference layers (ΔNDVI, NDWI, Canopy cover).
   - Sensor metadata: Scene IDs, acquisition timestamps, valid pixel percentages, and cloud contamination filters.
5. **ProofLoop Investigation & Counter-Evidence Matrix:**
   - Pro-finding evidence vs weakening factors.
   - Alternative phenological/infrastructure hypotheses.
   - Recommended human next-step and information requests.
6. **Data Provenance, Caveats & Legal Disclaimer:**
   - Explicit advisory that preliminary spectral observations do not constitute a legal determination of violation without ground cadastral survey.
