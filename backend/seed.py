"""Run: python seed.py   (resets DB and loads SAMPLE demo data)"""
from datetime import date, timedelta
from app.database import Base, engine, SessionLocal
from app import models as m
from app.security import hash_password

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
db = SessionLocal()
today = date.today()

i1 = m.Institution(name="Sunrise Institute of Technology", code="SIT001", city="Bengaluru", state="Karnataka")
i2 = m.Institution(name="Lakeview College of Engineering", code="LCE002", city="Pune", state="Maharashtra")
db.add_all([i1, i2]); db.commit()

pw = hash_password("demo123")
users = [
    m.User(name="Admin User", email="admin@securefdr.in", password_hash=pw, role=m.ROLE_ADMIN),
    m.User(name="Officer Rao", email="officer1@aicte.in", password_hash=pw, role=m.ROLE_OFFICER),
    m.User(name="Officer Sharma", email="officer2@aicte.in", password_hash=pw, role=m.ROLE_OFFICER),
    m.User(name="Sunrise Registrar", email="sunrise@inst.in", password_hash=pw, role=m.ROLE_INSTITUTION, institution_id=i1.id),
    m.User(name="Lakeview Registrar", email="lakeview@inst.in", password_hash=pw, role=m.ROLE_INSTITUTION, institution_id=i2.id),
]
db.add_all(users); db.commit()

# (institution, bank, ref, amount, issued days ago, matures in days, status)
rows = [
    (i1, "State Bank of India", "SBI-FDR-1001", 1000000, 300, 65, m.FDR_VERIFIED),
    (i1, "HDFC Bank", "HDFC-FDR-2002", 500000, 350, 20, m.FDR_VERIFIED),
    (i1, "Canara Bank", "CAN-FDR-3003", 750000, 10, 355, m.FDR_SUBMITTED),
    (i2, "Punjab National Bank", "PNB-FDR-4004", 1200000, 700, -5, m.FDR_VERIFIED),   # overdue
    (i2, "ICICI Bank", "ICICI-FDR-5005", 900000, 100, 265, m.FDR_UNDER_REVIEW),
    (i2, "Bank of Baroda", "BOB-FDR-6006", 600000, 60, 305, m.FDR_DISCREPANCY),
]
for n, (inst, bank, ref, amt, ago, left, st) in enumerate(rows, 1):
    db.add(m.FDRRecord(fdr_uid=f"FDR-{n:04d}", institution_id=inst.id, bank_name=bank,
                       reference_no=ref, amount=amt, issue_date=today - timedelta(days=ago),
                       maturity_date=today + timedelta(days=left), status=st))
db.add_all([m.AppSetting(key="alert_days_first", value="60"),
            m.AppSetting(key="alert_days_urgent", value="30"),
            m.AppSetting(key="alert_days_critical", value="7")])
db.commit()
print("Seeded. All demo passwords: demo123")
for u in users: print(f"  {u.role:12} {u.email}")
