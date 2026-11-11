/* =========================================================
   ManaNotes — app entry point.
   Wires shared chrome (navigation, sidebar, search, keyboard,
   global events), registers render/navigation callbacks, boots.
   ========================================================= */

import {
  $$, esc, pad2, els, state, ui,
  collectionStats, globalStats, getCollection, loadState, setState, saveNow, registerApp,
} from './core.js';
import {
  renderDashboard, renderCollection, openNote, createNote,
  openCollectionDialog, closeCollectionDialog, summarizeCollection,
  handleCopyNoteSummary, handleCopyCollectionSummary, initNotesEvents,
} from './notes.js';
import { renderTodo, toggleTask } from './todo.js';
import {
  renderFlashcard, renderFcDeckDetail, startFcSession,
  openFcDeckDialog, openFcCardDialog, closeFcCardDialog, closeFcDeckDialog,
  initFlashcards, saveFcDecks,
} from './flashcards.js';
import { openTutorial, initTutorialEvents, tutorialSeen } from './tutorial.js';
import { initRundownEvents } from './rundown.js';

/* =========================================================
   Rendering
   ========================================================= */

function renderAll() {
  els.viewDashboard.hidden = ui.view !== 'dashboard';
  els.viewCollection.hidden = ui.view !== 'collection';
  els.viewTodo.hidden = ui.view !== 'todo';
  els.viewFlashcard.hidden = ui.view !== 'flashcard' && ui.view !== 'flashcard-deck';

  renderSidebar();
  updateSearchPlaceholder();
  renderCurrentView();
}

function renderCurrentView() {
  if (ui.view === 'dashboard') renderDashboard();
  else if (ui.view === 'collection') renderCollection();
  else if (ui.view === 'todo') renderTodo();
  else if (ui.view === 'flashcard') renderFlashcard();
  else if (ui.view === 'flashcard-deck') renderFcDeckDetail(ui.fcDeckId);
}

function updateSearchPlaceholder() {
  const placeholders = {
    dashboard: 'Cari koleksi...',
    collection: 'Cari catatan...',
    todo: 'Cari to-do...',
    flashcard: 'Cari deck...',
    'flashcard-deck': 'Cari kartu...',
  };
  els.search.placeholder = placeholders[ui.view] || 'Cari...';
}

function renderSidebar() {
  $$('.nav-btn').forEach((button) => {
    const view = button.dataset.view;
    const isActive = view === ui.view || (view === 'flashcard' && ui.view === 'flashcard-deck');
    button.classList.toggle('is-active', isActive);
  });

  const stats = globalStats();
  els.navTodoCount.textContent = String(stats.open);
  els.navTodoCount.hidden = stats.open === 0;

  els.sidebarCollections.innerHTML = state.collections.length
    ? state.collections
        .map(
          (collection) => `
        <button class="collection-item ${
          ui.view === 'collection' && ui.collectionId === collection.id ? 'is-active' : ''
        }" type="button" data-open-collection="${collection.id}">
          <span class="dot theme-${collection.theme}"></span>
          <span class="collection-name">${esc(collection.title)}</span>
          <span class="collection-count">${pad2(collectionStats(collection).notes)}</span>
        </button>`
        )
        .join('')
    : '<p class="side-empty">Belum ada koleksi. Klik tombol + di atas untuk mulai.</p>';

  const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  els.sideRing.style.setProperty('--pct', percent);
  els.sideRingPct.textContent = `${percent}%`;
  els.sideProgressTitle.textContent = stats.total
    ? `${stats.open} to-do tersisa`
    : 'Belum ada to-do';
  els.sideProgressSub.textContent = stats.total
    ? `${stats.done} dari ${stats.total} tugas selesai`
    : 'Tambahkan checklist di catatan';
}

/* =========================================================
   Navigation
   ========================================================= */

function go(view) {
  ui.view = view;
  if (view !== 'collection') ui.collectionId = null;
  if (view !== 'flashcard-deck') ui.fcDeckId = null;
  ui.search = '';
  els.search.value = '';
  if (view !== 'collection') ui.collectionSummary = null;
  renderAll();
  els.main.scrollTop = 0;
}

function openCollection(collectionId) {
  if (!getCollection(collectionId)) return;
  if (ui.collectionId !== collectionId) ui.collectionSummary = null;
  ui.view = 'collection';
  ui.collectionId = collectionId;
  ui.search = '';
  els.search.value = '';
  renderAll();
  els.main.scrollTop = 0;
}

/* =========================================================
   App-wide delegated events
   ========================================================= */

document.addEventListener('click', (event) => {
  if (handleCopyNoteSummary(event)) return;
  if (handleCopyCollectionSummary(event)) return;

  const editCollectionButton = event.target.closest('[data-edit-collection]');
  if (editCollectionButton) {
    event.preventDefault();
    openCollectionDialog(editCollectionButton.dataset.editCollection);
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === 'new-note') createNote();
    else if (action === 'new-collection') openCollectionDialog();
    else if (action === 'open-tutorial') openTutorial();
    else if (action === 'summarize-collection') summarizeCollection();
    else if (action === 'close-summary') {
      ui.collectionSummary = null;
      renderCollection();
    }
    else if (action === 'fc-new-deck') openFcDeckDialog();
    else if (action === 'fc-new-card') {
      const deckId = actionButton.dataset.fcDeckId;
      if (deckId) openFcCardDialog(deckId);
    }
    return;
  }

  const fcOpenDeckBtn = event.target.closest('[data-fc-open-deck]');
  if (fcOpenDeckBtn && !event.target.closest('[data-fc-edit-deck]')) {
    event.preventDefault();
    startFcSession(fcOpenDeckBtn.dataset.fcOpenDeck);
    return;
  }

  const fcEditDeckBtn = event.target.closest('[data-fc-edit-deck]');
  if (fcEditDeckBtn) {
    event.preventDefault();
    event.stopPropagation();
    openFcDeckDialog(fcEditDeckBtn.dataset.fcEditDeck);
    return;
  }

  const fcEditCardBtn = event.target.closest('[data-fc-edit-card]');
  if (fcEditCardBtn) {
    openFcCardDialog(fcEditCardBtn.dataset.fcDeckId, fcEditCardBtn.dataset.fcEditCard);
    return;
  }

  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    event.preventDefault();
    go(viewButton.dataset.view);
    return;
  }

  const collectionCard = event.target.closest('[data-open-collection]');
  if (collectionCard) {
    openCollection(collectionCard.dataset.openCollection);
    return;
  }

  const noteCard = event.target.closest('[data-open-note]');
  if (noteCard) {
    openNote(noteCard.dataset.collectionId, noteCard.dataset.openNote);
    return;
  }

  const taskToggle = event.target.closest('[data-toggle-task]');
  if (taskToggle) {
    toggleTask(
      taskToggle.dataset.collectionId,
      taskToggle.dataset.noteId,
      taskToggle.dataset.toggleTask
    );
    return;
  }

  const closeDialogButton = event.target.closest('[data-close-dialog]');
  if (closeDialogButton) {
    closeCollectionDialog();
  }

  const closeFcDialogButton = event.target.closest('[data-close-fc-dialog]');
  if (closeFcDialogButton) {
    closeFcCardDialog();
  }

  const closeFcDeckDialogButton = event.target.closest('[data-close-fc-deck-dialog]');
  if (closeFcDeckDialogButton) {
    closeFcDeckDialog();
  }
});

document.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]')) return;

  const target = event.target;
  const typing =
    target instanceof HTMLElement &&
    (target.matches('input, textarea, select') || target.isContentEditable);

  if (typing) return;

  if (event.key === '/') {
    event.preventDefault();
    els.search.focus();
    els.search.select();
    return;
  }

  if (
    (event.key === 'n' || event.key === 'N') &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    event.preventDefault();
    createNote();
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    if (!(target instanceof Element)) return;
    if (target.closest('button, a, input, textarea, select')) return;
    const card = target.closest('[data-open-collection], [data-open-note]');
    if (card) {
      event.preventDefault();
      card.click();
    }
  }
});

els.search.addEventListener('input', () => {
  ui.search = els.search.value;
  renderCurrentView();
});

els.search.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    els.search.value = '';
    ui.search = '';
    renderCurrentView();
    els.search.blur();
  }
});

els.newNote.addEventListener('click', createNote);

window.addEventListener('beforeunload', () => { saveNow(); saveFcDecks(); });

/* =========================================================
   Boot
   ========================================================= */

registerApp({ renderAll, renderCurrentView, renderSidebar, go, openCollection });

function init() {
  const saved = loadState();
  setState(saved || { collections: [] });
  if (!saved) saveNow();

  initNotesEvents();
  initFlashcards();
  initTutorialEvents();
  initRundownEvents();

  renderAll();

  if (!tutorialSeen()) {
    setTimeout(openTutorial, 420);
  }
}

init();
