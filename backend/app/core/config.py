from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Dexmy API"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    TESTING_ACCESS_TOKEN_EXPIRE_MINUTES: int = 5

    ACCESS_COOKIE_NAME: str = "dexmy_access"
    REFRESH_COOKIE_NAME: str = "dexmy_refresh"
    CSRF_COOKIE_NAME: str = "dexmy_csrf"
    COOKIE_SECURE: bool | None = None
    COOKIE_SAMESITE: str | None = None
    COOKIE_DOMAIN: str | None = None

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

    # Keep the legacy single-origin setting for compatibility. The API also
    # accepts the production custom domain and Vercel domain in main.py.
    FRONTEND_ORIGIN: str = "https://dexmyedu.com"

    # Scheduled class reminder email delivery. Disabled until production SMTP
    # credentials and the reminder-delivery SQL migration are configured.
    CLASS_REMINDERS_ENABLED: bool = False
    CLASS_REMINDER_INTERVAL_SECONDS: int = 60
    CLASS_REMINDER_MINUTES_BEFORE: int = 30
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USE_TLS: bool = True
    SMTP_USERNAME: str = "dexmyedu@gmail.com"
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "dexmyedu@gmail.com"
    SMTP_FROM_NAME: str = "Dexmy"

    class Config:
        env_file = ".env"


settings = Settings()
