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
    # Пути /img/... соответствуют файлам в public/img/
    ("Маргарита", 710, "pizza",   "/img/margherita.jpg",  "Томатный соус, моцарелла, базилик"),
    ("Пепперони", 890, "pizza",   "/img/pepperoni.jpg",   "Томатный соус, моцарелла, пепперони"),
    ("Четыре сыра", 900, "pizza",   "/img/four-cheese.jpg", "Моцарелла, горгонзола, пармезан, рикотта"),
    ("Вегетарианская", 850, "pizza",   "/img/veget.jpeg", "Томатный соус, перец, грибы, оливки"),
    ("Карбонара", 820, "pasta",   "/img/carbonara.jpg",   "Спагетти, бекон, яйцо, пармезан"),
    ("Болоньезе", 780, "pasta",   "/img/bolognese.jpg",   "Тальятелле, мясной соус, томаты, пармезан"),
    ("Примавера", 700, "pasta",   "/img/primavera.jpg",   "Лингуине, сезонные овощи, оливковое масло"),
    ("Цезарь с курицей", 400, "salad",   "/img/caesar.png",      "Романо, курица, пармезан, соус цезарь"),
    ("Капрезе", 350, "salad",   "/img/caprese.jpg",     "Томаты, моцарелла, базилик, оливковое масло"),
    ("Тирамису", 400, "dessert", "/img/tiramicy.jpg",    "Маскарпоне, савоярди, кофе, какао"),
    ("Панна котта", 480, "dessert", "/img/panna_cota.jpeg",  "Сливки, ваниль, клубничный соус"),
    ("Шоколадный фондан", 450, "dessert", "/img/fondan.jpg",     "Горячий кекс с жидкой начинкой"),
    ("Эспрессо", 170, "drink",   "/img/ecspersso.jpg",    "Крепкий итальянский кофе"),
    ("Капучино", 180, "drink",   "/img/capuchinno.jpg",  "Эспрессо с нежной молочной пеной"),
    ("Клубничный лимонад",210, "drink",   "/img/clubnika.jpg",    "Клубника, лимон, мята, газированная вода"),
    ("Апельсиновый сок", 215, "drink",   "/img/sok.jpg",       "Свежевыжатый, без сахара"),
]


def init_db() -> None:
    """Создаёт таблицы и заполняет меню при первом запуске."""
    conn = get_connection()
    cur  = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT DEFAULT '',
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            category TEXT NOT NULL,
            image TEXT NOT NULL,
            description TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            items_json TEXT NOT NULL,
            total INTEGER NOT NULL,
            address TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            booking_date TEXT NOT NULL,
            booking_time TEXT NOT NULL,
            guests INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
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
