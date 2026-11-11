/* =========================================================
   Notes — collections, dashboard/collection views, note
   cards, note editor, collection dialog, collection summary.
   ========================================================= */

import {
  $$, esc, pad2, uid, els, state, ui, fullDate, toast, copyToClipboard,
  saveNow, schedulePersist, cancelPersist,
  getCollection, noteStats, collectionStats, globalStats, latestUpdate,
  relativeDay, noteSnippet, collectionMatches, noteMatches, nextTheme,
  THEMES, THEME_LABELS, CHECK_SVG, KEBAB_SVG, CLOSE_SVG, COPY_SVG,
  FOLDER_SVG, CHECK_SQUARE_SVG, ARROW_LEFT_SVG,
  refresh, refreshSidebar, openCollection,
} from './core.js';
import { summarize, buildSummarySource } from './summary.js';
import { rundownWidgetHTML } from './rundown.js';

/* =========================================================
   Module state
   ========================================================= */

let editorRef = null;
let editorFinalized = false;
let lastNoteSummary = [];
let selectedTheme = 'ember';
let editingCollectionId = null;
let saveStateTimer = 0;
let deleteConfirmTimer = 0;

/* =========================================================
   Dashboard & collection rendering
   ========================================================= */

export function renderDashboard() {
  const query = ui.search.trim().toLowerCase();
  const stats = globalStats();

  if (!state.collections.length) {
    els.viewDashboard.innerHTML = `
      ${pageHead('Workspace', 'Beranda', 'Mulai dari satu koleksi kecil. Nanti bisa nambah lagi.')}
      ${rundownWidgetHTML()}
      <div class="empty-state">
        <div class="empty-art">${FOLDER_SVG}</div>
        <h3>Belum ada koleksi</h3>
        <p>Bikin koleksi pertama buat mulai nulis catatan, to-do, dan ringkasannya. Belum yakin caranya? Buka panduan singkat dulu.</p>
        <div class="empty-actions">
          <button class="btn btn-primary" type="button" data-action="new-collection">Buat koleksi</button>
          <button class="btn btn-ghost" type="button" data-action="open-tutorial">Lihat panduan</button>
        </div>
      </div>`;
    return;
  }

  const filtered = state.collections.filter((collection) => collectionMatches(collection, query));

  els.viewDashboard.innerHTML = `
    <header class="page-head">
      <div>
        <span class="eyebrow">Workspace</span>
        <h1 class="page-title">Beranda</h1>
        <p class="page-sub">${state.collections.length} koleksi · ${stats.notes} catatan · ${stats.open} to-do aktif</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-ghost" type="button" data-view="todo">Lihat to-do</button>
        <button class="btn btn-ghost" type="button" data-action="new-collection">+ Koleksi baru</button>
      </div>
    </header>
    ${rundownWidgetHTML()}
    <div class="dashboard-section-head">
      <div>
        <span class="eyebrow">Catatan</span>
        <h2>Koleksi kamu</h2>
      </div>
    </div>
    ${
      filtered.length
        ? `<div class="collection-grid">
            ${filtered.map(collectionCardHTML).join('')}
          </div>`
        : noResultsHTML()
    }`;
}

function pageHead(eyebrow, title, subtitle) {
  return `
    <header class="page-head">
      <div>
        <span class="eyebrow">${esc(eyebrow)}</span>
        <h1 class="page-title">${esc(title)}</h1>
        <p class="page-sub">${esc(subtitle)}</p>
      </div>
    </header>`;
}

function collectionCardHTML(collection) {
  const stats = collectionStats(collection);
  const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const updated = stats.notes ? relativeDay(latestUpdate(collection)) : '';

  return `
    <article class="collection-card theme-${collection.theme}" tabindex="0" role="button"
      data-open-collection="${collection.id}" aria-label="Buka koleksi ${esc(collection.title)}">
      <div class="card-cover">
        <div class="cover-art"></div>
        <div class="cover-grain"></div>
        <div class="cover-shade"></div>
        <div class="cover-top">
          <span class="cover-chip">${stats.notes} catatan</span>
          <button class="kebab" type="button" data-edit-collection="${collection.id}"
            aria-label="Atur koleksi ${esc(collection.title)}" title="Atur koleksi">${KEBAB_SVG}</button>
        </div>
      </div>
      <div class="card-panel">
        <div class="card-tab">
          <h3>${esc(collection.title)}</h3>
          <p>${esc(collection.subtitle)}</p>
        </div>
        <div class="card-body">
          <div class="mini-progress">
            <div class="mini-head">
              <span>Progres to-do</span>
              <strong>${stats.done}/${stats.total}</strong>
            </div>
            <div class="bar"><span style="width: ${percent}%"></span></div>
          </div>
          ${
            collection.notes.length
              ? `<div class="card-recent">
                  ${collection.notes
                    .slice(0, 2)
                    .map((note) => `<span>${esc(note.title || 'Tanpa judul')}</span>`)
                    .join('')}
                </div>`
              : ''
          }
          <div class="card-hint">${updated ? `Diperbarui ${updated}` : 'Belum ada catatan'}</div>
        </div>
        <div class="card-stats">
          <div class="stat-big"><strong>${pad2(stats.notes)}</strong><span>Notes</span></div>
          <div class="stat-right">${pad2(stats.open)}<span>To-do</span></div>
        </div>
      </div>
    </article>`;
}

function noResultsHTML() {
  return `
    <div class="no-results">
      <strong>Tidak ada hasil</strong>
      Coba kata kunci lain atau hapus pencarian.
    </div>`;
}

export function renderCollection() {
  const collection = getCollection(ui.collectionId);
  if (!collection) {
    ui.view = 'dashboard';
    ui.collectionId = null;
    refresh();
    return;
  }

  const query = ui.search.trim().toLowerCase();
  const stats = collectionStats(collection);
  const notes = collection.notes.filter((note) => noteMatches(note, query));
  const updated = stats.notes ? relativeDay(latestUpdate(collection)) : '';

  els.viewCollection.innerHTML = `
    <div class="view-bar">
      <button class="back-btn" type="button" data-view="dashboard">${ARROW_LEFT_SVG} Semua koleksi</button>
      <div class="view-actions">
        <button class="btn btn-ghost" type="button" data-action="summarize-collection">
          <span aria-hidden="true" style="color: var(--accent-2)">✦</span> Ringkas koleksi
        </button>
        <button class="btn btn-primary" type="button" data-action="new-note">+ Catatan</button>
      </div>
    </div>

    <section class="collection-hero theme-${collection.theme}">
      <div class="hero-art"></div>
      <div class="hero-shade"></div>
      <button class="hero-edit" type="button" data-edit-collection="${collection.id}">Edit koleksi</button>
      <div class="hero-content">
        <h2>${esc(collection.title)}</h2>
        <p>${esc(collection.subtitle)}</p>
        <div class="hero-stats">
          <span><strong>${stats.notes}</strong> catatan</span>
          <span><strong>${stats.done}/${stats.total}</strong> to-do selesai</span>
          ${updated ? `<span>Diperbarui ${updated}</span>` : ''}
        </div>
      </div>
    </section>

    ${collectionSummaryHTML(collection)}

    ${
      notes.length
        ? `<div class="notes-grid">
            ${notes.map((note) => noteCardHTML(collection, note)).join('')}
            ${query ? '' : noteAddHTML()}
          </div>`
        : query
          ? noResultsHTML()
          : `<div class="empty-state" style="margin-top: 22px">
              <div class="empty-art">${CHECK_SQUARE_SVG}</div>
              <h3>Koleksi ini masih kosong</h3>
              <p>Buat catatan pertama. Bisa isi teks, to-do, atau dua-duanya.</p>
              <button class="btn btn-primary" type="button" data-action="new-note">Buat catatan</button>
            </div>`
    }`;
}

function noteCardHTML(collection, note) {
  const stats = noteStats(note);
  const snippet = noteSnippet(note);
  const isComplete = stats.total > 0 && stats.done === stats.total;

  return `
    <article class="note-card theme-${collection.theme}" tabindex="0" role="button"
      data-open-note="${note.id}" data-collection-id="${collection.id}"
      aria-label="Buka catatan ${esc(note.title || 'Tanpa judul')}">
      <div class="note-cover">
        <div class="cover-art"></div>
        <div class="cover-grain"></div>
        <div class="cover-shade"></div>
      </div>
      <div class="note-content">
        <h3>${esc(note.title || 'Tanpa judul')}</h3>
        <p class="note-snippet ${snippet ? '' : 'is-empty'}">${esc(snippet || 'Belum ada isi catatan')}</p>
        <div class="note-meta">
          ${
            stats.total
              ? `<span class="task-chip ${isComplete ? 'is-complete' : ''}">${CHECK_SVG} ${stats.done}/${stats.total}</span>`
              : '<span></span>'
          }
          <span>${relativeDay(note.updatedAt)}</span>
        </div>
      </div>
    </article>`;
}

function noteAddHTML() {
  return `
    <button class="note-add" type="button" data-action="new-note">
      <span class="plus" aria-hidden="true">+</span>
      <strong>Catatan baru</strong>
      <small>Kosong juga boleh</small>
    </button>`;
}

function collectionSummaryHTML(collection) {
  const summary = ui.collectionSummary;
  if (!summary || summary.id !== collection.id) return '';

  if (summary.status === 'loading') {
    return `
      <section class="summary-panel">
        <div class="summary-head">
          <h3>Ringkasan koleksi</h3>
          <span class="summary-badge">Memproses</span>
          <button class="summary-close" type="button" data-action="close-summary" aria-label="Tutup ringkasan">${CLOSE_SVG}</button>
        </div>
        <div class="skeleton-list">
          <span class="skeleton-line"></span>
          <span class="skeleton-line"></span>
          <span class="skeleton-line"></span>
        </div>
      </section>`;
  }

  const points = summary.points || [];
  return `
    <section class="summary-panel">
      <div class="summary-head">
        <h3>Ringkasan koleksi</h3>
        <span class="summary-badge">Ringkasan instan</span>
        <button class="summary-close" type="button" data-action="close-summary" aria-label="Tutup ringkasan">${CLOSE_SVG}</button>
      </div>
      <ul class="summary-list">
        ${points.map((point) => `<li>${esc(point)}</li>`).join('')}
      </ul>
      <div class="summary-foot">
        <span>Dibuat dari ${collection.notes.length} catatan · di perangkatmu</span>
        <button class="copy-btn" type="button" data-copy-summary>${COPY_SVG} Salin</button>
      </div>
    </section>`;
}

/* =========================================================
   Note editor
   ========================================================= */

function currentNote() {
  if (!editorRef) return null;
  const collection = getCollection(editorRef.collectionId);
  if (!collection) return null;
  const note = collection.notes.find((item) => item.id === editorRef.noteId);
  return note ? { collection, note } : null;
}

export function openNote(collectionId, noteId, options = {}) {
  const collection = getCollection(collectionId);
  if (!collection) return;
  const note = collection.notes.find((item) => item.id === noteId);
  if (!note) return;

  editorRef = {
    collectionId,
    noteId,
    isNew: Boolean(options.isNew),
  };
  editorFinalized = false;

  lastNoteSummary = [];
  els.editorCover.className = `editor-cover theme-${collection.theme}`;
  els.editorDot.className = `dot theme-${collection.theme}`;
  els.editorCollection.textContent = collection.title;
  els.noteTitle.value = note.title;
  els.noteBody.value = note.body;
  renderEditorTasks(note);
  updateEditorMeta(note);
  resetEditorSummary();
  setSaveState('Tersimpan', false);

  if (!els.noteDialog.open) els.noteDialog.showModal();

  window.requestAnimationFrame(autoGrowBody);

  if (options.focusTitle) {
    setTimeout(() => els.noteTitle.focus(), 80);
  }
}

function updateEditorMeta(note) {
  const stats = noteStats(note);
  els.editorDate.textContent = `Diperbarui ${fullDate.format(new Date(note.updatedAt))}`;
  els.editorTaskCount.textContent = stats.total
    ? `${stats.done}/${stats.total} to-do`
    : 'belum ada to-do';
}

function renderEditorTasks(note) {
  const stats = noteStats(note);

  if (!note.tasks.length) {
    els.taskList.innerHTML = '<li class="task-empty">Belum ada to-do di catatan ini.</li>';
  } else {
    els.taskList.innerHTML = note.tasks
      .map(
        (task) => `
          <li class="task-row ${task.done ? 'is-done' : ''}">
            <button class="check-btn ${task.done ? 'is-done' : ''}" type="button"
              data-editor-toggle="${task.id}" aria-pressed="${task.done}"
              aria-label="${task.done ? 'Tandai belum selesai' : 'Tandai selesai'}">
              ${CHECK_SVG}
            </button>
            <input class="task-input" type="text" value="${esc(task.text)}"
              data-editor-task-text="${task.id}" maxlength="120" aria-label="Teks tugas" />
            <button class="task-del" type="button" data-editor-del-task="${task.id}"
              aria-label="Hapus tugas" title="Hapus tugas">×</button>
          </li>`
      )
      .join('');
  }

  const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  els.taskProgressText.textContent = `${stats.done}/${stats.total}`;
  els.taskProgressBar.style.width = `${percent}%`;
  updateEditorMeta(note);
}

function autoGrowBody() {
  els.noteBody.style.height = 'auto';
  els.noteBody.style.height = `${Math.max(els.noteBody.scrollHeight, 300)}px`;
}

function setSaveState(text, saving) {
  clearTimeout(saveStateTimer);
  els.saveState.textContent = text;
  els.saveState.classList.toggle('is-saving', Boolean(saving));
}

function touchNote(note) {
  note.updatedAt = Date.now();
  updateEditorMeta(note);
  setSaveState('Menyimpan…', true);
  schedulePersist(() => {
    saveNow();
    setSaveState('Tersimpan', false);
  }, 450);
}

function resetEditorSummary() {
  lastNoteSummary = [];
  els.summaryOutput.innerHTML = '';
  const label = els.summarizeBtn.querySelector('span');
  if (label) label.textContent = 'Ringkas catatan';
  els.summarizeBtn.disabled = false;
}

function skeletonHTML() {
  return `
    <div class="skeleton-list">
      <span class="skeleton-line"></span>
      <span class="skeleton-line"></span>
      <span class="skeleton-line"></span>
    </div>`;
}

function renderEditorSummary(points) {
  els.summaryOutput.innerHTML = `
    <div class="summary-head">
      <span class="summary-badge">Ringkasan</span>
      <span class="side-card-count">${points.length} poin</span>
    </div>
    <ul class="summary-list">
      ${points.map((point) => `<li>${esc(point)}</li>`).join('')}
    </ul>
    <div class="summary-foot">
      <span>Dibuat di perangkatmu</span>
      <button class="copy-btn" type="button" data-copy-note-summary>${COPY_SVG} Salin</button>
    </div>`;
}

function finalizeEditor() {
  if (editorFinalized) return;
  editorFinalized = true;

  const ref = editorRef;
  editorRef = null;
  cancelPersist();

  if (ref) {
    const collection = getCollection(ref.collectionId);
    const note = collection
      ? collection.notes.find((item) => item.id === ref.noteId)
      : null;

    if (note) {
      note.title = note.title.replace(/\s+/g, ' ').trim();
      note.body = note.body.replace(/[ \t]+$/gm, '').trim();
      note.tasks = note.tasks
        .map((task) => ({ ...task, text: task.text.trim() }))
        .filter((task) => task.text);
    }

    cleanupEmptyNote(ref);
  }

  lastNoteSummary = [];
  saveNow();
  refresh();
}

function closeNoteDialog() {
  if (els.noteDialog.open) els.noteDialog.close();
  finalizeEditor();
}

function cleanupEmptyNote(ref) {
  if (!ref || !ref.isNew) return;
  const collection = getCollection(ref.collectionId);
  if (!collection) return;
  const note = collection.notes.find((item) => item.id === ref.noteId);
  if (!note) return;
  if (!note.title.trim() && !note.body.trim() && !note.tasks.length) {
    collection.notes = collection.notes.filter((item) => item.id !== ref.noteId);
    saveNow();
  }
}

/* =========================================================
   Collection dialog
   ========================================================= */

function renderThemePicker() {
  els.themePicker.innerHTML = THEMES.map(
    (theme) => `
      <button class="theme-swatch theme-${theme} ${theme === selectedTheme ? 'is-active' : ''}"
        type="button" data-theme="${theme}" aria-label="Warna ${THEME_LABELS[theme]}"
        aria-pressed="${theme === selectedTheme}" title="${THEME_LABELS[theme]}"></button>`
  ).join('');
}

function resetDeleteButton() {
  clearTimeout(deleteConfirmTimer);
  els.collectionDelete.dataset.confirm = '0';
  els.collectionDelete.textContent = 'Hapus koleksi';
}

export function openCollectionDialog(collectionId = null) {
  const collection = collectionId ? getCollection(collectionId) : null;
  editingCollectionId = collection ? collection.id : null;
  selectedTheme = collection ? collection.theme : nextTheme();

  els.collectionDialogTitle.textContent = collection ? 'Edit koleksi' : 'Koleksi baru';
  els.collectionName.value = collection ? collection.title : '';
  els.collectionSubtitle.value = collection ? collection.subtitle : '';
  els.collectionDelete.hidden = !collection;
  resetDeleteButton();
  renderThemePicker();

  if (!els.collectionDialog.open) els.collectionDialog.showModal();
  setTimeout(() => els.collectionName.focus(), 60);
}

export function closeCollectionDialog() {
  if (els.collectionDialog.open) els.collectionDialog.close();
}

/* =========================================================
   Actions
   ========================================================= */

export function createNote() {
  let collection = getCollection(ui.collectionId) || state.collections[0];
  let madeCollection = false;

  if (!collection) {
    collection = {
      id: uid(),
      title: 'Catatan baru',
      subtitle: 'Notes & Tasks',
      theme: nextTheme(),
      createdAt: Date.now(),
      notes: [],
    };
    state.collections.unshift(collection);
    madeCollection = true;
  }

  const now = Date.now();
  const note = {
    id: uid(),
    title: '',
    body: '',
    tasks: [],
    createdAt: now,
    updatedAt: now,
  };

  collection.notes.unshift(note);

  if (madeCollection || ui.view !== 'collection' || ui.collectionId !== collection.id) {
    ui.view = 'collection';
    ui.collectionId = collection.id;
    ui.search = '';
    els.search.value = '';
  }

  saveNow();
  refresh();
  openNote(collection.id, note.id, { isNew: true, focusTitle: true });
}

function deleteNoteFromEditor() {
  const ref = currentNote();
  if (!ref) return;

  const { collection, note } = ref;
  const index = collection.notes.findIndex((item) => item.id === note.id);
  if (index === -1) return;

  collection.notes.splice(index, 1);
  saveNow();
  closeNoteDialog();

  toast('Catatan dihapus.', 'Urungkan', () => {
    collection.notes.splice(Math.min(index, collection.notes.length), 0, note);
    saveNow();
    refresh();
  });
}

export function summarizeCollection() {
  const collection = getCollection(ui.collectionId);
  if (!collection) return;

  if (!collection.notes.length) {
    toast('Belum ada catatan buat diringkas.');
    return;
  }

  ui.collectionSummary = { id: collection.id, status: 'loading', points: [] };
  renderCollection();

  setTimeout(() => {
    const source = buildSummarySource(collection.notes);

    const points = summarize(source, 5);
    ui.collectionSummary = {
      id: collection.id,
      status: 'done',
      points: points.length
        ? points
        : ['Catatan di koleksi ini masih terlalu singkat buat diringkas.'],
    };

    if (ui.view === 'collection' && ui.collectionId === collection.id) {
      renderCollection();
    }
  }, 700);
}

/* =========================================================
   Delegated click helpers used by app.js
   ========================================================= */

export function handleCopyNoteSummary(event) {
  const copyNoteButton = event.target.closest('[data-copy-note-summary]');
  if (!copyNoteButton) return false;
  if (lastNoteSummary.length) {
    copyToClipboard(lastNoteSummary.map((point) => `• ${point}`).join('\n'));
    copyNoteButton.textContent = 'Tersalin';
    setTimeout(() => {
      if (copyNoteButton.isConnected) copyNoteButton.textContent = 'Salin';
    }, 1500);
  }
  return true;
}

export function handleCopyCollectionSummary(event) {
  const copyCollectionButton = event.target.closest('[data-copy-summary]');
  if (!copyCollectionButton) return false;
  const summary = ui.collectionSummary;
  if (summary && summary.points && summary.points.length) {
    copyToClipboard(summary.points.map((point) => `• ${point}`).join('\n'));
    toast('Ringkasan disalin.');
  }
  return true;
}

/* =========================================================
   Event wiring
   ========================================================= */

export function initNotesEvents() {
  // Collection dialog (ONLY for collections/notes)
  els.collectionForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const title = els.collectionName.value.trim();
    if (!title) {
      els.collectionName.focus();
      return;
    }

    const subtitle = els.collectionSubtitle.value.trim() || 'Notes & Tasks';

    if (editingCollectionId) {
      const collection = getCollection(editingCollectionId);
      if (collection) {
        collection.title = title;
        collection.subtitle = subtitle;
        collection.theme = selectedTheme;
      }
      saveNow();
      closeCollectionDialog();
      refresh();
      toast('Koleksi diperbarui.');
    } else {
      const collection = {
        id: uid(),
        title,
        subtitle,
        theme: selectedTheme,
        createdAt: Date.now(),
        notes: [],
      };
      state.collections.unshift(collection);
      saveNow();
      closeCollectionDialog();
      openCollection(collection.id);
      toast('Koleksi baru dibuat.');
    }
  });

  els.themePicker.addEventListener('click', (event) => {
    const swatch = event.target.closest('[data-theme]');
    if (!swatch) return;
    selectedTheme = swatch.dataset.theme;
    $$('.theme-swatch', els.themePicker).forEach((button) => {
      const active = button === swatch;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  });

  els.collectionDialog.addEventListener('click', (event) => {
    if (event.target === els.collectionDialog) closeCollectionDialog();
  });

  els.collectionDialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeCollectionDialog();
  });

  els.collectionDelete.addEventListener('click', () => {
    if (!editingCollectionId) return;

    if (els.collectionDelete.dataset.confirm !== '1') {
      els.collectionDelete.dataset.confirm = '1';
      els.collectionDelete.textContent = 'Yakin? Klik lagi';
      clearTimeout(deleteConfirmTimer);
      deleteConfirmTimer = setTimeout(resetDeleteButton, 2600);
      return;
    }

    const collection = getCollection(editingCollectionId);
    if (!collection) return;

    const index = state.collections.indexOf(collection);
    state.collections.splice(index, 1);
    saveNow();
    closeCollectionDialog();

    if (ui.collectionId === collection.id) {
      ui.view = 'dashboard';
      ui.collectionId = null;
      ui.collectionSummary = null;
    }

    refresh();
    toast(`Koleksi "${collection.title}" dihapus.`, 'Urungkan', () => {
      state.collections.splice(Math.min(index, state.collections.length), 0, collection);
      saveNow();
      refresh();
    });
  });

  // Note editor
  els.editorClose.addEventListener('click', closeNoteDialog);
  els.editorDelete.addEventListener('click', deleteNoteFromEditor);

  els.noteDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeNoteDialog();
  });

  els.noteDialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeNoteDialog();
  });

  els.noteDialog.addEventListener('click', (event) => {
    if (event.target === els.noteDialog) closeNoteDialog();
  });

  els.noteDialog.addEventListener('close', finalizeEditor);

  els.noteTitle.addEventListener('input', () => {
    const ref = currentNote();
    if (!ref) return;
    ref.note.title = els.noteTitle.value;
    touchNote(ref.note);
  });

  els.noteTitle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      els.noteBody.focus();
    }
  });

  els.noteBody.addEventListener('input', () => {
    const ref = currentNote();
    if (!ref) return;
    ref.note.body = els.noteBody.value;
    autoGrowBody();
    if (els.summaryOutput.innerHTML.trim()) resetEditorSummary();
    touchNote(ref.note);
  });

  els.taskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const ref = currentNote();
    if (!ref) return;
    const text = els.taskInput.value.trim();
    if (!text) return;

    ref.note.tasks.push({ id: uid(), text, done: false });
    els.taskInput.value = '';
    renderEditorTasks(ref.note);
    touchNote(ref.note);
    refreshSidebar();
    els.taskInput.focus();
  });

  els.taskList.addEventListener('click', (event) => {
    const ref = currentNote();
    if (!ref) return;

    const toggle = event.target.closest('[data-editor-toggle]');
    if (toggle) {
      const task = ref.note.tasks.find((item) => item.id === toggle.dataset.editorToggle);
      if (task) {
        task.done = !task.done;
        renderEditorTasks(ref.note);
        touchNote(ref.note);
        refreshSidebar();
      }
      return;
    }

    const remove = event.target.closest('[data-editor-del-task]');
    if (remove) {
      ref.note.tasks = ref.note.tasks.filter(
        (item) => item.id !== remove.dataset.editorDelTask
      );
      renderEditorTasks(ref.note);
      touchNote(ref.note);
      refreshSidebar();
    }
  });

  els.taskList.addEventListener('input', (event) => {
    const input = event.target.closest('[data-editor-task-text]');
    if (!input) return;
    const ref = currentNote();
    if (!ref) return;
    const task = ref.note.tasks.find((item) => item.id === input.dataset.editorTaskText);
    if (!task) return;
    task.text = input.value;
    touchNote(ref.note);
  });

  els.taskList.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.matches('[data-editor-task-text]')) {
      event.preventDefault();
      els.taskInput.focus();
    }
  });

  els.summarizeBtn.addEventListener('click', () => {
    const ref = currentNote();
    if (!ref) return;

    const source = buildSummarySource([ref.note]);

    if (!source.trim()) {
      els.summaryOutput.innerHTML =
        '<p class="summary-empty">Tulis dulu isi catatannya, lalu coba ringkas lagi.</p>';
      return;
    }

    els.summarizeBtn.disabled = true;
    const label = els.summarizeBtn.querySelector('span');
    if (label) label.textContent = 'Meringkas...';
    els.summaryOutput.innerHTML = skeletonHTML();

    setTimeout(() => {
      const points = summarize(source, 3);
      lastNoteSummary = points;
      renderEditorSummary(points);
      els.summarizeBtn.disabled = false;
      if (label) label.textContent = 'Ringkas ulang';
    }, 650);
  });
}
