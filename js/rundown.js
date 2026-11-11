/* =========================================================
   Rundown — agenda harian + kalender bulanan.
   Terpisah dari to-do dan koleksi; data punya storage sendiri.
   ========================================================= */

import { esc, uid, els, toast, refreshCurrentView } from './core.js';

const RUNDOWN_KEY = 'mananotes.rundown.v1';
const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dayShortFmt = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

let rundownItems = [];
let rundownLoaded = false;
let rundownCursor = new Date();
let rundownSelected = dateKey(new Date());
let rundownEditingId = null;

/* =========================================================
   Date helpers
   ========================================================= */

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function safeTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '';
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/* =========================================================
   Persistence
   ========================================================= */

function loadRundown() {
  try {
    const raw = localStorage.getItem(RUNDOWN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed && parsed.items)
        ? parsed.items
        : [];

    return list
      .filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.title === 'string' &&
          isDateKey(item.date)
      )
      .map((item) => ({
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        date: item.date,
        start: safeTime(item.start),
        end: safeTime(item.end),
        title: String(item.title).slice(0, 80),
        note: typeof item.note === 'string' ? item.note.slice(0, 300) : '',
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now(),
      }));
  } catch (error) {
    console.warn('ManaNotes: gagal membaca rundown.', error);
    return [];
  }
}

function saveRundown() {
  try {
    localStorage.setItem(
      RUNDOWN_KEY,
      JSON.stringify({ version: 1, items: rundownItems })
    );
  } catch (error) {
    console.warn('ManaNotes: gagal menyimpan rundown.', error);
  }
}

function ensureLoaded() {
  if (rundownLoaded) return;
  rundownItems = loadRundown();
  rundownLoaded = true;
}

function itemsForDate(key) {
  return rundownItems
    .filter((item) => item.date === key)
    .sort((a, b) => {
      const timeA = a.start || '99:99';
      const timeB = b.start || '99:99';
      return timeA.localeCompare(timeB) || a.createdAt - b.createdAt;
    });
}

function timeLabel(item) {
  if (!item.start) return 'Tanpa waktu';
  return item.end ? `${item.start}–${item.end}` : item.start;
}

/* =========================================================
   Rendering
   ========================================================= */

function calendarHTML() {
  const year = rundownCursor.getFullYear();
  const month = rundownCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const leading = (firstDay.getDay() + 6) % 7; // Senin = 0
  const gridStart = new Date(year, month, 1 - leading);
  const today = dateKey(new Date());
  const counts = new Map();

  rundownItems.forEach((item) => {
    counts.set(item.date, (counts.get(item.date) || 0) + 1);
  });

  let cells = '';
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );
    const key = dateKey(date);
    const count = counts.get(key) || 0;
    const classes = ['rd-day'];

    if (date.getMonth() !== month) classes.push('is-outside');
    if (key === today) classes.push('is-today');
    if (key === rundownSelected) classes.push('is-selected');

    const dots = count
      ? `<span class="rd-day-dots" aria-hidden="true">${'<i></i>'.repeat(Math.min(count, 3))}</span>`
      : '';
    const label = `${capitalize(dayShortFmt.format(date))}${count ? `, ${count} rundown` : ''}`;

    cells += `
      <button class="${classes.join(' ')}" type="button" data-rundown-date="${key}" aria-label="${label}">
        <span class="rd-day-num">${date.getDate()}</span>
        ${dots}
      </button>`;
  }

  return `
    <div class="rd-cal">
      <div class="rd-cal-head">
        <button class="icon-btn rd-month-btn" type="button" data-rundown-month="-1" aria-label="Bulan sebelumnya">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14.5 6 9 12l5.5 6" />
          </svg>
        </button>
        <span class="rd-cal-title">${capitalize(monthFmt.format(rundownCursor))}</span>
        <button class="icon-btn rd-month-btn" type="button" data-rundown-month="1" aria-label="Bulan berikutnya">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9.5 6 15 12l-5.5 6" />
          </svg>
        </button>
        <button class="btn btn-ghost rd-today-btn" type="button" data-rundown-today>Hari ini</button>
      </div>
      <div class="rd-weekdays" aria-hidden="true">
        ${WEEKDAY_LABELS.map((day) => `<span>${day}</span>`).join('')}
      </div>
      <div class="rd-grid" role="grid" aria-label="Kalender rundown">
        ${cells}
      </div>
    </div>`;
}

function itemHTML(item) {
  return `
    <button class="rd-item" type="button" data-rundown-edit="${item.id}" aria-label="Edit rundown ${esc(item.title)}">
      <span class="rd-item-body">
        <strong>${esc(item.title)}</strong>
        <span class="rd-item-meta">
          <span class="rd-time">${esc(timeLabel(item))}</span>
          ${item.note ? `<small>${esc(item.note)}</small>` : ''}
        </span>
      </span>
      <svg class="rd-pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 20h4.2L20 8.2 15.8 4 4 15.8V20z" />
        <path d="m13.8 6 4.2 4.2" />
      </svg>
    </button>`;
}

function dayPanelHTML() {
  const today = dateKey(new Date());
  const selectedDate = parseKey(rundownSelected);
  const items = itemsForDate(rundownSelected);
  const isToday = rundownSelected === today;

  const list = items.length
    ? `<div class="rd-list">${items.map(itemHTML).join('')}</div>`
    : `<div class="rd-empty">
        <p>Belum ada rundown di tanggal ini.</p>
        <button class="btn btn-ghost" type="button" data-rundown-add>+ Tambah rundown</button>
      </div>`;

  return `
    <div class="rd-day-panel">
      <div class="rd-day-head">
        <div>
          <span class="eyebrow">${isToday ? 'Hari ini' : 'Tanggal dipilih'}</span>
          <h3>${capitalize(dayFmt.format(selectedDate))}</h3>
        </div>
        <button class="btn btn-ghost rd-day-add" type="button" data-rundown-add>+ Tambah</button>
      </div>
      ${list}
    </div>`;
}

export function rundownWidgetHTML() {
  ensureLoaded();
  const total = rundownItems.length;

  return `
    <section class="rundown" aria-labelledby="rundown-heading">
      <header class="rundown-head">
        <div>
          <span class="eyebrow">Rundown harian</span>
          <h2 id="rundown-heading">Agenda kamu</h2>
          <p>${total ? `${total} rundown tersimpan` : 'Belum ada rundown. Tandai agenda pertamamu.'}</p>
        </div>
        <button class="btn btn-primary" type="button" data-rundown-add>
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Rundown baru
        </button>
      </header>
      <div class="rundown-body">
        ${calendarHTML()}
        ${dayPanelHTML()}
      </div>
    </section>`;
}

/* =========================================================
   Dialog
   ========================================================= */

function openRundownDialog(id = null) {
  ensureLoaded();
  rundownEditingId = id || null;
  const item = id ? rundownItems.find((entry) => entry.id === id) : null;

  els.rundownDialogTitle.textContent = item ? 'Edit rundown' : 'Rundown baru';
  els.rundownTitle.value = item ? item.title : '';
  els.rundownDate.value = item ? item.date : rundownSelected;
  els.rundownStart.value = item ? item.start : '';
  els.rundownEnd.value = item ? item.end : '';
  els.rundownNote.value = item ? item.note : '';
  els.rundownDelete.hidden = !item;

  if (!els.rundownDialog.open) els.rundownDialog.showModal();
  setTimeout(() => els.rundownTitle.focus(), 60);
}

function closeRundownDialog() {
  rundownEditingId = null;
  if (els.rundownDialog && els.rundownDialog.open) els.rundownDialog.close();
}

function saveEditing() {
  const title = els.rundownTitle.value.trim();
  if (!title) {
    els.rundownTitle.focus();
    return;
  }

  const date = els.rundownDate.value;
  if (!isDateKey(date)) {
    toast('Pilih tanggal rundown dulu.');
    els.rundownDate.focus();
    return;
  }

  const start = els.rundownStart.value;
  const end = els.rundownEnd.value;

  if (end && !start) {
    toast('Isi jam mulai dulu, atau kosongkan jam selesai.');
    els.rundownStart.focus();
    return;
  }

  if (start && end && end < start) {
    toast('Jam selesai harus setelah jam mulai.');
    els.rundownEnd.focus();
    return;
  }

  const now = Date.now();

  if (rundownEditingId) {
    const item = rundownItems.find((entry) => entry.id === rundownEditingId);
    if (item) {
      item.title = title;
      item.date = date;
      item.start = start;
      item.end = end;
      item.note = els.rundownNote.value.trim();
      item.updatedAt = now;
    }
  } else {
    rundownItems.unshift({
      id: uid(),
      date,
      start,
      end,
      title,
      note: els.rundownNote.value.trim(),
      createdAt: now,
      updatedAt: now,
    });
  }

  saveRundown();
  rundownSelected = date;
  rundownCursor = new Date(parseKey(date).getFullYear(), parseKey(date).getMonth(), 1);
  closeRundownDialog();
  refreshCurrentView();
  toast('Rundown disimpan.');
}

function deleteEditing() {
  if (!rundownEditingId) return;

  const index = rundownItems.findIndex((entry) => entry.id === rundownEditingId);
  if (index < 0) return;

  const snapshot = rundownItems[index];
  rundownItems.splice(index, 1);
  saveRundown();
  closeRundownDialog();
  refreshCurrentView();

  toast('Rundown dihapus.', 'Urungkan', () => {
    rundownItems.splice(Math.min(index, rundownItems.length), 0, snapshot);
    saveRundown();
    refreshCurrentView();
  });
}

/* =========================================================
   Calendar interaction
   ========================================================= */

function selectDate(key) {
  if (!isDateKey(key)) return;
  rundownSelected = key;
  const date = parseKey(key);
  rundownCursor = new Date(date.getFullYear(), date.getMonth(), 1);
  refreshCurrentView();
}

function shiftMonth(delta) {
  const next = new Date(
    rundownCursor.getFullYear(),
    rundownCursor.getMonth() + delta,
    1
  );
  rundownCursor = next;

  const now = new Date();
  rundownSelected =
    next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth()
      ? dateKey(now)
      : dateKey(next);
  refreshCurrentView();
}

function goToday() {
  const now = new Date();
  rundownCursor = new Date(now.getFullYear(), now.getMonth(), 1);
  rundownSelected = dateKey(now);
  refreshCurrentView();
}

/* =========================================================
   Events
   ========================================================= */

function onDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const dayButton = target.closest('[data-rundown-date]');
  if (dayButton) {
    selectDate(dayButton.dataset.rundownDate);
    return;
  }

  const monthButton = target.closest('[data-rundown-month]');
  if (monthButton) {
    shiftMonth(Number(monthButton.dataset.rundownMonth) || 0);
    return;
  }

  if (target.closest('[data-rundown-today]')) {
    goToday();
    return;
  }

  const editButton = target.closest('[data-rundown-edit]');
  if (editButton) {
    openRundownDialog(editButton.dataset.rundownEdit);
    return;
  }

  if (target.closest('[data-rundown-add]')) {
    openRundownDialog();
  }
}

export function initRundownEvents() {
  ensureLoaded();

  if (!els.rundownDialog) return;

  els.rundownForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveEditing();
  });

  els.rundownClose.addEventListener('click', closeRundownDialog);
  els.rundownCancel.addEventListener('click', closeRundownDialog);
  els.rundownDelete.addEventListener('click', deleteEditing);

  els.rundownDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeRundownDialog();
  });

  els.rundownDialog.addEventListener('click', (event) => {
    if (event.target === els.rundownDialog) closeRundownDialog();
  });

  document.addEventListener('click', onDocumentClick);
}
