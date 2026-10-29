// Capa de datos: la misma API funciona contra Supabase (modo real)
// o contra el navegador (modo demo, cuando config.js está vacío).
import { SPLIT, LIB } from "./routines.js";

const cfg = window.ITC_CONFIG || {};
export const LIVE = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
// La clave correcta es la "anon public" (empieza con eyJ…) o la "publishable" (sb_publishable_…).
export const CONFIG_ERROR = LIVE && !/^(eyJ|sb_publishable_)/.test(String(cfg.supabaseAnonKey).trim())
  ? "La clave de Supabase en config.js no es la correcta. Copiá la “anon public” (empieza con eyJ…) desde Supabase → Project Settings → API."
  : "";
// ¿Corre dentro de la app de iOS/Android (Capacitor)?
export const NATIVE = Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const SCHEME = "ar.irusta.trainingclub";
const DEEP_LINK = SCHEME + "://auth";

/* ------------------------------------------------------------------ */
/* utilidades de fecha (día local, formato YYYY-MM-DD)                  */
/* ------------------------------------------------------------------ */
export const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const monthKey = (d) => ymd(d).slice(0, 7);

/* ------------------------------------------------------------------ */
/* MODO REAL: Supabase                                                  */
/* ------------------------------------------------------------------ */
async function liveStore() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !NATIVE, flowType: NATIVE ? "pkce" : "implicit" },
  });
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const back = () => (NATIVE ? DEEP_LINK : location.origin + location.pathname);

  // En la app nativa, Google no deja loguearse dentro de la app: abrimos el
  // navegador del sistema y volvemos con ar.irusta.trainingclub://auth?code=…
  if (NATIVE) {
    const App = window.Capacitor.registerPlugin("App");
    App.addListener("appUrlOpen", async ({ url }) => {
      if (!url || !url.startsWith(SCHEME)) return;
      const q = new URL(url.replace(SCHEME + "://", "https://x/"));
      const code = q.searchParams.get("code");
      try { if (code) await sb.auth.exchangeCodeForSession(code); } catch (e) { console.error(e); }
      try { await Browser.close(); } catch (e) {}
    });
  }
  const Browser = NATIVE ? window.Capacitor.registerPlugin("Browser") : null;
  async function oauth(provider) {
    if (!NATIVE) return ok(await sb.auth.signInWithOAuth({ provider, options: { redirectTo: back() } }));
    const data = ok(await sb.auth.signInWithOAuth({ provider, options: { redirectTo: DEEP_LINK, skipBrowserRedirect: true } }));
    await Browser.open({ url: data.url, presentationStyle: "popover" });
  }

  return {
    mode: "live",
    async session() { const { data } = await sb.auth.getSession(); return data.session ? { email: data.session.user.email } : null; },
    onAuth(cb) { sb.auth.onAuthStateChange((_e, s) => cb(s ? { email: s.user.email } : null)); },
    async signInGoogle() { await oauth("google"); },
    async signInEmail(email) { ok(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back() } })); },
    async signOut() { await sb.auth.signOut(); },
    async whoami() { return ok(await sb.rpc("whoami")); },

    async settings() { return ok(await sb.from("settings").select("*").eq("id", 1).single()); },
    async saveSettings(p) { return ok(await sb.from("settings").update({ ...p, updated_at: new Date().toISOString() }).eq("id", 1).select().single()); },

    async students() { return ok(await sb.from("students").select("*").order("name")); },
    async saveStudent(s) {
      const row = { ...s }; if (!row.id) delete row.id;
      return ok(await sb.from("students").upsert(row).select().single());
    },
    async patchStudents(list) { for (const { id, ...p } of list) ok(await sb.from("students").update(p).eq("id", id)); },
    async deleteStudent(id) { ok(await sb.from("students").delete().eq("id", id)); },
    async importStudents(rows) { return ok(await sb.from("students").insert(rows).select()); },

    async replies(day) { return ok(await sb.from("replies").select("student_id,reply").eq("day", day)); },
    async setReply(day, reply) { ok(await sb.rpc("set_reply", { p_day: day, p_reply: reply })); },

    async payments(month) { return ok(await sb.from("payments").select("*").eq("month", month)); },
    async myPayments() { return ok(await sb.from("payments").select("*").order("month", { ascending: false }).limit(12)); },
    async setPayment(student_id, month, status, amount) {
      ok(await sb.from("payments").upsert({ student_id, month, status, amount, updated_at: new Date().toISOString() }));
    },
    async informPayment(month, amount) { ok(await sb.rpc("inform_payment", { p_month: month, p_amount: amount })); },

    async weights(ids) {
      let q = sb.from("weights").select("student_id,exercise,value,day,created_at").order("created_at", { ascending: true }).limit(5000);
      if (ids) q = q.in("student_id", ids);
      return ok(await q);
    },
    async addWeights(rows) { if (rows.length) ok(await sb.from("weights").insert(rows)); },

    async sessions(from, to) { return ok(await sb.from("sessions").select("*").gte("day", from).lte("day", to)); },
    async addSessions(rows) { if (rows.length) ok(await sb.from("sessions").insert(rows)); },

    async requests(since) { return ok(await sb.from("requests").select("*").gte("to_day", since).order("created_at")); },
    async createRequest(r) { ok(await sb.from("requests").insert(r)); },
    async setRequest(id, status) { ok(await sb.from("requests").update({ status }).eq("id", id)); },

    async suspensions(since) { return ok(await sb.from("suspensions").select("*").gte("day", since)); },
    async addSuspensions(rows) { if (rows.length) ok(await sb.from("suspensions").upsert(rows)); },

    async occupancy() { return ok(await sb.rpc("occupancy")); },
  };
}

/* ------------------------------------------------------------------ */
/* MODO DEMO: todo en el navegador, con alumnos inventados              */
/* ------------------------------------------------------------------ */
const DEMO_KEY = "itc-demo-db-v2";
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

function rnd(seed) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
}

const BASE_KG = {
  "Sentadilla con barra": 50, "Sentadilla húngara": 20, "Estocadas": 12, "Press militar mancuernas": 14,
  "Vuelos laterales 10 + sissy 12": 6, "Remo supino con barra": 40, "Remo 1 brazo 10 + pullover 12": 18,
  "Bíceps parado barra W": 25, "Martillo alternado": 12, "Press plano con barra": 40,
  "Inclinado manc. 8 + aperturas 12": 14, "Francés con mancuerna": 12, "Romano manc. 10 + fondos en banco 15": 10,
};

function demoSeed() {
  const today = new Date();
  const roster = [
    ["Tom", 3, [[2, "08:00"], [3, "08:00"], [4, "08:00"]], 1.0],
    ["Carla", 3, [[1, "08:00"], [3, "08:00"], [4, "08:00"]], 0.8],
    ["Mateo", 2, [[2, "08:00"], [4, "08:00"]], 1.1],
    ["Lola", 2, [[2, "08:00"], [4, "08:00"]], 0.75],
    ["Bruno", 3, [[1, "09:00"], [3, "09:00"], [5, "09:00"]], 0.8],
    ["Paula", 3, [[2, "09:00"], [4, "09:00"], [5, "09:00"]], 0.85],
    ["Santi", 3, [[1, "09:00"], [3, "09:00"], [4, "09:00"]], 1.05],
    ["Delfi", 2, [[3, "09:00"], [4, "09:00"]], 0.7],
    ["Inés", 2, [[2, "09:00"], [4, "09:00"]], 0.75],
    ["Fran", 3, [[1, "09:00"], [3, "09:00"], [4, "09:00"]], 1.15],
    ["Hernán", 1, [[4, "09:00"]], 0.9],
    ["Julia", 2, [[2, "10:00"], [4, "10:00"]], 0.7],
    ["Martina", 2, [[1, "10:00"], [3, "10:00"]], 0.75],
    ["Rocío", 1, [[5, "10:00"]], 0.7],
    ["Nacho", 2, [[2, "17:00"], [4, "17:00"]], 1.0],
    ["Lucas", 1, [[4, "17:00"]], 1.0],
    ["Agus", 3, [[1, "18:00"], [3, "18:00"], [4, "18:00"]], 1.05],
    ["Vicky", 2, [[2, "18:00"], [4, "18:00"]], 0.75],
    ["Ramiro", 2, [[1, "18:00"], [4, "18:00"]], 1.0],
    ["Sofi", 2, [[2, "18:00"], [5, "18:00"]], 0.75],
    ["Gonza", 3, [[1, "19:00"], [3, "19:00"], [5, "19:00"]], 1.1],
    ["Emi", 2, [[2, "19:00"], [5, "19:00"]], 1.0],
  ];
  const db = { admins: ["juan@demo"], settings: null, students: [], replies: [], payments: [], weights: [], sessions: [], requests: [], suspensions: [] };
  db.settings = {
    id: 1, spot: "rio", rates: { 1: 9000, 2: 8500, 3: 8000 }, alias: "irusta.juan.ignacio", bank: "Banco Francés",
    buen_dia: "Buennnn díaaaa {nombre}!! 🤜⚡️🤛\nHoy te espero {hora} en {spot}. Confirmá acá: {link}", app_url: "",
  };
  const month = monthKey(today);
  roster.forEach(([name, freq, sched, mult], i) => {
    const r = rnd(name);
    const id = uid();
    const split = SPLIT[freq];
    db.students.push({
      id, name, freq, split, sched: sched.map(([d, t]) => ({ d, t })), next_idx: Math.floor(r() * split.length),
      recover: i === 3 ? 1 : 0, active: true, notes: "",
      phone: "11 " + (4000 + Math.floor(r() * 5000)) + " " + (1000 + Math.floor(r() * 8999)),
      email: name === "Tom" ? "tom@demo" : name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "") + "@demo",
    });
    split.forEach((g) => LIB[g].forEach((ex) => {
      const rr = rnd(name + ex.n);
      let v = ex.bw ? 6 + Math.round(rr() * 3) : Math.max(2.5, Math.round(((BASE_KG[ex.n] || 10) * mult) / 2.5) * 2.5 - 7.5);
      for (let k = 5; k >= 0; k--) {
        const day = ymd(addDays(today, -7 * k - 1));
        db.weights.push({ student_id: id, exercise: ex.n, value: v, day, created_at: day + "T09:00:00Z" });
        if (rr() > 0.45) v += ex.bw ? 1 : 2.5;
      }
    }));
    const pay = [4, 9, 15, 20].includes(i) ? "pending" : [13, 14].includes(i) ? "informed" : "paid";
    db.payments.push({ student_id: id, month, status: pay, amount: null });
    if (name !== "Tom" && r() > 0.25) db.replies.push({ student_id: id, day: ymd(today), reply: r() > 0.85 ? "tarde" : r() > 0.9 ? "no" : "voy" });
  });
  // historial del mes para Tom
  const tom = db.students[0];
  for (let k = 1; k <= 26; k++) {
    const d = addDays(today, -k);
    if (d.getMonth() !== today.getMonth()) break;
    if (tom.sched.some((x) => x.d === d.getDay())) db.sessions.push({ id: uid(), student_id: tom.id, day: ymd(d), slot: "08:00", group_name: "", kind: "done" });
  }
  // dos pedidos pendientes
  const nextWd = (n) => { let d = addDays(today, n); while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1); return d; };
  db.requests.push({ id: uid(), student_id: db.students[16].id, from_day: ymd(nextWd(0)), from_slot: "18:00", to_day: ymd(nextWd(1)), to_slot: "18:00", reason: "Me surgió una reunión", status: "pending", created_at: new Date().toISOString() });
  db.requests.push({ id: uid(), student_id: db.students[3].id, from_day: null, from_slot: null, to_day: ymd(nextWd(1)), to_slot: "09:00", reason: "Recupera una clase", status: "pending", created_at: new Date().toISOString() });
  return db;
}

function demoStore() {
  let db;
  try { db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) { db = null; }
  if (!db || !db.students) db = demoSeed();
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) {} };
  let who = null; try { who = localStorage.getItem("itc-demo-who"); } catch (e) {}
  const cbs = [];
  const me = () => who === "student" ? db.students.find((s) => s.email === "tom@demo") : null;
  const isAdmin = () => who === "admin";
  const mine = (rows) => isAdmin() ? rows : rows.filter((r) => me() && r.student_id === me().id);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  save();

  return {
    mode: "demo",
    demoAs(role) { who = role; try { localStorage.setItem("itc-demo-who", role || ""); } catch (e) {} cbs.forEach((cb) => cb(role ? { email: role === "admin" ? "juan@demo" : "tom@demo" } : null)); },
    demoReset() { db = demoSeed(); save(); },
    async session() { return who ? { email: who === "admin" ? "juan@demo" : "tom@demo" } : null; },
    onAuth(cb) { cbs.push(cb); },
    async signInGoogle() { throw new Error("En modo demo usá los botones de prueba"); },
    async signInEmail() { throw new Error("En modo demo usá los botones de prueba"); },
    async signOut() { this.demoAs(null); },
    async whoami() { return { email: who === "admin" ? "juan@demo" : "tom@demo", admin: isAdmin(), student: me() ? clone(me()) : null }; },

    async settings() { return clone(db.settings); },
    async saveSettings(p) { Object.assign(db.settings, p); save(); return clone(db.settings); },

    async students() { return clone(isAdmin() ? db.students : db.students.filter((s) => s === me())).sort((a, b) => a.name.localeCompare(b.name)); },
    async saveStudent(s) {
      if (!isAdmin()) throw new Error("No autorizado");
      if (s.email && db.students.some((x) => x.email === s.email && x.id !== s.id)) throw new Error("Ese email ya lo tiene otro alumno");
      let row = db.students.find((x) => x.id === s.id);
      if (row) Object.assign(row, s); else { row = { recover: 0, next_idx: 0, active: true, ...s, id: uid() }; db.students.push(row); }
      save(); return clone(row);
    },
    async patchStudents(list) { list.forEach(({ id, ...p }) => Object.assign(db.students.find((s) => s.id === id) || {}, p)); save(); },
    async deleteStudent(id) { db.students = db.students.filter((s) => s.id !== id); save(); },
    async importStudents(rows) { const out = []; for (const r of rows) out.push(await this.saveStudent(r)); return out; },

    async replies(day) { return clone(mine(db.replies.filter((r) => r.day === day))); },
    async setReply(day, reply) {
      const m = me(); if (!m) throw new Error("No autorizado");
      const prev = db.replies.find((r) => r.student_id === m.id && r.day === day);
      if (reply === "no" && (!prev || prev.reply !== "no")) m.recover++;
      else if (prev && prev.reply === "no" && reply !== "no") m.recover = Math.max(0, m.recover - 1);
      if (prev) prev.reply = reply; else db.replies.push({ student_id: m.id, day, reply });
      save();
    },

    async payments(month) { return clone(mine(db.payments.filter((p) => p.month === month))); },
    async myPayments() { return clone(mine(db.payments)).sort((a, b) => b.month.localeCompare(a.month)); },
    async setPayment(student_id, month, status, amount) {
      const p = db.payments.find((x) => x.student_id === student_id && x.month === month);
      if (p) Object.assign(p, { status, amount }); else db.payments.push({ student_id, month, status, amount }); save();
    },
    async informPayment(month, amount) {
      const m = me(); const p = db.payments.find((x) => x.student_id === m.id && x.month === month);
      if (p) { if (p.status !== "paid") p.status = "informed"; p.amount = amount; } else db.payments.push({ student_id: m.id, month, status: "informed", amount }); save();
    },

    async weights(ids) { return clone(mine(db.weights).filter((w) => !ids || ids.includes(w.student_id))); },
    async addWeights(rows) { rows.forEach((r) => db.weights.push({ day: ymd(new Date()), created_at: new Date().toISOString(), ...r })); save(); },

    async sessions(from, to) { return clone(mine(db.sessions).filter((s) => s.day >= from && s.day <= to)); },
    async addSessions(rows) { rows.forEach((r) => db.sessions.push({ id: uid(), kind: "done", ...r })); save(); },

    async requests(since) { return clone(mine(db.requests).filter((r) => r.to_day >= since)); },
    async createRequest(r) { db.requests.push({ id: uid(), status: "pending", created_at: new Date().toISOString(), student_id: me().id, ...r }); save(); },
    async setRequest(id, status) { const r = db.requests.find((x) => x.id === id); if (r) r.status = status; save(); },

    async suspensions(since) { return clone(db.suspensions.filter((s) => s.day >= since)); },
    async addSuspensions(rows) { rows.forEach((r) => { if (!db.suspensions.some((s) => s.day === r.day && s.slot === r.slot)) db.suspensions.push(r); }); save(); },

    async occupancy() {
      return {
        scheds: db.students.filter((s) => s.active).map((s) => ({ id: s.id, sched: s.sched })),
        moves: db.requests.filter((r) => r.status === "ok").map(({ student_id, from_day, from_slot, to_day, to_slot }) => ({ id: student_id, from_day, from_slot, to_day, to_slot })),
        suspensions: clone(db.suspensions),
      };
    },
  };
}

export async function createStore() { return LIVE ? liveStore() : demoStore(); }
