import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { Bus, Fuel, Wrench, Shield, Users, Plus, TrendingUp, TrendingDown, Wallet, Sun, Moon, X, Check, Pencil, Trash2, UserCircle, Banknote, Calendar, Home, ClipboardList, Truck, LayoutDashboard, Settings, DollarSign, School, User, Clock, Search, UserX, Cloud, CloudOff } from "lucide-react";
import { supabase, cargarDatos, guardarDatos } from './supabase';

// ============ CONFIGURACIÓN DE ALMACENAMIENTO ============
window.storage = {
  get: (key) => {
    try {
      const value = localStorage.getItem(key);
      return Promise.resolve({ value });
    } catch (e) {
      return Promise.resolve({ value: null });
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (e) {
      return Promise.resolve();
    }
  }
};

const INK = "#1E2A44";
const YELLOW = "#F5B400";
const BG = "#EDEFF2";
const CARD = "#FFFFFF";
const GREEN = "#2E7D5B";
const GREEN_LT = "#E3F0EA";
const BRICK = "#C1442B";
const BRICK_LT = "#FBEAE6";
const GRAY_TXT = "#5B6478";
const BORDER = "#DDE1E8";
const CHIP_BG = "#F4F5F7";
const PURPLE = "#6B4FA0";
const BLUE = "#2563EB";
const BLUE_LT = "#DBEAFE";
const ORANGE = "#E67E22";
const ORANGE_LT = "#FDEBD0";

const CATS = [
  { id: "gasolina", label: "Gasolina", icon: Fuel, generalOnly: false },
  { id: "piezas", label: "Piezas de reparacion", icon: Wrench, generalOnly: false },
  { id: "seguro", label: "Seguro", icon: Shield, generalOnly: true },
  { id: "salario", label: "Salario", icon: Banknote, generalOnly: true },
  { id: "otro", label: "Otro", icon: Wallet, generalOnly: false },
];

const TIPOS_SERVICIO = [
  { id: "kinder", label: "Kinder", icon: School },
  { id: "escuela_dia", label: "Escuela Turno Día", icon: Sun },
  { id: "escuela_tarde", label: "Escuela Turno Tarde", icon: Moon },
  { id: "secundaria_dia", label: "Secundaria Turno Día", icon: Sun },
  { id: "secundaria_tarde", label: "Secundaria Turno Tarde", icon: Moon },
];

const CATEGORIES = {
  normal: { label: "Normal", rates: { 1: 260, 2: 450 }, color: INK },
  foraneo: { label: "Foraneo", rates: { 1: 300, 2: 500 }, color: PURPLE },
  especial: { label: "Especial", rates: {}, color: YELLOW },
};

function fmt(n) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function suggestedRate(category, numKids) {
  const rates = CATEGORIES[category].rates;
  if (rates[numKids]) return rates[numKids];
  if (numKids === 1) return rates[1] || "";
  return "";
}

function getWeekStart(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function getMonthStart(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function currentPeriod(account) {
  return account.frequency === "mensual" ? getMonthStart(new Date()) : getWeekStart(new Date());
}

// DATOS VACÍOS
function emptyData() {
  return {
    trucks: [],
    drivers: [],
    accounts: [],
    payments: [],
    expenses: [],
  };
}

function isValidShape(d) {
  return d && 
    Array.isArray(d.trucks) && 
    Array.isArray(d.drivers) && 
    Array.isArray(d.accounts) && 
    Array.isArray(d.payments) && 
    Array.isArray(d.expenses);
}

// Nombre completo si es 1 solo alumno, "Hermanos Apellido" si hay 2+ nombrados en la cuenta
function familyLabelFromKids(kids) {
  const nombrados = (kids || []).filter(k => k && k.trim());
  if (nombrados.length === 0) return "";
  if (nombrados.length === 1) return nombrados[0].trim();
  const parts = nombrados[0].trim().split(" ").filter(Boolean);
  const apellido = parts.length > 1 ? parts.slice(1).join(" ") : parts[0] || "";
  return `Hermanos ${apellido}`;
}

// ============ FUNCIONES DE CARGA Y PERSISTENCIA CON SUPABASE + LOCALSTORAGE ============

async function loadData() {
  // 1. Intentar cargar desde Supabase primero (nube)
  try {
    const data = await cargarDatos();
    if (data && data.trucks && data.trucks.length > 0) {
      // Guardar en localStorage como respaldo
      await window.storage.set("transescolar-data-v3", JSON.stringify(data), false);
      return data;
    }
  } catch (e) {
    console.log("Error cargando desde Supabase, usando localStorage:", e);
  }

  // 2. Si no hay datos en la nube, intentar con localStorage
  try {
    const res = await window.storage.get("transescolar-data-v3", false);
    if (res && res.value) {
      const parsed = JSON.parse(res.value);
      if (isValidShape(parsed)) {
        // Subir a Supabase para sincronizar
        await guardarDatos(parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.log("Error cargando desde localStorage:", e);
  }

  // 3. Si no hay datos en ningún lado, empezar vacío
  const empty = emptyData();
  await window.storage.set("transescolar-data-v3", JSON.stringify(empty), false);
  await guardarDatos(empty);
  return empty;
}

async function persist(data) {
  // Guardar en localStorage (respaldo local)
  try { await window.storage.set("transescolar-data-v3", JSON.stringify(data), false); } catch (e) {}
  
  // Guardar en Supabase (nube)
  try { await guardarDatos(data); } catch (e) {
    console.log("Error guardando en Supabase:", e);
  }
}

// ============ FIN FUNCIONES DE CARGA ============

function StatCard({ label, value, tone, Icon }) {
  const bg = tone === "green" ? GREEN_LT : tone === "brick" ? BRICK_LT : tone === "blue" ? BLUE_LT : tone === "orange" ? ORANGE_LT : CHIP_BG;
  const fg = tone === "green" ? GREEN : tone === "brick" ? BRICK : tone === "blue" ? BLUE : tone === "orange" ? ORANGE : INK;
  return (
    <div style={{ background: bg, borderRadius: 14, padding: "16px 18px", flex: 1, minWidth: 150 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon size={16} color={fg} />
        <span style={{ fontSize: 13, color: GRAY_TXT, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: fg }}>{value}</div>
    </div>
  );
}

function RouteStrip({ shift }) {
  const dots = 5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "10px 0 4px" }}>
      {shift === "AM" ? <Sun size={14} color={YELLOW} /> : <Moon size={14} color={INK} />}
      <span style={{ fontSize: 12, fontWeight: 700, color: INK, letterSpacing: 0.5, marginRight: 6 }}>
        {shift === "AM" ? "TURNO MANANA" : "TURNO TARDE"}
      </span>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        {Array.from({ length: dots }).map((_, i) => (
          <React.Fragment key={i}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: BORDER }} />
            {i < dots - 1 && <div style={{ flex: 1, height: 1, background: BORDER }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ============ MODAL BLOQUEADO - No se cierra al hacer clic fuera ============
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div 
      style={{ 
        position: "fixed", 
        inset: 0, 
        background: "rgba(30,42,68,0.5)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        zIndex: 50 
      }}
    >
      <div 
        style={{ 
          background: CARD, 
          borderRadius: 16, 
          padding: 24, 
          width: 460, 
          maxWidth: "90vw", 
          maxHeight: "85vh", 
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: INK }}>{title}</h3>
          <button 
            onClick={onClose} 
            style={{ 
              border: "none", 
              background: "none", 
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = CHIP_BG}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <X size={18} color={GRAY_TXT} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 14, marginBottom: 12, boxSizing: "border-box", fontFamily: "'Inter', sans-serif" };
const labelStyle = { fontSize: 12, fontWeight: 600, color: GRAY_TXT, marginBottom: 6, display: "block" };
const btnStyle = { width: "100%", padding: "10px", borderRadius: 8, border: "none", background: INK, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Inter', sans-serif" };
const chipBtn = active => ({
  padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer",
  fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif",
  background: active ? INK : CHIP_BG, color: active ? "#fff" : GRAY_TXT,
});

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      background: CARD, 
      borderRadius: 10, 
      padding: "4px 12px",
      border: `1px solid ${BORDER}`,
      flex: 1,
      minWidth: 150,
    }}>
      <Search size={18} color={GRAY_TXT} />
      <input 
        type="text" 
        placeholder={placeholder || "Buscar..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "none",
          padding: "8px 10px",
          fontSize: 14,
          flex: 1,
          outline: "none",
          background: "transparent",
          fontFamily: "'Inter', sans-serif",
        }}
      />
      {value && (
        <button 
          onClick={() => onChange("")}
          style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}
        >
          <X size={16} color={GRAY_TXT} />
        </button>
      )}
    </div>
  );
}

function MainNavButton({ icon: Icon, label, onClick, color = INK, bgColor = CARD }) {
  return (
    <button 
      onClick={onClick}
      style={{
        background: bgColor,
        borderRadius: 16,
        padding: "24px 20px",
        border: `1px solid ${BORDER}`,
        cursor: "pointer",
        flex: 1,
        minWidth: 120,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        transition: "all 0.2s",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        fontFamily: "'Inter', sans-serif",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
    >
      <Icon size={32} color={color} />
      <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{label}</span>
    </button>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("home");
  const [mainView, setMainView] = useState("clientes");
  const [view, setView] = useState("general");
  const [modal, setModal] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ synced: true, message: "Sincronizado" });
  
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAccess, setAdminAccess] = useState(false);
  const ADMIN_KEY = "admin123";

  useEffect(() => { loadData().then(setData); }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    
    const weeklyIncome = data.payments.reduce((s, p) => s + p.amount, 0);
    const totalIncome = weeklyIncome;
    const totalExpense = data.expenses.reduce((s, e) => s + e.amount, 0);
    
    const perTruck = data.trucks.map(t => {
      const accIds = data.accounts.filter(a => a.truckId === t.id).map(a => a.id);
      const inc = data.payments.filter(p => accIds.includes(p.accountId)).reduce((s, p) => s + p.amount, 0);
      const exp = data.expenses.filter(e => e.truckId === t.id).reduce((s, e) => s + e.amount, 0);
      return { name: t.name, balance: inc - exp, inc, exp };
    });
    
    const perDriver = data.drivers.map(dr => {
      const truckIds = data.trucks.filter(t => t.driverId === dr.id).map(t => t.id);
      const accIds = data.accounts.filter(a => truckIds.includes(a.truckId)).map(a => a.id);
      const inc = data.payments.filter(p => accIds.includes(p.accountId)).reduce((s, p) => s + p.amount, 0);
      return { name: dr.name, cobrado: inc, salary: dr.salary || 0 };
    });
    
    const perCat = CATS.map(c => ({
      name: c.label,
      value: data.expenses.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0),
    })).filter(c => c.value > 0);
    
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense, perTruck, perDriver, perCat, weeklyIncome };
  }, [data]);

  if (!data || !stats) {
    return <div style={{ padding: 40, textAlign: "center", color: GRAY_TXT, fontFamily: "'Inter', sans-serif" }}>Cargando...</div>;
  }

  const truck = view !== "general" ? data.trucks.find(t => t.id === view) : null;

  function getWeeks() {
    const weeks = [];
    const today = new Date();
    const currentWeekStart = getWeekStart(today);
    for (let i = 0; i < 4; i++) {
      const d = new Date(currentWeekStart + "T00:00:00");
      d.setDate(d.getDate() - i * 7);
      weeks.push(d.toISOString().slice(0, 10));
    }
    return weeks;
  }

  function getPaymentCount(accountId) {
    const weeks = getWeeks();
    return data.payments.filter(p => p.accountId === accountId && weeks.includes(p.period)).length;
  }

  function handleAdminLogin() {
    if (adminPassword === ADMIN_KEY) {
      setAdminAccess(true);
      setShowAdminLogin(false);
      setAdminPassword("");
    } else {
      alert("❌ Contraseña incorrecta");
      setAdminPassword("");
    }
  }

  // ============ FUNCIÓN PARA SINCRONIZAR MANUALMENTE ============
  async function syncToCloud() {
    setSyncStatus({ synced: false, message: "Sincronizando..." });
    try {
      await guardarDatos(data);
      setSyncStatus({ synced: true, message: "✅ Sincronizado con la nube" });
      setTimeout(() => {
        setSyncStatus({ synced: true, message: "Sincronizado" });
      }, 3000);
    } catch (error) {
      setSyncStatus({ synced: false, message: "❌ Error al sincronizar" });
      console.error("Error sincronizando:", error);
    }
  }

  // ============ FUNCIONES CRUD ============

  function addTruck(form) {
    const next = { ...data, trucks: [...data.trucks, { id: uid(), ...form }] };
    setData(next); persist(next); setModal(null);
  }
  function updateTruck(id, form) {
    const next = { ...data, trucks: data.trucks.map(t => t.id === id ? { ...t, ...form } : t) };
    setData(next); persist(next); setModal(null);
  }
  function deleteTruck(id) {
    const next = { ...data, trucks: data.trucks.filter(t => t.id !== id) };
    setData(next); persist(next); setModal(null);
    if (view === id) setView("general");
  }
  function addDriver(form) {
    const next = { ...data, drivers: [...data.drivers, { id: uid(), ...form }] };
    setData(next); persist(next); setModal(null);
  }
  function updateDriver(id, form) {
    const next = { ...data, drivers: data.drivers.map(d => d.id === id ? { ...d, ...form } : d) };
    setData(next); persist(next); setModal(null);
  }
  function deleteDriver(id) {
    const next = {
      ...data,
      drivers: data.drivers.filter(d => d.id !== id),
      trucks: data.trucks.map(t => t.driverId === id ? { ...t, driverId: null } : t),
    };
    setData(next); persist(next); setModal(null);
  }

  function addAccount(form) {
    const next = { ...data, accounts: [...data.accounts, { id: uid(), ...form }] };
    setData(next); persist(next); setModal(null);
  }
  function updateAccount(id, form) {
    const next = { ...data, accounts: data.accounts.map(a => a.id === id ? { ...a, ...form } : a) };
    setData(next); persist(next); setModal(null);
  }
  function deleteAccount(id) {
    const next = { 
      ...data, 
      accounts: data.accounts.filter(a => a.id !== id),
      payments: data.payments.filter(p => p.accountId !== id),
    };
    setData(next); 
    persist(next); 
    setModal(null);
  }

  function linkFamily(accountId, otherAccountId) {
    const a = data.accounts.find(x => x.id === accountId);
    const b = data.accounts.find(x => x.id === otherAccountId);
    if (!a || !b) return;
    const familyId = a.familyId || b.familyId || uid();
    const oldIds = [a.familyId, b.familyId].filter(Boolean);
    const next = {
      ...data,
      accounts: data.accounts.map(acc => {
        if (acc.id === accountId || acc.id === otherAccountId) return { ...acc, familyId };
        if (oldIds.includes(acc.familyId)) return { ...acc, familyId };
        return acc;
      }),
    };
    setData(next); persist(next);
  }
  function unlinkFamily(accountId) {
    const next = { ...data, accounts: data.accounts.map(a => a.id === accountId ? { ...a, familyId: null } : a) };
    setData(next); persist(next);
  }

  function markPaid(accountId, period, amount) {
    const next = { ...data, payments: [...data.payments, { id: uid(), accountId, period, amount: amount, date: new Date().toISOString().slice(0, 10) }] };
    setData(next); persist(next);
  }
  function undoPayment(paymentId) {
    const next = { ...data, payments: data.payments.filter(p => p.id !== paymentId) };
    setData(next); persist(next);
  }
  
  function addExpense(form) {
    const next = { ...data, expenses: [...data.expenses, { id: uid(), ...form }] };
    setData(next); persist(next); setModal(null);
  }
  function deleteExpense(id) {
    const next = { ...data, expenses: data.expenses.filter(e => e.id !== id) };
    setData(next); persist(next);
  }

  if (currentScreen === "home") {
    const totalStudentsHistorico = data.accounts.reduce((acc, a) => acc + a.kids.length, 0);
    const alumnosActivos = data.accounts.reduce((acc, a) => {
      const activos = a.kids.filter(name => !a.kidsActive || a.kidsActive[name] !== false);
      return acc + activos.length;
    }, 0);
    const alumnosBaja = totalStudentsHistorico - alumnosActivos;
    const paidCount = data.accounts.filter(a => 
      data.payments.some(p => p.accountId === a.id && p.period === currentPeriod(a))
    ).length;

    return (
      <div style={{ background: BG, minHeight: 600, fontFamily: "'Inter', sans-serif", padding: 20, borderRadius: 20 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');`}</style>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bus size={20} color={YELLOW} />
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: INK, lineHeight: 1.2 }}>Transporte Galindo</div>
            <div style={{ fontSize: 13, color: GRAY_TXT }}>{data.trucks.length} camiones · {alumnosActivos} alumnos activos</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: syncStatus.synced ? GREEN : BRICK }}>
              {syncStatus.message}
            </span>
            <button 
              onClick={syncToCloud}
              title="Sincronizar con la nube"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
              }}
            >
              <Cloud size={18} color={syncStatus.synced ? BLUE : BRICK} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Ingresos" value={fmt(stats.totalIncome)} tone="green" Icon={TrendingUp} />
          <StatCard label="Gastos" value={fmt(stats.totalExpense)} tone="brick" Icon={TrendingDown} />
          <StatCard label="Balance" value={fmt(stats.balance)} tone="neutral" Icon={Wallet} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          <MainNavButton 
            icon={ClipboardList} 
            label="Clientes" 
            color={INK}
            onClick={() => { setCurrentScreen("app"); setMainView("clientes"); }}
          />
          <MainNavButton 
            icon={Truck} 
            label="Flota" 
            color={PURPLE}
            onClick={() => { setCurrentScreen("app"); setMainView("flota"); }}
          />
          <MainNavButton 
            icon={LayoutDashboard} 
            label="Dashboard" 
            color={GREEN}
            onClick={() => { setCurrentScreen("app"); setMainView("dashboard"); }}
          />
          <MainNavButton 
            icon={Settings} 
            label="Gastos" 
            color={ORANGE}
            onClick={() => { setCurrentScreen("app"); setMainView("gastos"); }}
          />
        </div>

        <div style={{ background: CARD, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>Resumen de cuentas</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: GRAY_TXT }}>👦 Alumnos activos</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: PURPLE }}>{alumnosActivos}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: GRAY_TXT }}>Cuentas / familias</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{data.accounts.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: GRAY_TXT }}>Al corriente</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: GREEN }}>{paidCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: GRAY_TXT }}>Cuentas pendientes</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: BRICK }}>{data.accounts.length - paidCount}</div>
            </div>
            {alumnosBaja > 0 && (
              <div>
                <div style={{ fontSize: 11, color: GRAY_TXT }}>Dados de baja</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: GRAY_TXT }}>{alumnosBaja}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setShowAdminLogin(true)}
            style={{
              background: "none",
              border: "none",
              color: GRAY_TXT,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              padding: "4px 8px",
              borderRadius: 4,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = CHIP_BG}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            🔒 Admin
          </button>
        </div>

        {adminAccess && (
          <div style={{
            background: CARD,
            borderRadius: 14,
            padding: 16,
            marginTop: 12,
            border: `2px solid ${BRICK}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRICK }}>
                🔐 Panel de Administración
              </div>
              <button 
                onClick={() => setAdminAccess(false)}
                style={{ border: "none", background: "none", cursor: "pointer" }}
              >
                <X size={18} color={GRAY_TXT} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                onClick={() => {
                  const data = localStorage.getItem("transescolar-data-v3");
                  const blob = new Blob([data], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `respaldo-transporte-${new Date().toISOString().slice(0,10)}.json`;
                  a.click();
                  alert("✅ Respaldo descargado correctamente.");
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: `1px solid ${BLUE}`,
                  background: BLUE_LT,
                  color: BLUE,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                💾 Descargar respaldo de datos
              </button>
              
              <button
                onClick={syncToCloud}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: `1px solid ${GREEN}`,
                  background: GREEN_LT,
                  color: GREEN,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                ☁️ Sincronizar con la nube (Supabase)
              </button>
              
              <div>
                <input
                  type="file"
                  accept=".json"
                  id="restoreInput"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          const data = JSON.parse(event.target.result);
                          localStorage.setItem("transescolar-data-v3", JSON.stringify(data));
                          await guardarDatos(data);
                          alert("✅ Respaldo cargado correctamente. La página se recargará.");
                          window.location.reload();
                        } catch (error) {
                          alert("❌ Error: Archivo inválido.");
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }
                  }}
                />
                <button
                  onClick={() => document.getElementById("restoreInput").click()}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: `1px solid ${ORANGE}`,
                    background: ORANGE_LT,
                    color: ORANGE,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "left",
                    width: "100%",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  📂 Cargar respaldo guardado
                </button>
              </div>
              
              <button
                onClick={() => {
                  if (window.confirm("¿Limpiar datos antiguos?\n\nSe conservarán:\n• Clientes, camiones y choferes (siempre)\n• Gastos de piezas: 5 años\n• Gasolina y otros: 2 años\n• Pagos: 2 años\n\n¿Continuar?")) {
                    const data = JSON.parse(localStorage.getItem("transescolar-data-v3"));
                    const today = new Date();
                    const twoYearsAgo = new Date(today);
                    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
                    const fiveYearsAgo = new Date(today);
                    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
                    
                    data.payments = data.payments.filter(p => {
                      const date = new Date(p.date);
                      return date >= twoYearsAgo;
                    });
                    
                    data.expenses = data.expenses.filter(e => {
                      const date = new Date(e.date);
                      if (e.category === "piezas") {
                        return date >= fiveYearsAgo;
                      }
                      return date >= twoYearsAgo;
                    });
                    
                    localStorage.setItem("transescolar-data-v3", JSON.stringify(data));
                    alert("✅ Datos limpiados correctamente.");
                    window.location.reload();
                  }
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: `1px solid ${ORANGE}`,
                  background: ORANGE_LT,
                  color: ORANGE,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                🧹 Limpiar datos antiguos (piezas 5 años)
              </button>
              
              <button
                onClick={() => {
                  if (window.confirm("⚠️ ¿ELIMINAR TODOS LOS DATOS?\n\nEsta acción NO se puede deshacer.\n\nAsegúrate de tener un respaldo antes de continuar.")) {
                    if (window.confirm("¿ESTÁS COMPLETAMENTE SEGURO?\n\nSe borrarán TODOS los datos.")) {
                      localStorage.removeItem("transescolar-data-v3");
                      alert("✅ Todos los datos han sido eliminados.");
                      window.location.reload();
                    }
                  }
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: `1px solid ${BRICK}`,
                  background: BRICK_LT,
                  color: BRICK,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                🗑️ ELIMINAR TODOS LOS DATOS (PELIGROSO)
              </button>
            </div>
          </div>
        )}

        {showAdminLogin && (
          <div 
            style={{ 
              position: "fixed", 
              inset: 0, 
              background: "rgba(30,42,68,0.6)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              zIndex: 100,
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setShowAdminLogin(false)}
          >
            <div 
              style={{ 
                background: CARD, 
                borderRadius: 16, 
                padding: 32, 
                width: 340, 
                maxWidth: "90vw",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: INK, fontFamily: "'Space Grotesk', sans-serif" }}>
                  🔐 Acceso Administrador
                </div>
                <button 
                  onClick={() => setShowAdminLogin(false)}
                  style={{ border: "none", background: "none", cursor: "pointer" }}
                >
                  <X size={20} color={GRAY_TXT} />
                </button>
              </div>
              
              <div style={{ fontSize: 13, color: GRAY_TXT, marginBottom: 16 }}>
                Ingresa la contraseña para acceder al panel de administración.
              </div>
              
              <input
                type="password"
                placeholder="Contraseña"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `2px solid ${BORDER}`,
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "'Inter', sans-serif",
                  marginBottom: 16,
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = INK}
                onBlur={(e) => e.target.style.borderColor = BORDER}
                autoFocus
              />
              
              <button
                onClick={handleAdminLogin}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  border: "none",
                  background: INK,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Acceder
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: 600, fontFamily: "'Inter', sans-serif", padding: 20, borderRadius: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button 
          onClick={() => setCurrentScreen("home")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: GRAY_TXT,
            fontSize: 13,
            fontWeight: 500,
            padding: "4px 8px",
            borderRadius: 8,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <Home size={16} /> Inicio
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ width: 36, height: 36, borderRadius: 10, background: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bus size={19} color={YELLOW} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[{ id: "clientes", label: "Clientes" }, { id: "flota", label: "Flota" }, { id: "dashboard", label: "Dashboard" }, { id: "gastos", label: "Gastos" }].map(t => (
          <button key={t.id} onClick={() => setMainView(t.id)} style={{ flex: 1, ...chipBtn(mainView === t.id), padding: "10px 10px", borderRadius: 10, fontSize: 13 }}>
            {t.label}
          </button>
        ))}
      </div>

      {mainView === "flota" && (
        <FlotaScreen
          data={data}
          onAddTruck={() => setModal({ type: "truck" })}
          onEditTruck={truck => setModal({ type: "truck", truck })}
          onAddDriver={() => setModal({ type: "driver" })}
          onEditDriver={driver => setModal({ type: "driver", driver })}
        />
      )}

      {mainView === "clientes" && (
        <ClientesScreen
          data={data}
          onAddAccount={() => setModal({ type: "account" })}
          onEditAccount={acc => setModal({ type: "account", account: acc })}
          onMarkPaid={markPaid}
          onUndoPayment={undoPayment}
        />
      )}

      {mainView === "gastos" && (
        <GastosScreen
          data={data}
          onAddExpense={() => setModal({ type: "expense" })}
          onDeleteExpense={deleteExpense}
        />
      )}

      {mainView === "dashboard" && (
        <>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 18, paddingBottom: 4 }}>
            {["general", ...data.trucks.map(t => t.id)].map(v => (
              <button key={v} onClick={() => setView(v)} style={chipBtn(view === v)}>
                {v === "general" ? "General" : data.trucks.find(t => t.id === v)?.name}
              </button>
            ))}
          </div>

          {view === "general" && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                <StatCard label="Ingresos totales" value={fmt(stats.totalIncome)} tone="green" Icon={TrendingUp} />
                <StatCard label="Gastos totales" value={fmt(stats.totalExpense)} tone="brick" Icon={TrendingDown} />
                <StatCard label="Balance neto" value={fmt(stats.balance)} tone="neutral" Icon={Wallet} />
              </div>

              <div style={{ background: CARD, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>Gastos por camion</div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.perTruck}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: GRAY_TXT }} axisLine={{ stroke: BORDER }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: GRAY_TXT }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                      <Bar dataKey="exp" fill={BRICK} radius={[6, 6, 0, 0]} name="Gastos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ background: CARD, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>Pagos recibidos por chofer</div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.perDriver}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: GRAY_TXT }} axisLine={{ stroke: BORDER }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: GRAY_TXT }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12 }} />
                      <Bar dataKey="cobrado" fill={GREEN} radius={[6, 6, 0, 0]} name="Cobrado" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ background: CARD, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>Gastos por categoria</div>
                <div style={{ height: 220, display: "flex", justifyContent: "center" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.perCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                        {stats.perCat.map((_, i) => (<Cell key={i} fill={[BRICK, YELLOW, INK, GRAY_TXT][i % 4]} />))}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {truck && (
            <TruckView truck={truck} data={data} onAddExpense={shift => setModal({ type: "expense", truckId: truck.id, shift })} />
          )}
        </>
      )}

      {modal && modal.type === "truck" && (
        <Modal title={modal.truck ? "Editar camion" : "Nuevo camion"} onClose={() => setModal(null)}>
          <TruckForm
            truck={modal.truck}
            drivers={data.drivers}
            onSubmit={form => modal.truck ? updateTruck(modal.truck.id, form) : addTruck(form)}
            onDelete={modal.truck ? () => deleteTruck(modal.truck.id) : null}
          />
        </Modal>
      )}
      {modal && modal.type === "driver" && (
        <Modal title={modal.driver ? "Editar chofer" : "Nuevo chofer"} onClose={() => setModal(null)}>
          <DriverForm
            driver={modal.driver}
            onSubmit={form => modal.driver ? updateDriver(modal.driver.id, form) : addDriver(form)}
            onDelete={modal.driver ? () => deleteDriver(modal.driver.id) : null}
          />
        </Modal>
      )}
      {modal && modal.type === "account" && (
        <Modal title={modal.account ? "Editar cuenta" : "Nueva cuenta"} onClose={() => setModal(null)}>
          <AccountForm 
            account={modal.account} 
            trucks={data.trucks} 
            drivers={data.drivers} 
            allAccounts={data.accounts}
            onSubmit={form => modal.account ? updateAccount(modal.account.id, form) : addAccount(form)}
            onDelete={modal.account ? () => deleteAccount(modal.account.id) : null}
            onLinkFamily={modal.account ? (otherId) => linkFamily(modal.account.id, otherId) : null}
            onUnlinkFamily={modal.account ? () => unlinkFamily(modal.account.id) : null}
          />
        </Modal>
      )}
      {modal && modal.type === "expense" && (
        <Modal title="Registrar gasto" onClose={() => setModal(null)}>
          <ExpenseForm 
            trucks={data.trucks} 
            onSubmit={addExpense} 
          />
        </Modal>
      )}
    </div>
  );
}

// ============ COMPONENTE GASTOS ============

function GastosScreen({ data, onAddExpense, onDeleteExpense }) {
  const [truckFilter, setTruckFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  let filteredExpenses = data.expenses;

  if (truckFilter !== "all") {
    filteredExpenses = filteredExpenses.filter(e => e.truckId === truckFilter);
  }

  if (categoryFilter !== "all") {
    filteredExpenses = filteredExpenses.filter(e => e.category === categoryFilter);
  }

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    filteredExpenses = filteredExpenses.filter(e => {
      const cat = CATS.find(c => c.id === e.category);
      const categoryLabel = cat ? cat.label.toLowerCase() : "";
      const desc = (e.desc || "").toLowerCase();
      const truckName = data.trucks.find(t => t.id === e.truckId)?.name?.toLowerCase() || "general";
      return categoryLabel.includes(term) || desc.includes(term) || truckName.includes(term);
    });
  }

  filteredExpenses = filteredExpenses.sort((a, b) => b.date.localeCompare(a.date));

  const totalGasolina = data.expenses.filter(e => e.category === "gasolina").reduce((s, e) => s + e.amount, 0);
  const totalPiezas = data.expenses.filter(e => e.category === "piezas").reduce((s, e) => s + e.amount, 0);
  const totalSeguro = data.expenses.filter(e => e.category === "seguro").reduce((s, e) => s + e.amount, 0);
  const totalSalario = data.expenses.filter(e => e.category === "salario").reduce((s, e) => s + e.amount, 0);
  const totalOtro = data.expenses.filter(e => e.category === "otro").reduce((s, e) => s + e.amount, 0);
  const totalGeneral = data.expenses.reduce((s, e) => s + e.amount, 0);

  const getTruckName = (id) => {
    const truck = data.trucks.find(t => t.id === id);
    return truck ? truck.name : "General";
  };

  const getCategoryLabel = (id) => {
    const cat = CATS.find(c => c.id === id);
    return cat ? cat.label : id;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Gasolina" value={fmt(totalGasolina)} tone="orange" Icon={Fuel} />
        <StatCard label="Piezas" value={fmt(totalPiezas)} tone="brick" Icon={Wrench} />
        <StatCard label="Seguro" value={fmt(totalSeguro)} tone="blue" Icon={Shield} />
        <StatCard label="Salario" value={fmt(totalSalario)} tone="neutral" Icon={Banknote} />
        <StatCard label="Total Gastos" value={fmt(totalGeneral)} tone="brick" Icon={Wallet} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <SearchBar 
          value={searchTerm} 
          onChange={setSearchTerm} 
          placeholder="Buscar por categoría, descripción o camión..."
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setTruckFilter("all")} style={chipBtn(truckFilter === "all")}>Todos</button>
          {data.trucks.map(t => (
            <button key={t.id} onClick={() => setTruckFilter(t.id)} style={chipBtn(truckFilter === t.id)}>{t.name}</button>
          ))}
          <button onClick={() => setTruckFilter("general")} style={chipBtn(truckFilter === "general")}>Generales</button>
        </div>
        <button onClick={onAddExpense} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: ORANGE, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          <Plus size={14} /> Gasto
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setCategoryFilter("all")} style={chipBtn(categoryFilter === "all")}>Todas</button>
        {CATS.map(c => (
          <button key={c.id} onClick={() => setCategoryFilter(c.id)} style={chipBtn(categoryFilter === c.id)}>{c.label}</button>
        ))}
      </div>

      <div style={{ background: CARD, borderRadius: 14, overflow: "hidden" }}>
        {filteredExpenses.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: GRAY_TXT, fontSize: 13 }}>
            {searchTerm ? "No hay gastos que coincidan con tu búsqueda." : "No hay gastos registrados."}
          </div>
        )}
        {filteredExpenses.map((e, i) => {
          const cat = CATS.find(c => c.id === e.category);
          const Icon = cat ? cat.icon : Wallet;
          const isGeneral = e.shift === "GENERAL" || e.truckId === "general";
          
          return (
            <div key={e.id} style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={14} color={GRAY_TXT} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{cat ? cat.label : "Gasto"}</span>
                  <span style={{ fontSize: 12, color: GRAY_TXT }}>•</span>
                  <span style={{ fontSize: 12, color: GRAY_TXT }}>{getTruckName(e.truckId)}</span>
                  {!isGeneral && e.shift && (
                    <>
                      <span style={{ fontSize: 12, color: GRAY_TXT }}>•</span>
                      <span style={{ fontSize: 12, color: GRAY_TXT }}>{e.shift === "AM" ? "Mañana" : "Tarde"}</span>
                    </>
                  )}
                  {e.desc && (
                    <>
                      <span style={{ fontSize: 12, color: GRAY_TXT }}>•</span>
                      <span style={{ fontSize: 12, color: GRAY_TXT }}>{e.desc}</span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 11, color: GRAY_TXT, marginTop: 2 }}>{e.date}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: BRICK }}>{fmt(e.amount)}</span>
                <button 
                  onClick={() => onDeleteExpense(e.id)} 
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}
                >
                  <Trash2 size={14} color={GRAY_TXT} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ COMPONENTE EXPENSE FORM ============

function ExpenseForm({ trucks, onSubmit }) {
  const [category, setCategory] = useState("gasolina");
  const [truckId, setTruckId] = useState("general");
  const [shift, setShift] = useState("AM");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  const catInfo = CATS.find(c => c.id === category);
  const isGeneral = catInfo?.generalOnly || truckId === "general";

  function changeCategory(id) {
    setCategory(id);
    const info = CATS.find(c => c.id === id);
    if (info?.generalOnly) {
      setTruckId("general");
      setShift("GENERAL");
    } else if (truckId === "general") {
      setTruckId(trucks[0]?.id || "general");
      setShift("AM");
    }
  }

  function submit() {
    if (!amount || Number(amount) <= 0) { setError("Ingresa un monto valido."); return; }
    if (!truckId) { setError("Selecciona un camion o General."); return; }
    
    const finalShift = truckId === "general" ? "GENERAL" : shift;
    onSubmit({ 
      truckId, 
      shift: finalShift, 
      category, 
      amount: Number(amount), 
      desc, 
      date 
    });
  }

  return (
    <div>
      <label style={labelStyle}>Categoria</label>
      <select style={inputStyle} value={category} onChange={e => changeCategory(e.target.value)}>
        {CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      <label style={labelStyle}>Asignar a</label>
      <select style={inputStyle} value={truckId} onChange={e => {
        setTruckId(e.target.value);
        if (e.target.value === "general") setShift("GENERAL");
        else if (shift === "GENERAL") setShift("AM");
      }}>
        <option value="general">📌 General (sin camion)</option>
        {trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      {truckId !== "general" && !catInfo?.generalOnly && (
        <>
          <label style={labelStyle}>Turno</label>
          <select style={inputStyle} value={shift} onChange={e => setShift(e.target.value)}>
            <option value="AM">Mañana</option>
            <option value="PM">Tarde</option>
          </select>
        </>
      )}

      {truckId === "general" && (
        <div style={{ fontSize: 12, color: GRAY_TXT, marginBottom: 12, background: CHIP_BG, padding: "8px 10px", borderRadius: 8 }}>
          Este gasto se registra como general, sin ligarse a un camión o turno específico.
        </div>
      )}

      <input style={inputStyle} type="number" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} />
      <input style={inputStyle} placeholder="Descripción (opcional)" value={desc} onChange={e => setDesc(e.target.value)} />
      <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} />
      {error && <div style={{ color: BRICK, fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <button style={{ ...btnStyle, background: ORANGE }} onClick={submit}>Guardar gasto</button>
    </div>
  );
}

// ============ COMPONENTE FLOTA ============

function FlotaScreen({ data, onAddTruck, onEditTruck, onAddDriver, onEditDriver }) {
  const driverName = id => data.drivers.find(d => d.id === id)?.name || "Sin asignar";
  
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Camiones</div>
        <button onClick={onAddTruck} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: INK, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          <Plus size={13} /> Camion
        </button>
      </div>
      <div style={{ background: CARD, borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
        {data.trucks.length === 0 && <div style={{ padding: 16, textAlign: "center", color: GRAY_TXT, fontSize: 13 }}>Sin camiones registrados.</div>}
        {data.trucks.map((t, i) => {
          const driver = data.drivers.find(d => d.id === t.driverId);
          return (
            <button key={t.id} onClick={() => onEditTruck(t)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${BORDER}`, background: "none", border: "none", borderTopWidth: i === 0 ? 0 : 1, borderTopStyle: "solid", borderTopColor: BORDER, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: INK, display: "flex", alignItems: "center", gap: 6 }}><Bus size={14} color={GRAY_TXT} /> {t.name}</div>
                <div style={{ fontSize: 12, color: GRAY_TXT, marginTop: 2 }}>
                  Chofer: {driverName(t.driverId)}
                  {driver && driver.salary && (
                    <span style={{ marginLeft: 8, background: BLUE_LT, color: BLUE, padding: "1px 8px", borderRadius: 10, fontSize: 11 }}>
                      Salario: {fmt(driver.salary)}
                    </span>
                  )}
                </div>
              </div>
              <Pencil size={14} color={GRAY_TXT} />
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Choferes</div>
        <button onClick={onAddDriver} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: INK, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          <Plus size={13} /> Chofer
        </button>
      </div>
      <div style={{ background: CARD, borderRadius: 14, overflow: "hidden" }}>
        {data.drivers.length === 0 && <div style={{ padding: 16, textAlign: "center", color: GRAY_TXT, fontSize: 13 }}>Sin choferes registrados.</div>}
        {data.drivers.map((d, i) => {
          const truck = data.trucks.find(t => t.driverId === d.id);
          return (
            <button key={d.id} onClick={() => onEditDriver(d)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${BORDER}`, background: "none", border: "none", borderTopWidth: i === 0 ? 0 : 1, borderTopStyle: "solid", borderTopColor: BORDER, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: INK, display: "flex", alignItems: "center", gap: 6 }}>
                  <UserCircle size={14} color={GRAY_TXT} /> {d.name}
                </div>
                <div style={{ fontSize: 12, color: GRAY_TXT, marginTop: 2 }}>
                  {truck ? `Asignado a ${truck.name}` : "Sin camion asignado"}
                  {d.salary && (
                    <span style={{ marginLeft: 8, background: GREEN_LT, color: GREEN, padding: "1px 8px", borderRadius: 10, fontSize: 11 }}>
                      Salario: {fmt(d.salary)}
                    </span>
                  )}
                </div>
              </div>
              <Pencil size={14} color={GRAY_TXT} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ COMPONENTE CLIENTES CON FILTROS ============

function ClientesScreen({ data, onAddAccount, onEditAccount, onMarkPaid, onUndoPayment }) {
  const [truckFilter, setTruckFilter] = useState("all");
  const [turnoFilter, setTurnoFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [clickTimeout, setClickTimeout] = useState({});
  const listRef = useRef(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  
  let accounts = data.accounts;

  if (truckFilter !== "all" && truckFilter !== "deudores") {
    accounts = accounts.filter(a => a.truckId === truckFilter);
  }

  if (turnoFilter !== "all") {
    accounts = accounts.filter(a => a.shift === turnoFilter);
  }

  if (tipoFilter !== "all") {
    accounts = accounts.filter(a => a.tipoServicio === tipoFilter);
  }

  if (truckFilter === "deudores") {
    const getWeeks = () => {
      const weeks = [];
      const today = new Date();
      const currentWeekStart = getWeekStart(today);
      for (let i = 0; i < 4; i++) {
        const d = new Date(currentWeekStart + "T00:00:00");
        d.setDate(d.getDate() - i * 7);
        weeks.push(d.toISOString().slice(0, 10));
      }
      return weeks;
    };
    const weeks = getWeeks();
    accounts = accounts.filter(a => {
      const paidCount = data.payments.filter(p => p.accountId === a.id && weeks.includes(p.period)).length;
      return paidCount < 4;
    });
  }

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    accounts = accounts.filter(a => {
      const familyName = a.familyName.toLowerCase();
      const kids = a.kids.join(" ").toLowerCase();
      const tipo = TIPOS_SERVICIO.find(t => t.id === a.tipoServicio)?.label?.toLowerCase() || "";
      return familyName.includes(term) || kids.includes(term) || tipo.includes(term);
    });
  }

  const handleEditAccount = (account) => {
    setSelectedAccountId(account.id);
    if (listRef.current) {
      setScrollPosition(listRef.current.scrollTop || window.scrollY);
    }
    onEditAccount(account);
  };

  useEffect(() => {
    if (!selectedAccountId) {
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = scrollPosition;
        } else {
          window.scrollTo(0, scrollPosition);
        }
      }, 100);
    }
  }, [selectedAccountId, scrollPosition]);

  const getWeeks = () => {
    const weeks = [];
    const today = new Date();
    const currentWeekStart = getWeekStart(today);
    for (let i = 0; i < 4; i++) {
      const d = new Date(currentWeekStart + "T00:00:00");
      d.setDate(d.getDate() - i * 7);
      weeks.push(d.toISOString().slice(0, 10));
    }
    return weeks;
  };

  const weeks = getWeeks();
  
  const formatWeekLabel = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDate();
    const month = d.getMonth() + 1;
    return `${day}/${month}`;
  };

  const getPaymentCount = (accountId) => {
    return data.payments.filter(p => p.accountId === accountId && weeks.includes(p.period)).length;
  };

  const weeklyIncome = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalIncome = weeklyIncome;

  const truckLabel = truckId => data.trucks.find(t => t.id === truckId)?.name || "Camion eliminado";
  const driverOf = truckId => {
    const t = data.trucks.find(t => t.id === truckId);
    return t ? (data.drivers.find(d => d.id === t.driverId)?.name || "Sin asignar") : "-";
  };
  const getTipoLabel = (id) => {
    const tipo = TIPOS_SERVICIO.find(t => t.id === id);
    return tipo ? tipo.label : "Sin especificar";
  };

  const deudores = data.accounts.filter(a => getPaymentCount(a.id) < 4).length;

  const getAlumnosPorTipo = (tipoId) => {
    return data.accounts
      .filter(a => a.tipoServicio === tipoId)
      .reduce((acc, a) => acc + a.kids.filter(name => !a.kidsActive || a.kidsActive[name] !== false).length, 0);
  };

  const handleWeekClick = (accountId, week, amount, isPaid, paymentId) => {
    if (clickTimeout[accountId]) return;
    
    setClickTimeout(prev => ({ ...prev, [accountId]: true }));
    setTimeout(() => {
      setClickTimeout(prev => ({ ...prev, [accountId]: false }));
    }, 300);

    if (isPaid) {
      onUndoPayment(paymentId);
      return;
    }

    onMarkPaid(accountId, week, amount);

    const acc = data.accounts.find(a => a.id === accountId);
    if (acc && acc.familyId) {
      const siblings = data.accounts.filter(a => a.familyId === acc.familyId && a.id !== accountId);
      const pendientes = siblings.filter(s => {
        const period = currentPeriod(s);
        return !data.payments.some(p => p.accountId === s.id && p.period === period);
      });
      if (pendientes.length > 0) {
        const nombres = pendientes.map(s => s.familyName).join(", ");
        if (window.confirm(`👨‍👩‍👧‍👦 "${acc.familyName}" tiene hermano(s) vinculado(s) en otra ruta: ${nombres}.\n\n¿Marcar tambien su pago de este periodo?`)) {
          pendientes.forEach(s => onMarkPaid(s.id, currentPeriod(s), s.rate));
        }
      }
    }
  };

  const totalManana = data.accounts
    .filter(a => a.shift === "AM")
    .reduce((acc, a) => acc + a.kids.filter(name => !a.kidsActive || a.kidsActive[name] !== false).length, 0);
  const totalTarde = data.accounts
    .filter(a => a.shift === "PM")
    .reduce((acc, a) => acc + a.kids.filter(name => !a.kidsActive || a.kidsActive[name] !== false).length, 0);

  const totalAlumnos = data.accounts.reduce((acc, a) => 
    acc + a.kids.filter(name => !a.kidsActive || a.kidsActive[name] !== false).length, 0);

  return (
    <div ref={listRef}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 12, fontSize: 13, flexWrap: "wrap" }}>
          <span style={{ color: GRAY_TXT }}><b style={{ color: PURPLE }}>{totalAlumnos}</b> alumnos activos</span>
          <span style={{ color: GRAY_TXT }}><b style={{ color: INK }}>{data.accounts.length}</b> cuentas</span>
          <span style={{ color: GRAY_TXT }}><b style={{ color: BRICK }}>{deudores}</b> cuentas deben</span>
          <span style={{ color: GRAY_TXT }}><b style={{ color: GREEN }}>{fmt(totalIncome)}</b> ingresos</span>
        </div>
        <button onClick={onAddAccount} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: INK, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          <Plus size={14} /> Cuenta
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <SearchBar 
          value={searchTerm} 
          onChange={setSearchTerm} 
          placeholder="Buscar por familia, niño o tipo de servicio..."
        />
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, paddingBottom: 4, flexWrap: "wrap" }}>
        <button onClick={() => setTruckFilter("all")} style={chipBtn(truckFilter === "all")}>Todos</button>
        <button onClick={() => setTruckFilter("deudores")} style={chipBtn(truckFilter === "deudores")}>⚠️ Deudores</button>
        {data.trucks.map(t => (
          <button key={t.id} onClick={() => setTruckFilter(t.id)} style={chipBtn(truckFilter === t.id)}>{t.name}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <button 
          onClick={() => setTurnoFilter("all")} 
          style={chipBtn(turnoFilter === "all")}
        >
          Todos
        </button>
        <button 
          onClick={() => setTurnoFilter("AM")} 
          style={{ 
            ...chipBtn(turnoFilter === "AM"),
            background: turnoFilter === "AM" ? YELLOW : CHIP_BG,
            color: turnoFilter === "AM" ? INK : GRAY_TXT,
          }}
        >
          🌅 Mañana ({totalManana} alumnos)
        </button>
        <button 
          onClick={() => setTurnoFilter("PM")} 
          style={{ 
            ...chipBtn(turnoFilter === "PM"),
            background: turnoFilter === "PM" ? INK : CHIP_BG,
            color: turnoFilter === "PM" ? "#fff" : GRAY_TXT,
          }}
        >
          🌙 Tarde ({totalTarde} alumnos)
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <button 
          onClick={() => setTipoFilter("all")} 
          style={chipBtn(tipoFilter === "all")}
        >
          📚 Todos
        </button>
        {TIPOS_SERVICIO.map(tipo => {
          const count = getAlumnosPorTipo(tipo.id);
          const icon = tipo.id === "kinder" ? "🧸" : 
                       tipo.id === "escuela_dia" ? "☀️" :
                       tipo.id === "escuela_tarde" ? "🌙" :
                       tipo.id === "secundaria_dia" ? "📖" : "📚";
          return (
            <button 
              key={tipo.id}
              onClick={() => setTipoFilter(tipo.id)} 
              style={{ 
                ...chipBtn(tipoFilter === tipo.id),
                background: tipoFilter === tipo.id ? PURPLE : CHIP_BG,
                color: tipoFilter === tipo.id ? "#fff" : GRAY_TXT,
              }}
            >
              {icon} {tipo.label} ({count} alumnos)
            </button>
          );
        })}
      </div>

      <div style={{ background: CARD, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "2fr 1.2fr 1.2fr 1.2fr 1.2fr", 
          background: CHIP_BG, 
          padding: "12px 16px", 
          fontSize: 13, 
          fontWeight: 600, 
          color: GRAY_TXT,
          borderBottom: `2px solid ${BORDER}`,
          gap: 6,
        }}>
          <div>Cliente</div>
          {weeks.map((w, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 13 }}>
              Semana {4 - i}
              <div style={{ fontSize: 11, fontWeight: 400 }}>{formatWeekLabel(w)}</div>
            </div>
          ))}
        </div>

        {accounts.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: GRAY_TXT, fontSize: 13 }}>
            {searchTerm ? "No hay cuentas que coincidan con tu búsqueda." : "Sin cuentas registradas todavia."}
          </div>
        )}
        {accounts.map((a, i) => {
          const catInfo = CATEGORIES[a.category];
          const insuranceAmount = a.kids.filter(name => !a.kidsActive || a.kidsActive[name] !== false).length * 250 || a.kids.length * 250;
          const tipoLabel = getTipoLabel(a.tipoServicio);
          const isSelected = selectedAccountId === a.id;
          
          const tipoIcon = a.tipoServicio === "kinder" ? "🧸" : 
                           a.tipoServicio === "escuela_dia" ? "☀️" :
                           a.tipoServicio === "escuela_tarde" ? "🌙" :
                           a.tipoServicio === "secundaria_dia" ? "📖" : "📚";
          
          return (
            <div 
              key={a.id} 
              style={{ 
                padding: "12px 16px", 
                borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
                display: "grid",
                gridTemplateColumns: "2fr 1.2fr 1.2fr 1.2fr 1.2fr",
                gap: 6,
                alignItems: "center",
                background: isSelected ? BLUE_LT : "transparent",
                transition: "background 0.3s",
              }}
            >
              <div onClick={() => handleEditAccount(a)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{a.familyName}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 12, background: catInfo.color + "22", color: catInfo.color }}>{catInfo.label.toUpperCase()}</span>
                  {a.tipoServicio && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 12, background: PURPLE + "22", color: PURPLE }}>
                      {tipoIcon} {tipoLabel}
                    </span>
                  )}
                  {a.familyId && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 12, background: ORANGE_LT, color: ORANGE }}>
                      🔗 Familia
                    </span>
                  )}
                  <span style={{ 
                    fontSize: 9, 
                    fontWeight: 700, 
                    padding: "1px 6px", 
                    borderRadius: 12, 
                    background: a.shift === "AM" ? YELLOW + "44" : INK + "22",
                    color: a.shift === "AM" ? INK : "#fff",
                  }}>
                    {a.shift === "AM" ? "🌅" : "🌙"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: GRAY_TXT }}>
                  {a.kids.join(", ")} · {truckLabel(a.truckId)} ({a.shift === "AM" ? "Mañana" : "Tarde"})
                </div>
                <div style={{ fontSize: 10, color: GRAY_TXT }}>
                  {fmt(a.rate)}/{a.frequency === "mensual" ? "mes" : "sem"} · Seguro: ${insuranceAmount}
                </div>
              </div>

              {weeks.map((week, wi) => {
                const payment = data.payments.find(p => p.accountId === a.id && p.period === week);
                const isPaid = !!payment;
                
                return (
                  <div key={wi} style={{ textAlign: "center" }}>
                    <button 
                      onClick={() => handleWeekClick(a.id, week, a.rate, isPaid, payment?.id)}
                      disabled={clickTimeout[a.id]}
                      style={{ 
                        width: "100%", 
                        padding: "12px 8px", 
                        borderRadius: 8, 
                        border: isPaid ? `2px solid ${GREEN}` : `2px dashed ${BORDER}`, 
                        background: isPaid ? GREEN_LT : "transparent", 
                        color: isPaid ? GREEN : GRAY_TXT, 
                        cursor: "pointer", 
                        fontSize: 16, 
                        fontWeight: 700,
                        fontFamily: "'Inter', sans-serif",
                        transition: "all 0.2s",
                        minHeight: 48,
                        opacity: clickTimeout[a.id] ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isPaid) {
                          e.currentTarget.style.border = `2px solid ${BRICK}`;
                          e.currentTarget.style.background = BRICK_LT;
                          e.currentTarget.style.color = BRICK;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isPaid) {
                          e.currentTarget.style.border = `2px dashed ${BORDER}`;
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = GRAY_TXT;
                        }
                      }}
                    >
                      {isPaid ? "✅ Pagado" : "⬜ Pendiente"}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: GRAY_TXT, marginTop: 8, textAlign: "center" }}>
        {accounts.length} cuentas mostradas · {totalAlumnos} alumnos totales
      </div>
    </div>
  );
}

// ============ COMPONENTE TRUCK VIEW ============

function TruckView({ truck, data, onAddExpense }) {
  const driverName = data.drivers.find(d => d.id === truck.driverId)?.name || "Sin asignar";
  const accIds = data.accounts.filter(a => a.truckId === truck.id).map(a => a.id);
  const payments = data.payments.filter(p => accIds.includes(p.accountId));
  const expenses = data.expenses.filter(e => e.truckId === truck.id).sort((a, b) => b.date.localeCompare(a.date));
  const inc = payments.reduce((s, p) => s + p.amount, 0);
  const exp = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div style={{ background: CARD, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: INK }}>{truck.name}</div>
          <div style={{ fontSize: 12, color: GRAY_TXT, display: "flex", alignItems: "center", gap: 4 }}><Users size={13} /> Chofer: {driverName}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: GRAY_TXT }}>Balance</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: inc - exp >= 0 ? GREEN : BRICK }}>{fmt(inc - exp)}</div>
        </div>
      </div>

      <button onClick={() => onAddExpense("AM")} style={{ ...btnStyle, background: ORANGE, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Plus size={15} /> Registrar gasto
      </button>

      {(() => {
        const genExp = expenses.filter(e => e.shift === "GENERAL");
        const gExp = genExp.reduce((s, e) => s + e.amount, 0);
        if (genExp.length === 0) return null;
        return (
          <div style={{ background: CARD, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: INK, letterSpacing: 0.5, marginBottom: 8 }}>GASTOS GENERALES (no ligados a un turno)</div>
            <div style={{ fontSize: 13, marginBottom: 8 }}><span style={{ color: GRAY_TXT }}>Total: </span><b style={{ color: BRICK }}>{fmt(gExp)}</b></div>
            {genExp.map(e => {
              const cat = CATS.find(c => c.id === e.category);
              const Icon = cat ? cat.icon : Wallet;
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${BORDER}`, fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: INK }}>
                    <Icon size={14} color={GRAY_TXT} /> {cat ? cat.label : "Gasto"} <span style={{ color: GRAY_TXT, fontSize: 11 }}>{e.date}</span>
                  </div>
                  <span style={{ color: BRICK, fontWeight: 600 }}>-{fmt(e.amount)}</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {["AM", "PM"].map(shift => {
        const shiftExp = expenses.filter(e => e.shift === shift);
        const shiftAccIds = data.accounts.filter(a => a.truckId === truck.id && a.shift === shift).map(a => a.id);
        const sInc = payments.filter(p => shiftAccIds.includes(p.accountId)).reduce((s, p) => s + p.amount, 0);
        const sExp = shiftExp.reduce((s, e) => s + e.amount, 0);
        return (
          <div key={shift} style={{ background: CARD, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <RouteStrip shift={shift} />
            <div style={{ display: "flex", gap: 20, margin: "10px 0", fontSize: 13 }}>
              <div><span style={{ color: GRAY_TXT }}>Ingresos: </span><b style={{ color: GREEN }}>{fmt(sInc)}</b></div>
              <div><span style={{ color: GRAY_TXT }}>Gastos: </span><b style={{ color: BRICK }}>{fmt(sExp)}</b></div>
            </div>
            {shiftExp.slice(0, 4).map(e => {
              const cat = CATS.find(c => c.id === e.category);
              const Icon = cat ? cat.icon : Wallet;
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${BORDER}`, fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: INK }}>
                    <Icon size={14} color={GRAY_TXT} /> {cat ? cat.label : "Gasto"} <span style={{ color: GRAY_TXT, fontSize: 11 }}>{e.date}</span>
                  </div>
                  <span style={{ color: BRICK, fontWeight: 600 }}>-{fmt(e.amount)}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ============ COMPONENTE TRUCK FORM ============

function TruckForm({ truck, drivers, onSubmit, onDelete }) {
  const [name, setName] = useState(truck?.name || "");
  const [driverId, setDriverId] = useState(truck?.driverId || "");
  const [error, setError] = useState("");

  function submit() {
    if (!name.trim()) { setError("Ponle un nombre al camion."); return; }
    onSubmit({ name: name.trim(), driverId: driverId || null });
  }

  return (
    <div>
      <label style={labelStyle}>Nombre del camion</label>
      <input style={inputStyle} placeholder="Ej. Camion 1, Unidad Roja..." value={name} onChange={e => setName(e.target.value)} />
      <label style={labelStyle}>Chofer asignado</label>
      <select style={inputStyle} value={driverId} onChange={e => setDriverId(e.target.value)}>
        <option value="">Sin asignar</option>
        {drivers.map(d => <option key={d.id} value={d.id}>{d.name} {d.salary ? `(${fmt(d.salary)})` : ""}</option>)}
      </select>
      {error && <div style={{ color: BRICK, fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <button style={{ ...btnStyle, background: GREEN, marginBottom: onDelete ? 8 : 0 }} onClick={submit}>Guardar camion</button>
      {onDelete && (
        <button onClick={onDelete} style={{ ...btnStyle, background: BRICK_LT, color: BRICK, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Trash2 size={14} /> Eliminar camion
        </button>
      )}
    </div>
  );
}

// ============ COMPONENTE DRIVER FORM ============

function DriverForm({ driver, onSubmit, onDelete }) {
  const [name, setName] = useState(driver?.name || "");
  const [salary, setSalary] = useState(driver?.salary || "");
  const [error, setError] = useState("");

  function submit() {
    if (!name.trim()) { setError("Escribe el nombre del chofer."); return; }
    onSubmit({ name: name.trim(), salary: salary ? Number(salary) : 0 });
  }

  return (
    <div>
      <label style={labelStyle}>Nombre del chofer</label>
      <input style={inputStyle} placeholder="Nombre completo" value={name} onChange={e => setName(e.target.value)} />
      
      <label style={labelStyle}>Salario (por semana)</label>
      <input style={inputStyle} type="number" placeholder="Ej. 1800" value={salary} onChange={e => setSalary(e.target.value)} />
      <div style={{ fontSize: 11, color: GRAY_TXT, marginBottom: 12 }}>Dejar en blanco o 0 si no aplica</div>
      
      {error && <div style={{ color: BRICK, fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <button style={{ ...btnStyle, background: GREEN, marginBottom: onDelete ? 8 : 0 }} onClick={submit}>Guardar chofer</button>
      {onDelete && (
        <button onClick={onDelete} style={{ ...btnStyle, background: BRICK_LT, color: BRICK, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Trash2 size={14} /> Eliminar chofer
        </button>
      )}
    </div>
  );
}

// ============ ACCOUNT FORM ============

function AccountForm({ account, trucks, allAccounts, onSubmit, onDelete, onLinkFamily, onUnlinkFamily }) {
  function apellidoFrom(nombreCompleto) {
    const parts = nombreCompleto.trim().split(" ").filter(Boolean);
    return parts.length > 1 ? parts.slice(1).join(" ") : parts[0] || "";
  }

  function familyLabel(studentsList) {
    const named = studentsList.filter(s => s.name && s.name.trim());
    if (named.length === 0) return "";
    if (named.length === 1) return named[0].name.trim();
    const apellido = apellidoFrom(named[0].name);
    return `Hermanos ${apellido}`;
  }

  const initialStudents = account?.kids?.length
    ? account.kids.map(name => ({ id: uid(), name, active: account.kidsActive ? account.kidsActive[name] !== false : true }))
    : [{ id: uid(), name: "", active: true }];

  const [students, setStudents] = useState(initialStudents);
  const [truckId, setTruckId] = useState(account?.truckId || trucks[0]?.id || "");
  const [shift, setShift] = useState(account?.shift || "AM");
  const [category, setCategory] = useState(account?.category || "normal");
  const [frequency, setFrequency] = useState(account?.frequency || "semanal");
  const [rate, setRate] = useState(account?.rate || 260);
  const [rateTouched, setRateTouched] = useState(!!account);
  const [tipoServicio, setTipoServicio] = useState(account?.tipoServicio || "escuela_dia");
  const [error, setError] = useState("");

  const activeStudents = students.filter(s => s.active && s.name.trim());
  const totalActive = activeStudents.length || 1;
  const familyNamePreview = familyLabel(students);

  useEffect(() => {
    if (!rateTouched) setRate(suggestedRate(category, totalActive));
  }, [totalActive, category, rateTouched]);

  function updateStudentName(id, name) {
    setStudents(students.map(s => s.id === id ? { ...s, name } : s));
    setRateTouched(false);
  }

  function addStudent() {
    setStudents([...students, { id: uid(), name: "", active: true }]);
    setRateTouched(false);
  }

  function toggleBaja(id) {
    const s = students.find(x => x.id === id);
    const verb = s.active ? "dar de baja a" : "reactivar a";
    if (!window.confirm(`¿Seguro que quieres ${verb} "${s.name || "este alumno"}"?\n\nLa tarifa y el seguro de la cuenta se recalculan automaticamente.`)) return;
    setStudents(students.map(x => x.id === id ? { ...x, active: !x.active } : x));
    setRateTouched(false);
  }

  function removeStudentDraft(id) {
    setStudents(students.filter(x => x.id !== id));
  }

  function submit() {
    const named = students.filter(s => s.name.trim());
    if (named.length === 0) {
      setError("Agrega al menos un alumno.");
      return;
    }
    if (activeStudents.length === 0) {
      setError("No puedes guardar una cuenta con todos los alumnos dados de baja.");
      return;
    }

    const kidsActive = {};
    named.forEach(s => { kidsActive[s.name.trim()] = s.active; });

    onSubmit({
      familyName: familyLabel(named),
      kids: named.map(s => s.name.trim()),
      kidsActive,
      truckId,
      shift,
      category,
      frequency,
      rate: Number(rate),
      insurancePaid: account?.insurancePaid || false,
      insuranceDate: account?.insuranceDate || null,
      tipoServicio,
    });
  }

  function handleDelete() {
    const nombre = familyNamePreview || students[0]?.name;
    if (window.confirm(`⚠️ ¿Eliminar la cuenta de "${nombre}"?\n\nEsta accion NO se puede deshacer.\n\n¿Estas seguro?`)) {
      if (window.confirm(`¿ELIMINAR PERMANENTEMENTE a "${nombre}"?\n\nSe borraran TODOS los datos de esta cuenta.`)) {
        onDelete();
      }
    }
  }

  const ActionButtons = () => (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <button style={{ ...btnStyle, background: GREEN, flex: 1, padding: "12px", fontSize: 15 }} onClick={submit}>
        💾 Guardar cambios
      </button>
      {account && (
        <button onClick={handleDelete} style={{ ...btnStyle, background: BRICK_LT, color: BRICK, flex: 0.6, padding: "12px", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Trash2 size={16} /> Eliminar
        </button>
      )}
    </div>
  );

  return (
    <div>
      <ActionButtons />
      <hr style={{ margin: "16px 0", border: "none", borderTop: `1px solid ${BORDER}` }} />

      <label style={labelStyle}>📚 Tipo de servicio</label>
      <select style={inputStyle} value={tipoServicio} onChange={e => setTipoServicio(e.target.value)}>
        {TIPOS_SERVICIO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>

      <label style={labelStyle}>👨‍👩‍👧‍👦 Alumnos en esta cuenta</label>
      <div style={{ fontSize: 11, color: GRAY_TXT, marginTop: -2, marginBottom: 8 }}>
        Todos comparten el mismo camion, turno y cobro.
      </div>
      {students.map((s, i) => (
        <div key={s.id} style={{
          display: "flex", gap: 6, marginBottom: 8, alignItems: "center",
          opacity: s.active ? 1 : 0.55,
        }}>
          <input
            style={{ ...inputStyle, marginBottom: 0, textDecoration: s.active ? "none" : "line-through" }}
            placeholder={i === 0 ? "Nombre del alumno principal" : `Hermano ${i}`}
            value={s.name}
            onChange={e => updateStudentName(s.id, e.target.value)}
          />
          {s.name.trim() ? (
            <button
              onClick={() => toggleBaja(s.id)}
              title={s.active ? "Dar de baja" : "Reactivar"}
              style={{
                border: "none", borderRadius: 8, width: 40, height: 38, cursor: "pointer",
                background: s.active ? BRICK_LT : GREEN_LT, color: s.active ? BRICK : GREEN,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              {s.active ? <UserX size={16} /> : <Check size={16} />}
            </button>
          ) : students.length > 1 && (
            <button onClick={() => removeStudentDraft(s.id)} style={{ border: "none", background: BRICK_LT, color: BRICK, borderRadius: 8, width: 40, height: 38, cursor: "pointer", flexShrink: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button onClick={addStudent} style={{ ...btnStyle, background: CHIP_BG, color: INK, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Plus size={14} /> Agregar hermano
      </button>

      {onLinkFamily && <FamilyLinkBox account={account} allAccounts={allAccounts} onLinkFamily={onLinkFamily} onUnlinkFamily={onUnlinkFamily} />}

      {familyNamePreview && (
        <div style={{ fontSize: 11, color: GRAY_TXT, marginBottom: 14 }}>
          🏠 Se mostrara como "<b>{familyNamePreview}</b>"
        </div>
      )}

      <label style={labelStyle}>🚚 Camion y turno</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select style={{ ...inputStyle, marginBottom: 0 }} value={truckId} onChange={e => setTruckId(e.target.value)}>
          {trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select style={{ ...inputStyle, marginBottom: 0 }} value={shift} onChange={e => setShift(e.target.value)}>
          <option value="AM">Mañana</option>
          <option value="PM">Tarde</option>
        </select>
      </div>

      <label style={labelStyle}>💰 Categoria de cobro</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {Object.entries(CATEGORIES).map(([id, c]) => (
          <button key={id} onClick={() => { setCategory(id); setRateTouched(false); }} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Inter', sans-serif", background: category === id ? c.color : CHIP_BG, color: category === id ? "#fff" : GRAY_TXT }}>
            {c.label}
          </button>
        ))}
      </div>

      <label style={labelStyle}>📅 Frecuencia de pago</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setFrequency("semanal")} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Inter', sans-serif", background: frequency === "semanal" ? INK : CHIP_BG, color: frequency === "semanal" ? "#fff" : GRAY_TXT }}>Semanal</button>
        <button onClick={() => setFrequency("mensual")} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Inter', sans-serif", background: frequency === "mensual" ? INK : CHIP_BG, color: frequency === "mensual" ? "#fff" : GRAY_TXT }}>Mensual</button>
      </div>

      <label style={labelStyle}>💰 Tarifa ({frequency === "mensual" ? "por mes" : "por semana"})</label>
      <input style={inputStyle} type="number" value={rate} onChange={e => { setRate(e.target.value); setRateTouched(true); }} />
      <div style={{ fontSize: 11, color: GRAY_TXT, marginTop: -6, marginBottom: 12 }}>
        Sugerido para {totalActive} alumno(s) activo(s): ${suggestedRate(category, totalActive) || "—"}
      </div>

      <div style={{ background: BLUE_LT, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: BLUE, display: "flex", alignItems: "center", gap: 6 }}>
          <Shield size={14} /> Seguro anual
        </div>
        <div style={{ fontSize: 13, color: INK }}>
          Costo: <b>${250 * totalActive}</b> por {totalActive} alumno(s) activo(s) (${250} cada uno)
        </div>
        <div style={{ fontSize: 11, color: GRAY_TXT, marginTop: 4 }}>
          {account?.insurancePaid ? (
            <span style={{ color: GREEN }}>✓ Seguro pagado el {account.insuranceDate}</span>
          ) : (
            <span>Pendiente de pago</span>
          )}
        </div>
      </div>

      {error && <div style={{ color: BRICK, fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <hr style={{ margin: "16px 0", border: "none", borderTop: `1px solid ${BORDER}` }} />
      <ActionButtons />
    </div>
  );
}

// ============ VINCULAR HERMANO EN OTRA RUTA (familia) ============
function FamilyLinkBox({ account, allAccounts, onLinkFamily, onUnlinkFamily }) {
  const [selected, setSelected] = useState("");
  if (!account) return null;

  const siblings = (allAccounts || []).filter(a => a.familyId && a.familyId === account.familyId && a.id !== account.id);
  const candidatos = (allAccounts || []).filter(a =>
    a.id !== account.id && (!a.familyId || a.familyId !== account.familyId)
  );

  function linkNow() {
    if (!selected) return;
    onLinkFamily(selected);
    setSelected("");
  }

  return (
    <div style={{ background: ORANGE_LT, borderRadius: 10, padding: 12, marginBottom: 14, border: `1px solid ${ORANGE}55` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: ORANGE, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        🔗 Hermano(s) en otra ruta o turno
      </div>
      <div style={{ fontSize: 11, color: GRAY_TXT, marginBottom: 10 }}>
        Solo si un hermano va en otro camion, turno o tipo de servicio.
      </div>

      {siblings.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {siblings.map(s => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: CARD, borderRadius: 8, padding: "6px 10px", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: INK }}>{s.familyName} — {s.kids.join(", ")}</span>
            </div>
          ))}
          <button onClick={onUnlinkFamily} style={{ ...btnStyle, background: "transparent", color: BRICK, border: `1px dashed ${BRICK}`, padding: "6px", fontSize: 11 }}>
            Desvincular esta cuenta del grupo
          </button>
        </div>
      )}

      {candidatos.length > 0 ? (
        <div style={{ display: "flex", gap: 6 }}>
          <select style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">Vincular con cuenta existente...</option>
            {candidatos.map(a => (
              <option key={a.id} value={a.id}>{a.familyName} — {a.kids.join(", ")}</option>
            ))}
          </select>
          <button onClick={linkNow} disabled={!selected} style={{ padding: "0 14px", borderRadius: 8, border: "none", background: selected ? ORANGE : CHIP_BG, color: selected ? "#fff" : GRAY_TXT, cursor: selected ? "pointer" : "default", fontSize: 12, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
            Vincular
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: GRAY_TXT }}>No hay otras cuentas para vincular todavia.</div>
      )}
    </div>
  );
}