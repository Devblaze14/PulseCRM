"""
Database engine + session management.

One engine per process (connection pooling lives here); a fresh Session per
request via the `get_session` FastAPI dependency. Keeping this in `lib/` means
routers/services never construct engines themselves — they just ask for a
session, which makes testing and connection management predictable.
"""

from collections.abc import Generator

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


def init_db() -> None:
    """Create all tables defined on SQLModel metadata.

    Importing the models module registers the tables on `SQLModel.metadata`;
    we import inside the function to avoid a circular import at module load.
    """
    from app import models  # noqa: F401  (import for side-effect: table registration)

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped session that always closes."""
    with Session(engine) as session:
        yield session
