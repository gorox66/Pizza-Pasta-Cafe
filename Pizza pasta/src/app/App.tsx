/**
 * App.tsx — React-frontend кафе Pizza.
 * Подключается к FastAPI-бэкенду (backend/main.py).
 * Если бэкенд недоступен — работает через localStorage (оффлайн-режим).
 *
 * Запуск бэкенда:
 *   cd backend && pip install -r requirements.txt
 *   uvicorn main:app --reload --port 8000
 */

import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, User, X, Plus, Minus, Menu as MenuIcon, Check, Wifi, WifiOff } from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────
const API = "http://localhost:8000/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MenuItem  { id: number; name: string; price: number; category: string; image: string; description: string; }
interface CartItem  extends MenuItem { qty: number; }
interface UserInfo  { id?: number; name: string; email: string; phone: string; }
interface Order     { id: string | number; items: any[]; total: number; address: string; status: "active" | "cancelled"; created_at: string; }

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("pz_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Ошибка сервера" }));
    throw new Error(err.detail || "Ошибка сервера");
  }
  return res.json();
}

// ─── localStorage fallback helpers ───────────────────────────────────────────
const lsUsers   = () => JSON.parse(localStorage.getItem("pz_users")   || "[]");
const lsSaveU   = (u: any[]) => localStorage.setItem("pz_users",  JSON.stringify(u));
const lsSession = (): UserInfo | null => { const s = localStorage.getItem("pz_session"); return s ? JSON.parse(s) : null; };
const lsSaveS   = (u: UserInfo | null) => u ? localStorage.setItem("pz_session", JSON.stringify(u)) : localStorage.removeItem("pz_session");
const lsOrders  = (email: string): Order[] => JSON.parse(localStorage.getItem(`pz_orders_${email}`) || "[]");
const lsSaveO   = (email: string, o: Order[]) => localStorage.setItem(`pz_orders_${email}`, JSON.stringify(o));

function sha256sim(s: string): string {
  // Простая имитация для оффлайн-режима (не криптографически стойкая)
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
  return Math.abs(h).toString(16).padStart(8, "0") + s.length.toString(16);
}

// ─── Static menu (оффлайн-режим) ─────────────────────────────────────────────
const STATIC_MENU: MenuItem[] = [
  { id:1,  name:"Маргарита", price:710, category:"pizza", image:"/img/margherita.jpg", description:"Томатный соус, моцарелла, базилик" },
  { id:2,  name:"Пепперони", price:890, category:"pizza", image:"/img/pepperoni.jpg", description:"Томатный соус, моцарелла, пепперони" },
  { id:3,  name:"Четыре сыра", price:900, category:"pizza", image:"/img/four-cheese.jpg", description:"Моцарелла, горгонзола, пармезан, рикотта" },
  { id:4,  name:"Вегетарианская", price:850, category:"pizza", image:"/img/veget.jpeg", description:"Томатный соус, перец, грибы, оливки" },
  { id:5,  name:"Карбонара", price:820, category:"pasta", image:"/img/carbonara.jpg", description:"Спагетти, бекон, яйцо, пармезан" },
  { id:6,  name:"Болоньезе", price:780, category:"pasta", image:"/img/bolognese.jpg", description:"Тальятелле, мясной соус, томаты, пармезан" },
  { id:7,  name:"Примавера", price:700, category:"pasta", image:"/img/primavera.jpg", description:"Лингуине, сезонные овощи, оливковое масло" },
  { id:8,  name:"Цезарь с курицей", price:400, category:"salad", image:"/img/caesar.png", description:"Романо, курица, пармезан, соус цезарь" },
  { id:9,  name:"Капрезе", price:350, category:"salad", image:"/img/caprese.jpg", description:"Томаты, моцарелла, базилик, оливковое масло" },
  { id:10, name:"Тирамису", price:400, category:"dessert", image:"/img/tiramicy.jpg", description:"Маскарпоне, савоярди, кофе, какао" },
  { id:11, name:"Панна котта", price:480, category:"dessert", image:"/img/panna_cota.jpeg", description:"Сливки, ваниль, клубничный соус" },
  { id:12, name:"Шоколадный фондан", price:450, category:"dessert", image:"/img/fondan.jpg", description:"Горячий кекс с жидкой начинкой" },
  { id:13, name:"Эспрессо", price:170, category:"drink", image:"/img/ecspersso.jpg", description:"Крепкий итальянский кофе" },
  { id:14, name:"Капучино", price:180, category:"drink", image:"/img/capuchinno.jpg", description:"Эспрессо с нежной молочной пеной" },
  { id:15, name:"Клубничный лимонад",price:210, category:"drink", image:"/img/clubnika.jpg", description:"Клубника, лимон, мята, газированная вода" },
  { id:16, name:"Апельсиновый сок", price:215, category:"drink", image:"/img/sok.jpg", description:"Свежевыжатый, без сахара" },
];

const CATEGORIES = [
  { key:"pizza", label:"Пицца"   },
  { key:"pasta", label:"Паста"   },
  { key:"salad", label:"Салаты"  },
  { key:"dessert", label:"Десерты" },
  { key:"drink", label:"Напитки" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-0">
      <h2 className="text-lg font-semibold">{title}</h2>
      <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={17} /></button>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      {children}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}

const inp = (err?: string) =>
  `w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${err ? "border-red-400" : "border-border"}`;

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // Connection
  const [online, setOnline] = useState<boolean | null>(null);

  // Data
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // UI
  const [activeCat, setActiveCat] = useState("pizza");
  const [modal, setModal] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [mobileNav, setMobileNav] = useState(false);
  const [orderStep, setOrderStep] = useState(1);
  const [bookOk, setBookOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Forms
  const [loginF, setLoginF] = useState({ email:"", password:"" });
  const [regF, setRegF] = useState({ name:"", email:"", phone:"", password:"", agree: false });
  const [orderF, setOrderF] = useState({ name:"", phone:"", address:"" });
  const [bookF, setBookF] = useState({ date:"", time:"", guests:"2", name:"", phone:"" });

  // ── Init ──
  useEffect(() => {
    checkBackend();
  }, []);

  const checkBackend = async () => {
    try {
      await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) });
      setOnline(true);
      loadMenu(true);
      restoreSession(true);
    } catch {
      setOnline(false);
      setMenu(STATIC_MENU);
      restoreSession(false);
    }
  };

  const loadMenu = async (apiMode: boolean) => {
    if (!apiMode) { setMenu(STATIC_MENU); return; }
    try {
      const data = await apiFetch("/menu");
      setMenu(data);
    } catch {
      setMenu(STATIC_MENU);
    }
  };

  const restoreSession = async (apiMode: boolean) => {
    const token = localStorage.getItem("pz_token");
    if (apiMode && token) {
      try {
        const u = await apiFetch("/auth/me");
        setUser(u);
        const o = await apiFetch("/orders");
        setOrders(o);
      } catch {
        localStorage.removeItem("pz_token");
      }
    } else if (!apiMode) {
      const s = lsSession();
      if (s) { setUser(s); setOrders(lsOrders(s.email)); }
    }
  };

  // ── Cart ──
  const totalQty   = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const addItem = (item: MenuItem) => setCart(prev => {
    const ex = prev.find(c => c.id === item.id);
    return ex ? prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c) : [...prev, { ...item, qty: 1 }];
  });

  const removeItem = (id: number) => setCart(prev => {
    const ex = prev.find(c => c.id === id);
    if (!ex) return prev;
    return ex.qty === 1 ? prev.filter(c => c.id !== id) : prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c);
  });

  const qty = (id: number) => cart.find(c => c.id === id)?.qty || 0;
  const closeModal = () => { setModal(null); setErrors({}); setOrderStep(1); };

  // ── Auth ──
  const handleLogin = async () => {
    const e: Record<string, string> = {};
    if (!loginF.email) e.email = "Введите email";
    if (!loginF.password) e.password = "Введите пароль";
    setErrors(e); if (Object.keys(e).length) return;
    setLoading(true);
    try {
      if (online) {
        const data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: loginF.email, password: loginF.password }),
        });
        localStorage.setItem("pz_token", data.token);
        setUser(data.user);
        const o = await apiFetch("/orders");
        setOrders(o);
      } else {
        const found = lsUsers().find((u: any) => u.email === loginF.email && u.pw === sha256sim(loginF.password));
        if (!found) throw new Error("Неверный email или пароль");
        const u: UserInfo = { name: found.name, email: found.email, phone: found.phone || "" };
        setUser(u); lsSaveS(u); setOrders(lsOrders(u.email));
      }
      setModal(null); setLoginF({ email:"", password:"" });
    } catch (err: any) {
      setErrors({ gen: err.message || "Ошибка входа" });
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    const e: Record<string, string> = {};
    if (!regF.name.trim()) e.name = "Введите имя";
    if (!regF.email.includes("@")) e.email = "Введите корректный email";
    if (regF.password.length < 6) e.password = "Пароль — минимум 6 символов";
    if (!regF.agree) e.agree = "Необходимо принять соглашение";
    setErrors(e); if (Object.keys(e).length) return;
    setLoading(true);
    try {
      if (online) {
        const data = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name: regF.name, email: regF.email, phone: regF.phone, password: regF.password }),
        });
        localStorage.setItem("pz_token", data.token);
        setUser(data.user);
      } else {
        const users = lsUsers();
        if (users.find((u: any) => u.email === regF.email)) throw new Error("Email уже зарегистрирован");
        const nu = { name: regF.name, email: regF.email, phone: regF.phone, pw: sha256sim(regF.password) };
        lsSaveU([...users, nu]);
        const u: UserInfo = { name: nu.name, email: nu.email, phone: nu.phone };
        setUser(u); lsSaveS(u);
      }
      setModal(null); setRegF({ name:"", email:"", phone:"", password:"", agree: false });
    } catch (err: any) {
      setErrors({ email: err.message || "Ошибка регистрации" });
    } finally { setLoading(false); }
  };

  const handleLogout = () => {
    setUser(null); setOrders([]);
    localStorage.removeItem("pz_token"); lsSaveS(null);
    setModal(null);
  };

  // ── Order ──
  const handlePlaceOrder = async () => {
    const e: Record<string, string> = {};
    if (!orderF.name.trim()) e.oName = "Введите имя";
    if (!orderF.phone.trim()) e.oPhone = "Введите телефон";
    if (!orderF.address.trim()) e.oAddress = "Введите адрес";
    setErrors(e); if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const items = cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty }));
      let newOrder: Order;
      if (online) {
        newOrder = await apiFetch("/orders", {
          method: "POST",
          body: JSON.stringify({
            items,
            address: orderF.address,
            customer_name: orderF.name,
            customer_phone: orderF.phone,
          }),
        });
        const o = await apiFetch("/orders");
        setOrders(o);
      } else {
        newOrder = {
          id: Date.now().toString(),
          items,
          total: totalPrice,
          address: orderF.address,
          status: "active",
          created_at: new Date().toLocaleDateString("ru-RU"),
        };
        const email = user?.email || "guest";
        const updated = [newOrder, ...lsOrders(email)];
        lsSaveO(email, updated); setOrders(updated);
      }
      setCart([]); setOrderStep(3); setOrderF({ name:"", phone:"", address:"" });
    } catch (err: any) {
      setErrors({ gen: err.message });
    } finally { setLoading(false); }
  };

  const cancelOrder = async (id: string | number) => {
    try {
      if (online) {
        await apiFetch(`/orders/${id}/cancel`, { method: "PATCH" });
        const o = await apiFetch("/orders");
        setOrders(o);
      } else {
        const email = user?.email || "guest";
        const updated = lsOrders(email).map(o => o.id === id ? { ...o, status: "cancelled" as const } : o);
        lsSaveO(email, updated); setOrders(updated);
      }
    } catch {}
  };

  // ── Booking ──
  const handleBooking = async () => {
    const e: Record<string, string> = {};
    if (!bookF.date) e.bDate  = "Выберите дату";
    if (!bookF.time) e.bTime  = "Выберите время";
    if (!bookF.name.trim()) e.bName  = "Введите имя";
    if (!bookF.phone.trim()) e.bPhone = "Введите телефон";
    setErrors(e); if (Object.keys(e).length) return;
    setLoading(true);
    try {
      if (online) {
        await apiFetch("/bookings", {
          method: "POST",
          body: JSON.stringify({
            name: bookF.name,
            phone: bookF.phone,
            booking_date: bookF.date,
            booking_time: bookF.time,
            guests: Number(bookF.guests),
          }),
        });
      }
      setBookOk(true);
      setBookF({ date:"", time:"", guests:"2", name:"", phone:"" });
    } catch (err: any) {
      setErrors({ bDate: err.message });
    } finally { setLoading(false); }
  };

  const filtered = menu.filter(i => i.category === activeCat);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Nunito', sans-serif" }}>

      {/* ── Online indicator ─────────────────────────────────── */}
      {online !== null && (
        <div className={`fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md transition-all ${online ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {online ? "API подключён" : "Оффлайн-режим"}
        </div>
      )}

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-border z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <a href="#" className="text-xl font-bold tracking-tight text-foreground shrink-0">Pizza</a>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#menu" className="hover:text-primary transition-colors">Меню</a>
            <a href="#booking" className="hover:text-primary transition-colors">Бронь стола</a>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setOrderStep(1); setModal("cart"); }}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Корзина">
              <ShoppingCart size={20} />
              {totalQty > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalQty}
                </span>
              )}
            </button>
            <button
              onClick={() => { if (user) setModal("account"); else { setAuthTab("login"); setErrors({}); setModal("auth"); } }}
              className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Аккаунт">
              <User size={20} />
            </button>
            <button onClick={() => setMobileNav(v => !v)}
              className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Меню">
              <MenuIcon size={20} />
            </button>
          </div>
        </div>

        {mobileNav && (
          <div className="md:hidden border-t border-border bg-white px-4 py-3 flex flex-col gap-3 text-sm font-medium">
            <a href="#menu" onClick={() => setMobileNav(false)} className="hover:text-primary transition-colors">Меню</a>
            <a href="#booking" onClick={() => setMobileNav(false)} className="hover:text-primary transition-colors">Бронь стола</a>
          </div>
        )}
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="pt-14">
        <div className="relative flex items-center justify-center bg-stone-900 overflow-hidden" style={{ minHeight:"88vh" }}>
          <img
            src="/img/hero.jpg"
            alt="Пицца"
            className="absolute inset-0 w-full h-full object-cover opacity-45 select-none"
          />
          <div className="relative text-center text-white px-4 py-16">
            <p className="text-xs uppercase tracking-[0.25em] mb-5 opacity-70">Волгоград</p>
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-3">Итальянская кухня</h1>
            <p className="text-base sm:text-lg opacity-80 mb-10">Пицца, паста, десерты</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#menu"    className="bg-primary text-white px-7 py-3 rounded-xl font-semibold hover:bg-primary/85 transition-colors text-sm">Смотреть меню</a>
              <a href="#booking" className="border border-white/70 text-white px-7 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors text-sm">Забронировать стол</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Menu ───────────────────────────────────────────────── */}
      <section id="menu" className="py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-1">Меню</h2>
          <p className="text-muted-foreground text-sm mb-7">Из свежих ингредиентов каждый день</p>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-8" style={{ scrollbarWidth:"none" }}>
            {CATEGORIES.map(cat => (
              <button key={cat.key} onClick={() => setActiveCat(cat.key)}
                className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeCat === cat.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(item => {
              const q = qty(item.id);
              return (
                <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative bg-stone-100 h-44 overflow-hidden">
                    <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                    {q > 0 && (
                      <span className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        {q} в корзине
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm mb-0.5">{item.name}</h3>
                    <p className="text-muted-foreground text-xs mb-3">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold" style={{ fontVariantNumeric:"tabular-nums" }}>
                        {item.price}&thinsp;₽
                      </span>
                      {q === 0 ? (
                        <button onClick={() => addItem(item)}
                          className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/85 transition-colors">
                          В корзину
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeItem(item.id)}
                            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/60 transition-colors">
                            <Minus size={13} />
                          </button>
                          <span className="text-sm font-bold w-5 text-center">{q}</span>
                          <button onClick={() => addItem(item)}
                            className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/85 transition-colors">
                            <Plus size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalQty > 0 && (
            <div className="mt-10 flex justify-center">
              <button onClick={() => { setOrderStep(1); setModal("cart"); }}
                className="bg-primary text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-primary/85 transition-colors flex items-center gap-2">
                <ShoppingCart size={17} />
                Корзина · {totalQty} поз. · {totalPrice}&thinsp;₽
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Booking ────────────────────────────────────────────── */}
      <section id="booking" className="py-16 bg-muted/50">
        <div className="max-w-md mx-auto px-4">
          <h2 className="text-2xl font-bold mb-1">Бронь стола</h2>
          <p className="text-muted-foreground text-sm mb-7">Забронируйте столик заранее</p>

          {bookOk ? (
            <div className="bg-white border border-border rounded-2xl p-8 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={22} className="text-green-600" />
              </div>
              <h3 className="font-semibold text-base mb-1">Стол забронирован!</h3>
              <p className="text-muted-foreground text-sm mb-5">Мы свяжемся с вами для подтверждения</p>
              <button onClick={() => setBookOk(false)} className="text-primary text-sm font-medium hover:underline">Ещё раз</button>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Дата" error={errors.bDate}>
                  <input type="date" min={new Date().toISOString().split("T")[0]}
                    value={bookF.date} onChange={e => setBookF({ ...bookF, date: e.target.value })}
                    className={inp(errors.bDate)} />
                </Field>
                <Field label="Время" error={errors.bTime}>
                  <select value={bookF.time} onChange={e => setBookF({ ...bookF, time: e.target.value })}
                    className={inp(errors.bTime) + " bg-white"}>
                    <option value="">--</option>
                    {["12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"].map(t =>
                      <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Гостей">
                <select value={bookF.guests} onChange={e => setBookF({ ...bookF, guests: e.target.value })}
                  className={inp() + " bg-white"}>
                  {["1","2","3","4","5","6","7","8"].map(n =>
                    <option key={n} value={n}>{n} {n==="1"?"гость":+n<5?"гостя":"гостей"}</option>)}
                </select>
              </Field>
              <Field label="Ваше имя" error={errors.bName}>
                <input type="text" placeholder="Иван"
                  value={bookF.name} onChange={e => setBookF({ ...bookF, name: e.target.value })}
                  className={inp(errors.bName)} />
              </Field>
              <Field label="Телефон" error={errors.bPhone}>
                <input type="tel" placeholder="+7 (900) 000-00-00"
                  value={bookF.phone} onChange={e => setBookF({ ...bookF, phone: e.target.value })}
                  className={inp(errors.bPhone)} />
              </Field>
              <button onClick={handleBooking} disabled={loading}
                className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-60">
                {loading ? "Отправка..." : "Забронировать"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border py-7">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="font-bold text-foreground">Pizza</span>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <span>Волгоград</span>
            <button onClick={() => setModal("agreement")} className="underline hover:text-foreground transition-colors">
              Пользовательское соглашение
            </button>
          </div>
          <span>© 2026 Pizza</span>
        </div>
      </footer>

      {/* ══════════════ MODALS ══════════════ */}

      {/* Auth */}
      {modal === "auth" && (
        <Overlay onClose={closeModal}>
          <ModalHead title={authTab === "login" ? "Вход в аккаунт" : "Регистрация"} onClose={closeModal} />
          <div className="p-6">
            <div className="flex mb-6 border border-border rounded-xl overflow-hidden text-sm">
              <button onClick={() => { setAuthTab("login"); setErrors({}); }}
                className={`flex-1 py-2 font-semibold transition-colors ${authTab==="login" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
                Вход
              </button>
              <button onClick={() => { setAuthTab("register"); setErrors({}); }}
                className={`flex-1 py-2 font-semibold transition-colors ${authTab==="register" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
                Регистрация
              </button>
            </div>

            {authTab === "login" ? (
              <div className="space-y-4">
                {errors.gen && (
                  <p className="text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{errors.gen}</p>
                )}
                <Field label="Email" error={errors.email}>
                  <input type="email" placeholder="your@email.com"
                    value={loginF.email} onChange={e => setLoginF({ ...loginF, email: e.target.value })}
                    className={inp(errors.email)} />
                </Field>
                <Field label="Пароль" error={errors.password}>
                  <input type="password" placeholder="Пароль"
                    value={loginF.password}
                    onChange={e => setLoginF({ ...loginF, password: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    className={inp(errors.password)} />
                </Field>
                <button onClick={handleLogin} disabled={loading}
                  className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-60">
                  {loading ? "Вход..." : "Войти"}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Нет аккаунта?{" "}
                  <button onClick={() => { setAuthTab("register"); setErrors({}); }}
                    className="text-primary font-semibold hover:underline">Зарегистрироваться</button>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="Имя" error={errors.name}>
                  <input type="text" placeholder="Ваше имя"
                    value={regF.name} onChange={e => setRegF({ ...regF, name: e.target.value })}
                    className={inp(errors.name)} />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input type="email" placeholder="your@email.com"
                    value={regF.email} onChange={e => setRegF({ ...regF, email: e.target.value })}
                    className={inp(errors.email)} />
                </Field>
                <Field label="Телефон (необязательно)">
                  <input type="tel" placeholder="+7 (900) 000-00-00"
                    value={regF.phone} onChange={e => setRegF({ ...regF, phone: e.target.value })}
                    className={inp()} />
                </Field>
                <Field label="Пароль" error={errors.password}>
                  <input type="password" placeholder="Минимум 6 символов"
                    value={regF.password} onChange={e => setRegF({ ...regF, password: e.target.value })}
                    className={inp(errors.password)} />
                  {!errors.password && regF.password.length > 0 && regF.password.length < 6 && (
                    <p className="text-red-500 text-xs mt-1">Пароль слишком короткий</p>
                  )}
                </Field>
                <div>
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={regF.agree}
                      onChange={e => setRegF({ ...regF, agree: e.target.checked })}
                      className="mt-0.5 accent-red-600 shrink-0" />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      Я принимаю{" "}
                      <button type="button" onClick={() => setModal("agreement")}
                        className="text-primary underline font-medium">пользовательское соглашение</button>
                      {" "}и согласен на обработку персональных данных
                    </span>
                  </label>
                  {errors.agree && <p className="text-red-600 text-xs mt-1">{errors.agree}</p>}
                </div>
                <button onClick={handleRegister} disabled={loading}
                  className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-60">
                  {loading ? "Создание..." : "Создать аккаунт"}
                </button>
              </div>
            )}
          </div>
        </Overlay>
      )}

      {/* Account */}
      {modal === "account" && user && (
        <Overlay onClose={closeModal}>
          <ModalHead title="Мой аккаунт" onClose={closeModal} />
          <div className="p-6 space-y-5">
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <InfoRow label="Имя"    value={user.name} />
              <InfoRow label="Email"  value={user.email} />
              {user.phone && <InfoRow label="Телефон" value={user.phone} />}
            </div>

            {orders.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Мои заказы</h3>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1" style={{ scrollbarWidth:"thin" }}>
                  {orders.map(o => (
                    <div key={o.id} className="border border-border rounded-xl p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{o.created_at}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          o.status==="active" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                          {o.status==="active" ? "Активен" : "Отменён"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {(o.items || []).map((i: any) => i.name).join(", ")}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-sm">{o.total}&thinsp;₽</span>
                        {o.status === "active" && (
                          <button onClick={() => cancelOrder(o.id)}
                            className="text-red-600 text-xs font-medium hover:underline">Отменить</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleLogout}
              className="w-full border border-border py-2.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors text-muted-foreground">
              Выйти из аккаунта
            </button>
          </div>
        </Overlay>
      )}

      {/* Cart / Order */}
      {modal === "cart" && (
        <Overlay onClose={closeModal}>
          <ModalHead
            title={orderStep===1 ? "Корзина" : orderStep===2 ? "Оформление заказа" : "Заказ принят!"}
            onClose={closeModal} />
          <div className="p-6">
            {orderStep === 1 && (
              cart.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Корзина пуста</p>
              ) : (
                <>
                  <div className="space-y-3 mb-5 max-h-60 overflow-y-auto pr-1" style={{ scrollbarWidth:"thin" }}>
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.price}&thinsp;₽</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => removeItem(item.id)}
                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/60">
                            <Minus size={11} />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                          <button onClick={() => addItem(item)}
                            className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/85">
                            <Plus size={11} />
                          </button>
                        </div>
                        <span className="text-sm font-bold tabular-nums w-16 text-right shrink-0">
                          {item.price * item.qty}&thinsp;₽
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between font-bold text-base mb-4">
                      <span>Итого</span><span>{totalPrice}&thinsp;₽</span>
                    </div>
                    <button onClick={() => setOrderStep(2)}
                      className="w-full bg-primary text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary/85 transition-colors">
                      Оформить заказ
                    </button>
                  </div>
                </>
              )
            )}

            {orderStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Сумма: <span className="font-bold text-foreground">{totalPrice}&thinsp;₽</span>
                </p>
                {errors.gen && <p className="text-red-600 text-xs">{errors.gen}</p>}
                <Field label="Ваше имя" error={errors.oName}>
                  <input type="text" placeholder="Иван"
                    value={orderF.name} onChange={e => setOrderF({ ...orderF, name: e.target.value })}
                    className={inp(errors.oName)} />
                </Field>
                <Field label="Телефон" error={errors.oPhone}>
                  <input type="tel" placeholder="+7 (900) 000-00-00"
                    value={orderF.phone} onChange={e => setOrderF({ ...orderF, phone: e.target.value })}
                    className={inp(errors.oPhone)} />
                </Field>
                <Field label="Адрес доставки" error={errors.oAddress}>
                  <input type="text" placeholder="ул. Примерная, д. 1, кв. 10"
                    value={orderF.address} onChange={e => setOrderF({ ...orderF, address: e.target.value })}
                    className={inp(errors.oAddress)} />
                </Field>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setOrderStep(1); setErrors({}); }}
                    className="flex-1 border border-border py-2.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
                    Назад
                  </button>
                  <button onClick={handlePlaceOrder} disabled={loading}
                    className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-60">
                    {loading ? "Оформление..." : "Подтвердить"}
                  </button>
                </div>
              </div>
            )}

            {orderStep === 3 && (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={26} className="text-green-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">Заказ принят!</h3>
                <p className="text-muted-foreground text-sm mb-1">Мы перезвоним для подтверждения</p>
                {user && <p className="text-muted-foreground text-xs mb-5">Заказ сохранён в вашем аккаунте</p>}
                <button onClick={closeModal}
                  className="bg-primary text-white px-8 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/85 transition-colors">
                  Отлично!
                </button>
              </div>
            )}
          </div>
        </Overlay>
      )}

      {/* Agreement */}
      {modal === "agreement" && (
        <Overlay onClose={closeModal}>
          <ModalHead title="Пользовательское соглашение" onClose={closeModal} />
          <div className="px-6 pb-6">
            <div className="text-sm text-muted-foreground space-y-4 max-h-72 overflow-y-auto pr-1 mt-4" style={{ scrollbarWidth:"thin" }}>
              <div>
                <p className="font-semibold text-foreground mb-1">1. Общие положения</p>
                <p>Настоящее Соглашение регулирует использование сайта Pizza и обработку персональных данных в соответствии с Федеральным законом №152-ФЗ «О персональных данных».</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">2. Какие данные мы собираем</p>
                <p>При регистрации: имя, адрес электронной почты, номер телефона (по желанию). При заказе: адрес доставки. При бронировании: имя, телефон, дата и время.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">3. Цель обработки</p>
                <p>Данные используются исключительно для оформления заказов и бронирования столиков. Мы не передаём данные третьим лицам.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">4. Хранение данных</p>
                <p>Данные хранятся в базе данных на сервере. Удалив аккаунт, вы удалите все данные.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">5. Права пользователя</p>
                <p>Вы можете в любой момент отозвать согласие.</p>
              </div>
            </div>
            <button onClick={closeModal}
              className="mt-5 w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/85 transition-colors">
              Понятно
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
