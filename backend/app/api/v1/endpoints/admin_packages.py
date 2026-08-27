from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.package import PackagePlan
from app.models.user import User
from app.schemas.admin_packages import PackagePlanCreate, PackagePlanRead, PackagePlanUpdate
from app.services.audit_service import record_admin_action

router = APIRouter()


@router.get("", response_model=list[PackagePlanRead])
def list_package_plans(
    include_inactive: bool = False,
    current_user: User = Depends(require_permission("package.read")),
    db: Session = Depends(get_db),
):
    query = select(PackagePlan).order_by(PackagePlan.class_count.asc(), PackagePlan.currency.asc())
    if not include_inactive:
        query = query.where(PackagePlan.is_active.is_(True))
    return db.execute(query).scalars().all()


@router.post("", response_model=PackagePlanRead, status_code=status.HTTP_201_CREATED)
def create_package_plan(
    payload: PackagePlanCreate,
    current_user: User = Depends(require_permission("package.create")),
    db: Session = Depends(get_db),
):
    duplicate = db.execute(
        select(PackagePlan).where(
            PackagePlan.name.ilike(payload.name),
            PackagePlan.currency == payload.currency,
        )
    ).scalar_one_or_none()
    if duplicate:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A package with this name and currency already exists")

    package = PackagePlan(**payload.model_dump())
    db.add(package)
    db.flush()
    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="package.create",
        resource_type="package_plan",
        resource_id=package.id,
        new_values={"name": package.name, "class_count": package.class_count, "price": str(package.price), "currency": package.currency},
    )
    db.commit()
    db.refresh(package)
    return package


@router.patch("/{package_id}", response_model=PackagePlanRead)
def update_package_plan(
    package_id: UUID,
    payload: PackagePlanUpdate,
    current_user: User = Depends(require_permission("package.update")),
    db: Session = Depends(get_db),
):
    package = db.get(PackagePlan, package_id)
    if package is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    old_values = {
        "name": package.name,
        "class_count": package.class_count,
        "price": str(package.price),
        "currency": package.currency,
        "is_active": package.is_active,
    }

    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes or "currency" in changes:
        name = changes.get("name", package.name)
        currency = changes.get("currency", package.currency)
        duplicate = db.execute(
            select(PackagePlan).where(
                PackagePlan.name.ilike(name),
                PackagePlan.currency == currency,
                PackagePlan.id != package.id,
            )
        ).scalar_one_or_none()
        if duplicate:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A package with this name and currency already exists")

    for field, value in changes.items():
        setattr(package, field, value)

    db.flush()
    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="package.update",
        resource_type="package_plan",
        resource_id=package.id,
        old_values=old_values,
        new_values={"name": package.name, "class_count": package.class_count, "price": str(package.price), "currency": package.currency, "is_active": package.is_active},
    )
    db.commit()
    db.refresh(package)
    return package


@router.post("/{package_id}/disable", response_model=PackagePlanRead)
def disable_package_plan(
    package_id: UUID,
    current_user: User = Depends(require_permission("package.disable")),
    db: Session = Depends(get_db),
):
    package = db.get(PackagePlan, package_id)
    if package is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    if not package.is_active:
        return package

    package.is_active = False
    db.flush()
    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="package.disable",
        resource_type="package_plan",
        resource_id=package.id,
        old_values={"is_active": True},
        new_values={"is_active": False},
    )
    db.commit()
    db.refresh(package)
    return package
