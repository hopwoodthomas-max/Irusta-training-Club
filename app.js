// Irusta Training Club — app
import { createStore, LIVE, ymd, parseDay, addDays, monthKey } from "./data.js";
import { ABS, SPLIT, CARDIO, GROUPS, exercisesFor } from "./routines.js";

/* ================================================================== */
/* constantes y helpers                                                */
/* ================================================================== */
const SLOTS = ["08:00", "09:00", "10:00", "17:00", "18:00", "19:00"];
const CAP = 7;
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DOWL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MON = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const TDAY = ymd(TODAY), TDOW = TODAY.getDay(), MONTH = monthKey(TODAY);
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
const ini = (n) => String(n || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const monthName = (k) => MON[+k.slice(5, 7) - 1];
const nextMonth = (k) => { const d = new Date(+k.slice(0, 4), +k.slice(5, 7), 1); return monthKey(d); };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// WhatsApp: número argentino a formato wa.me (549 + área + número)
function waNumber(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("54")) { d = d.slice(2); if (!d.startsWith("9")) d = "9" + d; return "54" + d; }
  if (d.length === 10) return "549" + d;   // 11 2345 6789
  return d;
}
const waLink = (phone, text) => { const n = waNumber(phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : ""; };
const waShare = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
const appLink = () => (S.settings && S.settings.app_url) || location.origin + location.pathname;

/* ================================================================== */
/* estado                                                              */
/* ================================================================== */
let db;
const S = {
  booting: true, auth: null, who: null, role: null, asStudent: false, me: null,
  view: "hoy", settings: null, students: [], replies: [], payments: [], myPays: [],
  requests: [], susp: [], weights: [], sessions: [], occ: null,
  sel: null, filter: "activos", q: "", rDay: null, loginMsg: "",
};
const isAdminView = () => S.role === "admin" && !S.asStudent;
const byId = (id) => S.students.find((s) => s.id === id);
const active = () => S.students.filter((s) => s.active);
const rate = (f) => { const r = S.settings?.rates || {}; return +(f >= 3 ? r[3] : r[f]) || 0; };
const monthly = (s) => rate(s.freq) * s.freq * 4;
const spotName = () => (S.settings?.spot === "lluvia" ? "el spot de lluvia (Acassuso)" : "el río");
const spotTitle = () => (S.settings?.spot === "lluvia" ? "Spot de lluvia · Acassuso" : "Paraná y el río");
const spotAddr = () => (S.settings?.spot === "lluvia" ? "Rivera Indarte 947, Acassuso" : "Vicente López, frente al río");
const payOf = (sid, m = MONTH) => (S.payments.find((p) => p.student_id === sid && p.month === m)?.status) || "pending";
const fill = (tpl, s, hora) => String(tpl || "").replaceAll("{nombre}", s?.name?.split(" ")[0] || "").replaceAll("{hora}", hora || "").replaceAll("{spot}", spotName()).replaceAll("{link}", appLink());

function weekDays() {
  const add = TDOW === 0 ? 1 : TDOW === 6 ? 2 : 1 - TDOW;
  const mon = addDays(TODAY, add);
  return [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
}
function suspended(day, slot) {
  const list = isAdminView() ? S.susp : S.occ?.suspensions || [];
  return list.some((s) => s.day === day && s.slot === slot);
}
// quién va a un turno (ids). Admin ve ids reales, alumno ve ids anónimos.
function occList(day, slot) {
  if (suspended(day, slot)) return [];
  const d = parseDay(day).getDay();
  const src = isAdminView() ? active().map((s) => ({ id: s.id, sched: s.sched })) : S.occ?.scheds || [];
  const moves = isAdminView()
    ? S.requests.filter((r) => r.status === "ok").map((r) => ({ id: r.student_id, from_day: r.from_day, from_slot: r.from_slot, to_day: r.to_day, to_slot: r.to_slot }))
    : S.occ?.moves || [];
  let ids = src.filter((s) => (s.sched || []).some((x) => x.d === d && x.t === slot)).map((s) => s.id);
  ids = ids.filter((id) => !moves.some((m) => m.id === id && m.from_day === day && m.from_slot === slot));
  moves.filter((m) => m.to_day === day && m.to_slot === slot).forEach((m) => { if (!ids.includes(m.id)) ids.push(m.id); });
  return ids;
}
const free = (day, slot) => CAP - occList(day, slot).length;
function mySlotOn(me, day) {
  const d = parseDay(day).getDay();
  const mv = S.requests.filter((r) => r.status === "ok" && r.student_id === me.id);
  const to = mv.find((r) => r.to_day === day); if (to) return to.to_slot;
  const x = (me.sched || []).find((x) => x.d === d);
  if (x && !mv.some((r) => r.from_day === day) && !suspended(day, x.t)) return x.t;
  return null;
}

/* ================================================================== */
/* carga de datos                                                      */
/* ================================================================== */
async function load() {
  S.settings = await db.settings();
  const since = ymd(addDays(TODAY, -7));
  const m0 = MONTH + "-01";
  if (S.role === "admin") {
    [S.students, S.replies, S.payments, S.requests, S.susp] = await Promise.all([
      db.students(), db.replies(TDAY), db.payments(MONTH), db.requests(since), db.suspensions(since),
    ]);
  }
  if (S.who?.student) {
    const meId = S.who.student.id;
    const only = (rows) => rows.filter((r) => r.student_id === meId);
    const [studs, reps, pays, reqs, ws, ss, occ] = await Promise.all([
      S.role === "admin" ? Promise.resolve(S.students) : db.students(),
      S.role === "admin" ? Promise.resolve(S.replies) : db.replies(TDAY),
      db.myPayments(), S.role === "admin" ? Promise.resolve(S.requests) : db.requests(since),
      db.weights([meId]), db.sessions(m0, ymd(addDays(TODAY, 40))), db.occupancy(),
    ]);
    S.me = studs.find((s) => s.id === meId) || S.who.student;
    S.myReplies = only(reps); S.myPays = only(pays); S.myReqs = only(reqs);
    S.weights = only(ws); S.sessions = only(ss); S.occ = occ;
    if (S.role !== "admin") { S.replies = S.myReplies; S.requests = S.myReqs; }
  }
}
async function refresh(keep = true) { await load(); render(keep); }
async function act(fn, okMsg) {
  try { document.body.classList.add("busy"); await fn(); if (okMsg) toast(okMsg); }
  catch (e) { console.error(e); toast("No se pudo: " + (e.message || e)); }
  finally { document.body.classList.remove("busy"); }
}

/* ================================================================== */
/* UI base: íconos, toast, sheet                                       */
/* ================================================================== */
const I = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  ppl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.3c2.6.2 4.3 1.9 5 4.7"/></svg>',
  cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
  bar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12h20"/><rect x="4" y="7" width="3" height="10" rx="1"/><rect x="17" y="7" width="3" height="10" rx="1"/><rect x="7.5" y="9" width="2" height="6" rx=".8"/><rect x="14.5" y="9" width="2" height="6" rx=".8"/></svg>',
  river: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 9c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 14c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 19c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/></svg>',
  rain: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 15a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 7.5a3.8 3.8 0 0 1-.5 7.5H7Z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></svg>',
  wa: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3Z"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  sick: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M12 11v6"/></svg>',
  google: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"/></svg>',
};
const mascot = (cls = "mascot-sm") => `<svg class="${cls}" role="img" aria-label="Juancito"><use href="#juan"/></svg>`;
const avatar = (name, cls = "") => `<span class="av ${cls}" title="${esc(name)}">${esc(ini(name))}</span>`;

let tt;
function toast(msg) {
  clearTimeout(tt);
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; tt = setTimeout(() => (t.hidden = true), 3200);
}
function sheet(html, full = false) {
  $("#layer").innerHTML = `<div class="scrim" data-act="close-bg"><div class="sheet ${full ? "full" : ""}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
}
const closeSheet = () => { $("#layer").innerHTML = ""; CLASS = null; };
const sheetHead = (title) => `<div class="row"><h2 class="h2 grow">${title}</h2><button class="btn sm ghost" data-act="close">Cerrar</button></div>`;
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copiado. Pegalo en el grupo."); }
  catch (e) { toast("No pude copiar: mantené apretado el texto y copiá"); }
}
// hoja para mandar un mensaje a un grupo (elegís el chat en WhatsApp)
function groupMsg(title, text) {
  sheet(`${sheetHead(esc(title))}
    <div class="label">Así queda el mensaje</div>
    <div class="wa"><div class="msg"><div class="by">Juan Irusta Entrenamiento</div>${esc(text)}</div></div>
    <a class="btn cel block" href="${waShare(text)}" target="_blank" rel="noopener">${I.wa} Abrir WhatsApp y elegir el grupo</a>
    <button class="btn block" data-act="copy" data-text="${esc(text)}">Copiar texto</button>`);
}
function spark(h, w = 70, hgt = 22) {
  if (h.length < 2) return "";
  const mn = Math.min(...h), mx = Math.max(...h), r = mx - mn || 1;
  const pts = h.map((v, i) => [(i / (h.length - 1)) * (w - 4) + 2, hgt - 3 - ((v - mn) / r) * (hgt - 6)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const l = pts[pts.length - 1];
  return `<svg width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}" aria-hidden="true"><path d="${d} L${l[0].toFixed(1)} ${hgt} L2 ${hgt}Z" fill="rgba(127,182,232,.15)"/><path d="${d}" fill="none" stroke="var(--celeste)" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${l[0]}" cy="${l[1]}" r="2.6" fill="var(--bone)"/></svg>`;
}
const history = (rows, ex) => rows.filter((w) => w.exercise === ex).map((w) => +w.value).slice(-6);

/* ================================================================== */
/* pantallas de acceso                                                 */
/* ================================================================== */
function vLogin() {
  return `<div class="login">
    <img class="logo" style="width:120px;height:120px;align-self:center;border-width:3px" alt="Logo ITC" src="assets/logo.jpg">
    <h1>Irusta Training Club</h1>
    <p class="tagline">Fierro, mate y río</p>
    ${LIVE ? `
      <button class="btn pri block google" data-act="google">${I.google} Entrar con Google</button>
      <details class="mail"><summary>Prefiero entrar con mi email</summary>
        <form id="mailForm" class="field">
          <label class="label" for="loginEmail">Tu email</label>
          <input id="loginEmail" type="email" autocomplete="email" placeholder="vos@mail.com" required>
          <button class="btn block" type="submit">Mandame el link</button>
        </form></details>
      ${S.loginMsg ? `<p class="small" style="text-align:center">${esc(S.loginMsg)}</p>` : ""}
      <p class="demo-note">Entrás solo si Juan te sumó con ese email.</p>` : `
      <div class="card"><b>Modo demo</b><span class="small muted">La app todavía no está conectada a la base de datos (ver README). Probá con datos inventados:</span>
      <div class="row"><button class="btn grow" data-act="demo" data-role="admin">Soy Juan</button><button class="btn grow" data-act="demo" data-role="student">Soy alumno</button></div></div>`}
  </div>`;
}
function vNotMember() {
  return `<div class="login">${mascot("badge")}
    <h1 style="font-size:32px">Todavía no estás en la lista</h1>
    <p class="muted" style="text-align:center">Entraste como <b>${esc(S.who?.email)}</b>, pero ese email no está cargado en el club.</p>
    <p class="muted" style="text-align:center">Pedile a Juan que te sume con ese email, o entrá con el que le diste.</p>
    <button class="btn block" data-act="logout">Salir y probar otro</button></div>`;
}

/* ================================================================== */
/* shell                                                               */
/* ================================================================== */
function shell(body, tabs, badge = {}) {
  const adm = isAdminView();
  const name = adm ? "Juan" : S.me?.name?.split(" ")[0] || "";
  return `<header class="top">
    <img class="logo" alt="" src="assets/logo.jpg">
    <div class="wm">Irusta Training Club<small>${adm ? "Panel de Juan" : "Vicente López · río"}${db.mode === "demo" ? " · demo" : ""}</small></div>
    <span class="sp"></span>
    <button class="who" data-act="menu">${esc(name)} ▾</button>
  </header>
  <div class="scroll" id="scroll">${body}</div>
  <nav class="nav">${tabs.map(([v, l, ic]) => `<button data-act="tab" data-v="${v}" ${S.view === v ? 'aria-current="page"' : ""}>${I[ic]}${l}${badge[v] ? `<span class="dot">${badge[v]}</span>` : ""}</button>`).join("")}</nav>`;
}

/* ================================================================== */
/* ADMIN                                                               */
/* ================================================================== */
function todays() { return SLOTS.flatMap((t) => occList(TDAY, t).map((id) => ({ s: byId(id), t }))).filter((x) => x.s); }
function nextSlot() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const withPeople = SLOTS.filter((t) => occList(TDAY, t).length);
  return withPeople.find((t) => +t.slice(0, 2) + 1 > h) || withPeople[withPeople.length - 1] || SLOTS[0];
}
function aHoy() {
  const weekday = TDOW >= 1 && TDOW <= 5;
  const list = todays();
  const rep = { voy: 0, tarde: 0, no: 0, none: 0 };
  list.forEach(({ s }) => rep[S.replies.find((r) => r.student_id === s.id)?.reply || "none"]++);
  const sent = lsGet("itc-sent-" + TDAY, []);
  const reqN = S.requests.filter((r) => r.status === "pending").length;
  const ns = nextSlot(), nsN = occList(TDAY, ns).length;
  const face = (s) => { const r = S.replies.find((x) => x.student_id === s.id)?.reply; return avatar(s.name, r === "voy" ? "ok" : r === "tarde" ? "warn" : r === "no" ? "bad" : ""); };
  const slotRow = (t) => {
    const ids = occList(TDAY, t), sus = suspended(TDAY, t);
    return `<button class="slot ${t === ns ? "now" : ""} ${sus ? "sus" : ""}" data-act="slot" data-t="${t}">
      <div class="t">${t.slice(0, 2)}<small>${+t.slice(0, 2) < 12 ? "MAÑANA" : "TARDE"}</small></div>
      <div class="faces">${sus ? '<span class="chip bad">Suspendido</span>' : ids.length ? ids.map((id) => face(byId(id))).join("") : '<span class="muted small">Libre</span>'}</div>
      <div class="cap ${ids.length >= CAP ? "full" : ""}">${sus ? "–" : ids.length + "/" + CAP}</div></button>`;
  };
  return `
  <div class="row" style="align-items:flex-start">
    <div class="grow"><div class="date">${DOWL[TDOW]} ${TODAY.getDate()} de ${MON[TODAY.getMonth()]}</div>
    <h1 class="hello">Buen día,<br><em>Juan</em></h1></div>${mascot("badge")}
  </div>
  ${weekday ? `
  <section class="card">
    <div class="row"><span class="label grow">Buen día</span><span class="chip ${sent.length >= list.length && list.length ? "ok" : "warn"}">${sent.length}/${list.length} enviados</span></div>
    <div class="kpi">
      <div><b class="num" style="color:var(--ok)">${rep.voy}</b><span>Vienen</span></div>
      <div><b class="num" style="color:var(--sol)">${rep.tarde}</b><span>Llegan tarde</span></div>
      <div><b class="num" style="color:var(--bad)">${rep.no + rep.none}</b><span>No / sin resp.</span></div>
    </div>
    <button class="btn cel block" data-act="buendia">${I.wa} Mandar los buen día</button>
  </section>
  <button class="up" data-act="class" data-t="${ns}"><span>UP!!!</span><small>Arrancar<br>clase ${ns} · ${nsN} ${nsN === 1 ? "alumno" : "alumnos"}</small></button>` : `
  <section class="card"><b>Hoy no hay clases fijas</b><span class="small muted">Si abrís un sábado, avisá desde Semana.</span></section>`}
  <section class="card spot ${S.settings.spot === "rio" ? "" : "rain"}">
    <div class="ic">${S.settings.spot === "rio" ? I.river : I.rain}</div>
    <div><div class="label">Hoy entrenamos en</div><b>${spotTitle()}</b><div class="small muted">${spotAddr()}</div></div>
    <button class="btn block" style="grid-column:1/-1" data-act="toggle-spot">${S.settings.spot === "rio" ? "Llueve: pasar al spot de lluvia" : "Volver al río"}</button>
  </section>
  ${weekday ? `<div class="sec-h"><h2 class="h2">Turnos de hoy</h2><span class="label">máx ${CAP} por turno</span></div>
  <div class="list" style="gap:8px">${SLOTS.map(slotRow).join("")}</div>` : ""}
  ${reqN ? `<button class="card row" style="text-align:left;flex-direction:row" data-act="tab" data-v="semana"><span class="chip warn">${reqN}</span><span class="grow"><b>Pedidos de cambio de horario</b><br><span class="small muted">Aprobá o rechazá con un toque</span></span>${I.chev}</button>` : ""}
  ${weekday ? `<button class="btn danger block" data-act="sick">${I.sick} No puedo dar clase hoy</button>` : ""}
  <button class="btn ghost block" data-act="settings">${I.gear} Ajustes</button>`;
}

function aSemana() {
  const days = weekDays();
  const lvl = (n) => (n === 0 ? "zero" : n >= CAP ? "l3" : n >= 5 ? "l2" : "l1");
  const sel = S.sel;
  let detail = "";
  if (sel) {
    const ids = occList(sel.day, sel.t);
    detail = `<section class="card"><div class="row"><h2 class="h2 grow">${DOW[parseDay(sel.day).getDay()]} ${parseDay(sel.day).getDate()} · ${sel.t}</h2><span class="cap ${ids.length >= CAP ? "full" : ""}">${ids.length}/${CAP}</span></div>
    <div class="list">${ids.map(byId).filter(Boolean).map((s) => `<div class="li tap" data-act="student" data-id="${s.id}">${avatar(s.name)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub">${s.freq}×/sem · le toca ${esc(s.split[s.next_idx] || "")}</div></div>${I.chev}</div>`).join("") || '<p class="muted small">Sin alumnos.</p>'}</div></section>`;
  }
  const reqs = S.requests.filter((r) => r.status === "pending");
  const recov = active().filter((s) => s.recover > 0);
  return `
  <div class="sec-h"><h1 class="hello" style="font-size:32px">Semana</h1><span class="date">${days[0].getDate()} al ${days[4].getDate()} ${MON[days[4].getMonth()].slice(0, 3)}</span></div>
  <section class="card">
    <div class="wk">
      <span></span>${days.map((d) => `<span class="hd ${ymd(d) === TDAY ? "today" : ""}">${DOW[d.getDay()]} ${d.getDate()}</span>`).join("")}
      ${SLOTS.map((t) => `<span class="tm">${t.slice(0, 2)}</span>${days.map((d) => { const day = ymd(d); const sus = suspended(day, t); const n = occList(day, t).length;
        return `<button class="${sus ? "zero" : lvl(n)} ${sel && sel.day === day && sel.t === t ? "sel" : ""}" data-act="cell" data-day="${day}" data-t="${t}" aria-label="${DOW[d.getDay()]} ${t}: ${n} de ${CAP}">${sus ? "×" : n}</button>`; }).join("")}`).join("")}
    </div>
    <div class="legend"><span><i style="background:rgba(127,182,232,.22)"></i>Hay lugar</span><span><i style="background:rgba(245,181,27,.4)"></i>Lleno</span><span>Tocá un turno</span></div>
  </section>
  ${detail}
  <div class="sec-h"><h2 class="h2">Pedidos de cambio</h2><span class="chip ${reqs.length ? "warn" : "off"}">${reqs.length}</span></div>
  ${reqs.length ? reqs.map((r) => { const s = byId(r.student_id); if (!s) return ""; const f = free(r.to_day, r.to_slot); const td = parseDay(r.to_day);
    return `<section class="card">
    <div class="row">${avatar(s.name)}<div class="grow"><b>${esc(s.name)}</b><div class="small muted">${esc(r.reason || "")}</div></div></div>
    <div class="row formula wrap"><span>${r.from_day ? DOW[parseDay(r.from_day).getDay()] + " " + r.from_slot : "Recupero"}</span><span class="muted">→</span><b style="font-size:22px">${DOW[td.getDay()]} ${td.getDate()} · ${r.to_slot}</b><span class="chip ${f > 0 ? "ok" : "bad"}">${f > 0 ? f + " lugares" : "Lleno"}</span></div>
    <div class="row"><button class="btn grow cel" data-act="req-ok" data-id="${r.id}" ${f > 0 ? "" : "disabled"}>Sí, aprobar</button><button class="btn grow" data-act="req-no" data-id="${r.id}">No</button></div>
  </section>`; }).join("") : '<p class="muted small">No hay pedidos pendientes.</p>'}
  <div class="sec-h"><h2 class="h2">Clases a recuperar</h2><span class="label">dentro del mes</span></div>
  <section class="card">${recov.length ? `<div class="list">${recov.map((s) => `<div class="li tap" data-act="student" data-id="${s.id}">${avatar(s.name)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub">Debe ${s.recover} ${s.recover > 1 ? "clases" : "clase"} · elige horario desde su app</div></div><span class="chip cel">${s.recover}</span></div>`).join("")}</div>` : '<p class="muted small">Nadie tiene clases pendientes.</p>'}
  <p class="small muted" style="margin:0">Nada se pierde, todo se reprograma.</p></section>
  <section class="card">
    <h2 class="h2">Sábado de traino</h2><div class="small muted">Para recuperar ausencias. Mandás la encuesta al grupo.</div>
    <button class="btn block" data-act="saturday">Armar mensaje para el grupo</button>
  </section>`;
}

function aAlumnos() {
  const f = S.filter, q = S.q.trim().toLowerCase();
  let list = S.students.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.email || "").includes(q));
  list = f === "bajas" ? list.filter((s) => !s.active) : list.filter((s) => s.active);
  if (f === "debe") list = list.filter((s) => payOf(s.id) !== "paid");
  if (f === "recup") list = list.filter((s) => s.recover > 0);
  const payChip = (s) => { const p = payOf(s.id); return !s.active ? '<span class="chip off">Baja</span>' : p === "paid" ? '<span class="chip ok">Pagó</span>' : p === "informed" ? '<span class="chip cel">Avisó</span>' : '<span class="chip warn">Debe</span>'; };
  const noMail = active().filter((s) => !s.email).length;
  return `
  <div class="sec-h"><h1 class="hello" style="font-size:32px">Alumnos</h1><span class="date">${active().length} activos</span></div>
  <div class="row"><button class="btn pri grow" data-act="new-student">Sumar alumno</button><button class="btn grow" data-act="bulk">Carga rápida</button></div>
  ${noMail ? `<div class="card row" style="flex-direction:row"><span class="chip warn">${noMail}</span><span class="small grow">sin email: no pueden entrar a la app hasta que se lo cargues.</span></div>` : ""}
  <div class="field"><label class="label" for="q">Buscar</label><input id="q" placeholder="Nombre o email" value="${esc(S.q)}"></div>
  <div class="seg" role="group" aria-label="Filtro">${[["activos", "Activos"], ["debe", "Deben"], ["recup", "Recuperan"], ["bajas", "Bajas"]].map(([v, l]) => `<button data-act="filter" data-v="${v}" aria-pressed="${f === v}">${l}</button>`).join("")}</div>
  <section class="card"><div class="list">${list.map((s) => `<div class="li tap" data-act="student" data-id="${s.id}">${avatar(s.name)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub">${s.freq}×/sem · ${(s.sched || []).map((x) => DOW[x.d] + " " + x.t.slice(0, 2)).join(", ") || "sin horario"}</div></div>${payChip(s)}</div>`).join("") || '<p class="muted">Nadie con ese filtro.</p>'}</div></section>`;
}

function aCobros() {
  const all = active(), exp = all.reduce((a, s) => a + monthly(s), 0), got = all.filter((s) => payOf(s.id) === "paid").reduce((a, s) => a + monthly(s), 0);
  const owe = all.filter((s) => payOf(s.id) === "pending"), inf = all.filter((s) => payOf(s.id) === "informed");
  return `
  <div class="sec-h"><h1 class="hello" style="font-size:32px">Cobros</h1><span class="date">${monthName(MONTH)} ${MONTH.slice(0, 4)}</span></div>
  <section class="card">
    <div class="row"><div class="grow"><div class="label">Cobrado</div><div class="hello num" style="font-size:34px">${money(got)}</div></div><div style="text-align:right"><div class="label">De</div><b class="num">${money(exp)}</b></div></div>
    <div class="bar"><i style="width:${exp ? Math.round((got / exp) * 100) : 0}%"></i></div>
    <div class="small muted">Se paga del 1 al 10 · alias <b style="color:var(--bone)">${esc(S.settings.alias)}</b></div>
  </section>
  ${inf.length ? `<div class="sec-h"><h2 class="h2">Avisaron que transfirieron</h2><span class="chip cel">${inf.length}</span></div>
  <section class="card"><div class="list">${inf.map((s) => `<div class="li">${avatar(s.name)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub num">${money(monthly(s))} · fijate en el banco</div></div><button class="btn sm cel" data-act="pay-ok" data-id="${s.id}">Llegó</button></div>`).join("")}</div></section>` : ""}
  <div class="sec-h"><h2 class="h2">Deben ${monthName(MONTH)}</h2><span class="chip ${owe.length ? "warn" : "ok"}">${owe.length}</span></div>
  <section class="card">${owe.length ? `<div class="list">${owe.map((s) => `<div class="li">${avatar(s.name)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub num">${money(rate(s.freq))} × ${s.freq} × 4 = ${money(monthly(s))}</div></div><button class="btn sm" data-act="pay-ok" data-id="${s.id}">Pagó</button></div>`).join("")}</div>
  <button class="btn cel block" data-act="remind">${I.wa} Recordarles uno por uno</button>` : '<p class="muted small">Todos al día. Éxito rotundo.</p>'}</section>
  <div class="sec-h"><h2 class="h2">Valor por sesión</h2></div>
  <section class="card">
    ${[[3, "3 o más veces por semana"], [2, "2 veces por semana"], [1, "1 vez por semana"]].map(([k, l]) => `<div class="row"><span class="grow">${l}</span><div class="step"><button data-act="rate" data-k="${k}" data-v="-500" aria-label="Bajar">−</button><output class="num">${money(S.settings.rates[k])}</output><button data-act="rate" data-k="${k}" data-v="500" aria-label="Subir">+</button></div></div>`).join("")}
    <p class="small muted" style="margin:0">El mes se calcula solo: valor de la sesión × veces por semana × 4.</p>
    <button class="btn block" data-act="announce">Avisar cambio de honorarios al grupo</button>
  </section>`;
}

/* ---------- clase en curso (UP!!!) ---------- */
let CLASS = null;
async function openClass(t) {
  const ids = occList(TDAY, t);
  const ws = ids.length ? await db.weights(ids) : [];
  CLASS = { t, open: ids[0], list: ids.map((id) => {
    const s = byId(id); const g = s.split[s.next_idx % s.split.length] || "Cuerpo completo";
    const mine = ws.filter((w) => w.student_id === id);
    return { id, g, done: false, hist: Object.fromEntries(exercisesFor(g).map((e) => [e.n, history(mine, e.n)])),
      kg: Object.fromEntries(exercisesFor(g).map((e) => { const h = history(mine, e.n); return [e.n, h.length ? h[h.length - 1] : 0]; })) };
  }) };
  renderClass();
}
function renderClass() {
  const c = CLASS;
  sheet(`<div class="row"><div class="grow"><div class="label">Clase en curso · ${spotTitle()}</div><h2 class="hello" style="font-size:34px">UP!!! ${c.t}</h2></div><button class="btn sm ghost" data-act="close">Cerrar</button></div>
  <div class="small muted">1. Abs × 4 · 2. Fuerza · 3. Cardio</div>
  ${c.list.map((x) => { const s = byId(x.id); const open = c.open === x.id; const abs = ABS[(s.next_idx + TODAY.getDate()) % 4];
    return `<section class="card">
      <button class="row plain" data-act="cl-open" data-id="${s.id}">${avatar(s.name)}<div class="grow"><b>${esc(s.name)}</b><div class="small" style="color:var(--celeste)">Día ${(s.next_idx % s.split.length) + 1} · ${esc(x.g)}</div></div>${x.done ? '<span class="chip ok">Listo</span>' : I.chev}</button>
      ${open ? `<div class="small muted">${abs.n}: ${abs.items.join(" · ")} — × 4</div>
      ${exercisesFor(x.g).map((ex) => { const h = x.hist[ex.n]; const v = x.kg[ex.n];
        return `<div class="ex"><div style="min-width:0"><div class="en">${esc(ex.n)}</div><div class="sc">${ex.s}</div><div class="small muted">${h.length ? "La vez pasada: " + h[h.length - 1] + (ex.bw ? " reps" : " kg") : "Primera vez"}</div></div>
        <div class="step"><button data-act="kg" data-id="${s.id}" data-ex="${esc(ex.n)}" data-v="${ex.bw ? -1 : -2.5}" aria-label="Menos">−</button><output class="num">${v}</output><button data-act="kg" data-id="${s.id}" data-ex="${esc(ex.n)}" data-v="${ex.bw ? 1 : 2.5}" aria-label="Más">+</button></div></div>`; }).join("")}
      <button class="btn cel block" data-act="cl-done" data-id="${s.id}">${x.done ? "Guardado" : "Listo " + esc(s.name.split(" ")[0])}</button>` : ""}
    </section>`; }).join("") || '<p class="muted">No hay alumnos en este turno.</p>'}
  <button class="btn pri block" data-act="cl-finish">Terminar clase y guardar pesos</button>`, true);
}

/* ---------- ficha y formulario de alumno ---------- */
function studentSheet(id) {
  const s = byId(id);
  const ws = S.adminWeights?.[id];
  const g = s.split[s.next_idx % s.split.length];
  sheet(`<div class="row">${avatar(s.name)}<div class="grow"><h2 class="h2">${esc(s.name)}</h2><div class="small muted">${esc(s.phone || "sin celular")} · ${esc(s.email || "sin email")}</div></div><button class="btn sm ghost" data-act="close">Cerrar</button></div>
  ${!s.active ? '<span class="chip off" style="align-self:flex-start">Dado de baja</span>' : ""}
  <div class="row wrap">${(s.sched || []).map((x) => `<span class="chip cel">${DOW[x.d]} ${x.t}</span>`).join("")}</div>
  <div class="formula">${money(rate(s.freq))} × ${s.freq} × 4 = <b>${money(monthly(s))}</b> <span class="muted small">por mes</span></div>
  <div class="label">Rutina por días</div>
  ${s.split.map((gr, i) => `<div class="row"><span class="chip ${i === s.next_idx % s.split.length ? "warn" : "off"}">Día ${i + 1}</span><b class="grow">${esc(gr)}</b>${i === s.next_idx % s.split.length ? '<span class="small muted">le toca</span>' : ""}</div>`).join("")}
  ${s.recover ? `<div class="row"><span class="chip cel">${s.recover}</span><span class="grow">clases para recuperar</span></div>` : ""}
  ${s.notes ? `<div class="small muted">Notas: ${esc(s.notes)}</div>` : ""}
  <div class="label">Últimos pesos · ${esc(g)}</div>
  <div class="list">${ws ? exercisesFor(g).filter((e) => !e.bw).map((ex) => { const h = history(ws, ex.n); return `<div class="li"><div class="grow small">${esc(ex.n)}</div>${spark(h)}<b class="num">${h.length ? h[h.length - 1] + " kg" : "—"}</b></div>`; }).join("") : '<p class="small muted">Cargando…</p>'}</div>
  <div class="row wrap">
    ${s.phone ? `<a class="btn grow cel" href="${waLink(s.phone, `Hola ${s.name.split(" ")[0]}! 🤜⚡️🤛`)}" target="_blank" rel="noopener">${I.wa} Escribirle</a>` : ""}
    <button class="btn grow" data-act="travel" data-id="${s.id}">Rutina de viaje</button>
  </div>
  <div class="row"><button class="btn grow" data-act="edit-student" data-id="${s.id}">Editar</button>
  ${s.active ? `<button class="btn grow danger" data-act="deactivate" data-id="${s.id}">Dar de baja</button>` : `<button class="btn grow" data-act="reactivate" data-id="${s.id}">Reactivar</button>`}</div>
  ${!s.active ? `<button class="btn ghost danger block" data-act="delete-ask" data-id="${s.id}">Borrar para siempre</button>` : ""}`);
  if (!ws) db.weights([id]).then((rows) => { S.adminWeights = { ...(S.adminWeights || {}), [id]: rows }; if ($(".sheet")) studentSheet(id); });
}
function studentForm(s) {
  const isNew = !s;
  s = s || { name: "", phone: "", email: "", freq: 2, sched: [{ d: 2, t: "08:00" }, { d: 4, t: "08:00" }], split: SPLIT[2], next_idx: 0, recover: 0, notes: "" };
  const daySel = (i, x) => `<div class="row"><select id="fd${i}" aria-label="Día ${i + 1}">${[1, 2, 3, 4, 5, 6].map((d) => `<option value="${d}" ${x?.d === d ? "selected" : ""}>${DOWL[d]}</option>`).join("")}</select>
    <select id="ft${i}" aria-label="Horario ${i + 1}">${SLOTS.concat(["07:00", "11:00", "12:00"]).sort().map((t) => `<option ${x?.t === t ? "selected" : ""}>${t}</option>`).join("")}</select>
    <select id="fg${i}" aria-label="Rutina día ${i + 1}">${GROUPS.map((g) => `<option ${(s.split[i] || SPLIT[s.freq][i]) === g ? "selected" : ""}>${g}</option>`).join("")}</select></div>`;
  sheet(`${sheetHead(isNew ? "Alumno nuevo" : "Editar " + esc(s.name))}
  <form id="studentForm" data-id="${esc(s.id || "")}" class="form">
    <div class="field"><label class="label" for="fName">Nombre</label><input id="fName" required value="${esc(s.name)}" placeholder="Ej: Lucía Pérez"></div>
    <div class="field"><label class="label" for="fEmail">Email (con este entra a la app)</label><input id="fEmail" type="email" value="${esc(s.email || "")}" placeholder="lucia@gmail.com"></div>
    <div class="field"><label class="label" for="fPhone">Celular (código de área, sin 0 ni 15)</label><input id="fPhone" inputmode="tel" value="${esc(s.phone || "")}" placeholder="11 2345 6789"></div>
    <div class="field"><label class="label" for="fFreq">Veces por semana</label><select id="fFreq">${[1, 2, 3, 4, 5].map((f) => `<option value="${f}" ${s.freq === f ? "selected" : ""}>${f} ${f > 1 ? "veces" : "vez"}</option>`).join("")}</select></div>
    <div class="field"><span class="label">Días, horario y qué entrena</span><div id="fDays" class="days-form">${Array.from({ length: s.freq }, (_, i) => daySel(i, s.sched[i])).join("")}</div></div>
    ${isNew ? "" : `<div class="row"><div class="field grow"><label class="label" for="fRec">Clases a recuperar</label><input id="fRec" type="number" min="0" max="20" value="${s.recover}"></div>
    <div class="field grow"><label class="label" for="fNext">Le toca el día</label><select id="fNext">${s.split.map((g, i) => `<option value="${i}" ${i === s.next_idx % s.split.length ? "selected" : ""}>Día ${i + 1}</option>`).join("")}</select></div></div>`}
    <div class="field"><label class="label" for="fNotes">Notas (lesiones, objetivos)</label><input id="fNotes" value="${esc(s.notes || "")}"></div>
    <button class="btn pri block" type="submit">${isNew ? "Sumar al equipo" : "Guardar cambios"}</button>
  </form>`);
  S.formSplitSeed = s;
}
const DAYMAP = { lun: 1, lu: 1, mar: 2, ma: 2, mie: 3, "mié": 3, mi: 3, jue: 4, ju: 4, vie: 5, vi: 5, sab: 6, "sáb": 6, sa: 6 };
function parseBulk(text) {
  const out = [], errs = [];
  text.split(/\n/).map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const p = line.split(/[;\t|]/).map((x) => x.trim());
    const [name, phone, email, freqS, daysS, time] = p;
    if (!name) return errs.push(`Línea ${i + 1}: falta el nombre`);
    const freq = Math.min(5, Math.max(1, parseInt(freqS) || 2));
    const days = (daysS || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[\s,/-]+/).map((d) => DAYMAP[d.slice(0, 3)] || DAYMAP[d.slice(0, 2)]).filter(Boolean);
    const t = /^\d{1,2}(:\d{2})?$/.test(time || "") ? (time.includes(":") ? time.padStart(5, "0") : time.padStart(2, "0") + ":00") : "08:00";
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.push(`Línea ${i + 1}: email raro (${email})`);
    out.push({ name, phone: phone || null, email: email ? email.toLowerCase() : null, freq, sched: days.slice(0, freq).map((d) => ({ d, t })), split: SPLIT[freq], next_idx: 0, recover: 0, active: true });
  });
  return { rows: out, errs };
}

/* ================================================================== */
/* ALUMNO                                                              */
/* ================================================================== */
function sHoy() {
  const me = S.me, t = mySlotOn(me, TDAY), g = me.split[me.next_idx % me.split.length] || "Cuerpo completo";
  const reply = S.myReplies.find((r) => r.day === TDAY)?.reply || "";
  const msg = fill(S.settings.buen_dia, me, t).replace(/\s*Confirmá acá:.*$/m, "");
  const opts = [["voy", "Voy", "🤜⚡️🤛"], ["tarde", "Llego tarde", "10 min"], ["no", "Hoy no puedo", "reprogramar"]];
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  return `
  <div class="row" style="align-items:flex-start">
    <div class="grow"><div class="date">${DOWL[TDOW]} ${TODAY.getDate()} de ${MON[TODAY.getMonth()]}</div><h1 class="hello">Buen día,<br><em>${esc(me.name.split(" ")[0])}</em></h1></div>${mascot("badge")}
  </div>
  ${t ? `<section class="card">
    <div class="label">Mensaje de Juan</div>
    <div class="wa"><div class="msg"><div class="by">Juan Irusta Entrenamiento</div>${esc(msg)}</div>
    ${reply ? `<div class="msg me">${reply === "voy" ? "Voy! 🤜⚡️🤛" : reply === "tarde" ? "Voy pero llego 10 min tarde ⏰" : "Hoy no puedo, reprogramo 🙏"}</div>` : ""}</div>
    <div class="reply">${opts.map(([v, l, s]) => `<button data-act="reply" data-v="${v}" aria-pressed="${reply === v}">${l}<small>${s}</small></button>`).join("")}</div>
  </section>` : `<section class="card"><b>Hoy no tenés clase</b><span class="muted small">Tu próxima: ${nextClassLabel(me)}.</span></section>`}
  <section class="card spot ${S.settings.spot === "rio" ? "" : "rain"}">
    <div class="ic">${S.settings.spot === "rio" ? I.river : I.rain}</div>
    <div><div class="label">${t ? "Hoy " + t + " en" : "Entrenamos en"}</div><b>${spotTitle()}</b><div class="small muted">${spotAddr()}${S.settings.spot === "rio" ? " · traé mate" : ""}</div></div>
  </section>
  <button class="card" style="text-align:left" data-act="tab" data-v="rutina">
    <div class="row"><span class="label grow">Te toca</span>${I.chev}</div>
    <div class="row"><span class="chip warn">Día ${(me.next_idx % me.split.length) + 1}</span><b class="h2" style="font-size:24px">${esc(g)}</b></div>
    <div class="small muted">Abs × 4 · ${exercisesFor(g).length} ejercicios de fuerza · cardio</div>
  </button>
  ${me.recover > 0 ? `<section class="card"><div class="row"><span class="chip cel">${me.recover}</span><b class="grow">${me.recover > 1 ? "Clases" : "Clase"} para recuperar</b></div><button class="btn cel block" data-act="tab" data-v="clases">Elegir horario</button></section>` : ""}
  ${!standalone && !lsGet("itc-install-ok", false) ? `<section class="card"><b>Tenela como app</b><span class="small muted">iPhone: Compartir → “Agregar a inicio”. Android: menú ⋮ → “Instalar app”.</span><button class="btn sm ghost" data-act="install-ok">Listo</button></section>` : ""}
  <section class="card row" style="flex-direction:row">${mascot()}<div class="say grow">Nada se pierde, todo se reprograma</div></section>`;
}
function nextClassLabel(me) {
  for (let i = 1; i < 8; i++) { const d = addDays(TODAY, i); const t = mySlotOn(me, ymd(d)); if (t) return DOWL[d.getDay()] + " " + t; }
  return "a coordinar con Juan";
}
function sRutina() {
  const me = S.me, n = me.split.length, day = S.rDay ?? me.next_idx % n, g = me.split[day], abs = ABS[(day + TODAY.getDate()) % 4];
  return `
  <div class="sec-h"><h1 class="hello" style="font-size:32px">Mi rutina</h1><span class="date">${me.freq}× por semana</span></div>
  <div class="days" role="group" aria-label="Días">${me.split.map((x, i) => `<button data-act="rday" data-v="${i}" aria-pressed="${i === day}"><span>Día ${i + 1}${i === me.next_idx % n ? " · te toca" : ""}</span><b>${esc(x)}</b></button>`).join("")}</div>
  <section class="card">
    <div class="blk-h"><span class="n">1</span><h2 class="h2 grow">Abdominales</h2><span class="label" style="color:var(--celeste)">× 4 vueltas</span></div>
    <div class="list">${abs.items.map((a) => `<div class="li small">${esc(a)}</div>`).join("")}</div>
  </section>
  <section class="card">
    <div class="blk-h"><span class="n">2</span><h2 class="h2 grow">Fuerza</h2><span class="label">tocá para anotar</span></div>
    <div>${exercisesFor(g).map((ex) => { const h = history(S.weights, ex.n); const last = h[h.length - 1]; const d = h.length > 1 ? +(last - h[0]).toFixed(1) : 0;
      return `<button class="ex plain" data-act="log" data-ex="${esc(ex.n)}" data-bw="${ex.bw ? 1 : 0}"><div style="min-width:0;text-align:left"><div class="en">${esc(ex.n)}</div><div class="sc">${ex.s}</div></div>
      <div class="kg num">${last ?? "—"}<small>${last != null ? (ex.bw ? "reps" : "kg") : ""}</small></div>
      <div class="tr">${spark(h, 96, 24)}<span>${!h.length ? "Juan lo anota en la clase" : d > 0 ? `<span class="up-d">+${d}${ex.bw ? " reps" : " kg"}</span> en las últimas ${h.length} veces` : `${h.length} ${h.length > 1 ? "registros" : "registro"}`}</span></div></button>`; }).join("")}</div>
  </section>
  <section class="card"><div class="blk-h"><span class="n">3</span><h2 class="h2 grow">Cardio</h2></div><div class="small">${CARDIO}</div></section>
  <section class="card">
    <b>¿Te vas de viaje?</b><div class="small muted">Pedile a Juan tu rutina para el gimnasio del hotel.</div>
    <button class="btn block" data-act="copy" data-text="Juan! Me voy de viaje, ¿me pasás rutina para el gym? 🤜⚡️🤛">Copiar mensaje para Juan</button>
  </section>`;
}
function sClases() {
  const me = S.me, y = TODAY.getFullYear(), m = TODAY.getMonth();
  const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const done = new Set(S.sessions.filter((s) => s.day.startsWith(MONTH)).map((s) => +s.day.slice(8)));
  const cells = []; for (let i = 0; i < (first + 6) % 7; i++) cells.push("<i></i>");
  for (let d = 1; d <= days; d++) {
    const day = ymd(new Date(y, m, d));
    const cls = done.has(d) ? "done" : d >= TODAY.getDate() && mySlotOn(me, day) ? "c" : "";
    cells.push(`<i class="${cls} ${d === TODAY.getDate() ? "today" : ""}">${d}</i>`);
  }
  const opts = [];
  for (let i = 0; i <= 7 && opts.length < 8; i++) {
    const dt = addDays(TODAY, i), d = dt.getDay(), day = ymd(dt);
    if (d === 0 || d === 6) continue;
    SLOTS.forEach((t) => { if (i === 0 && +t.slice(0, 2) <= new Date().getHours()) return; const f = free(day, t); if (f > 0 && mySlotOn(me, day) !== t && opts.length < 8) opts.push({ day, dt, t, f }); });
  }
  const myReq = S.myReqs.filter((r) => r.to_day >= TDAY);
  return `
  <div class="sec-h"><h1 class="hello" style="font-size:32px">Mis clases</h1><span class="date">${monthName(MONTH)}</span></div>
  <section class="card">
    <div class="cal">${["L", "M", "M", "J", "V", "S", "D"].map((x) => `<span>${x}</span>`).join("")}${cells.join("")}</div>
    <div class="legend"><span><i style="background:var(--celeste)"></i>Fui</span><span><i style="background:rgba(127,182,232,.18)"></i>Próximas</span></div>
    <div class="kpi"><div><b class="num">${done.size}</b><span>Entrené</span></div><div><b class="num">${me.recover}</b><span>A recuperar</span></div><div><b class="num">${me.freq * 4}</b><span>Del mes</span></div></div>
  </section>
  <section class="card"><h2 class="h2">Mi horario fijo</h2>
    <div class="row wrap">${(me.sched || []).map((x) => `<span class="chip cel">${DOWL[x.d]} ${x.t}</span>`).join("") || '<span class="muted small">Juan todavía no te asignó horario.</span>'}</div></section>
  <section class="card">
    <h2 class="h2">${me.recover > 0 ? "Recuperar una clase" : "Sumar un día"}</h2>
    <div class="small muted">Turnos con lugar estos días. Juan lo confirma.</div>
    ${myReq.map((r) => `<div class="row"><span class="chip ${r.status === "ok" ? "ok" : r.status === "no" ? "bad" : "warn"}">${r.status === "ok" ? "Confirmado" : r.status === "no" ? "No hay lugar" : "Esperando a Juan"}</span><span class="small">${DOWL[parseDay(r.to_day).getDay()]} ${parseDay(r.to_day).getDate()} · ${r.to_slot}</span></div>`).join("")}
    <div class="list">${opts.map((o) => `<div class="li"><div class="grow"><div class="nm">${DOWL[o.dt.getDay()]} ${o.dt.getDate()} · ${o.t}</div><div class="sub">${o.f} ${o.f > 1 ? "lugares" : "lugar"}</div></div><button class="btn sm cel" data-act="pick" data-day="${o.day}" data-t="${o.t}">Pedir</button></div>`).join("") || '<p class="muted small">No hay lugares libres esta semana.</p>'}</div>
  </section>`;
}
function sPagos() {
  const me = S.me, r = rate(me.freq), tot = monthly(me);
  const cur = S.myPays.find((p) => p.month === MONTH)?.status || "pending";
  const target = cur === "paid" && TODAY.getDate() > 20 ? nextMonth(MONTH) : MONTH;
  const st = S.myPays.find((p) => p.month === target)?.status || "pending";
  return `
  <div class="sec-h"><h1 class="hello" style="font-size:32px">Pagos</h1><span class="date">${monthName(target)}</span></div>
  <section class="card">
    <div class="label">${monthName(target)} ${target.slice(0, 4)}</div>
    <div class="formula">${money(r)} × ${me.freq} × 4 semanas</div>
    <div class="hello num" style="font-size:44px">${money(tot)}</div>
    <div class="small muted">Pagá del 1 al 10. Si faltás, la clase se recupera dentro del mes.</div>
    <div class="alias"><code id="alias">${esc(S.settings.alias)}</code><button class="btn sm" data-act="copy" data-text="${esc(S.settings.alias)}">Copiar alias</button></div>
    <div class="small muted">${esc(S.settings.bank)}</div>
    ${st === "paid" ? '<span class="chip ok" style="align-self:flex-start">Pagado ✔</span>' : st === "informed" ? '<span class="chip cel" style="align-self:flex-start">Le avisaste a Juan · falta que confirme</span>' : `<button class="btn pri block" data-act="paid" data-month="${target}" data-amount="${tot}">Ya transferí</button>`}
  </section>
  ${S.myPays.length ? `<div class="sec-h"><h2 class="h2">Historial</h2></div>
  <section class="card"><div class="list">${S.myPays.map((p) => `<div class="li"><div class="grow"><div class="nm">${monthName(p.month)} ${p.month.slice(0, 4)}</div></div><b class="num">${p.amount ? money(p.amount) : ""}</b><span class="chip ${p.status === "paid" ? "ok" : p.status === "informed" ? "cel" : "warn"}">${p.status === "paid" ? "Pagado" : p.status === "informed" ? "Avisado" : "Pendiente"}</span></div>`).join("")}</div></section>` : ""}
  <section class="card"><div class="label">Valor por sesión</div>
    ${[[3, "3 o más por semana"], [2, "2 por semana"], [1, "1 por semana"]].map(([k, l]) => `<div class="row"><span class="grow small">${l}</span><b class="num">${money(S.settings.rates[k])}</b>${k === Math.min(3, me.freq) ? '<span class="chip cel">vos</span>' : ""}</div>`).join("")}
  </section>`;
}

/* ================================================================== */
/* render                                                              */
/* ================================================================== */
function render(keep = false) {
  const p = $("#app");
  const sc = keep ? window.scrollY : 0;
  if (S.booting) { p.innerHTML = `<div class="login">${mascot("badge")}<p class="tagline">Cargando…</p></div>`; return; }
  if (!S.auth) { p.innerHTML = vLogin(); return; }
  if (S.role === "none") { p.innerHTML = vNotMember(); return; }
  if (isAdminView()) {
    const v = { hoy: aHoy, semana: aSemana, alumnos: aAlumnos, cobros: aCobros }[S.view] || aHoy;
    p.innerHTML = shell(v(), [["hoy", "Hoy", "sun"], ["semana", "Semana", "cal"], ["alumnos", "Alumnos", "ppl"], ["cobros", "Cobros", "cash"]],
      { semana: S.requests.filter((r) => r.status === "pending").length, cobros: active().filter((s) => payOf(s.id) === "informed").length });
  } else {
    const v = { hoy: sHoy, rutina: sRutina, clases: sClases, pagos: sPagos }[S.view] || sHoy;
    p.innerHTML = shell(v(), [["hoy", "Hoy", "sun"], ["rutina", "Rutina", "bar"], ["clases", "Clases", "cal"], ["pagos", "Pagos", "cash"]]);
  }
  window.scrollTo(0, sc);
}

/* ================================================================== */
/* eventos                                                             */
/* ================================================================== */
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "mailForm") {
    const email = $("#loginEmail").value.trim().toLowerCase();
    await act(async () => { await db.signInEmail(email); S.loginMsg = "Listo: te mandamos un link a " + email + ". Abrilo desde este celular."; render(); });
  }
  if (f.id === "studentForm") {
    const freq = +$("#fFreq").value;
    const sched = [], split = [];
    for (let i = 0; i < freq; i++) { sched.push({ d: +$("#fd" + i).value, t: $("#ft" + i).value }); split.push($("#fg" + i).value); }
    const row = { name: $("#fName").value.trim(), email: $("#fEmail").value.trim().toLowerCase() || null, phone: $("#fPhone").value.trim() || null, freq, sched, split, notes: $("#fNotes").value.trim() || null };
    if (f.dataset.id) { row.id = f.dataset.id; row.recover = +$("#fRec").value || 0; row.next_idx = +$("#fNext").value || 0; }
    if (!row.name) return toast("Falta el nombre");
    await act(async () => { await db.saveStudent(row); closeSheet(); await refresh(); }, f.dataset.id ? "Guardado" : row.name + " sumado al equipo 💪");
  }
  if (f.id === "settingsForm") {
    const p = { alias: $("#sAlias").value.trim(), bank: $("#sBank").value.trim(), buen_dia: $("#sMsg").value, app_url: $("#sUrl").value.trim() };
    await act(async () => { S.settings = await db.saveSettings(p); closeSheet(); render(true); }, "Ajustes guardados");
  }
  if (f.id === "bulkForm") {
    const { rows, errs } = parseBulk($("#bulkText").value);
    if (!rows.length) return toast("No encontré alumnos en el texto");
    if (errs.length && !f.dataset.force) { $("#bulkErr").innerHTML = errs.map(esc).join("<br>") + "<br><b>Tocá Importar de nuevo para seguir igual.</b>"; f.dataset.force = "1"; return; }
    await act(async () => { await db.importStudents(rows); closeSheet(); await refresh(); }, rows.length + " alumnos cargados");
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "q") { S.q = e.target.value; const pos = e.target.selectionStart; render(true); const q = $("#q"); q.focus(); q.setSelectionRange(pos, pos); }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "fFreq") {
    const freq = +e.target.value, cur = [];
    for (let i = 0; i < 5; i++) if ($("#fd" + i)) cur.push({ d: +$("#fd" + i).value, t: $("#ft" + i).value });
    const s = { ...S.formSplitSeed, name: $("#fName").value, email: $("#fEmail").value, phone: $("#fPhone").value, notes: $("#fNotes").value, freq, split: SPLIT[freq], sched: Array.from({ length: freq }, (_, i) => cur[i] || { d: Math.min(5, (cur[i - 1]?.d || 0) + 2), t: cur[0]?.t || "08:00" }) };
    const id = $("#studentForm").dataset.id; studentForm(id ? { ...s, id } : null); if (!id) { $("#fName").value = s.name; $("#fEmail").value = s.email; $("#fPhone").value = s.phone; $("#fFreq").value = freq; }
  }
});

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act, d = el.dataset;
  if (a === "close-bg") { if (e.target === el) closeSheet(); return; }
  switch (a) {
    case "close": closeSheet(); break;
    case "copy": copy(d.text); break;
    case "google": await act(() => db.signInGoogle()); break;
    case "demo": db.demoAs(d.role); break;
    case "logout": closeSheet(); S.asStudent = false; await db.signOut(); break;
    case "menu":
      sheet(`${sheetHead("Cuenta")}<div class="small muted">${esc(S.who?.email || "")}</div>
        ${S.role === "admin" && S.who?.student ? `<button class="btn block" data-act="switch">${S.asStudent ? "Volver al panel de Juan" : "Ver como alumno (" + esc(S.who.student.name) + ")"}</button>` : ""}
        ${db.mode === "demo" ? `<button class="btn block" data-act="demo-reset">Reiniciar datos de demo</button>` : ""}
        <button class="btn danger block" data-act="logout">Salir</button>`);
      break;
    case "switch": S.asStudent = !S.asStudent; S.view = "hoy"; closeSheet(); render(); break;
    case "demo-reset": db.demoReset(); closeSheet(); await refresh(false); toast("Demo reiniciada"); break;
    case "tab": S.view = d.v; S.sel = null; S.rDay = null; render(); break;

    /* ---------- admin ---------- */
    case "buendia": {
      const list = todays(), sent = lsGet("itc-sent-" + TDAY, []);
      sheet(`${sheetHead("Buen día")}
        <p class="small muted" style="margin:0">Tocá cada nombre: se abre WhatsApp con el mensaje listo y le das Enviar. El link lleva a la app para que confirme.</p>
        <div class="list">${list.map(({ s, t }) => { const link = waLink(s.phone, fill(S.settings.buen_dia, s, t)); const ok = sent.includes(s.id);
          return `<div class="li">${avatar(s.name, ok ? "ok" : "")}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub">${t}${s.phone ? "" : " · sin celular"}</div></div>${link ? `<a class="btn sm ${ok ? "" : "cel"}" href="${link}" target="_blank" rel="noopener" data-act="mark-sent" data-id="${s.id}">${ok ? "Reenviar" : "Enviar"}</a>` : ""}</div>`; }).join("") || '<p class="muted">Hoy no hay alumnos.</p>'}</div>
        <div class="label">O uno solo para el grupo de la mañana</div>
        <a class="btn block" href="${waShare("Buennnn díaaaa mi gente!! 🤜⚡️🤛\nHoy entrenamos en " + spotName() + ". Confirmen en la app: " + appLink())}" target="_blank" rel="noopener">${I.wa} Mandar al grupo</a>`);
      break;
    }
    case "mark-sent": { const k = "itc-sent-" + TDAY; const s = lsGet(k, []); if (!s.includes(d.id)) s.push(d.id); lsSet(k, s); el.textContent = "Reenviar"; el.classList.remove("cel"); el.closest(".li").querySelector(".av").classList.add("ok"); setTimeout(() => render(true), 300); break; }
    case "toggle-spot": {
      const spot = S.settings.spot === "rio" ? "lluvia" : "rio";
      await act(async () => { S.settings = await db.saveSettings({ spot }); render(true); });
      groupMsg(spot === "rio" ? "Volvemos al río" : "Spot de lluvia", spot === "rio" ? "*Buen día equipo!* ☀️\nPasó la lluvia, hoy entrenamos con normalidad en el río 🤜⚡️🤛"
        : "*Equipo!* 🌧\nPor pronóstico de lluvia hoy hacemos spot de lluvia en Acassuso, Rivera Indarte 947. El agua no nos vence 🤜⚡️🤛\nFirmes!");
      break;
    }
    case "slot": {
      const ids = occList(TDAY, d.t), sus = suspended(TDAY, d.t);
      sheet(`${sheetHead("Hoy " + d.t)}
        <div class="list">${ids.map(byId).filter(Boolean).map((s) => { const r = S.replies.find((x) => x.student_id === s.id)?.reply;
          return `<div class="li tap" data-act="student" data-id="${s.id}">${avatar(s.name)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub">Día ${(s.next_idx % s.split.length) + 1} · ${esc(s.split[s.next_idx % s.split.length])}</div></div><span class="chip ${r === "voy" ? "ok" : r === "tarde" ? "warn" : r === "no" ? "bad" : "off"}">${r === "voy" ? "Viene" : r === "tarde" ? "Tarde" : r === "no" ? "No viene" : "Sin resp."}</span></div>`; }).join("") || '<p class="muted">Turno libre.</p>'}</div>
        ${ids.length && !sus ? `<button class="up" data-act="class" data-t="${d.t}" style="min-height:64px;font-size:34px">UP!!!</button><button class="btn danger block" data-act="suspend" data-t="${d.t}">Suspender este turno</button>` : ""}`);
      break;
    }
    case "class": closeSheet(); await act(() => openClass(d.t)); break;
    case "cl-open": CLASS.open = CLASS.open === d.id ? null : d.id; renderClass(); break;
    case "kg": { const x = CLASS.list.find((x) => x.id === d.id); x.kg[d.ex] = Math.max(0, +(x.kg[d.ex] + +d.v).toFixed(1)); const sc = $(".sheet").scrollTop; renderClass(); $(".sheet").scrollTop = sc; break; }
    case "cl-done": { const x = CLASS.list.find((x) => x.id === d.id); x.done = true; const i = CLASS.list.indexOf(x); CLASS.open = CLASS.list[i + 1]?.id || null; renderClass(); break; }
    case "cl-finish": {
      const c = CLASS;
      await act(async () => {
        const w = [], ses = [], patch = [];
        c.list.forEach((x) => { const s = byId(x.id);
          Object.entries(x.kg).forEach(([ex, v]) => { if (v > 0) w.push({ student_id: x.id, exercise: ex, value: v, day: TDAY }); });
          ses.push({ student_id: x.id, day: TDAY, slot: c.t, group_name: x.g, kind: "done" });
          patch.push({ id: x.id, next_idx: (s.next_idx + 1) % s.split.length });
        });
        await db.addWeights(w); await db.addSessions(ses); await db.patchStudents(patch);
        S.adminWeights = {}; closeSheet(); await refresh();
      }, "Clase guardada. Pesos al día 💪");
      break;
    }
    case "suspend": case "sick-go": {
      const ts = a === "suspend" ? [d.t] : [...document.querySelectorAll("[name=sus]:checked")].map((x) => x.value);
      if (!ts.length) return toast("Elegí al menos un turno");
      const ids = [...new Set(ts.flatMap((t) => occList(TDAY, t)))];
      await act(async () => {
        await db.addSuspensions(ts.map((slot) => ({ day: TDAY, slot })));
        await db.patchStudents(ids.map((id) => ({ id, recover: (byId(id).recover || 0) + 1 })));
        await refresh();
      });
      groupMsg("Avisar al grupo", `Buen día amigos! Hoy no puedo dar ${ts.length > 1 ? "las clases de las " + ts.join(", ") : "la clase de las " + ts[0]} 😔\nNada se pierde, todo se reprograma: elijan desde la app cuándo recuperan 👉 ${appLink()}\nGracias! 🤜🖤🤛`);
      break;
    }
    case "sick": {
      const slots = SLOTS.filter((t) => occList(TDAY, t).length && !suspended(TDAY, t));
      sheet(`${sheetHead("¿Qué turnos suspendés?")}
        <p class="small muted" style="margin:0">Cada alumno queda con una clase a recuperar y elige horario desde su app.</p>
        ${slots.map((t) => `<label class="row card" style="flex-direction:row"><input type="checkbox" name="sus" value="${t}" ${+t.slice(0, 2) < 12 ? "checked" : ""} style="width:22px;height:22px"><b class="grow">${t}</b><span class="muted">${occList(TDAY, t).length} alumnos</span></label>`).join("") || '<p class="muted">No quedan turnos hoy.</p>'}
        <button class="btn danger block" data-act="sick-go">Suspender y avisar</button>`);
      break;
    }
    case "settings":
      sheet(`${sheetHead("Ajustes")}
      <form id="settingsForm" class="form">
        <div class="field"><label class="label" for="sAlias">Alias para cobrar</label><input id="sAlias" value="${esc(S.settings.alias)}"></div>
        <div class="field"><label class="label" for="sBank">Banco / titular</label><input id="sBank" value="${esc(S.settings.bank)}"></div>
        <div class="field"><label class="label" for="sMsg">Mensaje de buen día</label><textarea id="sMsg">${esc(S.settings.buen_dia)}</textarea>
        <span class="small muted">{nombre}, {hora}, {spot} y {link} se completan solos.</span></div>
        <div class="field"><label class="label" for="sUrl">Link de la app</label><input id="sUrl" value="${esc(S.settings.app_url)}" placeholder="${esc(location.origin + location.pathname)}"></div>
        <button class="btn pri block" type="submit">Guardar</button>
      </form>`);
      break;
    case "cell": S.sel = { day: d.day, t: d.t }; render(true); break;
    case "req-ok": {
      const r = S.requests.find((x) => x.id === d.id), s = byId(r.student_id), td = parseDay(r.to_day);
      await act(async () => {
        await db.setRequest(r.id, "ok");
        if (!r.from_day && s.recover > 0) await db.patchStudents([{ id: s.id, recover: s.recover - 1 }]);
        await refresh();
      });
      if (s.phone) sheet(`${sheetHead("Aprobado")}<p>¿Le avisás a ${esc(s.name)}?</p><a class="btn cel block" href="${waLink(s.phone, `Dale ${s.name.split(" ")[0]}!! Te espero el ${DOWL[td.getDay()]} ${td.getDate()} a las ${r.to_slot} 🤜⚡️🤛`)}" target="_blank" rel="noopener" data-act="close">${I.wa} Avisarle por WhatsApp</a>`);
      break;
    }
    case "req-no": await act(async () => { await db.setRequest(d.id, "no"); await refresh(); }, "Rechazado. Lo ve en su app."); break;
    case "saturday": groupMsg("Sábado de traino", "*Buen día equipo!* 💪🖤\nEste sábado hay traino para recuperar! Abro 10 y 11 am, máximo 7 por turno. Si se llenan, abro un tercero.\nAnótense acá abajo 🤜⚡️🤛"); break;
    case "filter": S.filter = d.v; render(true); break;
    case "student": studentSheet(d.id); break;
    case "new-student": studentForm(null); break;
    case "edit-student": studentForm(byId(d.id)); break;
    case "deactivate": await act(async () => { await db.patchStudents([{ id: d.id, active: false }]); closeSheet(); await refresh(); }, "Dado de baja. Ya no puede entrar a la app."); break;
    case "reactivate": await act(async () => { await db.patchStudents([{ id: d.id, active: true }]); closeSheet(); await refresh(); }, "Reactivado"); break;
    case "delete-ask": el.outerHTML = `<div class="card"><b>¿Seguro? Se borran sus pesos, pagos y clases.</b><div class="row"><button class="btn grow danger" data-act="delete" data-id="${d.id}">Sí, borrar</button><button class="btn grow" data-act="close">No</button></div></div>`; break;
    case "delete": await act(async () => { await db.deleteStudent(d.id); closeSheet(); await refresh(); }, "Borrado"); break;
    case "bulk":
      sheet(`${sheetHead("Carga rápida")}
        <p class="small muted" style="margin:0">Un alumno por línea, separado con punto y coma:<br><b>Nombre; celular; email; veces por semana; días; hora</b></p>
        <form id="bulkForm" class="form">
          <div class="field"><label class="label" for="bulkText">Lista</label><textarea id="bulkText" rows="8" placeholder="Lucía Pérez; 11 2345 6789; lucia@gmail.com; 3; lun mie vie; 08:00&#10;Martín Gómez; 11 3456 7890; martin@gmail.com; 2; mar jue; 18:00"></textarea></div>
          <div id="bulkErr" class="small" style="color:var(--sol)"></div>
          <button class="btn pri block" type="submit">Importar</button>
        </form>`);
      break;
    case "travel": {
      const s = byId(d.id);
      const txt = s.split.map((g, i) => `*Día ${i + 1} · ${g}*\n_Abs_ ${ABS[i % 4].items.join(" / ")} x4\n` + exercisesFor(g).map((e) => "- " + e.n + " " + e.s).join("\n")).join("\n\n") + `\n\nLETS DO THIS ${s.name.split(" ")[0].toUpperCase()} 🤜⚡️🤛`;
      sheet(`${sheetHead("Rutina de viaje")}<div class="wa"><div class="msg">${esc(txt)}</div></div>
        ${s.phone ? `<a class="btn cel block" href="${waLink(s.phone, txt)}" target="_blank" rel="noopener">${I.wa} Mandársela</a>` : ""}
        <button class="btn block" data-act="copy" data-text="${esc(txt)}">Copiar</button>`);
      break;
    }
    case "pay-ok": { const s = byId(d.id); await act(async () => { await db.setPayment(s.id, MONTH, "paid", monthly(s)); await refresh(); }, s.name + ": pago registrado ✔"); break; }
    case "remind": {
      const owe = active().filter((s) => payOf(s.id) === "pending");
      sheet(`${sheetHead("Recordatorio de pago")}<p class="small muted" style="margin:0">A cada uno le llega su monto.</p>
        <div class="list">${owe.map((s) => { const link = waLink(s.phone, `Buenas buenas ${s.name.split(" ")[0]}! 💪🖤\nCuando puedas me mandás ${monthName(MONTH)}? Son ${money(monthly(s))} (${money(rate(s.freq))} × ${s.freq} × 4).\nAlias: ${S.settings.alias} · ${S.settings.bank}\nGracias!! A meterle 🤜⚡️🤛`);
          return `<div class="li">${avatar(s.name)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub num">${money(monthly(s))}</div></div>${link ? `<a class="btn sm cel" href="${link}" target="_blank" rel="noopener">Enviar</a>` : '<span class="small muted">sin celular</span>'}</div>`; }).join("")}</div>`);
      break;
    }
    case "rate": { const rates = { ...S.settings.rates, [d.k]: Math.max(500, (+S.settings.rates[d.k] || 0) + +d.v) }; await act(async () => { S.settings = await db.saveSettings({ rates }); render(true); }); break; }
    case "announce": groupMsg("Cambio de honorarios", `*Hola Equipo buen arranque de semana!*\n\nLa finalidad de este mensaje es decirles que hay un cambio de honorarios:\n\n- 3 veces o más por semana: ${money(S.settings.rates[3])} la sesión\n- 2 veces por semana: ${money(S.settings.rates[2])} la sesión\n- 1 vez por semana: ${money(S.settings.rates[1])} la sesión\n\nComo siempre, se abona del 1 al 10 y las ausencias se recuperan dentro del mes. Cualquier duda me escriben por privado 🤜🖤🤛`); break;

    /* ---------- alumno ---------- */
    case "reply": await act(async () => { await db.setReply(TDAY, d.v); await refresh(); }, d.v === "voy" ? "Juan ya sabe que venís 🤜⚡️🤛" : d.v === "tarde" ? "Avisado: llegás un toque tarde" : "Juan ya sabe. Te queda una clase para recuperar."); break;
    case "rday": S.rDay = +d.v; render(true); break;
    case "install-ok": lsSet("itc-install-ok", true); render(true); break;
    case "pick": await act(async () => { await db.createRequest({ student_id: S.me.id, from_day: null, from_slot: null, to_day: d.day, to_slot: d.t, reason: S.me.recover > 0 ? "Recupera una clase" : "Quiere sumar un día" }); await refresh(); }, "Pedido enviado. Juan lo confirma."); break;
    case "paid": await act(async () => { await db.informPayment(d.month, +d.amount); await refresh(); }, "Le avisamos a Juan. Él confirma cuando le llega."); break;
    case "log": {
      const bw = d.bw === "1", h = history(S.weights, d.ex), v = h.length ? h[h.length - 1] : bw ? 8 : 10;
      sheet(`${sheetHead("Anotar")}<b>${esc(d.ex)}</b>
        <div class="step" style="justify-content:center"><button data-act="lg" data-v="${bw ? -1 : -2.5}">−</button><output id="lgv" class="num" style="font-size:40px;min-width:110px">${v}</output><button data-act="lg" data-v="${bw ? 1 : 2.5}">+</button></div>
        <div class="small muted" style="text-align:center">${bw ? "repeticiones" : "kilos"} · hoy</div>
        <button class="btn pri block" data-act="lg-save" data-ex="${esc(d.ex)}">Guardar</button>`);
      break;
    }
    case "lg": { const o = $("#lgv"); o.textContent = Math.max(0, +(+o.textContent + +d.v).toFixed(1)); break; }
    case "lg-save": await act(async () => { await db.addWeights([{ student_id: S.me.id, exercise: d.ex, value: +$("#lgv").textContent, day: TDAY }]); closeSheet(); await refresh(); }, "Anotado 💪"); break;
  }
});

/* ================================================================== */
/* arranque                                                            */
/* ================================================================== */
let authSeq = 0;
async function onSession(sess) {
  const seq = ++authSeq;
  S.auth = sess;
  if (!sess) { S.role = null; S.who = null; S.booting = false; render(); return; }
  try {
    S.who = await db.whoami();
    if (seq !== authSeq) return;
    S.role = S.who.admin ? "admin" : S.who.student ? "student" : "none";
    if (S.role !== "none") await load();
  } catch (e) { console.error(e); toast("Error de conexión: " + e.message); }
  S.booting = false; S.view = "hoy"; render();
}
(async function boot() {
  render();
  db = await createStore();
  db.onAuth((s) => { if ((s?.email || null) !== (S.auth?.email || null) || S.booting) onSession(s); });
  await onSession(await db.session());
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
