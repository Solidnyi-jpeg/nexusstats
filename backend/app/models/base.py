from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    """
    Головний базовий клас для всіх моделей бази даних.
    Усі твої моделі (User, Game, PlatformConnection тощо) 
    повинні успадковуватися саме від цього класу.
    """
    pass

class TimestampMixin:
    """
    Міксин, який автоматично додає поля created_at та updated_at до будь-якої моделі.
    Щоб використати, просто додай його до моделі: 
    class User(Base, TimestampMixin):
        ...
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False,
        doc="Час створення запису (генерується БД автоматично)"
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False,
        doc="Час останнього оновлення запису (оновлюється SQLAlchemy автоматично)"
    )