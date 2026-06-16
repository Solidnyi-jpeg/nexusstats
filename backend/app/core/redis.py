import json
import logging
from typing import Any
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)
_redis: aioredis.Redis | None = None

async def get_redis() -> aioredis.Redis | None:
    """Ініціалізує та повертає підключення до Redis."""
    global _redis
    if _redis is None:
        try:
           
            _redis = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2.0
            )
            
            await _redis.ping()
            logger.info("Успішне підключення до Redis.")
        except Exception as e:
            logger.error(f"Не вдалося підключитися до Redis: {e}")
            _redis = None  
    return _redis

async def close_redis() -> None:
    """Закриває з'єднання при зупинці програми."""
    global _redis
    if _redis:
        try:
            
            if hasattr(_redis, "aclose"):
                await _redis.aclose()
            else:
                await _redis.close()
            logger.info("З'єднання з Redis закрито.")
        except Exception as e:
            logger.error(f"Помилка при закритті Redis: {e}")
        finally:
            _redis = None

async def cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    """Записує значення в кеш з конвертацією в JSON."""
    try:
        r = await get_redis()
        if r:
            await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"Помилка запису в Redis (key: {key}): {e}")

async def cache_get(key: str) -> Any | None:
    """Отримує значення з кешу та декодує JSON."""
    try:
        r = await get_redis()
        if r:
            data = await r.get(key)
            if data:
                return json.loads(data)
    except Exception as e:
        logger.warning(f"Помилка читання з Redis (key: {key}): {e}")
    return None

async def cache_delete(key: str) -> None:
    """Видаляє один конкретний ключ з кешу."""
    try:
        r = await get_redis()
        if r:
            await r.delete(key)
    except Exception as e:
        logger.warning(f"Помилка видалення з Redis (key: {key}): {e}")

async def cache_delete_pattern(pattern: str) -> None:
    """
    Видаляє всі ключі, що збігаються з патерном. 
    Ідеально підходить для інвалідації кешу при force-sync (напр. 'user:123:*').
    """
    try:
        r = await get_redis()
        if r:
            # Використовуємо async генератор scan_iter для безпечного пошуку без блокування Redis
            async for key in r.scan_iter(match=pattern):
                await r.delete(key)
    except Exception as e:
        logger.warning(f"Помилка видалення патерну з Redis (pattern: {pattern}): {e}")