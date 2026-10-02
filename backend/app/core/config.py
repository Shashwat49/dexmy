from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Dexmy API"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    ACCESS_COOKIE_NAME: str = "dexmy_access"
    REFRESH_COOKIE_NAME: str = "dexmy_refresh"
    CSRF_COOKIE_NAME: str = "dexmy_csrf"

    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: str | None = None

    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://dexmy.vercel.app",
        "https://dexmyedu.com",
        "https://www.dexmyedu.com",
    ]

    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str
    LIVEKIT_URL: str

    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "dexmy-storage"

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    WHATSAPP_VERIFY_TOKEN: str = ""
    META_APP_SECRET: str = ""

    # Keep the legacy single-origin setting for compatibility.
    FRONTEND_ORIGIN: str = "https://dexmyedu.com"

    class Config:
        env_file = ".env"


settings = Settings()