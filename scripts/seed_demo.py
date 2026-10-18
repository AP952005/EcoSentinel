# Demo seed script - creates admin + demo users and a replay demonstration project.
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password
from app.models.models import User, Project, CaseEvent
from app.services.fer_service import fer_service
import uuid

Base.metadata.create_all(bind=engine)
db = SessionLocal()

def seed():
    print("[seed] Seeding EcoSentinel demo data...\n")
    existing_admin = db.query(User).filter(User.email == "admin@ecosentinel.io").first()
    if not existing_admin:
        admin = User(id=str(uuid.uuid4()), email="admin@ecosentinel.io",
            hashed_password=hash_password("Admin@1234"), full_name="Admin User",
            role="admin", organization="EcoSentinel Platform", is_first_login=False)
        db.add(admin)
        print("[OK] Admin user: admin@ecosentinel.io / Admin@1234")
    else:
        admin = existing_admin
        print("[INFO] Admin user already exists.")
    if not db.query(User).filter(User.email == "officer@ecosentinel.io").first():
        db.add(User(id=str(uuid.uuid4()), email="officer@ecosentinel.io",
            hashed_password=hash_password("Officer@1234"), full_name="Dr. Ananya Sharma",
            role="officer", organization="MoEFCC", is_first_login=False))
        print("[OK] Officer: officer@ecosentinel.io / Officer@1234")
    if not db.query(User).filter(User.email == "applicant@ecosentinel.io").first():
        db.add(User(id=str(uuid.uuid4()), email="applicant@ecosentinel.io",
            hashed_password=hash_password("Applicant@1234"), full_name="Coastal Roads Ltd",
            role="applicant", organization="Coastal Roads Ltd", is_first_login=False))
        print("[OK] Applicant: applicant@ecosentinel.io / Applicant@1234")
    db.commit()
    db.refresh(admin)
    if not db.query(Project).filter(Project.project_name == "Mandrem Illustration (Replay Demo)").first():
        project = Project(id=str(uuid.uuid4()), owner_id=admin.id,
            project_name="Mandrem Illustration (Replay Demo)",
            applicant_name="Coastal Roads Ltd", organization="Coastal Roads Ltd",
            sector="Infrastructure", activity="Coastal road construction",
            project_category="New Project", application_stage="EIA submitted for appraisal",
            eia_category="B1", country="India", state="Goa", district="North Goa",
            sub_district="Pernem", village="Mandrem", latitude=15.693, longitude=73.732,
            scale_data={"capital_cost_crores": 245.0, "land_area_ha": 14.2,
                        "capacity_unit": "km", "project_length_km": 8.5},
            project_summary="Proposed 8.5 km coastal road. Illustrative demo - not a real project.",
            analysis_mode="REPLAY", status="active")
        db.add(project)
        db.add(CaseEvent(project_id=project.id, event_type="project_created",
            description="Demo project from seed script", actor_id=admin.id))
        db.commit()
        db.refresh(project)
        print("[OK] Demo project: " + project.id)
        try:
            fer = fer_service.generate_fer(db, project, admin.id)
            print("[OK] FER v{} generated (mode={})".format(fer.version, fer.report_mode))
        except Exception as e:
            print("[WARN] FER failed: {}".format(e))
    else:
        print("[INFO] Demo project already exists.")
    db.close()
    print("\nSeed complete! Login with admin@ecosentinel.io / Admin@1234")

if __name__ == "__main__":
    seed()
