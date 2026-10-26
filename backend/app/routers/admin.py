import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..security import hash_password, require_roles

router = APIRouter(prefix="/admin", tags=["admin"])


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=12, max_length=128)
    role: str
    institution_id: int | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        value = value.lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value):
        allowed = {
            models.ROLE_ADMIN,
            models.ROLE_OFFICER,
            models.ROLE_INSTITUTION,
        }
        if value not in allowed:
            raise ValueError("Role must be ADMIN, OFFICER, or INSTITUTION.")
        return value


class InstitutionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    code: str = Field(min_length=2, max_length=50)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value):
        return value.upper()


def institution_out(institution):
    return {
        "id": institution.id,
        "name": institution.name,
        "code": institution.code,
        "city": institution.city,
        "state": institution.state,
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), _=Depends(require_roles(models.ROLE_ADMIN))):
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role,
             "is_active": u.is_active,
             "institution_id": u.institution_id,
             "institution": u.institution.name if u.institution else None}
            for u in db.query(models.User).all()]


@router.post("/users", status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_roles(models.ROLE_ADMIN)),
):
    if data.email == admin.email.lower():
        raise HTTPException(409, "An account already exists for this email.")
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(409, "An account with this email already exists.")

    institution = None
    if data.role == models.ROLE_INSTITUTION:
        if data.institution_id is None:
            raise HTTPException(422, "Institution users must be assigned an institution.")
        institution = db.get(models.Institution, data.institution_id)
        if not institution:
            raise HTTPException(422, "The selected institution does not exist.")
    elif data.institution_id is not None:
        raise HTTPException(422, "Only institution users can be assigned an institution.")

    user = models.User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        is_active=True,
        institution_id=institution.id if institution else None,
    )
    db.add(user)
    try:
        db.flush()
        db.add(models.AuditLog(
            user_id=admin.id,
            action="USER_CREATED",
            entity="user",
            entity_id=user.id,
            details=f"Created {user.role} account for {user.email}.",
        ))
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists.")

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "institution_id": user.institution_id,
        "institution": institution.name if institution else None,
    }


@router.get("/institutions")
def list_institutions(
    db: Session = Depends(get_db),
    _=Depends(require_roles(models.ROLE_ADMIN)),
):
    return [
        institution_out(institution)
        for institution in db.query(models.Institution).order_by(models.Institution.name).all()
    ]


@router.post("/institutions", status_code=201)
def create_institution(
    data: InstitutionCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_roles(models.ROLE_ADMIN)),
):
    if db.query(models.Institution).filter(
        models.Institution.code == data.code
    ).first():
        raise HTTPException(409, "An institution with this code already exists.")

    institution = models.Institution(
        name=data.name,
        code=data.code,
        city=data.city,
        state=data.state,
    )
    db.add(institution)
    try:
        db.flush()
        db.add(models.AuditLog(
            user_id=admin.id,
            action="INSTITUTION_CREATED",
            entity="institution",
            entity_id=institution.id,
            details=f"Registered institution {institution.name} ({institution.code}).",
        ))
        db.commit()
        db.refresh(institution)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An institution with this code already exists.")

    return institution_out(institution)


@router.get("/audit-logs")
def audit_logs(limit: int = 100, db: Session = Depends(get_db),
               _=Depends(require_roles(models.ROLE_ADMIN, models.ROLE_OFFICER))):
    rows = db.query(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(limit).all()
    return [{"id": r.id, "user": r.user.name if r.user else "system", "action": r.action,
             "entity": r.entity, "entity_id": r.entity_id, "details": r.details,
             "created_at": r.created_at.isoformat()} for r in rows]
