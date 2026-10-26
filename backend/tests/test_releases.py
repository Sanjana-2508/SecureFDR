import unittest
from datetime import date, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.database import Base, get_db
from app.routers import releases
from app.security import create_token


class ReleaseWorkflowTests(unittest.TestCase):
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
        self.institution_user_one = models.User(
            name="North User",
            email="north@example.org",
            password_hash="unused",
            role=models.ROLE_INSTITUTION,
            institution=self.institution_one,
        )
        self.institution_user_two = models.User(
            name="South User",
            email="south@example.org",
            password_hash="unused",
            role=models.ROLE_INSTITUTION,
            institution=self.institution_two,
        )
        self.officer = models.User(
            name="Officer",
            email="officer@example.org",
            password_hash="unused",
            role=models.ROLE_OFFICER,
        )
        self.admin = models.User(
            name="Admin",
            email="admin@example.org",
            password_hash="unused",
            role=models.ROLE_ADMIN,
        )
        self.db.add_all([
            self.institution_one,
            self.institution_two,
            self.institution_user_one,
            self.institution_user_two,
            self.officer,
            self.admin,
        ])
        self.db.commit()

        app = FastAPI()
        app.include_router(releases.router)

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

    def add_verified_fdr(self, reference_no, institution):
        maturity_date = date.today() - timedelta(days=2)
        fdr = models.FDRRecord(
            institution_id=institution.id,
            bank_name="Example Bank",
            reference_no=reference_no,
            amount=1000,
            issue_date=maturity_date - timedelta(days=365),
            maturity_date=maturity_date,
            status=models.FDR_VERIFIED,
        )
        self.db.add(fdr)
        self.db.commit()
        return fdr

    def request_release(self, fdr, user):
        return self.client.post(
            "/release-requests",
            headers=self.headers_for(user),
            json={"fdr_id": fdr.id, "reason": "Deposit is no longer required."},
        )

    def decide(self, request_id, action, user=None):
        return self.client.post(
            f"/release-requests/{request_id}/decision",
            headers=self.headers_for(user or self.officer),
            json={"action": action, "remarks": "Reviewed by an authorized user."},
        )

    def test_release_transitions_preserve_maturity_and_enforce_institution_scope(self):
        fdr = self.add_verified_fdr("NORTH-1", self.institution_one)

        created = self.request_release(fdr, self.institution_user_one)
        self.assertEqual(created.status_code, 201, created.text)
        request_id = created.json()["id"]

        self.assertEqual(
            self.request_release(fdr, self.institution_user_one).status_code,
            400,
        )
        self.assertEqual(
            self.request_release(fdr, self.institution_user_two).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(
                f"/release-requests/{request_id}",
                headers=self.headers_for(self.institution_user_two),
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(
                "/release-requests",
                headers=self.headers_for(self.institution_user_two),
            ).json(),
            [],
        )
        self.assertEqual(
            self.decide(request_id, "REVIEW", self.institution_user_one).status_code,
            403,
        )

        reviewed = self.decide(request_id, "REVIEW")
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        self.assertEqual(reviewed.json()["status"], models.REL_UNDER_REVIEW)

        observed = self.decide(request_id, "OBSERVATION")
        self.assertEqual(observed.status_code, 200, observed.text)
        self.assertEqual(observed.json()["status"], models.REL_OBSERVATION)

        resubmitted = self.client.post(
            f"/release-requests/{request_id}/resubmit",
            headers=self.headers_for(self.institution_user_one),
            json={
                "fdr_id": fdr.id,
                "reason": "The deposit is no longer required by the institution.",
            },
        )
        self.assertEqual(resubmitted.status_code, 200, resubmitted.text)
        self.assertEqual(resubmitted.json()["status"], models.REL_RESUBMITTED)

        approved = self.decide(request_id, "APPROVE")
        self.assertEqual(approved.status_code, 200, approved.text)
        self.assertEqual(approved.json()["status"], models.REL_APPROVED)
        self.db.refresh(fdr)
        self.assertEqual(fdr.status, models.FDR_VERIFIED)

        self.assertEqual(
            self.client.post(
                f"/release-requests/{request_id}/record-release",
                headers=self.headers_for(self.institution_user_one),
            ).status_code,
            403,
        )
        recorded = self.client.post(
            f"/release-requests/{request_id}/record-release",
            headers=self.headers_for(self.admin),
        )
        self.assertEqual(recorded.status_code, 200, recorded.text)
        self.assertEqual(
            recorded.json()["request"]["status"],
            models.REL_RELEASE_RECORDED,
        )
        self.db.refresh(fdr)
        self.assertEqual(fdr.status, models.FDR_RELEASED)

    def test_rejection_keeps_fdr_verified_and_allows_new_request(self):
        fdr = self.add_verified_fdr("NORTH-2", self.institution_one)
        created = self.request_release(fdr, self.institution_user_one)
        self.assertEqual(created.status_code, 201, created.text)

        rejected = self.decide(created.json()["id"], "REJECT")
        self.assertEqual(rejected.status_code, 200, rejected.text)
        self.assertEqual(rejected.json()["status"], models.REL_REJECTED)
        self.db.refresh(fdr)
        self.assertEqual(fdr.status, models.FDR_VERIFIED)

        resubmitted_as_new = self.request_release(fdr, self.institution_user_one)
        self.assertEqual(resubmitted_as_new.status_code, 201, resubmitted_as_new.text)


if __name__ == "__main__":
    unittest.main()
