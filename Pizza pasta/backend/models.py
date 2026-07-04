"""
models.py — Python-датаклассы, описывающие строки таблиц БД.
Используются для типизации внутри приложения (не ORM).
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class User:
    id:            int
    name:          str
    email:         str
    phone:         str
    password_hash: str
    created_at:    str

    @classmethod
    def from_row(cls, row) -> "User":
        return cls(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            phone=row["phone"] or "",
            password_hash=row["password_hash"],
            created_at=row["created_at"],
        )


@dataclass
class MenuItem:
    id:          int
    name:        str
    price:       int
    category:    str
    image:       str
    description: str

    @classmethod
    def from_row(cls, row) -> "MenuItem":
        return cls(
            id=row["id"],
            name=row["name"],
            price=row["price"],
            category=row["category"],
            image=row["image"],
            description=row["description"],
        )

    def to_dict(self) -> dict:
        return {
            "id":          self.id,
            "name":        self.name,
            "price":       self.price,
            "category":    self.category,
            "image":       self.image,
            "description": self.description,
        }


@dataclass
class Order:
    id:             int
    user_id:        Optional[int]
    items_json:     str           # JSON-строка: [{id, name, price, qty}, ...]
    total:          int
    address:        str
    customer_name:  str
    customer_phone: str
    status:         str           # "active" | "cancelled"
    created_at:     str

    @classmethod
    def from_row(cls, row) -> "Order":
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            items_json=row["items_json"],
            total=row["total"],
            address=row["address"],
            customer_name=row["customer_name"],
            customer_phone=row["customer_phone"],
            status=row["status"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict:
        import json
        return {
            "id":             self.id,
            "user_id":        self.user_id,
            "items":          json.loads(self.items_json),
            "total":          self.total,
            "address":        self.address,
            "customer_name":  self.customer_name,
            "customer_phone": self.customer_phone,
            "status":         self.status,
            "created_at":     self.created_at,
        }


@dataclass
class Booking:
    id:           int
    name:         str
    phone:        str
    booking_date: str
    booking_time: str
    guests:       int
    created_at:   str

    @classmethod
    def from_row(cls, row) -> "Booking":
        return cls(
            id=row["id"],
            name=row["name"],
            phone=row["phone"],
            booking_date=row["booking_date"],
            booking_time=row["booking_time"],
            guests=row["guests"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id":           self.id,
            "name":         self.name,
            "phone":        self.phone,
            "booking_date": self.booking_date,
            "booking_time": self.booking_time,
            "guests":       self.guests,
            "created_at":   self.created_at,
        }
