# app/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from firebase_admin import auth as firebase_auth
import logging

from app.core.dependencies import get_db
from app.models.user import User
from app.services.auth_service import create_access_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

class FirebaseLoginRequest(BaseModel):
    id_token: str

@router.post("/firebase")
async def firebase_login(request_data: FirebaseLoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        # Тепер verify_id_token гарантовано працює, бо ініціалізація була в main.py
        decoded_token = firebase_auth.verify_id_token(request_data.id_token)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        name = decoded_token.get("name", email.split("@")[0] if email else "NexusUser")
        
        if not uid:
            raise HTTPException(status_code=400, detail="Токен не містить Firebase UID.")
            
        result = await db.execute(select(User).where(User.firebase_uid == uid))
        user = result.scalars().first()
        
        if not user:
            user = User(
                firebase_uid=uid,
                email=email,
                username=name,
                hashed_password="firebase_external_auth",
                preferred_language="en",
                preferred_theme="dark"
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        
        access_token = create_access_token(data={"sub": str(user.id), "username": user.username})
        return {"access_token": access_token, "token_type": "bearer"}
        
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Помилка авторизації.")