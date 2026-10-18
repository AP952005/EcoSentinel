# Watchtower Continuous Monitoring Specification

## 1. Overview

**Watchtower** provides persistent environmental surveillance. Once a preliminary FER or Global Intelligence analysis identifies an area of interest, the officer can convert the footprint into an automated monitoring cadence.

## 2. Monitoring Configuration

- **Target Footprint:** Geodesic polygon or coordinate centroid + radius buffer.
- **Surveillance Cadence:** Configurable checking interval (e.g. 7-day, 14-day, 30-day). Note: satellite revisit rates depend on orbit and cloud obstruction.
- **Trigger Thresholds:**
  - Vegetation Loss Trigger: ΔNDVI $\le -0.15$
  - Minimum Contiguous Area: $\ge 1.0$ ha
  - Quality Filter: Minimum valid pixel coverage $\ge 75\%$
- **Execution States:**
  - `New usable observation available`
  - `Analysis completed with candidate finding`
  - `Analysis completed with no candidate change`
  - `Insufficient usable data (cloud masked)`
  - `Provider unavailable`
  - `Processing failed`
- **Audit & Case Integration:** Every completed observation check logs an immutable event on the case timeline with timestamp, actor, and detection status.
