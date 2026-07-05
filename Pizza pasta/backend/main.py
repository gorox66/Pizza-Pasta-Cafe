"""
main.py — FastAPI-приложение. Запуск:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Swagger UI: http://localhost:8000/docs
"""

import json
import hashlib
import base64
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from database import get_connection, init_db
from models   import User, MenuItem, Order, Booking
from schemas  import (
    RegisterRequest, LoginRequest, UserResponse, TokenResponse,
    MenuItemResponse,
    CreateOrderRequest, OrderResponse,
    CreateBookingRequest, BookingResponse,
    MessageResponse,
)

# ─── App init ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Pizza API",
    description="REST API для кафе Pizza — Волгоград, 2026",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """SHA-256 хэш пароля (для продакшна используйте bcrypt)."""
    return hashlib.sha256(password.encode()).hexdigest()

def make_token(user_id: int, email: str) -> str:
    """Простой токен: base64(user_id:email). В продакшне — JWT."""
    raw = f"{user_id}:{email}"
    return base64.b64encode(raw.encode()).decode()

def decode_token(token: str) -> Optional[int]:
    """Возвращает user_id из токена, или None если невалидный"""
    try:
        decoded = base64.b64decode(token.encode()).decode()
        user_id = int(decoded.split(":")[0])
        return user_id
    except Exception:
        return None

def get_current_user_id(authorization: Optional[str] = None) -> Optional[int]:
    """Читает Bearer-токен из заголовка Authorization."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer "):]
    return decode_token(token)


# ─── Auth endpoints ───────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=TokenResponse, tags=["Auth"])
def register(body: RegisterRequest):
    """Регистрация нового пользователя."""
    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("SELECT id FROM users WHERE email = ?", (body.email,))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="Email уже зарегистрирован")

    pw_hash = hash_password(body.password)
    cur.execute(
        "INSERT INTO users (name, email, phone, password_hash) VALUES (?,?,?,?)",
        (body.name, body.email, body.phone or "", pw_hash),
    )
    conn.commit()
    user_id = cur.lastrowid
    conn.close()

    token = make_token(user_id, body.email)
    return TokenResponse(
        token=token,
        user=UserResponse(id=user_id, name=body.name, email=body.email, phone=body.phone or ""),
    )


@app.post("/api/auth/login", response_model=TokenResponse, tags=["Auth"])
def login(body: LoginRequest):
    """Вход в аккаунт."""
    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("SELECT * FROM users WHERE email = ?", (body.email,))
    row = cur.fetchone()
    conn.close()

    if not row or row["password_hash"] != hash_password(body.password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    user = User.from_row(row)
    token = make_token(user.id, user.email)
    return TokenResponse(
        token=token,
        user=UserResponse(id=user.id, name=user.name, email=user.email, phone=user.phone),
    )


@app.get("/api/auth/me", response_model=UserResponse, tags=["Auth"])
def get_me(authorization: Optional[str] = Header(default=None)):
    """Возвращает данные текущего пользователя по токену"""
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Требуется авторизация")

    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user = User.from_row(row)
    return UserResponse(id=user.id, name=user.name, email=user.email, phone=user.phone)


# ─── Menu endpoints ───────────────────────────────────────────────────────────

@app.get("/api/menu", response_model=List[MenuItemResponse], tags=["Menu"])
def get_menu(category: Optional[str] = None):
    """Возвращает всё меню или фильтрует по категории (pizza/pasta/salad/dessert/drink)"""
    conn = get_connection()
    cur  = conn.cursor()

    if category:
        cur.execute("SELECT * FROM menu_items WHERE category = ?", (category,))
    else:
        cur.execute("SELECT * FROM menu_items")

    rows  = cur.fetchall()
    conn.close()

    return [MenuItem.from_row(r).to_dict() for r in rows]


@app.get("/api/menu/{item_id}", response_model=MenuItemResponse, tags=["Menu"])
def get_menu_item(item_id: int):
    """Возвращает одну позицию меню по id"""
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM menu_items WHERE id = ?", (item_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Позиция меню не найдена")
    return MenuItem.from_row(row).to_dict()


# ─── Order endpoints ──────────────────────────────────────────────────────────

@app.post("/api/orders", response_model=OrderResponse, tags=["Orders"])
def create_order(body: CreateOrderRequest, authorization: Optional[str] = Header(default=None)):
    """Создаёт новый заказ user_id берётся из токена если авторизован"""
    user_id = get_current_user_id(authorization)

    total      = sum(item.price * item.qty for item in body.items)
    items_json = json.dumps([i.model_dump() for i in body.items], ensure_ascii=False)

    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        """INSERT INTO orders
           (user_id, items_json, total, address, customer_name, customer_phone)
           VALUES (?,?,?,?,?,?)""",
        (user_id, items_json, total, body.address, body.customer_name, body.customer_phone),
    )
    conn.commit()
    order_id = cur.lastrowid

    cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    row = cur.fetchone()
    conn.close()

    return Order.from_row(row).to_dict()


@app.get("/api/orders", response_model=List[OrderResponse], tags=["Orders"])
def get_my_orders(authorization: Optional[str] = Header(default=None)):
    """Возвращает заказы текущего авторизованного пользователя"""
    user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Требуется авторизация")

    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    )
    rows = cur.fetchall()
    conn.close()

    return [Order.from_row(r).to_dict() for r in rows]


@app.patch("/api/orders/{order_id}/cancel", response_model=OrderResponse, tags=["Orders"])
def cancel_order(order_id: int, authorization: Optional[str] = Header(default=None)):
    """Отменяет заказ"""
    user_id = get_current_user_id(authorization)

    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    row = cur.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if row["status"] == "cancelled":
        conn.close()
        raise HTTPException(status_code=400, detail="Заказ уже отменён")

    if user_id and row["user_id"] != user_id:
        conn.close()
        raise HTTPException(status_code=403, detail="Нет доступа к этому заказу")

    cur.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", (order_id,))
    conn.commit()

    cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    updated = cur.fetchone()
    conn.close()

    return Order.from_row(updated).to_dict()


# ─── Booking endpoints ────────────────────────────────────────────────────────

@app.post("/api/bookings", response_model=BookingResponse, tags=["Bookings"])
def create_booking(body: CreateBookingRequest):
    """Создаёт бронирование стола"""
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO bookings (name, phone, booking_date, booking_time, guests) VALUES (?,?,?,?,?)",
        (body.name, body.phone, body.booking_date, body.booking_time, body.guests),
    )
    conn.commit()
    booking_id = cur.lastrowid

    cur.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
    row = cur.fetchone()
    conn.close()

    return Booking.from_row(row).to_dict()


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/api/health", response_model=MessageResponse, tags=["System"])
def health():
    """Проверка работоспособности сервера"""
    return MessageResponse(message="OK")
