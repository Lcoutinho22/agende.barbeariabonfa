/* ============================================================
   firebase-init.js — Módulo Firebase com sistema pending/confirmed
   
   ESTADOS DE AGENDAMENTO:
   - "pending"   → cliente solicitou, aguarda confirmar do barbeiro
   - "confirmed" → barbeiro confirmou, slot bloqueado para todos
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue, get, remove }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPDV-JjqfkoxfczmEj016Y75W-Fx2lRS8",
  authDomain: "barbearia-bonfa.firebaseapp.com",
  projectId: "barbearia-bonfa",
  storageBucket: "barbearia-bonfa.firebasestorage.app",
  messagingSenderId: "170575734231",
  appId: "1:170575734231:web:02a371885eea9888739792",
  databaseURL: "https://barbearia-bonfa-default-rtdb.firebaseio.com"
};

let db = null;
let currentUnsub = null;
let isReady = false;

try {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  isReady = true;
  console.log("[Bonfá] Firebase OK");
} catch (err) {
  console.warn("[Bonfá] Firebase não iniciou — modo offline.", err.message);
}

/* ─────────────────────────────────────────────────────────────
   API PÚBLICA exposta em window
   ───────────────────────────────────────────────────────────── */

/**
 * Escuta em tempo real os agendamentos de uma data.
 * Chama onUpdate({ confirmed: Set<hora>, pending: Set<hora> })
 */
window.firebaseListenDate = function (dateKey, onUpdate) {
  if (currentUnsub) { currentUnsub(); currentUnsub = null; }

  if (isReady) {
    const r = ref(db, `bookings/${dateKey}`);
    currentUnsub = onValue(r, (snap) => {
      const raw = snap.val() || {};
      const confirmed = new Set();
      const pending   = new Set();
      Object.entries(raw).forEach(([time, data]) => {
        if (data.status === 'confirmed') confirmed.add(time);
        else pending.add(time);
      });
      onUpdate({ confirmed, pending });
      _setStatus(true);
    }, (err) => {
      console.error("[Bonfá] Listener erro:", err);
      _setStatus(false);
      onUpdate(_localRead(dateKey));
    });
  } else {
    _setStatus(false);
    onUpdate(_localRead(dateKey));
  }
};

/**
 * Salva solicitação como PENDING (aguarda confirmar do barbeiro).
 * Retorna Promise<true|false>
 */
window.firebaseSavePending = async function (dateKey, timeKey, payload) {
  const data = { ...payload, status: 'pending', ts: Date.now() };
  if (isReady) {
    try {
      await set(ref(db, `bookings/${dateKey}/${timeKey}`), data);
      return true;
    } catch (err) {
      console.error("[Bonfá] Erro ao salvar pending:", err);
    }
  }
  // Fallback localStorage
  _localSave(dateKey, timeKey, data);
  return true;
};

/**
 * Confirma um agendamento (uso no admin.html).
 * Muda status para 'confirmed'.
 */
window.firebaseConfirm = async function (dateKey, timeKey) {
  if (!isReady) return false;
  try {
    const r = ref(db, `bookings/${dateKey}/${timeKey}/status`);
    await set(r, 'confirmed');
    return true;
  } catch (err) { console.error(err); return false; }
};

/**
 * Rejeita/remove um agendamento (uso no admin.html).
 */
window.firebaseReject = async function (dateKey, timeKey) {
  if (!isReady) return false;
  try {
    await remove(ref(db, `bookings/${dateKey}/${timeKey}`));
    return true;
  } catch (err) { console.error(err); return false; }
};

/**
 * Retorna todos os agendamentos de uma data (para o admin.html).
 * Retorna objeto: { [time]: { name, service, price, status, ts } }
 */
window.firebaseGetAll = async function (dateKey) {
  if (!isReady) return _localReadAll(dateKey);
  try {
    const snap = await get(ref(db, `bookings/${dateKey}`));
    return snap.val() || {};
  } catch (err) { return {}; }
};

/* ─────────────────────────────────────────────────────────────
   Helpers internos
   ───────────────────────────────────────────────────────────── */
function _localKey(d) { return `bonfa_bookings_${d}`; }

function _localRead(dateKey) {
  try {
    const obj = JSON.parse(localStorage.getItem(_localKey(dateKey)) || '{}');
    const confirmed = new Set();
    const pending   = new Set();
    Object.entries(obj).forEach(([t, d]) => {
      if (d.status === 'confirmed') confirmed.add(t);
      else pending.add(t);
    });
    return { confirmed, pending };
  } catch { return { confirmed: new Set(), pending: new Set() }; }
}

function _localReadAll(dateKey) {
  try { return JSON.parse(localStorage.getItem(_localKey(dateKey)) || '{}'); }
  catch { return {}; }
}

function _localSave(dateKey, timeKey, data) {
  try {
    const obj = _localReadAll(dateKey);
    obj[timeKey] = data;
    localStorage.setItem(_localKey(dateKey), JSON.stringify(obj));
  } catch (e) { console.warn(e); }
}

function _setStatus(connected) {
  const el = document.getElementById('firebaseStatus');
  if (!el) return;
  el.className = 'firebase-status ' + (connected ? 'connected' : 'error');
  const span = el.querySelector('span');
  if (span) span.textContent = connected ? 'Sincronizado' : 'Modo offline';
}
