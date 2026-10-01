from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Supabase/Railway PostgreSQL may use transaction pooling. Disable psycopg's
# automatic prepared statements so pooled connections cannot collide on names
# such as "_pg3_0" when different transactions reuse the same server connection.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"prepare_threshold": None},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
