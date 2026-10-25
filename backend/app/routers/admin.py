from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..security import require_roles

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
def list_users(db: Session = Depends(get_db), _=Depends(require_roles(models.ROLE_ADMIN))):
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role,
             "is_active": u.is_active,
             "institution": u.institution.name if u.institution else None}
            for u in db.query(models.User).all()]


@router.get("/audit-logs")
def audit_logs(limit: int = 100, db: Session = Depends(get_db),
               _=Depends(require_roles(models.ROLE_ADMIN, models.ROLE_OFFICER))):
    rows = db.query(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(limit).all()
    return [{"id": r.id, "user": r.user.name if r.user else "system", "action": r.action,
             "entity": r.entity, "entity_id": r.entity_id, "details": r.details,
             "created_at": r.created_at.isoformat()} for r in rows]
