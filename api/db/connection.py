"""Database connection and session management for SQLAlchemy."""

import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Database configuration from environment variables
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "app")
DB_PASSWORD = os.getenv("DB_PASSWORD", "apppass")
DB_NAME = os.getenv("DB_NAME", "neat_memo")


def get_db_url() -> str:
    """Build database URL from environment variables."""
    return f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"


def get_engine():
    """Create SQLAlchemy engine with connection pooling optimized for Lambda."""
    return create_engine(
        get_db_url(),
        pool_pre_ping=True,  # Check connection health before use
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_size=5,
        max_overflow=10,
    )


# Session factory
_engine = None
SessionLocal = None


def _init_session():
    """Initialize session factory lazily."""
    global _engine, SessionLocal
    if _engine is None:
        _engine = get_engine()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@contextmanager
def get_session():
    """Provide a transactional scope around a series of operations."""
    _init_session()
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
