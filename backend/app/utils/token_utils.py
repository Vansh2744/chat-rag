from sqlalchemy.orm import Session
from app.db.models import UserTokenUsage, FREE_TOKEN_LIMIT
from fastapi import HTTPException

def get_or_create_usage(user_id: str, db: Session) -> UserTokenUsage:
    usage = db.query(UserTokenUsage).filter(UserTokenUsage.user_id == user_id).first()
    if not usage:
        usage = UserTokenUsage(user_id=user_id, tokens_used=0)
        db.add(usage)
        db.commit()
        db.refresh(usage)
    return usage

def check_token_limit(user_id: str, db: Session):
    usage = get_or_create_usage(user_id, db)
    if usage.tokens_used >= FREE_TOKEN_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "TOKEN_LIMIT_EXCEEDED",
                "used": usage.tokens_used,
                "limit": FREE_TOKEN_LIMIT,
            }
        )
    return usage

def add_tokens(usage: UserTokenUsage, count: int, db: Session):
    usage.tokens_used += count
    db.commit()