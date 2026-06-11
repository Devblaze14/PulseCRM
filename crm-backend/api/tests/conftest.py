"""
Shared pytest fixtures.

A fresh in-memory SQLite database per test, with all tables created from the
SQLModel metadata. SQLite is portable enough for the logic these tests cover
(status machine, idempotency dedup, revenue aggregation, validator) — and we
deliberately keep the tests off anything that only behaves correctly on Postgres
(JSON operators, etc.). Where a behaviour is Postgres-specific it is noted in the
test rather than faked here.

We use a single shared in-memory connection (StaticPool) so every Session in a
test sees the same database; a plain "sqlite://" URL would otherwise give each
connection its own private, empty DB.
"""

from __future__ import annotations

import pytest
from sqlalchemy import StaticPool
from sqlmodel import Session, SQLModel, create_engine

# Importing models registers every table on SQLModel.metadata.
from app import models  # noqa: F401


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(eng)
    yield eng
    SQLModel.metadata.drop_all(eng)


@pytest.fixture()
def session(engine):
    with Session(engine) as s:
        yield s
