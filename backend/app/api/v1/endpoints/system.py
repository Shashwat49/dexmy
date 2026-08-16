from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "dexmy-api",
    }

@router.get("/version")
def version():
    return {
        "name": "Dexmy API",
        "version": "1.0.0",
    }