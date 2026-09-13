from collections.abc import Generator
from functools import lru_cache
from pathlib import Path

from sqlalchemy import event, inspect, text
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings


def _ensure_sqlite_parent(database_url: str) -> None:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix) or database_url == "sqlite:///:memory:":
        return
    database_path = database_url.removeprefix(prefix)
    Path(database_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    _ensure_sqlite_parent(settings.database_url)
    connect_args = {"check_same_thread": False, "timeout": 30}
    engine = create_engine(settings.database_url, connect_args=connect_args)

    @event.listens_for(engine, "connect")
    def set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    return engine


def create_db_and_tables() -> None:
    # Import registers every table with SQLModel.metadata.
    from app.models import domain  # noqa: F401

    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    _ensure_case_metadata_columns(engine)


def _ensure_case_metadata_columns(engine: Engine) -> None:
    """Add nullable case metadata to databases created before these fields existed."""
    columns = {column["name"] for column in inspect(engine).get_columns("cases")}
    definitions = {
        "plaintiff_name": "VARCHAR(250)",
        "court": "VARCHAR(250)",
        "contract_number": "VARCHAR(100)",
    }
    missing = [(name, sql_type) for name, sql_type in definitions.items() if name not in columns]
    if not missing:
        return
    with engine.begin() as connection:
        for name, sql_type in missing:
            connection.execute(text(f"ALTER TABLE cases ADD COLUMN {name} {sql_type}"))


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session


def check_database() -> None:
    with Session(get_engine()) as session:
        session.exec(text("SELECT 1"))


def reset_database_state() -> None:
    """Clear cached settings/engine; intended for isolated tests."""

    get_engine.cache_clear()
    get_settings.cache_clear()
