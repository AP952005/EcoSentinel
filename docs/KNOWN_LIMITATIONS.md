# EcoSentinel — Known Limitations & Honest Constraints

1. **Spatial Resolution Constraints (10m vs Drone / LiDAR):**
   - Sentinel-2 10-meter pixel size cannot resolve individual tree species or ground boundary markers under 0.01 ha.
2. **Cloud and Atmospheric Interference:**
   - Tropical monsoon regions (e.g. Borneo, Western Ghats) experience substantial persistent cloud cover during wet seasons.
3. **Spectral Shift $\neq$ Cause Determination:**
   - A drop in NDVI can result from agricultural crop rotation, canal construction, phenological cycles, or drought, in addition to clearing. ProofLoop explicitly surfaces these alternative hypotheses.
4. **Cadastral Boundary Verifications:**
   - Without digitized, georeferenced government survey cadastres, core project footprints rely on applicant-declared geometries.
5. **Replay vs Live Demonstration Boundary:**
   - When Google Earth Engine service account credentials or Gemini keys are not injected, the platform runs in explicit `REPLAY` mode using pre-validated fixtures.
