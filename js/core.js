/* =========================================================
   Core — constants, helpers, DOM refs, shared state,
   persistence, data helpers, and the app callback registry.
   This module must not import any feature module.
   ========================================================= */

export const STORAGE_KEY = 'mananotes.v3';
export const FC_STORAGE_KEY = 'mananotes.flashcards.v1';
export const TUTORIAL_KEY = 'mananotes.tutorial.v1';
export const THEMES = ['ember', 'ocean', 'violet', 'lime', 'rose', 'amber'];
export const THEME_LABELS = {
  ember: 'Ember',
  ocean: 'Ocean',
  violet: 'Violet',
  lime: 'Lime',
  rose: 'Rose',
  amber: 'Amber',
};

export const CHECK_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 6.8"/></svg>';
export const KEBAB_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';
export const CLOSE_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export const COPY_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></svg>';
export const FOLDER_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.2l2 2.3H18a2.5 2.5 0 0 1 2.5 2.5v7.7A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5V7.5Z"/></svg>';
export const CHECK_SQUARE_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="m8 12.4 2.7 2.7L16.4 9"/></svg>';
export const ARROW_LEFT_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
export const CARDS_SVG =
  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="14" rx="3.5"/><path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V6"/><path d="M12 10v4M10 12h4"/></svg>';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const uid = () =>
  'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });

export const pad2 = (value) => String(value).padStart(2, '0');
export const debounce = (fn, wait) => {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

export const shortDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
export const fullDate = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function truncate(text, max) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const splitAt = slice.lastIndexOf(' ');
  return (splitAt > max * 0.55 ? slice.slice(0, splitAt) : slice).replace(/[.,;:\s]+$/, '') + '…';
}

/* =========================================================
   Elements
   ========================================================= */

export const els = {
  search: $('#search-input'),
  newNote: $('#btn-new-note'),
  sidebarCollections: $('#sidebar-collections'),
  navTodoCount: $('#nav-todo-count'),
  sideRing: $('#side-ring'),
  sideRingPct: $('#side-ring-pct'),
  sideProgressTitle: $('#side-progress-title'),
  sideProgressSub: $('#side-progress-sub'),
  main: $('#main'),
  viewDashboard: $('#view-dashboard'),
  viewCollection: $('#view-collection'),
  viewTodo: $('#view-todo'),
  noteDialog: $('#note-dialog'),
  editorClose: $('#editor-close'),
  editorDelete: $('#editor-delete'),
  editorDot: $('#editor-dot'),
  editorCollection: $('#editor-collection'),
  editorCover: $('#editor-cover'),
  editorDate: $('#editor-date'),
  editorTaskCount: $('#editor-task-count'),
  saveState: $('#save-state'),
  noteTitle: $('#note-title'),
  noteBody: $('#note-body'),
  taskList: $('#task-list'),
  taskForm: $('#task-form'),
  taskInput: $('#task-input'),
  taskProgressText: $('#task-progress-text'),
  taskProgressBar: $('#task-progress-bar'),
  summarizeBtn: $('#summarize-btn'),
  summaryOutput: $('#summary-output'),
  collectionDialog: $('#collection-dialog'),
  collectionForm: $('#collection-form'),
  collectionDialogTitle: $('#collection-dialog-title'),
  collectionName: $('#collection-name'),
  collectionSubtitle: $('#collection-subtitle'),
  themePicker: $('#theme-picker'),
  collectionDelete: $('#collection-delete'),
  helpBtn: $('#btn-help'),
  tutorialDialog: $('#tutorial-dialog'),
  tutorialStart: $('#tutorial-start'),
  rundownDialog: $('#rundown-dialog'),
  rundownForm: $('#rundown-form'),
  rundownDialogTitle: $('#rundown-dialog-title'),
  rundownTitle: $('#rundown-title'),
  rundownDate: $('#rundown-date'),
  rundownStart: $('#rundown-start'),
  rundownEnd: $('#rundown-end'),
  rundownNote: $('#rundown-note'),
  rundownDelete: $('#rundown-delete'),
  rundownClose: $('#rundown-close'),
  rundownCancel: $('#rundown-cancel'),
  toast: $('#toast'),
  toastText: $('#toast-text'),
  toastAction: $('#toast-action'),
  viewFlashcard: $('#view-flashcard'),
  fcModal: $('#fc-modal'),
  fcClose: $('#fc-close'),
  fcDeckName: $('#fc-deck-name'),
  fcCurrent: $('#fc-current'),
  fcTotal: $('#fc-total'),
  fcProgressFill: $('#fc-progress-fill'),
  fcCard: $('#fc-card'),
  fcCardWrap: $('#fc-card-wrap'),
  fcFrontText: $('#fc-front-text'),
  fcBackText: $('#fc-back-text'),
  fcRating: $('#fc-rating'),
  fcEditDialog: $('#fc-edit-dialog'),
  fcEditForm: $('#fc-edit-form'),
  fcEditTitle: $('#fc-edit-title'),
  fcQInput: $('#fc-q-input'),
  fcAInput: $('#fc-a-input'),
  fcContextInput: $('#fc-context-input'),
  fcCardDelete: $('#fc-card-delete'),
  fcTimerText: $('#fc-timer-text'),
  fcCardCounter: $('#fc-card-counter'),
  fcTtsFront: $('#fc-tts-front'),
  fcTtsBack: $('#fc-tts-back'),
  fcContextCard: $('#fc-context-card'),
  fcContextToggle: $('#fc-context-toggle'),
  fcContextBody: $('#fc-context-body'),
  fcContextText: $('#fc-context-text'),
  fcDeckDialog: $('#fc-deck-dialog'),
  fcDeckForm: $('#fc-deck-form'),
  fcDeckDialogTitle: $('#fc-deck-dialog-title'),
  fcDeckNameInput: $('#fc-deck-name-input'),
  fcThemePicker: $('#fc-theme-picker'),
  fcDeckDelete: $('#fc-deck-delete'),
};

/* =========================================================
   Shared state
   ========================================================= */

export let state = { collections: [] };
export const ui = {
  view: 'dashboard',
  collectionId: null,
  fcDeckId: null,
  search: '',
  collectionSummary: null,
};

export function setState(next) {
  state = next;
}

/* =========================================================
   Persistence
   ========================================================= */

let persistTimer = 0;

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.collections)) return null;

    const collections = parsed.collections.map((collection) => ({
      id: typeof collection.id === 'string' ? collection.id : uid(),
      title: String(collection.title || 'Tanpa nama'),
      subtitle: String(collection.subtitle || 'Notes & Tasks'),
      theme: THEMES.includes(collection.theme) ? collection.theme : 'ember',
      createdAt: Number(collection.createdAt) || Date.now(),
      notes: Array.isArray(collection.notes)
        ? collection.notes.map((note) => ({
            id: typeof note.id === 'string' ? note.id : uid(),
            title: String(note.title || ''),
            body: String(note.body || ''),
            tasks: Array.isArray(note.tasks)
              ? note.tasks
                  .filter((task) => task && typeof task.text === 'string')
                  .map((task) => ({
                    id: typeof task.id === 'string' ? task.id : uid(),
                    text: task.text,
                    done: Boolean(task.done),
                  }))
              : [],
            createdAt: Number(note.createdAt) || Date.now(),
            updatedAt: Number(note.updatedAt) || Number(note.createdAt) || Date.now(),
          }))
        : [],
    }));

    return { collections };
  } catch (error) {
    console.warn('ManaNotes: gagal membaca data.', error);
    return null;
  }
}

export function saveNow() {
  clearTimeout(persistTimer);
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 3, collections: state.collections })
    );
  } catch (error) {
    console.warn('ManaNotes: gagal menyimpan data.', error);
  }
}

export const scheduleSave = debounce(saveNow, 400);

// Shared debounce used by the note editor while typing. saveNow cancels it,
// mirroring the original single-IIFE timer behaviour.
export function schedulePersist(fn, wait = 450) {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(fn, wait);
}

export function cancelPersist() {
  clearTimeout(persistTimer);
}

/* =========================================================
   Data helpers
   ========================================================= */

export const getCollection = (id) => state.collections.find((collection) => collection.id === id);

export function getNote(collectionId, noteId) {
  const collection = getCollection(collectionId);
  if (!collection) return null;
  return collection.notes.find((note) => note.id === noteId) || null;
}

export function noteStats(note) {
  let done = 0;
  note.tasks.forEach((task) => {
    if (task.done) done += 1;
  });
  return { total: note.tasks.length, done, open: note.tasks.length - done };
}

export function collectionStats(collection) {
  let total = 0;
  let done = 0;
  collection.notes.forEach((note) => {
    note.tasks.forEach((task) => {
      total += 1;
      if (task.done) done += 1;
    });
  });
  return { notes: collection.notes.length, total, done, open: total - done };
}

export function globalStats() {
  let notes = 0;
  let total = 0;
  let done = 0;
  state.collections.forEach((collection) => {
    notes += collection.notes.length;
    collection.notes.forEach((note) => {
      note.tasks.forEach((task) => {
        total += 1;
        if (task.done) done += 1;
      });
    });
  });
  return { notes, total, done, open: total - done };
}

export function latestUpdate(collection) {
  let ts = collection.createdAt || 0;
  collection.notes.forEach((note) => {
    ts = Math.max(ts, note.updatedAt || note.createdAt || 0);
  });
  return ts;
}

export function relativeDay(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((startOfToday - startOfDay) / 86400000);
  if (diff <= 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  return shortDate.format(date);
}

export function noteSnippet(note) {
  const body = String(note.body || '').replace(/\s+/g, ' ').trim();
  if (body) return body;
  if (note.tasks.length) return note.tasks.map((task) => task.text).join(' · ');
  return '';
}

export function collectionMatches(collection, query) {
  if (!query) return true;
  const haystack = [
    collection.title,
    collection.subtitle,
    ...collection.notes.map((note) =>
      [note.title, note.body, ...note.tasks.map((task) => task.text)].join(' ')
    ),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export function noteMatches(note, query) {
  if (!query) return true;
  return [note.title, note.body, ...note.tasks.map((task) => task.text)]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

export function nextTheme() {
  const used = new Set(state.collections.map((collection) => collection.theme));
  return THEMES.find((theme) => !used.has(theme)) || THEMES[Math.floor(Math.random() * THEMES.length)];
}

/* =========================================================
   Clipboard & toast
   ========================================================= */

export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return;
  }
  fallbackCopy(text);
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
  } catch (error) {
    console.warn('ManaNotes: gagal menyalin.', error);
  }
  area.remove();
}

let toastTimer = 0;

export function toast(message, actionLabel = null, action = null) {
  clearTimeout(toastTimer);
  els.toastText.textContent = message;

  if (actionLabel && action) {
    els.toastAction.hidden = false;
    els.toastAction.textContent = actionLabel;
    els.toastAction.onclick = () => {
      hideToast();
      action();
    };
  } else {
    els.toastAction.hidden = true;
    els.toastAction.onclick = null;
  }

  els.toast.classList.add('is-visible');
  toastTimer = setTimeout(hideToast, 5500);
}

export function hideToast() {
  clearTimeout(toastTimer);
  els.toast.classList.remove('is-visible');
}

/* =========================================================
   App callback registry
   Feature modules use these instead of importing app.js.
   ========================================================= */

const appHandlers = {
  renderAll: null,
  renderCurrentView: null,
  renderSidebar: null,
  go: null,
  openCollection: null,
};

export function registerApp(handlers) {
  Object.assign(appHandlers, handlers);
}

function callApp(name, ...args) {
  const handler = appHandlers[name];
  if (handler) handler(...args);
}

export const refresh = () => callApp('renderAll');
export const refreshCurrentView = () => callApp('renderCurrentView');
export const refreshSidebar = () => callApp('renderSidebar');
export const go = (view) => callApp('go', view);
export const openCollection = (collectionId) => callApp('openCollection', collectionId);
