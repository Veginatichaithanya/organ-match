from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    """
    Shared Declarative Base class for all SQLAlchemy 2.0 models in the application.
    """
    pass

# Portable JSON column type (JSONB on PostgreSQL, standard JSON on SQLite for tests)
JSONType = JSON().with_variant(JSONB, "postgresql")
