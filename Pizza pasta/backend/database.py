"""
database.py — подключение к SQLite3, создание таблиц, начальные данные меню.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "pizza.db")


def get_connection() -> sqlite3.Connection:
    """Возвращает соединение с БД. Row-объекты обращаются как словари."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


MENU_SEED = [
    # (name, price, category, image, description)
    ("Маргарита",        450, "pizza",   "https://images.unsplash.com/photo-1680405620826-83b0f0f61b28?w=600&h=400&fit=crop&auto=format", "Томатный соус, моцарелла, базилик"),
    ("Пепперони",        550, "pizza",   "https://images.unsplash.com/photo-1667207394004-acb6aaf4790e?w=600&h=400&fit=crop&auto=format", "Томатный соус, моцарелла, пепперони"),
    ("Четыре сыра",      580, "pizza",   "https://images.unsplash.com/photo-1773308498493-ea7b44ac8237?w=600&h=400&fit=crop&auto=format", "Моцарелла, горгонзола, пармезан, рикотта"),
    ("Вегетарианская",   500, "pizza",   "https://images.unsplash.com/photo-1773308498493-ea7b44ac8237?w=600&h=400&fit=crop&auto=format", "Томатный соус, перец, грибы, оливки"),
    ("Карбонара",        480, "pasta",   "https://images.unsplash.com/photo-1588013273468-315fd88ea34c?w=600&h=400&fit=crop&auto=format", "Спагетти, бекон, яйцо, пармезан"),
    ("Болоньезе",        460, "pasta",   "https://images.unsplash.com/photo-1598866594230-a7c12756260f?w=600&h=400&fit=crop&auto=format", "Тальятелле, мясной соус, томаты, пармезан"),
    ("Примавера",        440, "pasta",   "https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=600&h=400&fit=crop&auto=format", "Лингуине, сезонные овощи, оливковое масло"),
    ("Цезарь с курицей", 380, "salad",   "https://images.unsplash.com/photo-1746211108786-ca20c8f80ecd?w=600&h=400&fit=crop&auto=format", "Романо, курица, пармезан, соус цезарь"),
    ("Капрезе",          350, "salad",   "https://images.unsplash.com/photo-1746211224437-8340316b288d?w=600&h=400&fit=crop&auto=format", "Томаты, моцарелла, базилик, оливковое масло"),
    ("Тирамису",         320, "dessert", "https://images.unsplash.com/photo-1782503708390-4e5fff098d57?w=600&h=400&fit=crop&auto=format", "Маскарпоне, савоярди, кофе, какао"),
    ("Панна котта",      290, "dessert", "https://images.unsplash.com/photo-1778008402773-f27c96136020?w=600&h=400&fit=crop&auto=format", "Сливки, ваниль, клубничный соус"),
    ("Шоколадный фондан",340, "dessert", "https://images.unsplash.com/photo-1769434128978-5bdcb5c7ee2a?w=600&h=400&fit=crop&auto=format", "Горячий кекс с жидкой начинкой"),
    ("Эспрессо",         120, "drink",   "https://images.unsplash.com/photo-1595434091143-b375ced5fe5c?w=600&h=400&fit=crop&auto=format", "Крепкий итальянский кофе"),
    ("Капучино",         160, "drink",   "https://images.unsplash.com/photo-1579992357154-faf4bde95b3d?w=600&h=400&fit=crop&auto=format", "Эспрессо с нежной молочной пеной"),
    ("Клубничный лимонад",180,"drink",   "https://images.unsplash.com/photo-1583898350903-99fa829dad3d?w=600&h=400&fit=crop&auto=format", "Клубника, лимон, мята, газированная вода"),
    ("Фруктовый сок",    150, "drink",   "https://images.unsplash.com/photo-1583898350727-9bf2e476c242?w=600&h=400&fit=crop&auto=format", "Свежевыжатый, без сахара"),
]


def init_db() -> None:
    """Создаёт таблицы и заполняет меню при первом запуске."""
    conn = get_connection()
    cur  = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL,
            email         TEXT    UNIQUE NOT NULL,
            phone         TEXT    DEFAULT '',
            password_hash TEXT    NOT NULL,
            created_at    TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS menu_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            price       INTEGER NOT NULL,
            category    TEXT    NOT NULL,
            image       TEXT    NOT NULL,
            description TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id          INTEGER REFERENCES users(id),
            items_json       TEXT    NOT NULL,
            total            INTEGER NOT NULL,
            address          TEXT    NOT NULL,
            customer_name    TEXT    NOT NULL,
            customer_phone   TEXT    NOT NULL,
            status           TEXT    DEFAULT 'active',
            created_at       TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT    NOT NULL,
            phone        TEXT    NOT NULL,
            booking_date TEXT    NOT NULL,
            booking_time TEXT    NOT NULL,
            guests       INTEGER NOT NULL,
            created_at   TEXT    DEFAULT (datetime('now'))
        );
    """)

    # Заполняем меню только если таблица пустая
    cur.execute("SELECT COUNT(*) FROM menu_items")
    if cur.fetchone()[0] == 0:
        cur.executemany(
            "INSERT INTO menu_items (name, price, category, image, description) VALUES (?,?,?,?,?)",
            MENU_SEED,
        )

    conn.commit()
    conn.close()
