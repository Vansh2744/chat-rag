from pydantic import BaseModel
from uuid import UUID


class User(BaseModel):
    name: str
    email: str
    password: str


class UserCreate(User):
    pass


class UserLogin(BaseModel):
    email: str
    password: str


class UserLogout(BaseModel):
    email: str


class UserResponse(BaseModel):
    id: UUID
    email: str

    class Config:
        from_attributes = True


class AccessToken(BaseModel):
    access_token: str


class RefreshToken(BaseModel):
    refresh_token: str
