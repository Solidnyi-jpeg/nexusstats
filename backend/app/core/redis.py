import json
import logging
from typing import Any
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)
_redis: aioredis.Redis | None = None

async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        try:
            _redis = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2.0  # Важливо: не чекати вічно, якщо Redis недоступний
            )
        except Exception as e:
            logger.error(f"Не вдалося підключитися до Redis: {e}")
    return _redis

async def close_redis():
    """Функція для закриття з'єднань при зупинці програми."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None

async def cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    try:
        r = await get_redis()
        if r:
            await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        # Логуємо, але не перериваємо виконання програми
        logger.warning(f"Помилка запису в Redis: {e}")

async def cache_get(key: str) -> Any | None:
    try:
        r = await get_redis()
        if r:
            data = await r.get(key)
            return json.loads(data) if data else None
    except Exception as e:
        logger.warning(f"Помилка читання з Redis: {e}")
    return None

async def cache_delete(key: str) -> None:
    try:
        r = await get_redis()
        if r:
            await r.delete(key)
    except Exception as e:
        logger.warning(f"Помилка видалення з Redis: {e}")