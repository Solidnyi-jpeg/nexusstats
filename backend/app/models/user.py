from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

class User(Base, TimestampMixin):
    """Модель користувача системи."""
    __tablename__ = "users"

    # Використовуємо BigInteger для консистентності з іншими таблицями
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # Ім'я користувача (обов'язкове, можна брати зі Steam)
    username: Mapped[str] = mapped_column(String(256), unique=True, index=True, nullable=False)
    
    # Робимо email та пароль опціональними, оскільки Steam OpenID їх не надає
    email: Mapped[str | None] = mapped_column(String(256), unique=True, index=True, nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(512), nullable=True)
    
    # Налаштування профілю
    preferred_language: Mapped[str] = mapped_column(String(16), default="en")
    preferred_theme: Mapped[str] = mapped_column(String(16), default="dark")
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Зв'язки
    # Вказуємо назви класів у лапках ("PlatformConnection"), щоб уникнути помилок циклічного імпорту
    platform_connections: Mapped[list["PlatformConnection"]] = relationship(
        "PlatformConnection", 
        back_populates="user", 
        cascade="all, delete-orphan"
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship(
        "Bookmark", 
        back_populates="user", 
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}')>"