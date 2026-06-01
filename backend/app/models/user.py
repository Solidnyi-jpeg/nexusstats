from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    
    # Додали default, щоб уникнути помилок при реєстрації через Firebase
    hashed_password = Column(String, nullable=False, default="firebase_auth")
    
    preferred_language = Column(String, nullable=False, default="en")
    preferred_theme = Column(String, nullable=False, default="dark")
    
    is_active = Column(Boolean, default=True)

    # Зв'язки
    platform_connections = relationship(
        "PlatformConnection", 
        back_populates="user", 
        cascade="all, delete-orphan"
    )
    bookmarks = relationship(
        "Bookmark", 
        back_populates="user", 
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"