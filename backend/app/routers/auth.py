from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..security import verify_password, create_token, get_current_user, log_action

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


def user_out(u: models.User):
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role,
            "institution_id": u.institution_id,
            "institution_name": u.institution.name if u.institution else None}


@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.password_hash) or not user.is_active:
        raise HTTPException(401, "Invalid email or password")
    log_action(db, user, "LOGIN", "user", user.id)
    return {"access_token": create_token(user), "token_type": "bearer", "user": user_out(user)}


@router.get("/me")
def me(user: models.User = Depends(get_current_user)):
    return user_out(user)
