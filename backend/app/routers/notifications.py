from datetime import date, timedelta
from threading import Lock
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..security import get_current_user

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)

_maturity_scan_lock = Lock()

def generate_maturity_alerts_for_all(
    db: Session,
    today: Optional[date] = None,
):
    with _maturity_scan_lock:
        return _generate_maturity_alerts_for_all(db, today)


def _generate_maturity_alerts_for_all(
    db: Session,
    today: Optional[date] = None,
):
    """Create deduplicated maturity alerts for authorized recipients."""
    today = today or date.today()
    alert_window = today + timedelta(days=30)

    upcoming_fdrs = (
        db.query(models.FDRRecord)
        .filter(
            models.FDRRecord.status == models.FDR_VERIFIED,
            models.FDRRecord.maturity_date >= today,
            models.FDRRecord.maturity_date <= alert_window,
        )
        .all()
    )
    overdue_fdrs = (
        db.query(models.FDRRecord)
        .filter(
            models.FDRRecord.status == models.FDR_VERIFIED,
            models.FDRRecord.maturity_date < today,
        )
        .all()
    )

    active_users = (
        db.query(models.User)
        .filter(
            models.User.is_active.is_(True),
            models.User.role.in_(
                (
                    models.ROLE_INSTITUTION,
                    models.ROLE_OFFICER,
                    models.ROLE_ADMIN,
                )
            ),
        )
        .all()
    )

    institution_users = {}
    officers = []
    admins = []

    for recipient in active_users:
        if recipient.role == models.ROLE_INSTITUTION:
            institution_users.setdefault(
                recipient.institution_id,
                [],
            ).append(recipient)
        elif recipient.role == models.ROLE_OFFICER:
            officers.append(recipient)
        elif recipient.role == models.ROLE_ADMIN:
            admins.append(recipient)

    created_count = 0
    skipped_count = 0

    def create_alert(fdr, title, message, level):
        nonlocal created_count, skipped_count

        recipients = list(institution_users.get(fdr.institution_id, []))
        recipients.extend(admins)
        recipients.extend(
            officer
            for officer in officers
            if (
                fdr.assigned_officer_id is None
                or officer.id == fdr.assigned_officer_id
            )
        )

        if not recipients:
            skipped_count += 1
            return

        for recipient in recipients:
            existing = (
                db.query(models.Notification)
                .filter(
                    models.Notification.user_id == recipient.id,
                    models.Notification.fdr_id == fdr.id,
                    models.Notification.title == title,
                )
                .first()
            )

            if existing:
                skipped_count += 1
                continue

            db.add(
                models.Notification(
                    user_id=recipient.id,
                    fdr_id=fdr.id,
                    title=title,
                    message=message,
                    level=level,
                    is_read=False,
                )
            )
            created_count += 1

    for fdr in upcoming_fdrs:
        days_remaining = (fdr.maturity_date - today).days
        create_alert(
            fdr=fdr,
            title="FDR maturity approaching",
            message=(
                f"FDR {fdr.reference_no} ({fdr.fdr_uid or fdr.id}) from "
                f"{fdr.institution.name}, {fdr.bank_name}, matures on "
                f"{fdr.maturity_date.isoformat()}. "
                f"Days remaining: {days_remaining}. "
                "Review renewal or release requirements."
            ),
            level="warning",
        )

    for fdr in overdue_fdrs:
        days_overdue = (today - fdr.maturity_date).days
        create_alert(
            fdr=fdr,
            title="FDR maturity overdue",
            message=(
                f"FDR {fdr.reference_no} ({fdr.fdr_uid or fdr.id}) from "
                f"{fdr.institution.name}, {fdr.bank_name}, passed its "
                f"maturity date of {fdr.maturity_date.isoformat()}. "
                f"Days overdue: {days_overdue}. "
                "Review the FDR status and required action."
            ),
            level="danger",
        )

    db.commit()

    return {
        "message": "Maturity-alert scan completed.",
        "scan_date": today.isoformat(),
        "upcoming_fdrs_found": len(upcoming_fdrs),
        "overdue_fdrs_found": len(overdue_fdrs),
        "notifications_created": created_count,
        "duplicate_or_unassigned_alerts_skipped": skipped_count,
        "note": (
            "Maturity alerts are also scanned automatically every 24 hours "
            "while the backend is running."
        ),
    }


# -------------------- LIST NOTIFICATIONS --------------------

@router.get("")
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Institutions can see their own notifications.
    Officers and admins can see their own notifications.
    """

    query = db.query(models.Notification).filter(
        models.Notification.user_id == user.id
    )

    if unread_only:
        query = query.filter(
            models.Notification.is_read.is_(False)
        )

    notifications = query.order_by(
        models.Notification.created_at.desc()
    ).all()

    return {
        "total": len(notifications),
        "notifications": [
            {
                "id": item.id,
                "fdr_id": item.fdr_id,
                "title": item.title,
                "message": item.message,
                "level": item.level,
                "is_read": item.is_read,
                "created_at": (
                    item.created_at.isoformat()
                    if item.created_at
                    else None
                ),
            }
            for item in notifications
        ],
    }


# -------------------- MARK NOTIFICATION AS READ --------------------

@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    notification = db.get(
        models.Notification,
        notification_id,
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    # Users may only mark their own notifications as read.
    if notification.user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot modify another user's notification.",
        )

    notification.is_read = True

    db.commit()
    db.refresh(notification)

    return {
        "message": "Notification marked as read.",
        "notification_id": notification.id,
        "is_read": notification.is_read,
    }


# -------------------- GENERATE MATURITY ALERTS --------------------

@router.post("/generate-maturity-alerts")
def generate_maturity_alerts(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Officers/admins can trigger a maturity-alert scan manually.

    Creates:
    - Upcoming maturity alerts for FDRs maturing within 30 days.
    - Overdue alerts for FDRs past maturity that remain verified.

    Repeated scans do not create duplicate alerts of the same type
    for the same FDR.
    """

    if user.role not in (
        models.ROLE_OFFICER,
        models.ROLE_ADMIN,
    ):
        raise HTTPException(
            status_code=403,
            detail="Only officers and administrators can generate maturity alerts.",
        )

    return generate_maturity_alerts_for_all(db)