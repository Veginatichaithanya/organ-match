import os
import sys
import asyncio
from typing import AsyncGenerator, Generator

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings

DATABASE_URL = settings.DATABASE_URL

if "@postgres:5432" in DATABASE_URL:
    try:
        import socket
        socket.gethostbyname("postgres")
    except Exception:
        DATABASE_URL = DATABASE_URL.replace("@postgres:5432", "@localhost:5432")


# Convert URL protocol for async operations using asyncpg driver
ASYNC_DATABASE_URL = DATABASE_URL
if ASYNC_DATABASE_URL.startswith("postgresql+psycopg://"):
    ASYNC_DATABASE_URL = ASYNC_DATABASE_URL.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
elif ASYNC_DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = ASYNC_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif ASYNC_DATABASE_URL.startswith("postgres://"):
    ASYNC_DATABASE_URL = ASYNC_DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)



# Asynchronous engine configuration for application routers
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    echo=False
)

async_session_maker = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Synchronous engine configuration for migrations, CLI tooling, and seed scripts
# Convert async schema back to sync for standard library engines if necessary
SYNC_DATABASE_URL = DATABASE_URL
if SYNC_DATABASE_URL.startswith("postgresql+asyncpg://"):
    SYNC_DATABASE_URL = SYNC_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
elif SYNC_DATABASE_URL.startswith("postgres://"):
    SYNC_DATABASE_URL = SYNC_DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif SYNC_DATABASE_URL.startswith("postgresql://"):
    SYNC_DATABASE_URL = SYNC_DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

sync_engine = create_engine(
    SYNC_DATABASE_URL,
    pool_pre_ping=True,
    future=True
)

sync_session_maker = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an asynchronous database session.
    """
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

def get_sync_db() -> Generator[Session, None, None]:
    """
    Generator yielding a synchronous database session for scripting purposes.
    """
    session = sync_session_maker()
    try:
        yield session
    finally:
        session.close()
