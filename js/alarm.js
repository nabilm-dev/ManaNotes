/* =========================================================
   Alarm — alarm harian lokal.
   Bunyi selama tab ManaNotes kebuka (tanpa server/backend).
   ========================================================= */

import { $$, esc, uid, els, ui, toast, refreshCurrentView } from './core.js';

const ALARM_KEY = 'mananotes.alarms.v1';
const SETTINGS_KEY = 'mananotes.alarm.settings.v1';

const MAX_ALARMS = 20;
const SNOOZE_MINUTES = 5;
const FIRE_WINDOW_MS = 90 * 1000;
const TICK_MS = 15000;
const RING_INTERVAL_MS = 2400;
const RING_MAX_MS = 2 * 60 * 1000;

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

let alarms = [];
let settings = { sound: true, notify: false };
let loaded = false;

let tickTimer = null;
let audioContext = null;
let ringTimer = null;
let ringStopTimer = null;
let ringingAlarm = null;

let editingId = null;

/* =========================================================
   Helpers
   ========================================================= */

function pad(value) {
  return String(value).padStart(2, '0');
}

function isTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function repeatLabel(alarm) {
  if (alarm.repeat === 'weekdays') return 'Senin–Jumat';
  if (alarm.repeat === 'custom') {
    const days = DAY_ORDER.filter((day) => alarm.days.includes(day));
    return days.length ? days.map((day) => DAY_LABELS[day]).join(', ') : 'Hari tertentu';
  }
  return 'Setiap hari';
}

function isActiveOn(alarm, date) {
  const day = date.getDay();
  if (alarm.repeat === 'weekdays') return day >= 1 && day <= 5;
  if (alarm.repeat === 'custom') return alarm.days.includes(day);
  return true;
}

function relativeTime(target) {
  const diff = target - Date.now();
  if (diff <= 60000) return 'kurang dari 1 menit lagi';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes} menit lagi`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} jam ${rest} menit lagi` : `${hours} jam lagi`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'besok' : `${days} hari lagi`;
}

function nextOccurrence(alarm, from = Date.now()) {
  if (!alarm.enabled) return null;
  if (alarm.snoozeUntil && alarm.snoozeUntil > from) return new Date(alarm.snoozeUntil);

  const [hours, minutes] = alarm.time.split(':').map(Number);
  const base = new Date(from);

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(base);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);

    if (!isActiveOn(alarm, candidate)) continue;
    if (candidate.getTime() > from) return candidate;
  }

  return null;
}

function nextLabel(alarm) {
  if (!alarm.enabled) return 'Nonaktif';
  const next = nextOccurrence(alarm);
  if (!next) return 'Tidak ada jadwal';

  const time = `${pad(next.getHours())}:${pad(next.getMinutes())}`;
  const now = new Date();

  if (alarm.snoozeUntil && alarm.snoozeUntil > Date.now()) {
    return `Ditunda sampai ${time}`;
  }

  if (next.toDateString() === now.toDateString()) {
    return `Berikutnya ${time} · ${relativeTime(next.getTime())}`;
  }

  return `Berikutnya ${DAY_LABELS[next.getDay()]} ${time}`;
}

function defaultTime() {
  const date = new Date();
  date.setMinutes(Math.ceil((date.getMinutes() + 5) / 5) * 5, 0, 0);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* =========================================================
   Persistence
   ========================================================= */

function normalizeAlarm(item) {
  if (!item || typeof item !== 'object') return null;
  if (!isTime(item.time)) return null;

  const repeat = ['daily', 'weekdays', 'custom'].includes(item.repeat)
    ? item.repeat
    : 'daily';

  let days = Array.isArray(item.days)
    ? [...new Set(item.days.map(Number).filter((day) => day >= 0 && day <= 6))]
    : [];

  if (repeat === 'custom' && !days.length) days = [1, 2, 3, 4, 5];

  return {
    id: typeof item.id === 'string' && item.id ? item.id : uid(),
    time: item.time,
    label: String(item.label || 'Alarm').slice(0, 40),
    repeat,
    days: repeat === 'custom' ? days : [],
    enabled: item.enabled !== false,
    lastFired: isDateKey(item.lastFired) ? item.lastFired : '',
    snoozeUntil: Number(item.snoozeUntil) > 0 ? Number(item.snoozeUntil) : 0,
    const STOP_DURATION_MS = 2 * 60 * 1000; // 2 minutes mute after user presses “Matikan”
    stopUntil: Number(item.stopUntil) > 0 ? Number(item.stopUntil) : 0,
    createdAt: Number(item.createdAt) || Date.now(),
    updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now(),
  };
}

function loadAlarms() {
  try {
    const raw = localStorage.getItem(ALARM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed && parsed.alarms)
        ? parsed.alarms
        : [];

    return list.map(normalizeAlarm).filter(Boolean).slice(0, MAX_ALARMS);
  } catch (error) {
    console.warn('ManaNotes: gagal membaca alarm.', error);
    return [];
  }
}

function saveAlarms() {
  try {
    localStorage.setItem(
      ALARM_KEY,
      JSON.stringify({ version: 1, alarms })
    );
  } catch (error) {
    console.warn('ManaNotes: gagal menyimpan alarm.', error);
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      sound: parsed ? parsed.sound !== false : true,
      notify: parsed ? Boolean(parsed.notify) : false,
    };
  } catch (error) {
    return { sound: true, notify: false };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    /* ignore */
  }
}

function ensureLoaded() {
  if (loaded) return;
  alarms = loadAlarms();
  settings = loadSettings();
  loaded = true;
}

/* =========================================================
   Sound & notification
   ========================================================= */

function ensureAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = audioContext || new Ctx();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
  } catch (error) {
    return null;
  }
}

function playBurst(force = false) {
  if (!settings.sound && !force) return;
  const ctx = ensureAudio();
  if (!ctx) return;

  try {
    const start = ctx.currentTime + 0.02;
    [880, 880, 1174.66].forEach((frequency, index) => {
      const at = start + index * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);

      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.19);
    });
  } catch (error) {
    console.warn('ManaNotes: gagal memutar alarm.', error);
  }
}

function startRinging() {
  stopRingTimers();
  playBurst();
  ringTimer = setInterval(() => playBurst(), RING_INTERVAL_MS);
  ringStopTimer = setTimeout(() => {
    clearInterval(ringTimer);
    ringTimer = null;
  }, RING_MAX_MS);
}

function stopRingTimers() {
  clearInterval(ringTimer);
  clearTimeout(ringStopTimer);
  ringTimer = null;
  ringStopTimer = null;
}

function stopRinging() {
  stopRingTimers();
  if (els.alarmRing && els.alarmRing.open) els.alarmRing.close();
  ringingAlarm = null;
}

function snoozeRinging() {
  const alarm = ringingAlarm;
  if (!alarm) {
    stopRinging();
    return;
  }

  alarm.snoozeUntil = Date.now() + SNOOZE_MINUTES * 60 * 1000;
  saveAlarms();
  stopRinging();
  refreshCurrentView();
  toast(`Alarm ditunda ${SNOOZE_MINUTES} menit.`);
}

function showNotification(alarm) {
  if (!settings.notify || !document.hidden) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    const note = new Notification(`⏰ ${alarm.label}`, {
      body: `Alarm ${alarm.time} · ${repeatLabel(alarm)}`,
      tag: 'mananotes-alarm',
    });
    note.onclick = () => {
      window.focus();
      note.close();
    };
  } catch (error) {
    console.warn('ManaNotes: gagal menampilkan notifikasi alarm.', error);
  }
}

async function requestNotifyPermission() {
  if (typeof Notification === 'undefined') {
    toast('Browser ini belum mendukung notifikasi.');
    return false;
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      permission = 'denied';
    }
  }

  if (permission !== 'granted') {
    toast('Izin notifikasi ditolak. Alarm tetap bunyi selama tab kebuka.');
    return false;
  }

  return true;
}

/* =========================================================
   Firing
   ========================================================= */

function fireAlarm(alarm) {
  ringingAlarm = alarm;

  if (els.alarmRingTime) els.alarmRingTime.textContent = alarm.time;
  if (els.alarmRingLabel) els.alarmRingLabel.textContent = alarm.label;

  if (els.alarmRing && !els.alarmRing.open) {
    els.alarmRing.showModal();
  }

  startRinging();
  showNotification(alarm);
}

function checkAlarms() {
  if (!loaded || ringingAlarm) return;

  const now = Date.now();
  const today = dateKey(new Date());
  let fired = false;

  alarms.forEach((alarm) => {
    if (fired || !alarm.enabled) return;

    if (alarm.snoozeUntil) {
      if (now >= alarm.snoozeUntil) {
        alarm.snoozeUntil = 0;
        saveAlarms();
        fireAlarm(alarm);
        fired = true;
      }
      return;
    }

    if (alarm.lastFired === today) return;

    const [hours, minutes] = alarm.time.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    if (!isActiveOn(alarm, target)) return;
    if (now < target.getTime()) return;
    if (now - target.getTime() > FIRE_WINDOW_MS) return;

    alarm.lastFired = today;
    saveAlarms();
    fireAlarm(alarm);
    fired = true;
  });
}

/* =========================================================
   Rendering
   ========================================================= */

const BELL_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10.3 21a2 2 0 0 0 3.4 0" />
  </svg>`;

function alarmCardHTML(alarm) {
  return `
    <article class="al-card ${alarm.enabled ? '' : 'is-off'}" data-alarm-card="${alarm.id}">
      <div class="al-card-top">
        <strong class="al-time">${esc(alarm.time)}</strong>
        <label class="al-toggle" title="${alarm.enabled ? 'Matikan alarm' : 'Aktifkan alarm'}">
          <input type="checkbox" data-alarm-toggle="${alarm.id}" ${alarm.enabled ? 'checked' : ''} aria-label="Aktifkan alarm ${esc(alarm.label)}" />
          <span aria-hidden="true"></span>
        </label>
      </div>
      <div class="al-card-body">
        <strong class="al-label">${esc(alarm.label)}</strong>
        <span class="al-repeat">${esc(repeatLabel(alarm))}</span>
        <span class="al-next">${esc(nextLabel(alarm))}</span>
      </div>
      <div class="al-card-foot">
        <button class="al-edit" type="button" data-alarm-edit="${alarm.id}">Edit</button>
      </div>
    </article>`;
}

export function renderAlarm() {
  ensureLoaded();
  if (!els.viewAlarm) return;

  const query = String(ui.search || '').trim().toLowerCase();
  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));
  const visible = query
    ? sorted.filter((alarm) =>
        `${alarm.label} ${alarm.time} ${repeatLabel(alarm)}`.toLowerCase().includes(query)
      )
    : sorted;

  const activeCount = alarms.filter((alarm) => alarm.enabled).length;

  const header = `
    <header class="page-head">
      <div>
        <span class="eyebrow">Alarm</span>
        <h1 class="page-title">Alarm harian</h1>
        <p class="page-sub">${
          alarms.length
            ? `${activeCount} dari ${alarms.length} alarm aktif · bunyi selama tab ini kebuka`
            : 'Atur jam bangun, istirahat, atau pengingat harian.'
        }</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-primary" type="button" data-alarm-add>
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Alarm baru
        </button>
      </div>
    </header>`;

  const toolbar = `
    <div class="al-toolbar">
      <label class="al-switch">
        <span>Suara</span>
        <input type="checkbox" data-alarm-sound ${settings.sound ? 'checked' : ''} />
      </label>
      <label class="al-switch">
        <span>Notifikasi</span>
        <input type="checkbox" data-alarm-notify ${settings.notify ? 'checked' : ''} />
      </label>
      <button class="btn btn-ghost al-test" type="button" data-alarm-test>Tes bunyi</button>
      <p class="al-hint">Alarm cuma bunyi kalau ManaNotes sedang kebuka di tab ini.</p>
    </div>`;

  let body;

  if (!alarms.length) {
    body = `
      <div class="empty-state">
        <div class="empty-art al-empty-art">${BELL_SVG}</div>
        <h3>Belum ada alarm</h3>
        <p>Bikin alarm pertama. Bisa ulang tiap hari, cuma hari kerja, atau pilih hari sendiri.</p>
        <div class="empty-actions">
          <button class="btn btn-primary" type="button" data-alarm-add>Buat alarm</button>
        </div>
      </div>`;
  } else if (!visible.length) {
    body = `<div class="no-results"><strong>Tidak ada hasil</strong> Coba kata kunci lain.</div>`;
  } else {
    body = `<div class="al-grid">${visible.map(alarmCardHTML).join('')}</div>`;
  }

  els.viewAlarm.innerHTML = `${header}${toolbar}${body}`;
}

/* =========================================================
   Dialog
   ========================================================= */

function toggleDayPicker() {
  if (!els.alarmDays || !els.alarmRepeat) return;
  els.alarmDays.hidden = els.alarmRepeat.value !== 'custom';
}

function openAlarmDialog(id = null) {
  ensureLoaded();
  editingId = id || null;
  const alarm = id ? alarms.find((item) => item.id === id) : null;

  els.alarmDialogTitle.textContent = alarm ? 'Edit alarm' : 'Alarm baru';
  els.alarmTime.value = alarm ? alarm.time : defaultTime();
  els.alarmLabel.value = alarm ? alarm.label : '';
  els.alarmRepeat.value = alarm ? alarm.repeat : 'daily';

  const selectedDays = alarm && alarm.repeat === 'custom' ? alarm.days : DAY_ORDER;
  $$('[data-alarm-day]').forEach((input) => {
    input.checked = selectedDays.includes(Number(input.value));
  });

  els.alarmDelete.hidden = !alarm;
  toggleDayPicker();

  if (!els.alarmDialog.open) els.alarmDialog.showModal();
  setTimeout(() => els.alarmTime.focus(), 60);
}

function closeAlarmDialog() {
  editingId = null;
  if (els.alarmDialog && els.alarmDialog.open) els.alarmDialog.close();
}

function saveEditing() {
  const time = els.alarmTime.value;
  if (!isTime(time)) {
    toast('Isi jam alarm dulu.');
    els.alarmTime.focus();
    return;
  }

  const repeat = els.alarmRepeat.value;
  const days = $$('[data-alarm-day]')
    .filter((input) => input.checked)
    .map((input) => Number(input.value));

  if (repeat === 'custom' && !days.length) {
    toast('Pilih minimal satu hari untuk alarm ini.');
    return;
  }

  const isEdit = Boolean(editingId);
  if (!isEdit && alarms.length >= MAX_ALARMS) {
    toast(`Maksimal ${MAX_ALARMS} alarm. Hapus yang nggak dipakai dulu.`);
    return;
  }

  const label = (els.alarmLabel.value || '').trim().slice(0, 40) || 'Alarm';
  const now = Date.now();

  let alarm = isEdit ? alarms.find((item) => item.id === editingId) : null;

  if (alarm) {
    alarm.time = time;
    alarm.label = label;
    alarm.repeat = repeat;
    alarm.days = repeat === 'custom' ? days : [];
    alarm.updatedAt = now;
  } else {
    alarm = {
      id: uid(),
      time,
      label,
      repeat,
      days: repeat === 'custom' ? days : [],
      enabled: true,
      lastFired: '',
      snoozeUntil: 0,
      createdAt: now,
      updatedAt: now,
    };
    alarms.push(alarm);
  }

  // Jangan langsung bunyi kalau jamnya baru saja lewat hari ini.
  const [hours, minutes] = time.split(':').map(Number);
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  alarm.lastFired =
    target.getTime() <= now && isActiveOn(alarm, target) ? dateKey(new Date()) : '';
  alarm.snoozeUntil = 0;

  saveAlarms();
  ensureAudio();
  closeAlarmDialog();
  refreshCurrentView();
  toast(isEdit ? 'Alarm diperbarui.' : 'Alarm ditambahkan.');
}

function deleteEditing() {
  if (!editingId) return;

  const index = alarms.findIndex((item) => item.id === editingId);
  if (index < 0) return;

  const [removed] = alarms.splice(index, 1);
  saveAlarms();
  closeAlarmDialog();
  refreshCurrentView();

  toast(`Alarm "${removed.label}" dihapus.`, 'Urungkan', () => {
    alarms.splice(Math.min(index, alarms.length), 0, removed);
    saveAlarms();
    refreshCurrentView();
  });
}

function setEnabled(id, enabled) {
  const alarm = alarms.find((item) => item.id === id);
  if (!alarm) return;

  alarm.enabled = enabled;
  if (!enabled) alarm.snoozeUntil = 0;
  alarm.updatedAt = Date.now();

  saveAlarms();
  refreshCurrentView();
}

/* =========================================================
   Events
   ========================================================= */

function onDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.closest('[data-alarm-add]')) {
    openAlarmDialog();
    return;
  }

  const editButton = target.closest('[data-alarm-edit]');
  if (editButton) {
    openAlarmDialog(editButton.dataset.alarmEdit);
    return;
  }

  if (target.closest('[data-alarm-test]')) {
    ensureAudio();
    playBurst(true);
  }
}

function onDocumentChange(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const toggle = target.closest('[data-alarm-toggle]');
  if (toggle) {
    setEnabled(toggle.dataset.alarmToggle, toggle.checked);
    return;
  }

  if (target.matches('[data-alarm-sound]')) {
    settings.sound = target.checked;
    saveSettings();
    if (settings.sound) {
      ensureAudio();
      playBurst(true);
    }
    return;
  }

  if (target.matches('[data-alarm-notify]')) {
    const input = target;
    if (!input.checked) {
      settings.notify = false;
      saveSettings();
      return;
    }

    requestNotifyPermission().then((granted) => {
      settings.notify = granted;
      saveSettings();
      if (!granted) input.checked = false;
      else toast('Notifikasi alarm aktif.');
    });
  }
}

function unlockAudioOnce() {
  const unlock = () => {
    ensureAudio();
  };
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  document.addEventListener('keydown', unlock, { once: true, capture: true });
}

export function initAlarm() {
  ensureLoaded();

  unlockAudioOnce();

  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(checkAlarms, TICK_MS);

  if (!els.alarmDialog) return;

  els.alarmForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveEditing();
  });

  els.alarmClose.addEventListener('click', closeAlarmDialog);
  els.alarmCancel.addEventListener('click', closeAlarmDialog);
  els.alarmDelete.addEventListener('click', deleteEditing);
  els.alarmRepeat.addEventListener('change', toggleDayPicker);

  els.alarmDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeAlarmDialog();
  });

  els.alarmDialog.addEventListener('click', (event) => {
    if (event.target === els.alarmDialog) closeAlarmDialog();
  });

  if (els.alarmRing) {
    els.alarmRing.addEventListener('cancel', (event) => {
      event.preventDefault();
      stopRinging();
    });
  }

  if (els.alarmStop) els.alarmStop.addEventListener('click', stopRinging);
  if (els.alarmSnooze) els.alarmSnooze.addEventListener('click', snoozeRinging);

  document.addEventListener('click', onDocumentClick);
  document.addEventListener('change', onDocumentChange);
}
