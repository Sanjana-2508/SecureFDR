import unittest
from datetime import date, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.database import Base, get_db
from app.routers import admin, notifications
from app.security import create_token, verify_password


class SecureFDRApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.Session()
        self.institution_one = models.Institution(
            name="North Institute", code="NORTH1"
        )
        self.institution_two = models.Institution(
            name="South Institute", code="SOUTH1"
        )
        self.admin = models.User(
            name="Admin", email="admin@example.org",
            password_hash="unused", role=models.ROLE_ADMIN,
        )
        self.officer_one = models.User(
            name="Officer One", email="officer1@example.org",
            password_hash="unused", role=models.ROLE_OFFICER,
        )
        self.officer_two = models.User(
            name="Officer Two", email="officer2@example.org",
            password_hash="unused", role=models.ROLE_OFFICER,
        )
        self.institution_user_one = models.User(
            name="North User", email="north@example.org",
            password_hash="unused", role=models.ROLE_INSTITUTION,
            institution=self.institution_one,
        )
        self.institution_user_two = models.User(
            name="South User", email="south@example.org",
            password_hash="unused", role=models.ROLE_INSTITUTION,
            institution=self.institution_two,
        )
        self.db.add_all([
            self.institution_one,
            self.institution_two,
            self.admin,
            self.officer_one,
            self.officer_two,
            self.institution_user_one,
            self.institution_user_two,
        ])
        self.db.commit()

        app = FastAPI()
        app.include_router(admin.router)
        app.include_router(notifications.router)

        def override_get_db():
            session = self.Session()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

    def headers_for(self, user):
        return {"Authorization": f"Bearer {create_token(user)}"}

    def test_admin_user_and_institution_management(self):
        response = self.client.post(
            "/admin/users",
            headers=self.headers_for(self.admin),
            json={
                "name": "New Registrar",
                "email": "NEW@EXAMPLE.ORG",
                "password": "a-long-initial-password",
                "role": "INSTITUTION",
                "institution_id": self.institution_one.id,
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        created = response.json()
        self.assertNotIn("password", created)
        self.assertNotIn("password_hash", created)
        stored_user = self.db.get(models.User, created["id"])
        self.assertTrue(verify_password("a-long-initial-password", stored_user.password_hash))
        self.assertNotEqual(stored_user.password_hash, "a-long-initial-password")

        for role, email in (
            ("OFFICER", "new-officer@example.org"),
            ("ADMIN", "new-admin@example.org"),
        ):
            created_role = self.client.post(
                "/admin/users",
                headers=self.headers_for(self.admin),
                json={
                    "name": f"New {role.title()}",
                    "email": email,
                    "password": "another-long-initial-password",
                    "role": role,
                },
            )
            self.assertEqual(created_role.status_code, 201, created_role.text)
            self.assertEqual(created_role.json()["role"], role)

        self_account = self.client.post(
            "/admin/users",
            headers=self.headers_for(self.admin),
            json={
                "name": "Admin",
                "email": self.admin.email,
                "password": "another-long-initial-password",
                "role": "ADMIN",
            },
        )
        self.assertEqual(self_account.status_code, 409)

        duplicate = self.client.post(
            "/admin/users",
            headers=self.headers_for(self.admin),
            json={
                "name": "Duplicate",
                "email": "new@example.org",
                "password": "another-long-initial-password",
                "role": "ADMIN",
            },
        )
        self.assertEqual(duplicate.status_code, 409)

        missing_institution = self.client.post(
            "/admin/users",
            headers=self.headers_for(self.admin),
            json={
                "name": "Unassigned Registrar",
                "email": "unassigned@example.org",
                "password": "another-long-initial-password",
                "role": "INSTITUTION",
            },
        )
        self.assertEqual(missing_institution.status_code, 422)

        institution = self.client.post(
            "/admin/institutions",
            headers=self.headers_for(self.admin),
            json={
                "name": "West Institute",
                "code": "west1",
                "city": "Pune",
                "state": "Maharashtra",
            },
        )
        self.assertEqual(institution.status_code, 201, institution.text)
        self.assertEqual(institution.json()["code"], "WEST1")
        duplicate_institution = self.client.post(
            "/admin/institutions",
            headers=self.headers_for(self.admin),
            json={"name": "Duplicate Institute", "code": "west1"},
        )
        self.assertEqual(duplicate_institution.status_code, 409)
        self.assertEqual(
            self.client.get(
                "/admin/institutions",
                headers=self.headers_for(self.admin),
            ).status_code,
            200,
        )

    def test_non_admin_cannot_create_users_or_institutions(self):
        payload = {
            "name": "Unauthorized",
            "email": "unauthorized@example.org",
            "password": "a-long-initial-password",
            "role": "ADMIN",
        }
        self.assertEqual(
            self.client.post(
                "/admin/users",
                headers=self.headers_for(self.officer_one),
                json=payload,
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                "/admin/institutions",
                headers=self.headers_for(self.institution_user_one),
                json={"name": "Denied Institute", "code": "DENIED"},
            ).status_code,
            403,
        )

    def add_fdr(self, ref, institution, maturity_date, status, assigned=None):
        fdr = models.FDRRecord(
            institution_id=institution.id,
            bank_name="Example Bank",
            reference_no=ref,
            amount=1000,
            issue_date=maturity_date - timedelta(days=100),
            maturity_date=maturity_date,
            status=status,
            assigned_officer_id=assigned.id if assigned else None,
        )
        self.db.add(fdr)
        self.db.commit()
        return fdr

    def test_maturity_alerts_respect_window_scope_and_deduplicate(self):
        today = date(2026, 10, 26)
        self.db.add(models.AppSetting(key="alert_days_first", value="60"))
        upcoming_one = self.add_fdr(
            "UPCOMING-0", self.institution_one, today, models.FDR_VERIFIED
        )
        upcoming_two = self.add_fdr(
            "UPCOMING-60", self.institution_two,
            today + timedelta(days=60), models.FDR_VERIFIED,
            assigned=self.officer_one,
        )
        self.add_fdr(
            "OUTSIDE-WINDOW", self.institution_two,
            today + timedelta(days=61), models.FDR_VERIFIED,
        )
        overdue_one = self.add_fdr(
            "OVERDUE", self.institution_one,
            today - timedelta(days=1), models.FDR_VERIFIED,
        )
        matured_overdue = self.add_fdr(
            "MATURED-OVERDUE", self.institution_two,
            today - timedelta(days=3), models.FDR_MATURED,
            assigned=self.officer_one,
        )
        self.add_fdr(
            "RENEWED-OVERDUE", self.institution_one,
            today - timedelta(days=2), models.FDR_RENEWED,
        )
        self.add_fdr(
            "RELEASED-OVERDUE", self.institution_two,
            today - timedelta(days=4), models.FDR_RELEASED,
        )
        self.db.commit()

        result = notifications.generate_maturity_alerts_for_all(self.db, today)
        self.assertEqual(result["monitoring_window_days"], 60)
        self.assertEqual(result["upcoming_fdrs_found"], 2)
        self.assertEqual(result["overdue_fdrs_found"], 2)
        first_count = self.db.query(models.Notification).count()
        self.assertEqual(first_count, 14)

        rows = self.db.query(models.Notification).all()
        recipients_by_fdr = {}
        for row in rows:
            recipients_by_fdr.setdefault(row.fdr_id, set()).add(row.user_id)

        self.assertEqual(
            recipients_by_fdr[upcoming_one.id],
            {
                self.institution_user_one.id,
                self.admin.id,
                self.officer_one.id,
                self.officer_two.id,
            },
        )
        self.assertEqual(
            recipients_by_fdr[upcoming_two.id],
            {
                self.institution_user_two.id,
                self.admin.id,
                self.officer_one.id,
            },
        )
        self.assertEqual(
            recipients_by_fdr[overdue_one.id],
            {
                self.institution_user_one.id,
                self.admin.id,
                self.officer_one.id,
                self.officer_two.id,
            },
        )
        self.assertEqual(
            recipients_by_fdr[matured_overdue.id],
            {
                self.institution_user_two.id,
                self.admin.id,
                self.officer_one.id,
            },
        )

        repeated = notifications.generate_maturity_alerts_for_all(self.db, today)
        self.assertEqual(repeated["notifications_created"], 0)
        self.assertEqual(self.db.query(models.Notification).count(), first_count)

    def test_notification_endpoints_keep_user_scoping_and_manual_role_check(self):
        own_notification = models.Notification(
            user_id=self.institution_user_one.id,
            title="Own alert",
            message="For this institution only",
        )
        other_notification = models.Notification(
            user_id=self.institution_user_two.id,
            title="Other alert",
            message="Must remain private",
        )
        self.db.add_all([own_notification, other_notification])
        self.db.commit()

        denied = self.client.post(
            "/notifications/generate-maturity-alerts",
            headers=self.headers_for(self.institution_user_one),
        )
        self.assertEqual(denied.status_code, 403)
        response = self.client.get(
            "/notifications",
            headers=self.headers_for(self.institution_user_one),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["notifications"][0]["title"], "Own alert")

        forbidden_read = self.client.patch(
            f"/notifications/{other_notification.id}/read",
            headers=self.headers_for(self.institution_user_one),
        )
        self.assertEqual(forbidden_read.status_code, 403)
        self.assertEqual(
            self.client.patch(
                f"/notifications/{own_notification.id}/read",
                headers=self.headers_for(self.institution_user_one),
            ).status_code,
            200,
        )
        unread = self.client.get(
            "/notifications",
            params={"unread_only": True},
            headers=self.headers_for(self.institution_user_one),
        )
        self.assertEqual(unread.status_code, 200)
        self.assertEqual(unread.json()["total"], 0)

        for permitted_user in (self.admin, self.officer_one):
            permitted_scan = self.client.post(
                "/notifications/generate-maturity-alerts",
                headers=self.headers_for(permitted_user),
            )
            self.assertEqual(permitted_scan.status_code, 200)


if __name__ == "__main__":
    unittest.main()
