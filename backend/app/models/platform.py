from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class PlatformConnection(Base, TimestampMixin):
    """Підключена платформа користувача (Steam / Epic / Google)."""
    __tablename__ = "platform_connections"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(String(32), nullable=False)  # steam / epic / google
    platform_user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    platform_username: Mapped[str | None] = mapped_column(String(256), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("user_id", "platform", "platform_user_id", name="uq_platform_connection"),
    )

    user: Mapped["User"] = relationship(back_populates="platform_connections")
    games: Mapped[list["PlayerGame"]] = relationship(
        back_populates="connection", cascade="all, delete-orphan"
    )


class Game(Base, TimestampMixin):
    """Гра — незалежно від платформи."""
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    platform: Mapped[str] = mapped_column(String(32), nullable=False)
    platform_game_id: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    img_icon_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    img_cover_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    genre: Mapped[str | None] = mapped_column(String(128), nullable=True)
    developer: Mapped[str | None] = mapped_column(String(256), nullable=True)

    __table_args__ = (
        UniqueConstraint("platform", "platform_game_id", name="uq_game_platform"),
    )

    player_games: Mapped[list["PlayerGame"]] = relationship(back_populates="game")


class PlayerGame(Base, TimestampMixin):
    """Гра конкретного гравця на конкретній платформі."""
    __tablename__ = "player_games"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    connection_id: Mapped[int] = mapped_column(ForeignKey("platform_connections.id", ondelete="CASCADE"))
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    playtime_minutes: Mapped[int] = mapped_column(Integer, default=0)
    playtime_2weeks_minutes: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    achievement_count: Mapped[int] = mapped_column(Integer, default=0)
    achievement_total: Mapped[int] = mapped_column(Integer, default=0)

    connection: Mapped["PlatformConnection"] = relationship(back_populates="games")
    game: Mapped["Game"] = relationship(back_populates="player_games")
    achievements: Mapped[list["PlayerAchievement"]] = relationship(
        back_populates="player_game", cascade="all, delete-orphan"
    )


class Achievement(Base, TimestampMixin):
    """Досягнення гри."""
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    api_name: Mapped[str] = mapped_column(String(256), nullable=False)
    display_name: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    icon_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint("game_id", "api_name", name="uq_achievement"),
    )


class PlayerAchievement(Base, TimestampMixin):
    """Досягнення гравця."""
    __tablename__ = "player_achievements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    player_game_id: Mapped[int] = mapped_column(ForeignKey("player_games.id", ondelete="CASCADE"))
    achievement_id: Mapped[int] = mapped_column(ForeignKey("achievements.id", ondelete="CASCADE"))
    achieved: Mapped[bool] = mapped_column(Boolean, default=False)
    unlock_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    player_game: Mapped["PlayerGame"] = relationship(back_populates="achievements")
    achievement: Mapped["Achievement"] = relationship()


class Bookmark(Base, TimestampMixin):
    """Збережені профілі."""
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(String(32), nullable=False)
    platform_user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "platform", "platform_user_id", name="uq_bookmark"),
    )

    user: Mapped["User"] = relationship(back_populates="bookmarks")
