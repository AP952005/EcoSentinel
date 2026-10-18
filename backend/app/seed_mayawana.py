"""
Seed or update the canonical Mayawana Forest-Change Reference Investigation Project in EcoSentinel database.
Location: Ketapang Regency, West Kalimantan, Indonesia (-0.924587°S, 109.941413°E).
"""
import math
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.models import (
    Project, Boundary, FERReport, FERReportVersion, Finding, FindingEvidence, User, CaseEvent
)

MAYAWANA_PROJECT_ID = "demo-mayawana-ketapang-west-kalimantan-002"
C_LAT = -0.924587
C_LNG = 109.941413

def create_circle_geojson(c_lat: float, c_lng: float, radius_km: float, points: int = 48) -> dict:
    coords = []
    earth_r = 6371.0
    rad_lat = math.radians(c_lat)
    rad_lng = math.radians(c_lng)
    d = radius_km / earth_r
    for i in range(points + 1):
        bearing = (i * 2 * math.pi) / points
        lat = math.asin(math.sin(rad_lat) * math.cos(d) + math.cos(rad_lat) * math.sin(d) * math.cos(bearing))
        lng = rad_lng + math.atan2(math.sin(bearing) * math.sin(d) * math.cos(rad_lat), math.cos(d) - math.sin(rad_lat) * math.sin(lat))
        coords.append([round(math.degrees(lng), 6), round(math.degrees(lat), 6)])
    return {"type": "Polygon", "coordinates": [coords]}

def create_box_geojson(c_lat: float, c_lng: float, d_lat: float, d_lng: float) -> dict:
    half_lat = d_lat / 2.0
    half_lng = d_lng / 2.0
    return {
        "type": "Polygon",
        "coordinates": [[
            [round(c_lng - half_lng, 6), round(c_lat + half_lat, 6)],
            [round(c_lng + half_lng, 6), round(c_lat + half_lat, 6)],
            [round(c_lng + half_lng, 6), round(c_lat - half_lat, 6)],
            [round(c_lng - half_lng, 6), round(c_lat - half_lat, 6)],
            [round(c_lng - half_lng, 6), round(c_lat + half_lat, 6)],
        ]]
    }

def seed_mayawana():
    db: Session = SessionLocal()
    try:
        # Find admin or officer user to own the project
        owner = db.query(User).filter(User.role.in_(["admin", "officer"])).first()
        if not owner:
            owner = db.query(User).first()
        if not owner:
            from app.core.security import hash_password
            owner = User(
                id="60b89473-bc5e-43ed-992d-c0245c163338",
                email="admin@ecosentinel.io",
                hashed_password=hash_password("EcoSentinelAdmin2024!"),
                full_name="Lead Environmental Officer",
                organization="EcoSentinel Environmental Authority",
                role="officer",
                is_first_login=False,
            )
            db.add(owner)
            db.flush()
        owner_id = owner.id

        # Check existing project
        project = db.query(Project).filter(
            (Project.id == MAYAWANA_PROJECT_ID) | 
            (Project.project_name.like("%Mayawana%"))
        ).first()

        now = datetime.now(timezone.utc)

        if not project:
            print("Creating new Mayawana Reference Investigation project...")
            project = Project(
                id=MAYAWANA_PROJECT_ID,
                owner_id=owner_id,
                project_name="Mayawana Forest-Change Reference Investigation — PT Mayawana Persada Concession Audit",
                applicant_name="PT Mayawana Persada (Alas Kusuma Group)",
                organization="PT Mayawana Persada",
                sector="Forestry",
                activity="Industrial Timber Plantation (HTI) & Peatland Concession Audit",
                eia_category="Category A (High Sensitivity Tropical Peatland)",
                application_stage="Compliance Audit & Concession Verification",
                proposal_number="WK-KLHK-2024-00918",
                has_prior_approval=True,
                prior_approval_reference="SK.732/Menhut-II/2010 (IUPHHK-HTI)",
                project_summary=(
                    "Authoritative multi-temporal environmental intelligence investigation and remote-sensing "
                    "compliance audit of the Mayawana commercial concession in Ketapang Regency, West Kalimantan, "
                    "Borneo (-0.924587°S, 109.941413°E). Multi-sensor planetary screening verifies 18.4 ha of core "
                    "tropical rainforest canopy disturbance and 20.0 ha of secondary buffer degradation across 12 observation "
                    "epochs (March 2021 to July 2024). Corroborated by Copernicus Sentinel-2 L2A BOA reflectance "
                    "(NDVI 0.82 → 0.44), Hansen Global Forest Change v1.11 (2022 annual loss epoch), and Dynamic World "
                    "continuous probability transitions (+38% bare ground expansion)."
                ),
                scale_data={
                    "capital_cost_crores": 450.0,
                    "land_area_ha": 11309.73,
                    "project_length_km": 12.5,
                    "capacity_value": 120000.0,
                    "capacity_unit": "m3/year timber extraction capacity",
                    "buffer_radius_km": 6.0,
                    "core_area_ha": 34.5,
                    "monitored_epochs": 12,
                },
                country="Indonesia",
                state="West Kalimantan",
                district="Ketapang Regency",
                sub_district="Simpang Dua / Sandai",
                village="Keriau Peatland Corridor",
                survey_details="Hansen GFC 2022 Loss Tile 00N_100E · Sentinel-2 Tile 49MDN · Centroid -0.924587, 109.941413",
                latitude=C_LAT,
                longitude=C_LNG,
                location_description=(
                    "Mayawana Plantation concession boundary, adjacent to Bukit Baka Bukit Raya biodiversity "
                    "corridor and high-carbon peat dome in Ketapang Regency."
                ),
                status="active",
                analysis_mode="REPLAY",
                created_at=now,
                updated_at=now,
                submitted_at=now,
            )
            db.add(project)
            db.flush()
        else:
            print(f"Updating existing Mayawana project: {project.id}")
            project.project_name = "Mayawana Forest-Change Reference Investigation — PT Mayawana Persada Concession Audit"
            project.applicant_name = "PT Mayawana Persada (Alas Kusuma Group)"
            project.organization = "PT Mayawana Persada"
            project.sector = "Forestry"
            project.activity = "Industrial Timber Plantation (HTI) & Peatland Concession Audit"
            project.latitude = C_LAT
            project.longitude = C_LNG
            project.country = "Indonesia"
            project.state = "West Kalimantan"
            project.district = "Ketapang Regency"
            project.status = "active"
            project.analysis_mode = "REPLAY"
            project.scale_data = {
                "capital_cost_crores": 450.0,
                "land_area_ha": 11309.73,
                "project_length_km": 12.5,
                "capacity_value": 120000.0,
                "capacity_unit": "m3/year timber extraction capacity",
                "buffer_radius_km": 6.0,
                "core_area_ha": 34.5,
                "monitored_epochs": 12,
            }
            db.flush()

        # Clean old boundaries & re-seed
        db.query(Boundary).filter(Boundary.project_id == project.id).delete()

        # 1. Zone B Surveillance Window (6.0 km circle = 11,309.73 ha)
        zone_b_geojson = create_circle_geojson(C_LAT, C_LNG, radius_km=6.0, points=64)
        b_zone_b = Boundary(
            project_id=project.id,
            zone_type="B",
            geometry_geojson=zone_b_geojson,
            source="planetary_surveillance_circle",
            status="approved_search_window",
            area_ha=11309.73,
            perimeter_km=37.7,
            buffer_distance_m=6000.0,
            notes="Zone B 6.0 km circular surveillance boundary for satellite multi-epoch screening.",
            is_valid=True,
            created_at=now,
        )
        db.add(b_zone_b)

        # 2. Zone A Core Footprint (approx 34.5 ha)
        zone_a_geojson = create_box_geojson(C_LAT, C_LNG, d_lat=0.0055, d_lng=0.0055)
        b_zone_a = Boundary(
            project_id=project.id,
            zone_type="A",
            geometry_geojson=zone_a_geojson,
            source="concession_core_footprint",
            status="active_core_aoi",
            area_ha=34.5,
            perimeter_km=2.4,
            buffer_distance_m=0.0,
            notes="Zone A primary concession operational clearing polygon.",
            is_valid=True,
            created_at=now,
        )
        db.add(b_zone_a)

        # 3. Candidate Change Area (18.4 ha verified loss)
        candidate_geojson = create_box_geojson(C_LAT + 0.001, C_LNG + 0.002, d_lat=0.004, d_lng=0.0042)
        b_candidate = Boundary(
            project_id=project.id,
            zone_type="candidate",
            geometry_geojson=candidate_geojson,
            source="sentinel2_hansen_corroboration",
            status="verified_degradation",
            area_ha=18.4,
            perimeter_km=1.8,
            buffer_distance_m=0.0,
            notes="18.4 ha verified canopy clearing corroborated by Hansen 2022 annual loss epoch.",
            is_valid=True,
            created_at=now,
        )
        db.add(b_candidate)

        # Ensure FER Report exists
        fer = db.query(FERReport).filter(FERReport.project_id == project.id).first()
        if not fer:
            fer = FERReport(
                project_id=project.id,
                version=1,
                report_mode="REPLAY",
                status="ready",
                created_at=now,
                updated_at=now,
            )
            db.add(fer)
            db.flush()

        fer.summary = (
            "Fast Environmental Review (FER) for Mayawana Plantation concession audit in Ketapang, West Kalimantan. "
            "Satellite observations confirm persistent multi-temporal vegetation loss of 18.4 ha within core Zone A "
            "and 20.0 ha of scattered degradation across the Zone B buffer. Mean canopy NDVI decreased from 0.82 to 0.44 "
            "(ΔNDVI = -0.38) between March 2021 baseline and July 2024 latest usable pass."
        )
        fer.executive_summary = (
            "EXECUTIVE COMPLIANCE FINDING: High-confidence anthropogenic forest canopy loss and drainage canal development "
            "detected within the PT Mayawana Persada concession area. Copernicus Sentinel-2 L2A surface reflectance indicates "
            "gradual photosynthetic loss beginning in Q3 2022 and reaching peak bare ground exposure (+38%) in Q1 2023. "
            "The clearing is independently corroborated by the University of Maryland Hansen Global Forest Change (GFC) v1.11 dataset, "
            "which flags 18.4 ha of annual canopy loss in the 2022 epoch. No high-temperature VIIRS/MODIS thermal anomalies were registered, "
            "substantiating mechanical earth-moving and excavator-based drainage rather than seasonal slash-and-burn fire."
        )
        fer.environmental_baseline = {
            "biome": "Tropical Moist Deciduous & Lowland Peat Swamp Forest",
            "baseline_date": "2021-03-15",
            "baseline_ndvi_mean": 0.82,
            "baseline_canopy_cover_pct": 88.5,
            "baseline_water_fraction_pct": 2.1,
            "baseline_cloud_cover_pct": 4.2,
            "sensor": "Sentinel-2B MSI L2A (BOA Reflectance)",
            "scene_id": "S2B_MSIL2A_20210315T030539_N0214_R075_T49MDN",
        }
        fer.screening_observations = [
            {
                "sensor": "Copernicus Sentinel-2 L2A",
                "bands": "Band 8 (NIR 842nm), Band 4 (Red 665nm)",
                "observation": "NDVI dropped from 0.82 (March 2021) to 0.44 (July 2024). Chlorophyll decline persistent across 12 quarters.",
                "status": "verified_loss",
            },
            {
                "sensor": "UMD Hansen Global Forest Change v1.11",
                "bands": "Tree Loss Year 2022 Layer (30m GFC)",
                "observation": "Identified 18.4 ha contiguous canopy loss in the 2022 calendar epoch matching Sentinel-2 disturbance contours.",
                "status": "independent_corroboration",
            },
            {
                "sensor": "Google Dynamic World (Sentinel-2 NRT AI)",
                "bands": "9-Class Land Cover Continuous Probability",
                "observation": "Tree canopy class probability dropped from 88% to 46%; bare ground probability surged +38%.",
                "status": "verified_transition",
            },
            {
                "sensor": "NASA FIRMS VIIRS (375m)",
                "bands": "I-Band 4/5 Thermal Brightness Temperature",
                "observation": "Zero thermal hotspot anomalies detected during clearing timeframe, ruling out slash-and-burn fire.",
                "status": "mechanical_clearing_inferred",
            },
        ]
        fer.candidate_findings = [
            {
                "finding_id": "FINDING-WK-2024-01",
                "title": "Unapproved 18.4 ha Forest Canopy Disturbance in Mayawana Concession",
                "type": "unauthorized_deforestation_and_drainage",
                "delta_ndvi": -0.38,
                "candidate_area_ha": 18.4,
                "core_zone_a_impact_ha": 8.2,
                "buffer_zone_b_impact_ha": 10.2,
                "severity": "HIGH",
            }
        ]
        fer.evidence_gaps = [
            "Official cadastral boundary shapefile from provincial forestry office (BPHL) pending verification.",
            "Sub-meter UAV drone orthomosaic required for ground-level tree crown and stump enumeration.",
            "Water table depth telemetry data absent for peat subsidence validation.",
        ]
        fer.suggested_next_checks = [
            "Request Ministry of Environment and Forestry (KLHK) concession decree boundaries and peat moratorium map.",
            "Deploy local forestry inspection team with handheld GPS to survey boundary marker pillars.",
            "Schedule Sentinel-1 SAR coherence analysis to penetrate seasonal monsoonal cloud cover.",
            "Issue formal inquiry to PT Mayawana Persada regarding drainage canal authorization.",
        ]
        fer.source_references = [
            "COPERNICUS/S2_SR_HARMONIZED (European Space Agency / Copernicus Programme)",
            "UMD/hansen/global_forest_change_2023_v1_11 (Hansen et al., Science 2013)",
            "GOOGLE/DYNAMICWORLD/V1 (Brown et al., Nature Scientific Data 2022)",
            "NASA FIRMS / VIIRS 375m NRT Thermal Anomaly Product",
        ]
        fer.limitations = [
            "10m Sentinel-2 optical resolution cannot distinguish between palm monoculture canopy and secondary degraded forest.",
            "Remote sensing spectral change detection does not constitute a legal conviction without cadastral boundary superposition.",
        ]
        fer.generated_by_model = "EcoSentinel-RemoteSensing-Audit-Engine v2.4"
        fer.generation_time_seconds = 1.84
        fer.status = "ready"

        # Ensure Findings exist
        finding = db.query(Finding).filter(Finding.project_id == project.id).first()
        if not finding:
            finding = Finding(
                id="finding-wk-2024-001",
                project_id=project.id,
                fer_report_id=fer.id,
                finding_type="deforestation_and_peat_drainage",
                title="Verified 18.4 ha Multi-Temporal Canopy Clearing in Ketapang Buffer",
                description=(
                    "Multi-temporal satellite earth observation detected 18.4 ha of contiguous rainforest canopy removal "
                    "in Ketapang Regency, West Kalimantan. Sentinel-2 NDVI dropped by -0.38 across 12 epochs, corroborated "
                    "by Hansen GFC 2022 annual loss epoch and Dynamic World bare ground surge."
                ),
                status="corroborated_change",
                zone_classification="B",
                candidate_area_ha=18.4,
                area_in_zone_a_ha=8.2,
                area_in_zone_b_ha=10.2,
                geometry_geojson=candidate_geojson,
                ndvi_delta=-0.38,
                threshold_used=-0.15,
                observation_start_date=datetime(2021, 3, 15, tzinfo=timezone.utc),
                observation_end_date=datetime(2024, 7, 20, tzinfo=timezone.utc),
                connection_mode="REPLAY",
                source_references=fer.source_references,
                created_at=now,
                updated_at=now,
            )
            db.add(finding)
            db.flush()

            # Add Evidence items
            db.add(FindingEvidence(
                finding_id=finding.id,
                evidence_type="supporting",
                source_type="observation",
                description="Sentinel-2 Band 8/Band 4 BOA reflectance confirms persistent chlorophyll loss from 0.82 to 0.44.",
                confidence="HIGH",
            ))
            db.add(FindingEvidence(
                finding_id=finding.id,
                evidence_type="supporting",
                source_type="calculation",
                description="Hansen Global Forest Change v1.11 flags 18.4 ha canopy disturbance in the 2022 epoch.",
                confidence="VERY_HIGH",
            ))
            db.add(FindingEvidence(
                finding_id=finding.id,
                evidence_type="supporting",
                source_type="observation",
                description="Dynamic World transition model verifies tree canopy reduction from 88% to 46% with commensurate bare ground expansion.",
                confidence="HIGH",
            ))
            db.add(FindingEvidence(
                finding_id=finding.id,
                evidence_type="contradictory",
                source_type="observation",
                description="Zero VIIRS thermal hotspot anomalies registered, contradicting fire/slash-and-burn clearing.",
                confidence="HIGH",
            ))

        # Add CaseEvent
        db.add(CaseEvent(
            project_id=project.id,
            event_type="investigation_activated",
            description="Mayawana Forest-Change Reference Investigation loaded as canonical planetary audit dossier.",
            actor_id=owner_id,
            created_at=now,
        ))

        db.commit()
        print(f"SUCCESS: Mayawana project seeded with ID {project.id}!")
    except Exception as e:
        db.rollback()
        print(f"ERROR: Failed to seed Mayawana project: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_mayawana()
