import uuid

from sqlalchemy.orm import Session

from app.models.admin import AdminAuditLog


def record_admin_action(
    db: Session,
    *,
    admin_user_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID | str | None = None,
    old_values: dict | None = None,
    new_values: dict | None = None,
    reason: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AdminAuditLog:
    log = AdminAuditLog(
        admin_user_id=admin_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        old_values=old_values,
        new_values=new_values,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
    return log
