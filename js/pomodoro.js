/* =========================================================
   Pomodoro — focus timer, break cycle, task linking, stats.
   Independent storage: mananotes.pomodoro.v1
   ========================================================= */

import {
  els, state, ui, esc, getNote, saveNow, toast,
  refreshCurrentView, refreshSidebar,
} from './core.js';

const POMO_KEY = 'mananotes.pomodoro.v1';
const BASE_TITLE = document.title;

const VALID_MODES = ['focus', 'short', 'long'];
const MODE_META = {
  focus: { label: 'Fokus', short: 'Fokus' },
  short: { label: 'Istirahat', short: 'Istirahat' },
  long: { label: 'Istirahat panjang', short: 'Panjang' },
};
const DURATION_LIMITS = {
  focus: [5, 120],
  short: [1, 60],
  long: [5, 90],
};

const PLAY_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6l11.4-6.8z"/></svg>';
const PAUSE_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="5.4" width="3.6" height="13.2" rx="1.2"/><rect x="13.4" y="5.4" width="3.6" height="13.2" rx="1.2"/></svg>';
const TIMER_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13.2" r="7.8"/><path d="M12 9.2v4l2.4 1.7"/><path d="M9.2 2.4h5.6"/></svg>';

/* =========================================================
   State
   ========================================================= */

let pomo = defaultPomo();
let pomoLoaded = false;
let ticker = 0;
let booting = false;
let audioContext = null;

function defaultPomo() {
  return {
    settings: {
      focus: 25,
      short: 5,
      long: 15,
      autoBreak: true,
      autoFocus: false,
      sound: true,
      notify: false,
    },
    timer: {
      mode: 'focus',
      running: false,
      remainingMs: 25 * 60000,
      durationMs: 25 * 60000,
      endAt: 0,
      startedAt: 0,
    },
    cycle: { sinceLong: 0 },
    history: {},
    activeTask: null,
  };
}

function clampInt(value, min, max, fallback) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function sanitize(raw) {
  const base = defaultPomo();
  if (!raw || typeof raw !== 'object') return base;

  const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  Object.keys(DURATION_LIMITS).forEach((key) => {
    const [min, max] = DURATION_LIMITS[key];
    base.settings[key] = clampInt(settings[key], min, max, base.settings[key]);
  });
  ['autoBreak', 'autoFocus', 'sound', 'notify'].forEach((key) => {
    if (key in settings) base.settings[key] = Boolean(settings[key]);
  });

  const timer = raw.timer && typeof raw.timer === 'object' ? raw.timer : {};
  if (VALID_MODES.includes(timer.mode)) base.timer.mode = timer.mode;

  const modeDuration = base.settings[base.timer.mode] * 60000;
  base.timer.durationMs = clampInt(
    timer.durationMs,
    60000,
    3 * 3600000,
    modeDuration
  );
  base.timer.remainingMs = Math.min(
    base.timer.durationMs,
    clampInt(timer.remainingMs, 0, 3 * 3600000, base.timer.durationMs)
  );

  const endAt = Number(timer.endAt);
  const running = Boolean(timer.running) && Number.isFinite(endAt) && endAt > 0;
  base.timer.running = running;
  base.timer.endAt = running ? endAt : 0;
  base.timer.startedAt = Number(timer.startedAt) || 0;

  const cycle = raw.cycle && typeof raw.cycle === 'object' ? raw.cycle : {};
  base.cycle.sinceLong = clampInt(cycle.sinceLong, 0, 4, 0);

  const history = raw.history && typeof raw.history === 'object' ? raw.history : {};
  Object.keys(history).forEach((key) => {
    if (!isDateKey(key)) return;
    const entry = history[key];
    if (!entry || typeof entry !== 'object') return;
    const sessions = clampInt(entry.sessions, 0, 64, 0);
    const minutes = clampInt(entry.minutes, 0, 24 * 60, 0);
    if (!sessions && !minutes) return;
    base.history[key] = { sessions, minutes };
  });

  const active = raw.activeTask;
  if (
    active &&
    typeof active.collectionId === 'string' &&
    typeof active.noteId === 'string' &&
    typeof active.taskId === 'string'
  ) {
    base.activeTask = {
      collectionId: active.collectionId,
      noteId: active.noteId,
      taskId: active.taskId,
    };
  }

  return base;
}

function ensureLoaded() {
  if (pomoLoaded) return;
  pomoLoaded = true;
  try {
    const raw = localStorage.getItem(POMO_KEY);
    pomo = raw ? sanitize(JSON.parse(raw)) : defaultPomo();
  } catch (error) {
    console.warn('ManaNotes: gagal membaca sesi pomodoro.', error);
    pomo = defaultPomo();
  }
}

function savePomo() {
  try {
    localStorage.setItem(POMO_KEY, JSON.stringify(pomo));
  } catch (error) {
    console.warn('ManaNotes: gagal menyimpan sesi pomodoro.', error);
  }
}

/* =========================================================
   Timer core
   ========================================================= */

function modeDurationMs(mode) {
  return (pomo.settings[mode] || 25) * 60000;
}

function currentDurationMs() {
  return pomo.timer.durationMs || modeDurationMs(pomo.timer.mode);
}

function remainingMs() {
  if (pomo.timer.running && pomo.timer.endAt) {
    return Math.max(0, pomo.timer.endAt - Date.now());
  }
  return Math.max(0, pomo.timer.remainingMs);
}

function progressPct() {
  const duration = currentDurationMs();
  if (!duration) return 0;
  const used = duration - remainingMs();
  return Math.min(100, Math.max(0, Math.round((used / duration) * 100)));
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTicker() {
  stopTicker();
  ticker = window.setInterval(tick, 1000);
}

function stopTicker() {
  if (ticker) {
    clearInterval(ticker);
    ticker = 0;
  }
}

function tick() {
  if (!pomo.timer.running) {
    stopTicker();
    updateClockUI();
    return;
  }
  if (remainingMs() <= 0) {
    completeSession();
    return;
  }
  updateClockUI();
}

function startTimer() {
  ensureLoaded();
  if (pomo.timer.running) return;

  if (!pomo.timer.durationMs) pomo.timer.durationMs = modeDurationMs(pomo.timer.mode);
  if (remainingMs() <= 0) pomo.timer.remainingMs = pomo.timer.durationMs;

  const remaining = remainingMs();
  pomo.timer.running = true;
  pomo.timer.startedAt = Date.now();
  pomo.timer.endAt = Date.now() + remaining;

  savePomo();
  startTicker();
  syncSurfaces();
}

function pauseTimer() {
  if (!pomo.timer.running) return;
  pomo.timer.remainingMs = remainingMs();
  pomo.timer.running = false;
  pomo.timer.endAt = 0;

  savePomo();
  stopTicker();
  syncSurfaces();
}

function toggleTimer() {
  if (pomo.timer.running) pauseTimer();
  else startTimer();
}

function applyMode(mode) {
  pomo.timer.mode = mode;
  pomo.timer.running = false;
  pomo.timer.endAt = 0;
  pomo.timer.startedAt = 0;
  pomo.timer.durationMs = modeDurationMs(mode);
  pomo.timer.remainingMs = pomo.timer.durationMs;
}

function resetTimer() {
  stopTicker();
  applyMode(pomo.timer.mode);
  savePomo();
  syncSurfaces();
}

function setMode(mode) {
  if (!VALID_MODES.includes(mode) || mode === pomo.timer.mode) return;
  stopTicker();
  applyMode(mode);
  savePomo();
  syncSurfaces();
}

function skipSession() {
  stopTicker();
  const from = pomo.timer.mode;
  if (from === 'long') pomo.cycle.sinceLong = 0;
  applyMode(from === 'focus' ? 'short' : 'focus');
  savePomo();
  syncSurfaces();
}

function completeSession({ silent = false, allowAutoStart = true } = {}) {
  const finishedMode = pomo.timer.mode;
  const endedAt = pomo.timer.endAt || Date.now();
  const finishedDuration = currentDurationMs();

  stopTicker();
  pomo.timer.running = false;
  pomo.timer.endAt = 0;
  pomo.timer.startedAt = 0;

  const wasFocus = finishedMode === 'focus';

  if (wasFocus) {
    recordSession(endedAt, finishedDuration);
    pomo.cycle.sinceLong = Math.min(4, pomo.cycle.sinceLong + 1);
  } else if (finishedMode === 'long') {
    pomo.cycle.sinceLong = 0;
  }

  const nextMode = wasFocus
    ? pomo.cycle.sinceLong >= 4
      ? 'long'
      : 'short'
    : 'focus';

  applyMode(nextMode);
  savePomo();

  if (!silent) {
    playChime();

    if (wasFocus) {
      const task = activeTaskInfo();
      const breakLabel = nextMode === 'long' ? 'Istirahat panjang' : 'Istirahat';
      toast(
        `Sesi fokus selesai. ${breakLabel} ${pomo.settings[nextMode]} menit.`,
        task ? 'Tandai tugas' : null,
        task ? markActiveTaskDone : null
      );
      notify('Sesi fokus selesai', `${breakLabel} ${pomo.settings[nextMode]} menit.`);
    } else {
      toast('Istirahat selesai. Waktunya fokus lagi.');
      notify('Istirahat selesai', 'Siap untuk sesi fokus berikutnya?');
    }
  }

  const autoStart =
    allowAutoStart &&
    (nextMode === 'focus' ? pomo.settings.autoFocus : pomo.settings.autoBreak);

  if (autoStart) {
    startTimer();
  } else {
    syncSurfaces();
  }
}

/* =========================================================
   History & stats
   ========================================================= */

function historyFor(key) {
  return pomo.history[key] || { sessions: 0, minutes: 0 };
}

function recordSession(timestamp, duration) {
  const key = dateKey(new Date(timestamp));
  const entry = historyFor(key);
  entry.sessions += 1;
  entry.minutes += Math.max(1, Math.round(duration / 60000));
  pomo.history[key] = entry;

  // Keep the log small: last 90 days is plenty for streaks and charts.
  const keys = Object.keys(pomo.history).sort();
  while (keys.length > 90) {
    delete pomo.history[keys.shift()];
  }
}

function todayStats() {
  return historyFor(dateKey(new Date()));
}

function streakDays() {
  let streak = 0;
  const cursor = new Date();
  if (!historyFor(dateKey(cursor)).sessions) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let guard = 0; guard < 400; guard += 1) {
    if (!historyFor(dateKey(cursor)).sessions) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const weekdayShort = new Intl.DateTimeFormat('id-ID', { weekday: 'short' });

function lastSevenDays() {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = dateKey(date);
    days.push({
      key,
      label: weekdayShort.format(date).replace('.', ''),
      sessions: historyFor(key).sessions,
      isToday: offset === 0,
    });
  }
  return days;
}

/* =========================================================
   Task linking
   ========================================================= */

function activeTaskInfo() {
  const ref = pomo.activeTask;
  if (!ref) return null;
  const note = getNote(ref.collectionId, ref.noteId);
  if (!note) return null;
  const task = note.tasks.find((item) => item.id === ref.taskId);
  if (!task || task.done) return null;
  return {
    collectionId: ref.collectionId,
    note,
    task,
  };
}

function setActiveTask(value) {
  if (!value) {
    pomo.activeTask = null;
  } else {
    const [collectionId, noteId, taskId] = String(value).split('::');
    const note = getNote(collectionId, noteId);
    const task = note && note.tasks.find((item) => item.id === taskId && !item.done);
    pomo.activeTask = task ? { collectionId, noteId, taskId } : null;
  }
  savePomo();
  if (ui.view === 'pomodoro') renderPomodoro();
  updateClockUI();
}

function markActiveTaskDone() {
  const info = activeTaskInfo();
  if (!info) return;

  info.task.done = true;
  info.note.updatedAt = Date.now();
  pomo.activeTask = null;

  savePomo();
  saveNow();
  refreshSidebar();
  refreshCurrentView();
  toast('Tugas ditandai selesai. Nice!');
}

function openTaskOptions() {
  const list = [];
  state.collections.forEach((collection) => {
    collection.notes.forEach((note) => {
      note.tasks.forEach((task) => {
        if (task.done) return;
        list.push({
          collectionId: collection.id,
          noteId: note.id,
          taskId: task.id,
          text: task.text,
          noteTitle: note.title || 'Tanpa judul',
          collectionTitle: collection.title,
          updatedAt: note.updatedAt || 0,
        });
      });
    });
  });
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return list.slice(0, 80);
}

function activeTaskValue() {
  const ref = pomo.activeTask;
  return ref ? `${ref.collectionId}::${ref.noteId}::${ref.taskId}` : '';
}

/* =========================================================
   Feedback: chime + notification
   ========================================================= */

function playChime() {
  if (!pomo.settings.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioContext = audioContext || new Ctx();
    if (audioContext.state === 'suspended') audioContext.resume();

    const start = audioContext.currentTime + 0.02;
    [659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = start + index * 0.16;
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(at);
      osc.stop(at + 0.36);
    });
  } catch (error) {
    console.warn('ManaNotes: gagal memutar bel.', error);
  }
}

function notify(title, body) {
  if (!pomo.settings.notify || !document.hidden) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag: 'mananotes-pomodoro' });
  } catch (error) {
    console.warn('ManaNotes: gagal menampilkan notifikasi.', error);
  }
}

/* =========================================================
   Rendering
   ========================================================= */

function cycleDotsHTML() {
  const filled = Math.min(4, pomo.cycle.sinceLong);
  const dots = Array.from({ length: 4 }, (_, index) =>
    `<i class="${index < filled ? 'is-on' : ''}"></i>`
  ).join('');
  return `<span class="pomo-cycle" aria-label="${filled} dari 4 sesi selesai">${dots}</span>`;
}

function modeTabsHTML() {
  return VALID_MODES.map((mode) => {
    const active = mode === pomo.timer.mode;
    return `<button class="pomo-mode ${active ? 'is-active' : ''}" type="button"
      data-pomo-mode="${mode}" role="tab" aria-selected="${active}">${MODE_META[mode].label}</button>`;
  }).join('');
}

function taskSelectHTML() {
  const all = openTaskOptions();
  const query = ui.search.trim().toLowerCase();
  const current = activeTaskValue();

  if (!all.length) {
    return `
      <div class="pomo-task-empty">
        <p>Belum ada to-do terbuka. Tambahkan checklist di catatan dulu, atau mulai sesi tanpa target.</p>
        <button class="btn btn-ghost" type="button" data-view="todo">Buka to-do</button>
      </div>`;
  }

  let options = query
    ? all.filter((option) =>
        `${option.text} ${option.noteTitle} ${option.collectionTitle}`
          .toLowerCase()
          .includes(query)
      )
    : all;

  // Keep the active task visible even when the search filters it out.
  if (current && !options.some((option) => taskValue(option) === current)) {
    const active = all.find((option) => taskValue(option) === current);
    if (active) options = [active, ...options];
  }

  if (!options.length) {
    return `
      <label class="pomo-task-label" for="pomo-task-select">Fokus pada</label>
      <select class="pomo-select" id="pomo-task-select" data-pomo-task disabled>
        <option>Tidak ada tugas yang cocok</option>
      </select>
      <p class="pomo-task-hint">Coba kata kunci lain di kolom pencarian.</p>`;
  }

  return `
    <label class="pomo-task-label" for="pomo-task-select">Fokus pada</label>
    <select class="pomo-select" id="pomo-task-select" data-pomo-task>
      <option value="">Tanpa tugas</option>
      ${options
        .map((option) => {
          const value = taskValue(option);
          const label = `${option.text} — ${option.noteTitle}`;
          return `<option value="${value}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`;
        })
        .join('')}
    </select>`;
}

function taskValue(option) {
  return `${option.collectionId}::${option.noteId}::${option.taskId}`;
}

function taskMetaHTML() {
  const info = activeTaskInfo();
  if (!info) {
    if (!openTaskOptions().length) return '';
    return '<p class="pomo-task-hint">Pilih satu tugas biar sesi ini punya tujuan jelas.</p>';
  }
  const collection = state.collections.find((item) => item.id === info.collectionId);
  return `<p class="pomo-task-hint is-linked">Terhubung ke <b>${esc(
    collection ? collection.title : 'Koleksi'
  )}</b> · ${esc(info.note.title || 'Tanpa judul')}</p>`;
}

function durationField(key, label) {
  const [min, max] = DURATION_LIMITS[key];
  return `
    <label class="pomo-field">
      <span>${label}</span>
      <input type="number" inputmode="numeric" min="${min}" max="${max}" step="1"
        value="${pomo.settings[key]}" data-pomo-setting="${key}"
        aria-label="Durasi ${label} dalam menit" />
    </label>`;
}

function switchRow(key, label, checked) {
  return `
    <label class="pomo-switch-row">
      <span>${label}</span>
      <input type="checkbox" data-pomo-setting="${key}" ${checked ? 'checked' : ''} />
    </label>`;
}

function weekHTML() {
  const days = lastSevenDays();
  const max = Math.max(1, ...days.map((day) => day.sessions));
  return days
    .map((day) => {
      const height = day.sessions ? Math.max(10, Math.round((day.sessions / max) * 100)) : 0;
      return `
        <div class="pomo-day ${day.isToday ? 'is-today' : ''}">
          <span class="pomo-day-count">${day.sessions || ''}</span>
          <span class="pomo-day-track"><i style="height: ${height}%"></i></span>
          <span class="pomo-day-label">${day.label}</span>
        </div>`;
    })
    .join('');
}

export function renderPomodoro() {
  ensureLoaded();
  if (!els.viewPomodoro) return;

  const today = todayStats();
  const streak = streakDays();
  const running = pomo.timer.running;
  const mode = pomo.timer.mode;
  const remaining = remainingMs();

  els.viewPomodoro.innerHTML = `
    <header class="page-head">
      <div>
        <span class="eyebrow">Pomodoro</span>
        <h1 class="page-title">Fokus</h1>
        <p class="page-sub">${
          running
            ? 'Sesi berjalan. Timer tetap jalan walau kamu pindah menu.'
            : `Sesi ke-${Math.min(4, pomo.cycle.sinceLong + 1)} dari 4 sebelum istirahat panjang.`
        }</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-ghost" type="button" data-pomo-reset>Reset</button>
        <button class="btn btn-ghost" type="button" data-pomo-skip>Lewati</button>
      </div>
    </header>

    <div class="pomo-layout">
      <section class="pomo-stage is-mode-${mode} ${running ? 'is-running' : ''}"
        data-pomo-surface aria-label="Timer pomodoro">
        <div class="pomo-modes" role="tablist" aria-label="Mode timer">
          ${modeTabsHTML()}
        </div>

        <div class="pomo-ring" data-pomo-pct style="--pct: ${progressPct()}">
          <div class="pomo-ring-inner">
            <span class="pomo-mode-label" data-pomo-mode-label>${MODE_META[mode].label}</span>
            <strong class="pomo-time" data-pomo-time>${formatClock(remaining)}</strong>
            ${cycleDotsHTML()}
          </div>
        </div>

        <div class="pomo-controls">
          <button class="btn btn-primary pomo-toggle" type="button" data-pomo-toggle
            aria-pressed="${running}">
            <span class="pomo-toggle-icon" data-pomo-toggle-icon>${running ? PAUSE_SVG : PLAY_SVG}</span>
            <span data-pomo-toggle-label>${running ? 'Jeda' : 'Mulai'}</span>
          </button>
        </div>

        <div class="pomo-task">
          ${taskSelectHTML()}
          ${taskMetaHTML()}
        </div>
      </section>

      <aside class="pomo-side">
        <section class="pomo-card">
          <span class="eyebrow">Hari ini</span>
          <h3>${today.sessions ? 'Kerja bagus, lanjut!' : 'Belum ada sesi'}</h3>
          <div class="pomo-stats">
            <div class="pomo-stat">
              <strong>${today.sessions}</strong>
              <span>sesi</span>
            </div>
            <div class="pomo-stat">
              <strong>${today.minutes}</strong>
              <span>menit</span>
            </div>
            <div class="pomo-stat">
              <strong>${streak}</strong>
              <span>hari</span>
            </div>
          </div>
        </section>

        <section class="pomo-card">
          <span class="eyebrow">7 hari terakhir</span>
          <h3>Konsistensi fokus</h3>
          <div class="pomo-week">${weekHTML()}</div>
        </section>

        <section class="pomo-card pomo-card--settings">
          <span class="eyebrow">Pengaturan</span>
          <h3>Durasi &amp; perilaku</h3>
          <div class="pomo-field-row">
            ${durationField('focus', 'Fokus')}
            ${durationField('short', 'Istirahat')}
            ${durationField('long', 'Panjang')}
          </div>
          <p class="pomo-settings-hint">${
            running
              ? 'Durasi baru berlaku untuk sesi berikutnya. Sesi yang jalan tetap pakai durasi lama.'
              : 'Durasi dalam menit. Isi lalu klik di luar kolom untuk menyimpan.'
          }</p>
          ${switchRow('autoBreak', 'Mulai istirahat otomatis', pomo.settings.autoBreak)}
          ${switchRow('autoFocus', 'Mulai fokus otomatis', pomo.settings.autoFocus)}
          ${switchRow('sound', 'Suara bel saat sesi selesai', pomo.settings.sound)}
          ${switchRow('notify', 'Notifikasi saat tab di background', pomo.settings.notify)}
        </section>
      </aside>
    </div>`;

  updateClockUI();
}

export function pomodoroWidgetHTML() {
  ensureLoaded();
  const today = todayStats();
  const running = pomo.timer.running;
  const mode = pomo.timer.mode;
  const task = activeTaskInfo();

  return `
    <section class="pomo-widget is-mode-${mode} ${running ? 'is-running' : ''}"
      data-pomo-surface aria-label="Pomodoro">
      <div class="pomo-widget-main">
        <span class="pomo-widget-icon">${TIMER_SVG}</span>
        <div class="pomo-widget-copy">
          <span class="eyebrow">Pomodoro</span>
          <div class="pomo-widget-line">
            <strong data-pomo-time>${formatClock(remainingMs())}</strong>
            <span class="pomo-widget-mode" data-pomo-mode-label>${MODE_META[mode].label}</span>
          </div>
          <p>${
            task
              ? `Fokus: ${esc(task.task.text)}`
              : `${today.sessions} sesi · ${today.minutes} menit fokus hari ini`
          }</p>
        </div>
      </div>
      <div class="pomo-widget-actions">
        <button class="btn btn-primary" type="button" data-pomo-toggle aria-pressed="${running}">
          <span class="pomo-toggle-icon" data-pomo-toggle-icon>${running ? PAUSE_SVG : PLAY_SVG}</span>
          <span data-pomo-toggle-label>${running ? 'Jeda' : 'Mulai'}</span>
        </button>
        <button class="btn btn-ghost" type="button" data-view="pomodoro">Buka</button>
      </div>
      <div class="pomo-widget-bar"><span data-pomo-fill style="width: ${progressPct()}%"></span></div>
    </section>`;
}

/* =========================================================
   Live UI updates (every tick, no full re-render)
   ========================================================= */

function updateClockUI() {
  const remaining = remainingMs();
  const text = formatClock(remaining);
  const running = pomo.timer.running;
  const midway =
    !running && remaining > 0 && remaining <= currentDurationMs() - 1000;
  const toggleLabel = running ? 'Jeda' : midway ? 'Lanjutkan' : 'Mulai';

  document.querySelectorAll('[data-pomo-time]').forEach((node) => {
    node.textContent = text;
  });

  const pct = progressPct();
  document.querySelectorAll('[data-pomo-pct]').forEach((node) => {
    node.style.setProperty('--pct', String(pct));
  });
  document.querySelectorAll('[data-pomo-fill]').forEach((node) => {
    node.style.width = `${pct}%`;
  });
  document.querySelectorAll('[data-pomo-toggle-label]').forEach((node) => {
    node.textContent = toggleLabel;
  });
  document.querySelectorAll('[data-pomo-toggle-icon]').forEach((node) => {
    node.innerHTML = running ? PAUSE_SVG : PLAY_SVG;
  });
  document.querySelectorAll('[data-pomo-toggle]').forEach((node) => {
    node.setAttribute('aria-pressed', String(running));
  });
  document.querySelectorAll('[data-pomo-surface]').forEach((node) => {
    node.classList.toggle('is-running', running);
  });

  if (els.navPomoCount) {
    if (running) {
      els.navPomoCount.hidden = false;
      els.navPomoCount.textContent = `${Math.max(1, Math.ceil(remaining / 60000))}m`;
    } else {
      els.navPomoCount.hidden = true;
    }
  }

  document.title = running
    ? `${text} · ${MODE_META[pomo.timer.mode].short} — ManaNotes`
    : BASE_TITLE;
}

function syncSurfaces() {
  if (!booting) {
    if (ui.view === 'pomodoro') renderPomodoro();
    else if (ui.view === 'dashboard') refreshCurrentView();
  }
  updateClockUI();
}

/* =========================================================
   Settings
   ========================================================= */

async function setNotify(enabled) {
  if (!enabled) {
    pomo.settings.notify = false;
    savePomo();
    renderPomodoro();
    return;
  }

  if (typeof Notification === 'undefined') {
    pomo.settings.notify = false;
    savePomo();
    renderPomodoro();
    toast('Browser ini belum mendukung notifikasi.');
    return;
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    pomo.settings.notify = false;
    savePomo();
    renderPomodoro();
    toast('Izin notifikasi ditolak. Aktifkan dari pengaturan browser.');
    return;
  }

  pomo.settings.notify = true;
  savePomo();
  renderPomodoro();
  toast('Notifikasi aktif saat tab di background.');
}

function onChange(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const taskSelect = target.closest('[data-pomo-task]');
  if (taskSelect) {
    setActiveTask(taskSelect.value);
    return;
  }

  const field = target.closest('[data-pomo-setting]');
  if (!field) return;

  const key = field.dataset.pomoSetting;

  if (key === 'notify') {
    setNotify(field.checked);
    return;
  }

  if (DURATION_LIMITS[key]) {
    const [min, max] = DURATION_LIMITS[key];
    const wasFresh =
      !pomo.timer.running &&
      pomo.timer.remainingMs >= pomo.timer.durationMs - 500;

    pomo.settings[key] = clampInt(field.value, min, max, pomo.settings[key]);

    if (wasFresh && pomo.timer.mode === key) {
      pomo.timer.durationMs = modeDurationMs(key);
      pomo.timer.remainingMs = pomo.timer.durationMs;
    }

    savePomo();
    renderPomodoro();
    updateClockUI();
    return;
  }

  if (key === 'autoBreak' || key === 'autoFocus' || key === 'sound') {
    pomo.settings[key] = field.checked;
    savePomo();
    renderPomodoro();
  }
}

/* =========================================================
   Events & init
   ========================================================= */

function onDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const modeButton = target.closest('[data-pomo-mode]');
  if (modeButton) {
    setMode(modeButton.dataset.pomoMode);
    return;
  }

  if (target.closest('[data-pomo-toggle]')) {
    toggleTimer();
    return;
  }

  if (target.closest('[data-pomo-reset]')) {
    resetTimer();
    return;
  }

  if (target.closest('[data-pomo-skip]')) {
    skipSession();
  }
}

export function initPomodoro() {
  ensureLoaded();

  booting = true;
  if (pomo.timer.running) {
    if (pomo.timer.endAt > Date.now()) startTicker();
    else completeSession({ silent: true, allowAutoStart: false });
  }
  booting = false;

  document.addEventListener('click', onDocumentClick);
  document.addEventListener('change', onChange);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  window.addEventListener('focus', tick);

  updateClockUI();
}
