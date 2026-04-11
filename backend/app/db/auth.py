from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from fastapi import HTTPException, Depends, Request
from .models import User
from datetime import datetime, timedelta
import jwt
from .db import get_db


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30
ACCESS_TOKEN_SECRET_KEY = (
    "95959b1ad1f53d68edad6e16acc80ea00fea5b47cb7237bdacc1dc90f78e1792"
)
REFRESH_TOKEN_SECRET_KEY = (
    "b32e7661a763407aa9f9994891c151e6325aebe2459812c70451ea4f5e6d06af"
)


password_hash = PasswordHash.recommended()


def get_password_hash(password):
    return password_hash.hash(password)


def verify_password(plain_password, hashed_password):
    return password_hash.verify(plain_password, hashed_password)


def get_user(email: str, db: Session):
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(status_code=402, detail="User not exist with this email")

    return user


def authenticate_user(email: str, password: str, db: Session):
    user = get_user(email, db)
    if not user:
        raise HTTPException(status_code=402, detail="User not exist with this email")
    if not verify_password(password, user.password):
        raise HTTPException(status_code=402, detail="Incorrect password")

    return user


def create_access_token(data: dict):
    expire = datetime.now() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    data.update({"exp": expire, "type": "access"})
    return jwt.encode(data, ACCESS_TOKEN_SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict):
    expire = datetime.now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    data.update({"exp": expire, "type": "refresh"})
    return jwt.encode(data, REFRESH_TOKEN_SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(access_token: str, db: Session):
    payload = jwt.decode(access_token, ACCESS_TOKEN_SECRET_KEY, algorithms=ALGORITHM)
    email = payload.get("sub")

    if not email:
        raise HTTPException(status_code=402, detail="No user available")

    user = db.query(User).filter(User.email == email).first()

    return user


def refresh_token(refresh_token: str, db: Session):
    payload = jwt.decode(refresh_token, REFRESH_TOKEN_SECRET_KEY, algorithms=ALGORITHM)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    email = payload.get("sub")

    user = db.query(User).filter(User.email == email).first()

    if not user or user.refresh_token != refresh_token:
        raise HTTPException(status_code=401, detail="Token revoked")

    new_access = create_access_token({"sub": email})
    new_refresh = create_refresh_token({"sub": email})

    user.refresh_token = new_refresh
    db.commit()

    return {"access_token": new_access, "refresh_token": new_refresh}
