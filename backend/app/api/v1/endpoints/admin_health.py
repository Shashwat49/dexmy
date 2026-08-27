from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/admin/system", tags=["Admin System"])

@router.get("/health")
def admin_system_health(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    db.execute(text("select 1"))
    return {"status": "ok", "database": "ok", "admin_user_id": str(current_user.id)}
