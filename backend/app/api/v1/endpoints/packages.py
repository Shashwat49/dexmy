from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.package import PackagePlan

router = APIRouter()


@router.get("", response_model=list[dict])
def list_public_packages(db: Session = Depends(get_db)):
    packages = db.execute(
        select(PackagePlan)
        .where(PackagePlan.is_active.is_(True))
        .order_by(PackagePlan.class_count.asc(), PackagePlan.currency.asc())
    ).scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "class_count": p.class_count,
            "price": p.price,
            "currency": p.currency,
            "is_custom": p.is_custom,
        }
        for p in packages
    ]
