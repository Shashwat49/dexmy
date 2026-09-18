import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

load_dotenv()

url = make_url(os.environ["DATABASE_URL"]).set(database="postgres")

engine = create_engine(
    url,
    isolation_level="AUTOCOMMIT",
)

with engine.connect() as conn:
    exists = conn.execute(
        text("SELECT 1 FROM pg_database WHERE datname = 'dexmy_test'")
    ).scalar()

    if not exists:
        conn.execute(text("CREATE DATABASE dexmy_test"))
        print("Test database created: dexmy_test")
    else:
        print("Test database already exists: dexmy_test")

engine.dispose()