import os, hashlib, hmac, secrets
from datetime import datetime, timedelta
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from . import models

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-securefdr")
ALGO = "HS256"
TOKEN_HOURS = 8
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return f"{salt}${h}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split("$")
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return hmac.compare_digest(check, h)


def create_token(user: models.User) -> str:
    payload = {"sub": str(user.id), "role": user.role,
               "exp": datetime.utcnow() + timedelta(hours=TOKEN_HOURS)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGO)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer),
                     db: Session = Depends(get_db)) -> models.User:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        data = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(models.User, int(data["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive or missing")
    return user


def require_roles(*roles):
    """Backend-enforced RBAC. Usage: Depends(require_roles('OFFICER','ADMIN'))"""
    def checker(user: models.User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission for this action")
        return user
    return checker


def log_action(db: Session, user, action: str, entity: str = None,
               entity_id: int = None, details: str = None):
    db.add(models.AuditLog(user_id=user.id if user else None, action=action,
                           entity=entity, entity_id=entity_id, details=details))
    db.commit()
