from fastapi import APIRouter, Depends, HTTPException, Header
from app.db.models import User
from app.db.schemas import (
    UserCreate,
    UserLogin,
    UserLogout,
    UserResponse,
    RefreshToken,
)
from app.db.db import get_db
from app.db.auth import (
    get_password_hash,
    authenticate_user,
    get_current_user,
    create_access_token,
    create_refresh_token,
    refresh_token,
)
from sqlalchemy.orm import Session
from uuid import UUID

router = APIRouter(tags=["user"], prefix="/users")


@router.post("/sign-up")
def sign_up(user: UserCreate, db: Session = Depends(get_db)):
    existed_user = db.query(User).filter(User.email == user.email).first()
    if existed_user:
        raise HTTPException(
            status_code=402, detail="User with this email already exists"
        )

    hashed_password = get_password_hash(user.password)
    db_user = User(name=user.name, email=user.email, password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    if not db_user:
        raise HTTPException(
            status_code=402, detail="Unable to signup. Please try again later"
        )
    return {"message": "Signup successful"}


@router.post("/sign-in")
def sign_in(user: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(user.email, user.password, db)

    if not user:
        raise HTTPException(status_code=402, detail="User not found")

    access_token = create_access_token({"sub": user.email})
    refresh_token = create_refresh_token({"sub": user.email})

    user.refresh_token = refresh_token
    db.commit()
    db.refresh(user)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"id": user.id, "email": user.email},
    }


@router.post("/sign-out/")
def logout(user: UserLogout, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user.email).first()
    if not user:
        raise HTTPException(status_code=402, detail="User not Found")

    user.refresh_token = None
    db.commit()

    return {"message": "Logged out"}


@router.get("/current-user/", response_model=UserResponse)
def current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_current_user(token, db)

    if not user:
        raise HTTPException(status_code=402, detail="User not Found")

    return user


@router.post("/refresh/")
def token_refresh(token: RefreshToken, db: Session = Depends(get_db)):
    token = token.refresh_token
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    res_tokens = refresh_token(token, db)

    return res_tokens

@router.get("/token-usage/{user_id}")
async def get_token_usage(user_id: UUID, db: Session = Depends(get_db)):
    from app.utils.token_utils import get_or_create_usage
    from app.db.models import FREE_TOKEN_LIMIT
    usage = get_or_create_usage(str(user_id), db)
    return {
        "tokens_used": usage.tokens_used,
        "token_limit": FREE_TOKEN_LIMIT,
        "remaining": max(0, FREE_TOKEN_LIMIT - usage.tokens_used),
    }