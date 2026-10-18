"""
Replay Observation Provider — fixed demonstration case.
Provides labelled REPLAY mode data with known provenance.
Never masquerades as live Earth Engine data.
"""
from datetime import datetime, timezone
from typing import Dict, Any, List

REPLAY_MODE = "REPLAY"

# ── Demo project boundary (illustrative — Goa coastal area, fictional project) ──
DEMO_PROJECT = {
    "id": "replay-demo-001",
    "project_name": "[DEMO] Coastal Infrastructure Project - Mandrem Illustration",
    "applicant_name": "Demo Applicant (Replay Fixture)",
    "sector": "Infrastructure",
    "activity": "Coastal Road",
    "state": "Goa",
    "district": "North Goa",
    "sub_district": "Pernem",
    "village": "Mandrem (Illustration)",
    "latitude": 15.693,
    "longitude": 73.731,
    "project_summary": (
        "This is a REPLAY FIXTURE for demonstration purposes only. "
        "It does not represent any real project, approval, or environmental decision. "
        "The boundary and findings are illustrative."
    ),
    "analysis_mode": "REPLAY",
    "note": "REPLAY FIXTURE — not a real project record",
}

# Zone A boundary (illustrative polygon ~12 ha)
DEMO_ZONE_A = {
    "type": "Polygon",
    "coordinates": [[
        [73.728, 15.690],
        [73.736, 15.690],
        [73.736, 15.697],
        [73.728, 15.697],
        [73.728, 15.690],
    ]]
}

# Zone B boundary (illustrative — 500m buffer approx)
DEMO_ZONE_B = {
    "type": "Polygon",
    "coordinates": [[
        [73.720, 15.683],
        [73.744, 15.683],
        [73.744, 15.704],
        [73.720, 15.704],
        [73.720, 15.683],
    ]]
}

# Candidate finding polygon (illustrative vegetation decline area)
DEMO_FINDING_GEOMETRY = {
    "type": "Polygon",
    "coordinates": [[
        [73.733, 15.693],
        [73.738, 15.693],
        [73.738, 15.697],
        [73.733, 15.697],
        [73.733, 15.693],
    ]]
}

# Replay analysis result — fixed, known values
DEMO_ANALYSIS_RESULT = {
    "connection_mode": REPLAY_MODE,
    "provider": "ReplayObservationProvider",
    "dataset_id": "REPLAY/DEMO/NDVI_COMPARISON_V1",
    "note": "REPLAY FIXTURE — fixed illustrative outputs, not measured from real satellite imagery",
    "baseline_period": {
        "start": "2021-11-01",
        "end": "2022-01-31",
        "scene_count": 3,
        "mean_cloud_cover_pct": 18.2,
        "valid_pixel_coverage_pct": 81.8,
        "acquisition_dates": ["2021-11-15", "2021-12-12", "2022-01-08"],
        "source_item_ids": ["REPLAY/S2_SR/2021-11-15", "REPLAY/S2_SR/2021-12-12", "REPLAY/S2_SR/2022-01-08"],
    },
    "comparison_period": {
        "start": "2023-11-01",
        "end": "2024-01-31",
        "scene_count": 3,
        "mean_cloud_cover_pct": 22.1,
        "valid_pixel_coverage_pct": 77.9,
        "acquisition_dates": ["2023-11-18", "2023-12-09", "2024-01-14"],
        "source_item_ids": ["REPLAY/S2_SR/2023-11-18", "REPLAY/S2_SR/2023-12-09", "REPLAY/S2_SR/2024-01-14"],
    },
    "metrics": {
        "analysis_type": "ndvi_change",
        "ndvi_baseline_mean": 0.42,
        "ndvi_comparison_mean": 0.27,
        "ndvi_delta_mean": -0.15,
        "ndvi_threshold_used": -0.15,
        "candidate_area_ha": 4.3,
        "candidate_area_in_zone_a_ha": 1.2,
        "candidate_area_in_zone_b_ha": 3.1,
        "candidate_area_outside_zone_a_ha": 3.1,
        "resolution_m": 10,
        "method": "masked_median_composite_ndvi_delta",
        "method_version": "v1.0",
        "bands_used": {"nir": "B8", "red": "B4"},
        "formula": "NDVI = (B8 - B4) / (B8 + B4)",
        "seasonal_comparability": "Both periods are Nov-Jan (dry season); comparable.",
    },
    "limitations": [
        "REPLAY FIXTURE: values are fixed illustrations, not computed from real imagery.",
        "Real analysis requires Earth Engine authentication.",
        "10m resolution may miss sub-pixel features.",
        "Cloud masking reduces valid pixel count.",
        "NDVI threshold of -0.15 is configurable; not a universal ecological standard.",
    ],
    "data_provenance": {
        "collection": "COPERNICUS/S2_SR_HARMONIZED (illustrative)",
        "reference": "https://developers.google.com/earth-engine/datasets/catalog/sentinel-2/",
        "connection_mode": REPLAY_MODE,
        "retrieval_timestamp": None,
    },
}

# Replay FER content
DEMO_FER_CONTENT = {
    "report_mode": REPLAY_MODE,
    "note": "REPLAY FIXTURE — illustrative FER, not an official environmental assessment",
    "summary": (
        "[REPLAY MODE] This First Environmental Report is generated from a fixed demonstration "
        "fixture for the illustrative Coastal Infrastructure Project (Mandrem Illustration, Goa). "
        "It demonstrates the EcoSentinel workflow. No real project data, satellite imagery, or "
        "regulatory decisions are represented. All values are illustrative."
    ),
    "executive_summary": (
        "EcoSentinel has generated a preliminary FER for this illustrative project. "
        "A candidate vegetation-index decline of approximately 4.3 ha has been identified in "
        "the investigation area between the baseline period (Nov 2021 – Jan 2022) and the "
        "comparison period (Nov 2023 – Jan 2024). Of this, approximately 1.2 ha falls within "
        "the declared Zone A boundary and approximately 3.1 ha falls outside it. "
        "These are illustrative NDVI-based screening observations only and require human review "
        "before any interpretation as environmental change. This FER does not constitute an "
        "official environmental clearance appraisal or regulatory finding."
    ),
    "environmental_baseline": {
        "mean_ndvi_baseline": 0.42,
        "mean_ndvi_comparison": 0.27,
        "vegetation_index": "NDVI",
        "reference_collection": "COPERNICUS/S2_SR_HARMONIZED (illustrative)",
        "coastal_proximity_km": 0.8,
        "elevation_m": 12,
        "land_cover_description": "Coastal scrubland and sparse vegetation (illustrative)",
    },
    "screening_observations": [
        {
            "id": "obs-001",
            "type": "vegetation_index_change",
            "description": (
                "Candidate vegetation-index decline (ΔNDVI ≈ −0.15) detected in the "
                "investigation area between Nov 2021–Jan 2022 and Nov 2023–Jan 2024."
            ),
            "source": "REPLAY fixture (illustrative NDVI comparison)",
            "zone": "A and B",
            "area_ha": 4.3,
            "confidence": "illustrative",
            "connection_mode": REPLAY_MODE,
        },
        {
            "id": "obs-002",
            "type": "data_limitation",
            "description": (
                "Valid pixel coverage ranged from 77.9% to 81.8% across selected composites. "
                "Cloud-affected areas are excluded from analysis."
            ),
            "source": "REPLAY fixture",
            "zone": "AOI",
            "connection_mode": REPLAY_MODE,
        },
    ],
    "investigation_guide": [
        "Verify whether the candidate vegetation change overlaps with any permitted construction footprint.",
        "Check whether seasonal variation (particularly monsoon/post-monsoon) may explain the NDVI change.",
        "Review submitted environmental clearance conditions for vegetation restrictions.",
        "Obtain and review available site inspection records.",
        "Compare with Google Earth historical imagery if available.",
        "Request surveyor confirmation of current ground conditions.",
    ],
    "evidence_gaps": [
        "No field inspection records available in this case.",
        "No EIA/EMP document uploaded for this replay fixture.",
        "Real-time Earth Engine authentication not configured; live analysis unavailable.",
        "No applicant response to screening observations has been recorded.",
    ],
    "data_availability": {
        "earth_engine": {"status": "replay", "note": "Replay fixture used; live EE not configured"},
        "piper_tts": {"status": "not_configured", "note": "Piper TTS requires local installation"},
        "ollama": {"status": "checking", "note": "Detected at startup"},
        "database": {"status": "connected", "note": "SQLite local"},
    },
    "suggested_next_checks": [
        "Configure Google Earth Engine for live satellite analysis.",
        "Upload project documents (EIA, Form 1, site plan) to extract evidence claims.",
        "Add field inspection records as case evidence.",
        "Run 'Challenge This Finding' to examine alternative explanations.",
    ],
    "source_references": [
        {
            "id": "src-001",
            "type": "satellite_collection",
            "name": "COPERNICUS/S2_SR_HARMONIZED (Illustrative Replay)",
            "url": "https://developers.google.com/earth-engine/datasets/catalog/sentinel-2/",
            "connection_mode": REPLAY_MODE,
        },
        {
            "id": "src-002",
            "type": "boundary",
            "name": "Illustrative project boundary (Replay Fixture)",
            "source": "EcoSentinel replay fixture",
            "connection_mode": REPLAY_MODE,
        },
    ],
    "limitations": [
        "REPLAY MODE: All observations use fixed illustrative values, not live satellite data.",
        "This FER is not an official environmental assessment or regulatory opinion.",
        "NDVI change screening is a preliminary indicator only; human expert review is required.",
        "Configure Earth Engine to enable live Sentinel-2 analysis.",
    ],
}

# Demo challenge investigation result
DEMO_CHALLENGE_RESULT = {
    "observation_summary": (
        "[REPLAY] Candidate NDVI decline of −0.15 over approximately 4.3 ha detected "
        "in the comparison period (Nov 2023 – Jan 2024). The decline partially extends "
        "outside the declared Zone A boundary (3.1 ha in Zone B / surrounding area). "
        "All values are illustrative replay fixture data."
    ),
    "supporting_evidence": [
        {
            "type": "satellite_index",
            "description": "NDVI decline exceeds configured threshold of −0.15 in both Zone A and Zone B.",
            "source": "REPLAY fixture",
        },
        {
            "type": "spatial_overlap",
            "description": "Candidate change polygon overlaps with declared Zone A boundary (1.2 ha).",
            "source": "REPLAY spatial calculation",
        },
    ],
    "contradictory_evidence": [
        {
            "type": "data_limitation",
            "description": (
                "Cloud coverage of 18–22% means some pixels were excluded. "
                "The masked area could conceal or exaggerate the apparent change."
            ),
        },
        {
            "type": "seasonal_factor",
            "description": (
                "Both periods are dry-season composites, reducing seasonal bias. "
                "However, inter-annual rainfall variation could still affect NDVI."
            ),
        },
    ],
    "alternative_explanations": [
        "Natural inter-annual vegetation variability in coastal scrubland.",
        "Agricultural clearance unrelated to the declared project boundary.",
        "Post-cyclone or storm damage (coastal areas susceptible).",
        "Data artefact from cloud shadow not fully masked by the quality filter.",
    ],
    "data_quality_notes": [
        "Valid pixel coverage: 77.9%–81.8% (acceptable for screening, below optimal).",
        "10m resolution is sufficient for area > 1 ha; sub-hectare features may be missed.",
        "All scene IDs in this replay are illustrative and not real Sentinel-2 acquisition IDs.",
    ],
    "limitations": [
        "REPLAY FIXTURE: values are fixed; not computed from real satellite imagery.",
        "NDVI is a vegetation index, not a direct land-clearing detection method.",
        "Human expert review is required before any regulatory interpretation.",
        "Earth Engine authentication needed for live analysis.",
    ],
    "unresolved_questions": [
        "Has construction commenced within or adjacent to Zone B?",
        "Are any permits issued for vegetation clearance outside the declared boundary?",
        "What is the current ground condition as reported by a site inspector?",
        "Are monsoon rainfall records for 2021–2024 consistent with NDVI baseline assumptions?",
    ],
    "suggested_next_checks": [
        "Obtain field inspection report for the site.",
        "Review any granted permissions for vegetation clearance.",
        "Compare with Google Earth historical imagery.",
        "Request applicant written response to screening observations.",
        "Configure Earth Engine for live analysis in the next monitoring cycle.",
    ],
    "recommended_review_action": (
        "Field verification recommended. The candidate change requires ground-truth "
        "confirmation before any regulatory action. This is a preliminary screening finding only."
    ),
    "priority_rationale": (
        "Moderate priority: NDVI change is above threshold but data quality is acceptable "
        "rather than high. The portion outside Zone A warrants spatial verification. "
        "REPLAY mode — live analysis required for definitive assessment."
    ),
    "review_status": "under_human_review",
    "analysis_version": "replay-v1.0",
    "generated_by_model": "REPLAY (no AI generation required for fixture)",
}


def get_replay_project() -> Dict[str, Any]:
    return DEMO_PROJECT


def get_replay_analysis_result() -> Dict[str, Any]:
    return DEMO_ANALYSIS_RESULT


def get_replay_fer_content() -> Dict[str, Any]:
    return DEMO_FER_CONTENT


def get_replay_challenge_result() -> Dict[str, Any]:
    return DEMO_CHALLENGE_RESULT


def get_replay_zone_a() -> Dict[str, Any]:
    return DEMO_ZONE_A


def get_replay_zone_b() -> Dict[str, Any]:
    return DEMO_ZONE_B


def get_replay_finding_geometry() -> Dict[str, Any]:
    return DEMO_FINDING_GEOMETRY
