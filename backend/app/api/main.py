from fastapi import APIRouter
from app.api.routes import pdf_chat, youtube_chat
from app.api.routes import user

api_router = APIRouter()

api_router.include_router(user.router)
api_router.include_router(pdf_chat.router)
api_router.include_router(youtube_chat.router)