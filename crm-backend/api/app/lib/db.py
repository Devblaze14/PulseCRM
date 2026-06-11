"""
Database engine + session management.

One engine per process (connection pooling lives here); a fresh Session per
request via the `get_session` FastAPI dependency. Keeping this in `lib/` means
routers/services never construct engines themselves — they just ask for a
session, which makes testing and connection management predictable.
"""

from collections.abc import Generator

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

# SQLite (our local fallback) needs `check_same_thread=False` because FastAPI
# may touch the connection from different threads. Postgres ignores this arg,
# so we only pass it for sqlite URLs.
_connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

# `pool_pre_ping` transparently recycles dead connections — important for
# Supabase/managed Postgres where idle connections can be dropped.
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args=_connect_args,
    pool_pre_ping=not settings.DATABASE_URL.startswith("sqlite"),
)


def _ensure_columns() -> None:
    """Add columns that were introduced after a table was first created.

    `create_all` only creates MISSING tables — it never ALTERs an existing one to
    add a new column. On a fresh DB the column already exists (create_all made
    it); on an existing DB (e.g. the live Supabase Postgres) it does not, so we
    add it here. Guarded by an existence check, so this is idempotent and safe to
    run on every boot. New columns are nullable, so existing rows stay valid.
    """
    inspector = inspect(engine)
    # Map of table name -> {column name: column DDL type} we may need to add.
    expected: dict[str, dict[str, str]] = {
        "communication": {"attributed_amount": "FLOAT"},
    }
    for table, columns in expected.items():
        if not inspector.has_table(table):
            continue  # create_all will have made it with all columns already
        existing = {c["name"] for c in inspector.get_columns(table)}
        for name, ddl_type in columns.items():
            if name in existing:
                continue
            with engine.begin() as conn:
                conn.execute(
                    text(f'ALTER TABLE {table} ADD COLUMN {name} {ddl_type}')
                )


def init_db() -> None:
    """Create all tables defined on SQLModel metadata, then patch in any columns
    added after those tables were first created.

    Importing the models module registers the tables on `SQLModel.metadata`;
    we import inside the function to avoid a circular import at module load.
    """
    from app import models  # noqa: F401  (import for side-effect: table registration)

    SQLModel.metadata.create_all(engine)
    _ensure_columns()


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped session that always closes."""
    with Session(engine) as session:
        yield session
