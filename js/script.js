/* ============================================
   BARBEARIA BONFÁ — script.js
   Sistema: pending (cliente) → confirmed (barbeiro)
   ============================================ */

const SERVICES = [
  { name: "Corte",                       price: 35 },
  { name: "Barba",                       price: 25 },
  { name: "Sobrancelha",                 price: 15 },
  { name: "Pigmentação",                 price: 20 },
  { name: "Corte + Barba",               price: 45 },
  { name: "Corte + Sobrancelha",         price: 45 },
  { name: "Corte + Barba + Sobrancelha", price: 55 },
  { name: "Barba + Pigmentação",         price: 35 },
  { name: "Combo Completo",              price: 65 },
  { name: "Barboterapia",                price: 45 },
  { name: "Depilação Orelhas",           price: 20 },
  { name: "Depilação Nariz",             price: 20 },
  { name: "Remoção de Cravos",           price: 10 },
  { name: "Limpeza de Pele",             price: 50 },
];

const HOURS = {
  weekday:  ['18:00','18:50','19:40','20:30','21:20','22:00','22:50','23:40'],
  saturday: ['08:00','08:50','09:40','10:30','11:20'],
};

/* --- Estado global --- */
let pendingBooking = null;
let currentDateKey = null;
let currentSlots   = [];       // horários do dia selecionado
let confirmedSet   = new Set();
let pendingSet     = new Set();
let selectedTime   = null;

/* ─────────────────────────────────────────
   INICIALIZAÇÃO
   ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initServiceGrid();
  initDateMin();
  injectToast();
  injectShake();
  injectFirebaseStatusBadge();
  document.getElementById('clientName')?.addEventListener('input', updateScheduleBtn);
});

/* --- Tema --- */
function initTheme() {
  if (localStorage.getItem('bonfa-theme') === 'dark') {
    document.body.classList.add('dark-theme');
    document.querySelector('.theme-toggle i')?.classList.replace('fa-moon','fa-sun');
  }
}
function toggleTheme() {
  document.body.classList.toggle('dark-theme');
  const dark = document.body.classList.contains('dark-theme');
  document.querySelector('.theme-toggle i')
    ?.classList.replace(dark ? 'fa-moon':'fa-sun', dark ? 'fa-sun':'fa-moon');
  localStorage.setItem('bonfa-theme', dark ? 'dark' : 'light');
}

/* --- Data mínima = hoje --- */
function initDateMin() {
  const el = document.getElementById('dateSelect');
  if (!el) return;
  const n = new Date();
  el.min = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

/* --- Chips de serviço --- */
function initServiceGrid() {
  const grid = document.getElementById('serviceGrid');
  if (!grid) return;
  SERVICES.forEach((svc, idx) => {
    const chip = document.createElement('div');
    chip.className = 'service-chip';
    chip.innerHTML = `<span class="chip-name">${svc.name}</span><span class="chip-price">R$ ${svc.price}</span>`;
    chip.addEventListener('click', () => selectService(idx, chip));
    grid.appendChild(chip);
  });
}

function selectService(idx, chipEl) {
  document.querySelectorAll('.service-chip').forEach(c => c.classList.remove('active'));
  chipEl.classList.add('active');
  const svc = SERVICES[idx];
  document.getElementById('selectedService').value = svc.name;
  document.getElementById('selectedPrice').value   = svc.price;
  document.getElementById('badgeServiceName').textContent = svc.name;
  document.getElementById('badgePrice').textContent       = `R$ ${svc.price}`;
  document.getElementById('priceBadge').classList.add('visible');
  updateScheduleBtn();
}

/* ─────────────────────────────────────────
   SELEÇÃO DE DATA
   ───────────────────────────────────────── */
function onDateChange() {
  const val = document.getElementById('dateSelect').value;
  if (!val) return;

  const [y, m, d] = val.split('-').map(Number);
  const day = new Date(y, m-1, d).getDay();

  currentDateKey = val;
  selectedTime   = null;
  document.getElementById('selectedTime').value = '';
  updateScheduleBtn();

  const sec     = document.getElementById('timeSection');
  const closed  = document.getElementById('timeClosed');
  const loading = document.getElementById('timeLoading');
  const grid    = document.getElementById('timeGrid');

  sec.style.display = 'block';

  if (day === 0) {
    closed.style.display  = 'flex';
    loading.style.display = 'none';
    grid.style.display    = 'none';
    return;
  }

  closed.style.display  = 'none';
  grid.style.display    = 'grid';
  loading.style.display = 'flex';
  grid.innerHTML = '';
  currentSlots = day === 6 ? HOURS.saturday : HOURS.weekday;

  // Listener Firebase em tempo real
  if (typeof window.firebaseListenDate === 'function') {
    window.firebaseListenDate(currentDateKey, ({ confirmed, pending }) => {
      confirmedSet = confirmed;
      pendingSet   = pending;
      loading.style.display = 'none';
      renderTimeGrid(currentSlots, confirmedSet, pendingSet);
    });
  } else {
    // Firebase ainda carregando (ES module async)
    setTimeout(() => {
      if (typeof window.firebaseListenDate === 'function') {
        window.firebaseListenDate(currentDateKey, ({ confirmed, pending }) => {
          confirmedSet = confirmed;
          pendingSet   = pending;
          loading.style.display = 'none';
          renderTimeGrid(currentSlots, confirmedSet, pendingSet);
        });
      } else {
        loading.style.display = 'none';
        renderTimeGrid(currentSlots, new Set(), new Set());
      }
    }, 900);
  }
}

/* ─────────────────────────────────────────
   GRADE DE HORÁRIOS
   ───────────────────────────────────────── */

/*
  Estados visuais dos slots:
  - free      (verde)   → disponível
  - pending   (amarelo) → aguardando confirmação do barbeiro (não bloqueia outros)
  - confirmed (cinza)   → confirmado e BLOQUEADO
  - selected  (preto)   → selecionado pelo usuário atual
*/
function renderTimeGrid(slots, confirmed, pending) {
  const grid = document.getElementById('timeGrid');
  if (!grid) return;
  grid.innerHTML = '';

  slots.forEach((time, i) => {
    const isConfirmed = confirmed.has(time);
    const isPending   = pending.has(time);
    const isSelected  = time === selectedTime;

    let state, label;
    if (isConfirmed)      { state = 'confirmed'; label = 'Ocupado'; }
    else if (isPending)   { state = 'pending-slot'; label = 'Em análise'; }
    else if (isSelected)  { state = 'selected'; label = 'Selecionado'; }
    else                  { state = 'free'; label = 'Livre'; }

    const slot = document.createElement('div');
    slot.className = `time-slot ${state}`;
    slot.dataset.time = time;
    slot.style.animationDelay = `${i * 45}ms`;
    slot.innerHTML = `<span class="slot-time">${time}</span><span class="slot-label">${label}</span>`;

    if (!isConfirmed) {
      slot.addEventListener('click', () => onSelectSlot(time, slot, isPending));
    }
    grid.appendChild(slot);
  });
}

function onSelectSlot(time, slotEl, isPending) {
  // Avisa se slot está em análise mas permite tentar mesmo assim
  if (isPending) {
    showToast('⚠️ Este horário está em análise. Você pode solicitar, mas o barbeiro decide.', 'warning');
  }

  document.querySelectorAll('.time-slot.selected').forEach(el => {
    const t = el.dataset.time;
    const newState = confirmedSet.has(t) ? 'confirmed' : pendingSet.has(t) ? 'pending-slot' : 'free';
    el.className = `time-slot ${newState}`;
    el.querySelector('.slot-label').textContent =
      newState === 'pending-slot' ? 'Em análise' : 'Livre';
  });

  slotEl.className = 'time-slot selected';
  slotEl.querySelector('.slot-label').textContent = 'Selecionado';

  selectedTime = time;
  document.getElementById('selectedTime').value = time;
  updateScheduleBtn();
}

function updateScheduleBtn() {
  const btn = document.getElementById('btnSchedule');
  if (!btn) return;
  const nome    = document.getElementById('clientName')?.value.trim();
  const servico = document.getElementById('selectedService')?.value;
  btn.disabled = !(nome && servico && selectedTime);
}

/* ─────────────────────────────────────────
   CARROSSEIS
   ───────────────────────────────────────── */
function scrollGallery(dir) {
  document.getElementById('galleryTrack').scrollBy({ left: dir * 155, behavior: 'smooth' });
}
function scrollPrices(dir) {
  document.getElementById('priceTrack').scrollBy({ left: dir * 145, behavior: 'smooth' });
}

/* ─────────────────────────────────────────
   MODAL DE CONFIRMAÇÃO
   ───────────────────────────────────────── */
function abrirModalConfirmacao() {
  const nome    = document.getElementById('clientName').value.trim();
  const servico = document.getElementById('selectedService').value;
  const preco   = document.getElementById('selectedPrice').value;
  const data    = document.getElementById('dateSelect').value;
  const hora    = selectedTime;

  if (!nome)    { shakeField('clientName');            return; }
  if (!servico) { showToast('Selecione um serviço!');  return; }
  if (!data)    { shakeField('dateSelect');             return; }
  if (!hora)    { showToast('Selecione um horário!');  return; }

  // Não bloqueia se pending, apenas avisa — só confirmedSet bloqueia
  if (confirmedSet.has(hora)) {
    showToast('❌ Este horário já está confirmado! Escolha outro.', 'error');
    selectedTime = null;
    document.getElementById('selectedTime').value = '';
    onDateChange();
    return;
  }

  const [y, m, d] = data.split('-').map(Number);
  const dataFmt   = new Date(y, m-1, d).toLocaleDateString('pt-BR', {
    weekday:'long', day:'2-digit', month:'long', timeZone:'UTC'
  });

  document.getElementById('modalNome').textContent    = nome;
  document.getElementById('modalServico').textContent = servico;
  document.getElementById('modalData').textContent    = dataFmt;
  document.getElementById('modalHora').textContent    = hora;
  document.getElementById('modalPreco').textContent   = preco ? `R$ ${preco},00` : 'Consulte';

  pendingBooking = { nome, servico, preco, data, dataFmt, hora };

  document.getElementById('confirmModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharModal(e) {
  if (e && e.target !== document.getElementById('confirmModal')) return;
  document.getElementById('confirmModal').classList.remove('open');
  document.body.style.overflow = '';
}

async function confirmarAgendamento() {
  if (!pendingBooking) return;
  const { nome, servico, preco, data, dataFmt, hora } = pendingBooking;

  const btn = document.getElementById('btnModalConfirm');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>'; }

  try {
    // Salva como PENDING (não bloqueia ainda — só confirmar do barbeiro bloqueia)
    await window.firebaseSavePending(data, hora, { name: nome, service: servico, price: preco });

    fecharModal();

    // Mensagem WhatsApp com pedido de confirmação
    const msg = encodeURIComponent(
      `Olá! Gostaria de *solicitar* horário na Barbearia Bonfá:\n\n` +
      `👤 *Cliente:* ${nome}\n` +
      `✂️ *Serviço:* ${servico}\n` +
      `📅 *Data:* ${dataFmt}\n` +
      `🕐 *Horário:* ${hora}\n` +
      `💰 *Valor:* ${preco ? 'R$ ' + preco + ',00' : 'a consultar'}\n\n` +
      `Aguardo confirmação! 😊`
    );

    showToast('✅ Solicitação enviada! Aguarde confirmação.', 'success');
    setTimeout(() => {
      window.open(`https://wa.me/5532998033153?text=${msg}`, '_blank');
    }, 600);

    resetForm();
  } catch (err) {
    console.error(err);
    showToast('Erro ao enviar. Tente novamente.', 'error');
  } finally {
    pendingBooking = null;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> Solicitar'; }
  }
}

function resetForm() {
  document.getElementById('clientName').value = '';
  document.getElementById('selectedService').value = '';
  document.getElementById('selectedPrice').value = '';
  document.querySelectorAll('.service-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('priceBadge').classList.remove('visible');
  document.getElementById('dateSelect').value = '';
  document.getElementById('selectedTime').value = '';
  document.getElementById('timeSection').style.display = 'none';
  selectedTime = null; currentDateKey = null;
  confirmedSet = new Set(); pendingSet = new Set();
  updateScheduleBtn();
}

/* ─────────────────────────────────────────
   UTILITÁRIOS UI
   ───────────────────────────────────────── */
function injectToast() {
  const t = document.createElement('div');
  t.className = 'toast'; t.id = 'toast';
  document.body.appendChild(t);
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

function injectShake() {
  const s = document.createElement('style');
  s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}`;
  document.head.appendChild(s);
}

function shakeField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.animation = '';
  void el.offsetWidth;
  el.style.animation = 'shake 0.35s ease';
  el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}

function injectFirebaseStatusBadge() {
  const sec = document.getElementById('timeSection');
  if (!sec) return;
  const b = document.createElement('div');
  b.id = 'firebaseStatus'; b.className = 'firebase-status';
  b.innerHTML = '<span class="status-dot"></span><span>Conectando…</span>';
  sec.insertBefore(b, sec.firstChild);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });