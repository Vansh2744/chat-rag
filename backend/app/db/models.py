from sqlalchemy import (
    Column,
    String,
    ForeignKey,
    DateTime,
    func,
    Integer
)
from .db import Base
from sqlalchemy.orm import relationship
import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import UniqueConstraint
import enum


class TimestampMixin:
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    refresh_token = Column(String, nullable=True)

    embedded_docs = relationship(
        "EmbeddedDocs", back_populates="created_by", cascade="all, delete"
    )
    token_usage = relationship("UserTokenUsage", back_populates="user", uselist=False, cascade="all, delete")


class EmbeddedDocs(Base, TimestampMixin):
    __tablename__ = "embedded_docs"
 
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_name = Column(String, nullable=False)
    doc_id = Column(String, nullable=False, unique=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    source_type = Column(String, nullable=True, default="pdf")

    source_url = Column(String, nullable=True)
 
    created_by = relationship("User", back_populates="embedded_docs")

FREE_TOKEN_LIMIT = 10_000

class UserTokenUsage(Base, TimestampMixin):
    __tablename__ = "user_token_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    tokens_used = Column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="token_usage")