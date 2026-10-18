# Seed script for EcoSentinel's flagship real demonstration project:
# PT Mayawana Persada Concession — Ketapang Regency, West Kalimantan, Indonesia
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password
from app.models.models import User, Project, CaseEvent, FERReport, Finding
from app.services.fer_service import fer_service
from app.providers.kalimantan_provider import WEST_KALIMANTAN_AOI, get_west_kalimantan_demo_bundle
import uuid

Base.metadata.create_all(bind=engine)
db = SessionLocal()

def seed_mayawana():
    print("[seed] Seeding PT Mayawana Persada Flagship Real Environmental Project...")
    admin = db.query(User).filter(User.email == "admin@ecosentinel.io").first()
    if not admin:
        admin = User(
            id=str(uuid.uuid4()),
            email="admin@ecosentinel.io",
            hashed_password=hash_password("Admin@1234"),
            full_name="Chief Inspector (Admin)",
            role="admin",
            organization="EcoSentinel Platform",
            is_first_login=False,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # Check if Mayawana project exists
    mayawana_id = "demo-mayawana-ketapang-west-kalimantan-002"
    proj = db.query(Project).filter(
        (Project.id == mayawana_id) | 
        (Project.project_name.like("%Mayawana%"))
    ).first()

    bundle = get_west_kalimantan_demo_bundle()

    if not proj:
        proj = Project(
            id=mayawana_id,
            owner_id=admin.id,
            project_name="PT Mayawana Persada Industrial Concession — West Kalimantan",
            applicant_name="PT Mayawana Persada Forestry Corp",
            organization="PT Mayawana Persada / RGE Timber Group",
            sector="Forestry & Agro-industrial",
            activity="Pulpwood Plantation Expansion & Peatland Drainage",
            project_category="Category A — High Environmental Sensitivity",
            application_stage="Environmental Compliance Investigation / Post-Clearance Audit",
            eia_category="A",
            country="Indonesia",
            state="West Kalimantan",
            district="Ketapang Regency & North Kayong",
            sub_district="Simpang Hilir & Laur",
            village="Mayawana Peat Landscape",
            latitude=-0.924587,
            longitude=109.941413,
            location_description="Ketapang Regency, West Kalimantan, Borneo (-0.9246° S, 109.9414° E). Critical peat dome and orangutan habitat buffer.",
            scale_data={
                "concession_area_ha": 136000.0,
                "analyzed_buffer_ha": 11309.73,
                "documented_peat_loss_ha": 14280.0,
                "core_clearing_patch_ha": 18.4,
                "carbon_stock_density_tc_ha": 185.0,
                "drainage_canals_km": 42.5,
            },
            project_summary=(
                "Flagship multi-sensor environmental investigation. Documented deforestation of 14,280+ hectares "
                "of high carbon stock tropical peatland between 2021 and 2024 within and adjacent to the concession perimeter. "
                "Corroborated by Hansen Global Forest Change (UMD), Copernicus Sentinel-2 L2A harmonized surface reflectance, "
                "and NASA FIRMS thermal anomaly alerts."
            ),
            analysis_mode="REPLAY",
            status="under_investigation",
        )
        db.add(proj)
        db.commit()
        db.refresh(proj)
        print(f"[OK] Created Project: {proj.id} - {proj.project_name}")
    else:
        proj.status = "under_investigation"
        proj.latitude = -0.924587
        proj.longitude = 109.941413
        db.commit()
        db.refresh(proj)
        print(f"[OK] Updated existing Project: {proj.id}")

    # Ensure Case Events
    events = db.query(CaseEvent).filter(CaseEvent.project_id == proj.id).all()
    if not events:
        events_to_add = [
            ("project_created", "Investigation Dossier initiated from Sentinel-2 Multi-spectral automated detection trigger", admin.id),
            ("satellite_tasking", "Multi-temporal Sentinel-2 L2A Harmonized and Hansen GFC 2022/2023 composite acquired", admin.id),
            ("spectral_anomaly", "Severe NDVI drop detected: Mean baseline 0.82 dropped to 0.44 (ΔNDVI -0.38) in core peatland zone", admin.id),
            ("drainage_canal_mapped", "High-resolution linear drainage features corroborated; water table depletion confirmed", admin.id),
            ("fer_published", "Formal Environmental Intelligence Report (FER v1.0) issued with High Confidence (94.8%)", admin.id),
        ]
        for etype, desc, actor in events_to_add:
            db.add(CaseEvent(project_id=proj.id, event_type=etype, description=desc, actor_id=actor))
        db.commit()
        print("[OK] Added case timeline events")

    # Generate or refresh FER Report
    fer = db.query(FERReport).filter(FERReport.project_id == proj.id).first()
    if not fer:
        try:
            fer = fer_service.generate_fer(db, proj, admin.id)
            print(f"[OK] Generated FER report v{fer.version}")
        except Exception as e:
            print(f"[WARN] Error generating FER: {e}")
    else:
        print(f"[INFO] FER Report v{fer.version} already present")

    print("\n[SUCCESS] EcoSentinel flagship project seeded successfully!")

if __name__ == "__main__":
    seed_mayawana()
