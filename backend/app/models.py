from datetime import datetime, date
from sqlalchemy import (Column, Integer, String, Float, Date, DateTime, Boolean,
                        ForeignKey, Text)
from sqlalchemy.orm import relationship
from .database import Base

# ---- Constants (use these everywhere instead of raw strings) ----
ROLE_INSTITUTION, ROLE_OFFICER, ROLE_ADMIN = "INSTITUTION", "OFFICER", "ADMIN"

FDR_SUBMITTED, FDR_UNDER_REVIEW, FDR_DISCREPANCY = "SUBMITTED", "UNDER_REVIEW", "DISCREPANCY"
FDR_VERIFIED, FDR_MATURED, FDR_RENEWED, FDR_RELEASED = "VERIFIED", "MATURED", "RENEWED", "RELEASED"

REL_SUBMITTED, REL_UNDER_REVIEW, REL_OBSERVATION = "SUBMITTED", "UNDER_REVIEW", "OBSERVATION_RAISED"
REL_RESUBMITTED, REL_APPROVED, REL_REJECTED = "RESUBMITTED", "APPROVED", "REJECTED"
REL_RELEASE_RECORDED = "RELEASE_RECORDED"


class Institution(Base):
    __tablename__ = "institutions"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    city = Column(String(100))
    state = Column(String(100))
    users = relationship("User", back_populates="institution")
    fdrs = relationship("FDRRecord", back_populates="institution")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(300), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    institution = relationship("Institution", back_populates="users")


class FDRRecord(Base):
    __tablename__ = "fdr_records"
    id = Column(Integer, primary_key=True)
    fdr_uid = Column(String(30), unique=True, index=True)          # e.g. FDR-0001
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False)
    bank_name = Column(String(150), nullable=False)
    reference_no = Column(String(100), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    issue_date = Column(Date, nullable=False)
    maturity_date = Column(Date, nullable=False)
    status = Column(String(30), default=FDR_SUBMITTED, index=True)
    # Institution-submitted vs officer-verified are kept separate
    verification_remarks = Column(Text)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    is_simulated_verification = Column(Boolean, default=True)      # demo label
    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    renewed_from_id = Column(Integer, ForeignKey("fdr_records.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    institution = relationship("Institution", back_populates="fdrs")
    documents = relationship("FDRDocument", back_populates="fdr")


class FDRDocument(Base):
    __tablename__ = "fdr_documents"
    id = Column(Integer, primary_key=True)
    fdr_id = Column(Integer, ForeignKey("fdr_records.id"), nullable=False)
    doc_type = Column(String(50), default="FDR_COPY")
    filename = Column(String(255), nullable=False)
    stored_path = Column(String(500), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    fdr = relationship("FDRRecord", back_populates="documents")


class ReleaseRequest(Base):
    __tablename__ = "release_requests"
    id = Column(Integer, primary_key=True)
    fdr_id = Column(Integer, ForeignKey("fdr_records.id"), nullable=False)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text)
    status = Column(String(30), default=REL_SUBMITTED, index=True)
    officer_remarks = Column(Text)
    decided_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    fdr_id = Column(Integer, ForeignKey("fdr_records.id"), nullable=True)
    title = Column(String(200), nullable=False)
    message = Column(Text)
    level = Column(String(20), default="info")   # info | warning | danger
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity = Column(String(50))
    entity_id = Column(Integer)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")


class AppSetting(Base):
    """Configurable alert thresholds etc. (not hard-coded)."""
    __tablename__ = "app_settings"
    key = Column(String(100), primary_key=True)
    value = Column(String(200), nullable=False)
