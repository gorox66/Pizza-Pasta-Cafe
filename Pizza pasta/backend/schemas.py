"""
schemas.py — Pydantic-схемы для валидации входящих запросов и формирования ответов API.
"""

from pydantic import BaseModel, EmailStr, field_validator, Field
from typing import Optional, List


# ─── Auth ─────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name:     str  = Field(..., min_length=1, max_length=100)
    email:    EmailStr
    phone:    Optional[str] = ""
    password: str  = Field(..., min_length=6, max_length=128)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Имя не может быть пустым")
        return v.strip()


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id:    int
    name:  str
    email: str
    phone: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    token: str        # простой токен (user_id:email, base64)
    user:  UserResponse


# ─── Menu ─────────────────────────────────────────────────────────────────────

class MenuItemResponse(BaseModel):
    id:          int
    name:        str
    price:       int
    category:    str
    image:       str
    description: str


# ─── Orders ───────────────────────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    id:    int
    name:  str
    price: int
    qty:   int = Field(..., ge=1)


class CreateOrderRequest(BaseModel):
    items:          List[OrderItemIn] = Field(..., min_length=1)
    address:        str = Field(..., min_length=3)
    customer_name:  str = Field(..., min_length=1)
    customer_phone: str = Field(..., min_length=5)
    user_id:        Optional[int] = None

    @field_validator("address", "customer_name", "customer_phone")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Поле не может быть пустым")
        return v.strip()


class OrderResponse(BaseModel):
    id:             int
    user_id:        Optional[int]
    items:          list
    total:          int
    address:        str
    customer_name:  str
    customer_phone: str
    status:         str
    created_at:     str


# ─── Bookings ─────────────────────────────────────────────────────────────────

class CreateBookingRequest(BaseModel):
    name:         str = Field(..., min_length=1)
    phone:        str = Field(..., min_length=5)
    booking_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    booking_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    guests:       int = Field(..., ge=1, le=20)

    @field_validator("name", "phone")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Поле не может быть пустым")
        return v.strip()


class BookingResponse(BaseModel):
    id:           int
    name:         str
    phone:        str
    booking_date: str
    booking_time: str
    guests:       int
    created_at:   str


# ─── Generic ──────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str

class ErrorResponse(BaseModel):
    detail: str
