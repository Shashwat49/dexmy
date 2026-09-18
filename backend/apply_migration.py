from pathlib import Path

from sqlalchemy import text

from app.db.session import engine


MIGRATION_DIR = Path(__file__).resolve().parent / "sql_migrations"


def apply_migration(filename: str) -> None:
    migration_path = MIGRATION_DIR / filename

    if not migration_path.exists():
        raise FileNotFoundError(f"Migration not found: {migration_path}")

    sql = migration_path.read_text(encoding="utf-8")

    with engine.begin() as conn:
        conn.execute(text(sql))

    print(f"{filename} applied successfully")


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: python apply_migration.py <migration-file.sql>"
        )

    apply_migration(sys.argv[1])