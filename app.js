(() => {
  'use strict';

  /* =========================================================
     Constants & helpers
     ========================================================= */

  const STORAGE_KEY = 'mananotes.v3';
  const FC_STORAGE_KEY = 'mananotes.flashcards.v1';
  const TUTORIAL_KEY = 'mananotes.tutorial.v1';
  const THEMES = ['ember', 'ocean', 'violet', 'lime', 'rose', 'amber'];
  const THEME_LABELS = {
    ember: 'Ember',
    ocean: 'Ocean',
    violet: 'Violet',
    lime: 'Lime',
    rose: 'Rose',
    amber: 'Amber',
  };

  const STOPWORDS = new Set(
    (
      'yang dan di ke dari untuk dengan ini itu ada adalah akan pada juga karena bisa atau saat sudah belum lebih sangat para kita kami kamu saya dia mereka ' +
      'tidak bukan dalam oleh sebagai agar supaya kalau jika tapi namun lalu kemudian setelah sebelum atas bawah hanya masih lagi para aja udah tuh nggak gak ' +
      'jadi buat bikin gitu kayak sama atau pun agar bahwa terhadap secara serta bagi hingga sampai antara tanpa harus dapat sedang telah ' +
      'the a an and or of to in on at for with is are was were be been being it this that these those as by from into over under then than so such'
    ).split(/\s+/)
  );

  const WORD_RE = /[a-z0-9\u00c0-\u024f]+/gi;

  const CHECK_SVG =
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 6.8"/></svg>';
  const KEBAB_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';
  const CLOSE_SVG =
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const COPY_SVG =
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></svg>';
  const FOLDER_SVG =
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.2l2 2.3H18a2.5 2.5 0 0 1 2.5 2.5v7.7A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5V7.5Z"/></svg>';
  const CHECK_SQUARE_SVG =
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="m8 12.4 2.7 2.7L16.4 9"/></svg>';
  const SPARK_SVG =
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5Z"/><path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"/></svg>';
  const ARROW_LEFT_SVG =
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

  const CARDS_SVG =
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="14" rx="3.5"/><path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V6"/><path d="M12 10v4M10 12h4"/></svg>';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const uid = () =>
    'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const esc = (value) =>
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

  const pad2 = (value) => String(value).padStart(2, '0');
  const debounce = (fn, wait) => {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  const shortDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
  const fullDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  /* =========================================================
     Elements
     ========================================================= */

  const els = {
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
     State
     ========================================================= */

  let state = { collections: [] };
  let ui = {
    view: 'dashboard',
    collectionId: null,
    fcDeckId: null,
    search: '',
    collectionSummary: null,
  };

  let editorRef = null;
  let editorFinalized = false;
  let lastNoteSummary = [];
  let selectedTheme = 'ember';
  let editingCollectionId = null;
  let persistTimer = 0;
  let saveStateTimer = 0;
  let toastTimer = 0;
  let deleteConfirmTimer = 0;

  /* =========================================================
     Flashcard state
     ========================================================= */

  let fcDecks = []; // [{ id, name, theme, cards: [{id,q,a,lastRated}] }]
  let fcSession = null; // { deckId, queue:[cardId,...], idx, results:{easy,medium,hard} }
  let fcEditingDeckId = null;
  let fcEditingCardId = null;

  /* =========================================================
     Persistence
     ========================================================= */

  function loadFcDecks() {
    try {
      const raw = localStorage.getItem(FC_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((deck) => ({
        id: typeof deck.id === 'string' ? deck.id : uid(),
        name: String(deck.name || 'Deck'),
        theme: THEMES.includes(deck.theme) ? deck.theme : 'ocean',
        createdAt: Number(deck.createdAt) || Date.now(),
        cards: Array.isArray(deck.cards)
          ? deck.cards.map((card) => ({
              id: typeof card.id === 'string' ? card.id : uid(),
              q: String(card.q || ''),
              a: String(card.a || ''),
              context: String(card.context || ''),
              lastRated: card.lastRated || null,
            }))
          : [],
      }));
    } catch (e) {
      return [];
    }
  }

  function saveFcDecks() {
    try {
      localStorage.setItem(FC_STORAGE_KEY, JSON.stringify(fcDecks));
    } catch (e) {}
  }

  function getFcDeck(id) {
    return fcDecks.find((d) => d.id === id) || null;
  }

  function loadState() {
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

  function saveNow() {
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

  const scheduleSave = debounce(saveNow, 400);

  /* =========================================================
     Data helpers
     ========================================================= */

  const getCollection = (id) => state.collections.find((collection) => collection.id === id);

  function getNote(collectionId, noteId) {
    const collection = getCollection(collectionId);
    if (!collection) return null;
    return collection.notes.find((note) => note.id === noteId) || null;
  }

  function currentNote() {
    if (!editorRef) return null;
    const collection = getCollection(editorRef.collectionId);
    if (!collection) return null;
    const note = collection.notes.find((item) => item.id === editorRef.noteId);
    return note ? { collection, note } : null;
  }

  function noteStats(note) {
    let done = 0;
    note.tasks.forEach((task) => {
      if (task.done) done += 1;
    });
    return { total: note.tasks.length, done, open: note.tasks.length - done };
  }

  function collectionStats(collection) {
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

  function globalStats() {
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

  function latestUpdate(collection) {
    let ts = collection.createdAt || 0;
    collection.notes.forEach((note) => {
      ts = Math.max(ts, note.updatedAt || note.createdAt || 0);
    });
    return ts;
  }

  function relativeDay(timestamp) {
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

  function noteSnippet(note) {
    const body = String(note.body || '').replace(/\s+/g, ' ').trim();
    if (body) return body;
    if (note.tasks.length) return note.tasks.map((task) => task.text).join(' · ');
    return '';
  }

  function buildSummarySource(notes) {
    return notes
      .map((note) => {
        const parts = [];
        const body = String(note.body || '').trim();
        if (body) parts.push(/[.!?]$/.test(body) ? body : `${body}.`);
        const tasks = note.tasks.map((task) => task.text.trim()).filter(Boolean);
        if (tasks.length) {
          parts.push(tasks.map((task) => (/[.!?]$/.test(task) ? task : `${task}.`)).join(' '));
        }
        return parts.join(' ');
      })
      .filter(Boolean)
      .join(' ');
  }

  function collectionMatches(collection, query) {
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

  function noteMatches(note, query) {
    if (!query) return true;
    return [note.title, note.body, ...note.tasks.map((task) => task.text)]
      .join(' ')
      .toLowerCase()
      .includes(query);
  }

  function nextTheme() {
    const used = new Set(state.collections.map((collection) => collection.theme));
    return THEMES.find((theme) => !used.has(theme)) || THEMES[Math.floor(Math.random() * THEMES.length)];
  }

  /* =========================================================
     Summarizer (local extractive)
     ========================================================= */

  function truncate(text, max) {
    if (text.length <= max) return text;
    const slice = text.slice(0, max);
    const splitAt = slice.lastIndexOf(' ');
    return (splitAt > max * 0.55 ? slice.slice(0, splitAt) : slice).replace(/[.,;:\s]+$/, '') + '…';
  }

  function cleanPoint(sentence) {
    const cleaned = sentence.trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  function summarize(text, maxPoints = 3) {
    const raw = String(text || '').trim();
    if (!raw) return [];

    const chunks = raw
      .split(/\r?\n|•|;/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    let sentences = [];
    chunks.forEach((chunk) => {
      const pieces = chunk.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [chunk];
      pieces.forEach((piece) => {
        const sentence = piece.trim();
        if (!sentence) return;
        if (sentence.split(/\s+/).filter(Boolean).length < 2) return;
        sentences.push(sentence);
      });
    });

    const seen = new Set();
    sentences = sentences.filter((sentence) => {
      const key = sentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!sentences.length) {
      return [truncate(raw.replace(/\s+/g, ' '), 180)];
    }

    const words = (raw.toLowerCase().match(WORD_RE) || []).filter(
      (word) => word.length > 2 && !STOPWORDS.has(word)
    );

    const frequency = new Map();
    words.forEach((word) => {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    });

    const scored = sentences.map((sentence, index) => {
      const tokens = (sentence.toLowerCase().match(WORD_RE) || []).filter(Boolean);
      let score = 0;
      tokens.forEach((token) => {
        if (!STOPWORDS.has(token)) score += frequency.get(token) || 0;
      });
      score /= Math.sqrt(Math.max(tokens.length, 4));
      score += Math.max(0, 1 - index / Math.max(sentences.length, 1)) * 1.2;
      if (index === 0) score += 0.8;
      if (/\d/.test(sentence)) score += 0.35;
      return { sentence, index, score };
    });

    const picked = scored
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(maxPoints, sentences.length))
      .sort((a, b) => a.index - b.index)
      .map((entry) => truncate(cleanPoint(entry.sentence), 220))
      .filter(Boolean);

    return picked.length ? picked : [truncate(raw.replace(/\s+/g, ' '), 180)];
  }

  /* =========================================================
     Flashcard — rendering
     ========================================================= */

  function renderFlashcard() {
    const query = ui.search.trim().toLowerCase();
    const decks = query
      ? fcDecks.filter((d) => d.name.toLowerCase().includes(query) ||
          d.cards.some((c) => c.q.toLowerCase().includes(query) || c.a.toLowerCase().includes(query)))
      : fcDecks;

    const header = `
      <header class="page-head">
        <div>
          <span class="eyebrow">Belajar</span>
          <h1 class="page-title">Flashcard</h1>
          <p class="page-sub">${fcDecks.length} deck · ${fcDecks.reduce((s, d) => s + d.cards.length, 0)} kartu total</p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-ghost" type="button" data-action="fc-new-deck">+ Deck baru</button>
        </div>
      </header>`;

    if (!fcDecks.length) {
      els.viewFlashcard.innerHTML = `
        ${header}
        <div class="empty-state">
          <div class="empty-art">${CARDS_SVG}</div>
          <h3>Belum ada deck</h3>
          <p>Buat deck flashcard pertama. Tiap deck berisi kartu Tanya-Jawab yang bisa kamu latih kapan saja.</p>
          <div class="empty-actions">
            <button class="btn btn-primary" type="button" data-action="fc-new-deck">Buat deck</button>
          </div>
        </div>`;
      return;
    }

    const deckHTML = decks.length
      ? `<div class="fc-deck-grid">${decks.map(fcDeckCardHTML).join('')}</div>`
      : `<div class="no-results"><strong>Tidak ada hasil</strong> Coba kata kunci lain.</div>`;

    els.viewFlashcard.innerHTML = `${header}${deckHTML}`;
  }

  function fcDeckCardHTML(deck) {
    const total = deck.cards.length;
    const easy = deck.cards.filter((c) => c.lastRated === 'easy').length;
    const medium = deck.cards.filter((c) => c.lastRated === 'medium').length;
    const hard = deck.cards.filter((c) => c.lastRated === 'hard').length;
    const rated = deck.cards.filter((c) => c.lastRated).length;
    const pct = total ? Math.round((easy / total) * 100) : 0;

    return `
      <article class="fc-deck-card theme-${deck.theme}" tabindex="0" role="button"
        data-fc-open-deck="${deck.id}" aria-label="Latihan deck ${esc(deck.name)}">
        <div class="fc-deck-cover">
          <div class="cover-art"></div>
          <div class="cover-grain"></div>
          <div class="cover-shade"></div>
          <div class="fc-deck-cover-top">
            <span class="cover-chip">${total} kartu</span>
            <button class="kebab" type="button" data-fc-edit-deck="${deck.id}"
              aria-label="Atur deck ${esc(deck.name)}" title="Atur deck">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
            </button>
          </div>
        </div>
        <div class="fc-deck-panel">
          <h3>${esc(deck.name)}</h3>
          <div class="fc-deck-stats">
            <div class="fc-stat"><span class="fc-stat-n fc-easy-n">${easy}</span><span>Mudah</span></div>
            <div class="fc-stat"><span class="fc-stat-n">${medium}</span><span>Lumayan</span></div>
            <div class="fc-stat"><span class="fc-stat-n fc-hard-n">${hard}</span><span>Susah</span></div>
          </div>
          <div class="bar" style="margin-top:8px"><span style="width:${pct}%"></span></div>
          <div class="fc-deck-foot">
            <span>${rated}/${total} dinilai</span>
            <button class="btn btn-primary" style="height:34px;font-size:11.5px;padding:0 14px" type="button" data-fc-open-deck="${deck.id}">Latihan</button>
          </div>
        </div>
      </article>`;
  }

  function renderFcDeckDetail(deckId) {
    const deck = getFcDeck(deckId);
    if (!deck) { renderFlashcard(); return; }
    const query = ui.search.trim().toLowerCase();
    const cards = query
      ? deck.cards.filter((c) => c.q.toLowerCase().includes(query) || c.a.toLowerCase().includes(query))
      : deck.cards;

    const ratingLabel = { easy: '😄 Mudah', medium: '🙂 Lumayan', hard: '😕 Susah' };

    const cardsHTML = cards.length
      ? `<div class="fc-cards-list">${cards.map((card) => `
          <div class="fc-card-row">
            <div class="fc-card-row-body">
              <div class="fc-card-row-q">${esc(card.q)}</div>
              <div class="fc-card-row-a">${esc(card.a)}</div>
            </div>
            <div class="fc-card-row-meta">
              ${card.lastRated ? `<span class="fc-chip fc-chip-${card.lastRated}">${ratingLabel[card.lastRated]}</span>` : '<span class="fc-chip">Belum dinilai</span>'}
              <button class="icon-btn" type="button" data-fc-edit-card="${card.id}" data-fc-deck-id="${deck.id}" title="Edit kartu">
                <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
              </button>
            </div>
          </div>`).join('')}
        </div>`
      : `<div class="no-results"><strong>Tidak ada kartu</strong> Coba kata kunci lain.</div>`;

    els.viewFlashcard.innerHTML = `
      <div class="view-bar">
        <button class="back-btn" type="button" data-view="flashcard">${ARROW_LEFT_SVG} Semua deck</button>
        <div class="view-actions">
          <button class="btn btn-ghost" type="button" data-fc-edit-deck="${deck.id}">Edit deck</button>
          <button class="btn btn-ghost" type="button" data-action="fc-new-card" data-fc-deck-id="${deck.id}">+ Kartu</button>
          <button class="btn btn-primary" type="button" data-fc-open-deck="${deck.id}">▶ Latihan</button>
        </div>
      </div>

      <section class="collection-hero theme-${deck.theme}">
        <div class="hero-art"></div>
        <div class="hero-shade"></div>
        <div class="hero-content">
          <h2>${esc(deck.name)}</h2>
          <div class="hero-stats">
            <span><strong>${deck.cards.length}</strong> kartu</span>
            <span><strong>${deck.cards.filter((c) => c.lastRated === 'easy').length}</strong> mudah</span>
            <span><strong>${deck.cards.filter((c) => c.lastRated === 'hard').length}</strong> susah</span>
          </div>
        </div>
      </section>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 2px 10px">
        <span class="eyebrow" style="font-size:10px;letter-spacing:.12em;color:var(--faint)">KARTU (${deck.cards.length})</span>
        <button class="btn btn-ghost" style="height:34px;font-size:11.5px" type="button" data-action="fc-new-card" data-fc-deck-id="${deck.id}">+ Tambah kartu</button>
      </div>

      ${deck.cards.length === 0
        ? `<div class="empty-state" style="margin-top:16px">
            <div class="empty-art">${CARDS_SVG}</div>
            <h3>Belum ada kartu</h3>
            <p>Tambahkan kartu pertama ke deck ini.</p>
            <button class="btn btn-primary" type="button" data-action="fc-new-card" data-fc-deck-id="${deck.id}">+ Tambah kartu</button>
          </div>`
        : cardsHTML}`;
  }

  /* =========================================================
     Flashcard — deck create/edit dialog (dedicated)
     ========================================================= */

  let fcEditingDeckId2 = null;
  let fcDeckSelectedTheme = 'ocean';
  let fcDeckDeleteTimer = 0;

  function renderFcThemePicker() {
    if (!els.fcThemePicker) return;
    els.fcThemePicker.innerHTML = THEMES.map(
      (theme) => `
        <button class="theme-swatch theme-${theme} ${theme === fcDeckSelectedTheme ? 'is-active' : ''}"
          type="button" data-fc-theme="${theme}" aria-label="Warna ${THEME_LABELS[theme]}"
          aria-pressed="${theme === fcDeckSelectedTheme}" title="${THEME_LABELS[theme]}"></button>`
    ).join('');
  }

  function resetFcDeckDeleteButton() {
    clearTimeout(fcDeckDeleteTimer);
    if (els.fcDeckDelete) {
      els.fcDeckDelete.dataset.confirm = '0';
      els.fcDeckDelete.textContent = 'Hapus deck';
    }
  }

  function openFcDeckDialog(deckId = null) {
    const deck = deckId ? getFcDeck(deckId) : null;
    fcEditingDeckId2 = deck ? deck.id : null;
    const usedThemes = new Set(fcDecks.map((d) => d.theme));
    const freshTheme = THEMES.find((t) => !usedThemes.has(t)) || 'ocean';
    fcDeckSelectedTheme = deck ? deck.theme : freshTheme;

    els.fcDeckDialogTitle.textContent = deck ? 'Edit deck' : 'Deck baru';
    els.fcDeckNameInput.value = deck ? deck.name : '';
    els.fcDeckDelete.hidden = !deck;
    resetFcDeckDeleteButton();
    renderFcThemePicker();

    if (!els.fcDeckDialog.open) els.fcDeckDialog.showModal();
    setTimeout(() => els.fcDeckNameInput.focus(), 60);
  }

  function closeFcDeckDialog() {
    if (els.fcDeckDialog && els.fcDeckDialog.open) els.fcDeckDialog.close();
    fcEditingDeckId2 = null;
  }

  /* =========================================================
     Flashcard — card create/edit dialog
     ========================================================= */

  function openFcCardDialog(deckId, cardId = null) {
    fcEditingDeckId = deckId;
    fcEditingCardId = cardId;
    const deck = getFcDeck(deckId);
    const card = cardId && deck ? deck.cards.find((c) => c.id === cardId) : null;

    els.fcEditTitle.textContent = card ? 'Edit kartu' : 'Kartu baru';
    els.fcQInput.value = card ? card.q : '';
    els.fcAInput.value = card ? card.a : '';
    if (els.fcContextInput) els.fcContextInput.value = card ? (card.context || '') : '';
    els.fcCardDelete.hidden = !card;

    if (!els.fcEditDialog.open) els.fcEditDialog.showModal();
    setTimeout(() => els.fcQInput.focus(), 60);
  }

  function closeFcCardDialog() {
    if (els.fcEditDialog.open) els.fcEditDialog.close();
  }

  /* =========================================================
     Flashcard — practice session (Timer, TTS, Context, Rating)
     ========================================================= */

  let fcTimerInterval = null;
  let fcTimerSeconds = 0;
  let fcStageMarkup = null;

  function speakText(text) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

  function startFcSession(deckId) {
    const deck = getFcDeck(deckId);
    if (!deck || !deck.cards.length) {
      toast('Deck ini belum punya kartu. Tambahkan dulu!');
      return;
    }

    const stageEl = $('#fc-stage');
    if (stageEl && !fcStageMarkup) fcStageMarkup = stageEl.innerHTML;

    const shuffled = deck.cards.slice().sort(() => Math.random() - 0.5);
    fcSession = {
      deckId,
      queue: shuffled.map((c) => c.id),
      idx: 0,
      results: { easy: 0, medium: 0, hard: 0 },
    };

    els.fcDeckName.textContent = deck.name;
    const card = $('#fc-card');
    const rating = $('#fc-rating');
    if (card) card.classList.remove('is-flipped');
    if (rating) rating.hidden = true;

    // Start practice timer
    clearInterval(fcTimerInterval);
    fcTimerSeconds = 0;
    if (els.fcTimerText) els.fcTimerText.textContent = '00:00';
    fcTimerInterval = setInterval(() => {
      fcTimerSeconds++;
      const mins = pad2(Math.floor(fcTimerSeconds / 60));
      const secs = pad2(fcTimerSeconds % 60);
      if (els.fcTimerText) els.fcTimerText.textContent = `${mins}:${secs}`;
    }, 1000);

    updateFcSessionUI();
    if (!els.fcModal.open) els.fcModal.showModal();
  }

  function updateFcSessionUI() {
    if (!fcSession) return;
    const deck = getFcDeck(fcSession.deckId);
    if (!deck) return;

    const total = fcSession.queue.length;
    const idx = fcSession.idx;
    const cardId = fcSession.queue[idx];
    const card = deck.cards.find((c) => c.id === cardId);
    if (!card) return;

    if (els.fcCurrent) els.fcCurrent.textContent = idx + 1;
    if (els.fcTotal) els.fcTotal.textContent = total;
    if (els.fcProgressFill) els.fcProgressFill.style.width = `${Math.round((idx / total) * 100)}%`;
    if (els.fcCardCounter) els.fcCardCounter.textContent = `Kartu ${idx + 1}`;

    const frontText = $('#fc-front-text');
    const backText = $('#fc-back-text');
    if (frontText) frontText.textContent = card.q;
    if (backText) backText.textContent = card.a;

    // Word in use / context
    const contextCard = $('#fc-context-card');
    const contextText = $('#fc-context-text');
    const contextBody = $('#fc-context-body');
    const contextToggle = $('#fc-context-toggle');
    if (contextCard && contextText) {
      if (card.context && card.context.trim()) {
        contextCard.hidden = false;
        contextText.textContent = card.context.trim();
        if (contextBody) contextBody.hidden = true;
        if (contextToggle) contextToggle.setAttribute('aria-expanded', 'false');
      } else {
        contextCard.hidden = true;
      }
    }

    const fcCard = $('#fc-card');
    const fcRating = $('#fc-rating');
    if (fcCard) fcCard.classList.remove('is-flipped');
    if (fcRating) fcRating.hidden = true;
  }

  function rateFcCard(rating) {
    if (!fcSession) return;
    const deck = getFcDeck(fcSession.deckId);
    if (!deck) return;

    const cardId = fcSession.queue[fcSession.idx];
    const card = deck.cards.find((c) => c.id === cardId);
    if (card) card.lastRated = rating;
    fcSession.results[rating] = (fcSession.results[rating] || 0) + 1;
    saveFcDecks();

    fcSession.idx++;
    if (fcSession.idx >= fcSession.queue.length) {
      showFcResult();
      return;
    }

    const wrap = $('#fc-card-wrap');
    if (wrap) {
      wrap.classList.add('fc-slide-out');
      setTimeout(() => {
        if (wrap.isConnected) wrap.classList.remove('fc-slide-out');
        updateFcSessionUI();
      }, 180);
    } else {
      updateFcSessionUI();
    }
  }

  function showFcResult() {
    clearInterval(fcTimerInterval);
    const r = fcSession.results;
    const total = fcSession.queue.length;
    const deckId = fcSession.deckId;
    const stage = $('#fc-stage');
    if (!stage) return;
    if (!fcStageMarkup) fcStageMarkup = stage.innerHTML;
    const mins = pad2(Math.floor(fcTimerSeconds / 60));
    const secs = pad2(fcTimerSeconds % 60);

    stage.innerHTML = `
      <div class="fc-result">
        <div class="fc-result-emoji">🎉</div>
        <h3>Sesi selesai!</h3>
        <p>${total} kartu sudah direview dalam <strong>${mins}:${secs}</strong></p>
        <div class="fc-result-breakdown">
          <div class="fc-rb-item fc-easy-n"><span>${r.easy || 0}</span>Mudah</div>
          <div class="fc-rb-item"><span>${r.medium || 0}</span>Lumayan</div>
          <div class="fc-rb-item fc-hard-n"><span>${r.hard || 0}</span>Susah</div>
        </div>
        <div class="fc-result-actions">
          <button class="btn btn-ghost" type="button" id="fc-restart-btn">Ulangi sesi</button>
          <button class="btn btn-primary" type="button" id="fc-done-btn">Selesai</button>
        </div>
      </div>`;

    $('#fc-restart-btn').addEventListener('click', () => {
      if (!fcStageMarkup) return;
      stage.innerHTML = fcStageMarkup;
      startFcSession(deckId);
    });
    $('#fc-done-btn').addEventListener('click', closeFcModal);
  }

  function closeFcModal() {
    clearInterval(fcTimerInterval);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (els.fcModal.open) els.fcModal.close();
    fcSession = null;
    if (ui.view === 'flashcard') renderFlashcard();
    else if (ui.view === 'flashcard-deck') renderFcDeckDetail(ui.fcDeckId);
  }

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

  function renderDashboard() {
    const query = ui.search.trim().toLowerCase();
    const stats = globalStats();

    if (!state.collections.length) {
      els.viewDashboard.innerHTML = `
        ${pageHead('Workspace', 'Koleksi kamu', 'Mulai dari satu koleksi kecil. Nanti bisa nambah lagi.')}
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
          <h1 class="page-title">Koleksi kamu</h1>
          <p class="page-sub">${state.collections.length} koleksi · ${stats.notes} catatan · ${stats.open} to-do aktif</p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-ghost" type="button" data-view="todo">Lihat to-do</button>
          <button class="btn btn-ghost" type="button" data-action="new-collection">+ Koleksi baru</button>
        </div>
      </header>
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

  function collectionAddHTML() {
    return `
      <button class="collection-add" type="button" data-action="new-collection">
        <span class="add-plus" aria-hidden="true">+</span>
        <strong>Koleksi baru</strong>
        <small>Kelompokkan catatan & to-do</small>
      </button>`;
  }

  function noResultsHTML() {
    return `
      <div class="no-results">
        <strong>Tidak ada hasil</strong>
        Coba kata kunci lain atau hapus pencarian.
      </div>`;
  }

  function renderCollection() {
    const collection = getCollection(ui.collectionId);
    if (!collection) {
      ui.view = 'dashboard';
      ui.collectionId = null;
      renderAll();
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

  function renderTodo() {
    const query = ui.search.trim().toLowerCase();
    const stats = globalStats();

    const groups = [];
    state.collections.forEach((collection) => {
      collection.notes.forEach((note) => {
        if (!note.tasks.length) return;
        const tasks = note.tasks.filter(
          (task) =>
            !query ||
            task.text.toLowerCase().includes(query) ||
            note.title.toLowerCase().includes(query) ||
            collection.title.toLowerCase().includes(query)
        );
        if (tasks.length) groups.push({ collection, note, tasks });
      });
    });

    groups.sort((a, b) => b.note.updatedAt - a.note.updatedAt);

    const header = `
      <header class="page-head">
        <div>
          <span class="eyebrow">Tasks</span>
          <h1 class="page-title">To-do</h1>
          <p class="page-sub">${
            stats.total
              ? `${stats.open} tugas belum selesai dari ${stats.total} total.`
              : 'Checklist dari semua catatan bakal muncul di sini.'
          }</p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-ghost" type="button" data-view="dashboard">Ke beranda</button>
          <button class="btn btn-primary" type="button" data-action="new-note">+ Catatan</button>
        </div>
      </header>`;

    if (!stats.total) {
      els.viewTodo.innerHTML = `
        ${header}
        <div class="empty-state">
          <div class="empty-art">${CHECK_SQUARE_SVG}</div>
          <h3>Belum ada to-do</h3>
          <p>Buat koleksi dan catatan dulu, lalu tambahkan checklist di panel To-do saat menulis.</p>
          <div class="empty-actions">
            <button class="btn btn-primary" type="button" data-view="dashboard">Lihat koleksi</button>
            <button class="btn btn-ghost" type="button" data-action="open-tutorial">Lihat panduan</button>
          </div>
        </div>`;
      return;
    }

    const percent = Math.round((stats.done / stats.total) * 100);

    els.viewTodo.innerHTML = `
      ${header}
      <div class="todo-layout">
        <aside class="todo-overview">
          <span class="eyebrow">Progress</span>
          <div class="todo-ring" style="--pct: ${percent}">
            <div><strong>${stats.open}</strong><span>tersisa</span></div>
          </div>
          <h3>${
            stats.open === 0
              ? 'Semua beres!'
              : percent >= 70
                ? 'Hampir kelar'
                : 'Pelan-pelan aja'
          }</h3>
          <p>${stats.done} dari ${stats.total} tugas sudah selesai.</p>
          <div class="bar"><span style="width: ${percent}%"></span></div>
        </aside>

        <div class="todo-groups">
          ${
            groups.length
              ? groups
                  .map((group) => {
                    const remaining = group.tasks.filter((task) => !task.done).length;
                    const sorted = group.tasks
                      .slice()
                      .sort((a, b) => Number(a.done) - Number(b.done));
                    return `
                      <section class="todo-group theme-${group.collection.theme}">
                        <button class="todo-group-head" type="button"
                          data-open-note="${group.note.id}" data-collection-id="${group.collection.id}">
                          <span class="dot"></span>
                          <span class="todo-group-title">${esc(group.note.title || 'Tanpa judul')}</span>
                          <span class="todo-group-col">${esc(group.collection.title)}</span>
                          <span class="todo-group-count">${remaining}</span>
                        </button>
                        <ul class="todo-tasks">
                          ${sorted
                            .map(
                              (task) => `
                                <li class="todo-row ${task.done ? 'is-done' : ''}">
                                  <button class="check-btn ${task.done ? 'is-done' : ''}" type="button"
                                    data-toggle-task="${task.id}" data-collection-id="${group.collection.id}"
                                    data-note-id="${group.note.id}" aria-pressed="${task.done}"
                                    aria-label="${task.done ? 'Tandai belum selesai' : 'Tandai selesai'}">
                                    ${CHECK_SVG}
                                  </button>
                                  <span class="todo-text">${esc(task.text)}</span>
                                </li>`
                            )
                            .join('')}
                        </ul>
                      </section>`;
                  })
                  .join('')
              : `<div class="no-results">
                  <strong>Tidak ada to-do yang cocok</strong>
                  Coba kata kunci lain.
                </div>`
          }
        </div>
      </div>`;
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

  function openFcDeck(deckId) {
    if (!getFcDeck(deckId)) return;
    ui.view = 'flashcard-deck';
    ui.fcDeckId = deckId;
    ui.search = '';
    els.search.value = '';
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
     Note editor
     ========================================================= */

  function openNote(collectionId, noteId, options = {}) {
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
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
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
    clearTimeout(persistTimer);

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
    renderAll();
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

  function openCollectionDialog(collectionId = null) {
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

  function closeCollectionDialog() {
    if (els.collectionDialog.open) els.collectionDialog.close();
  }

  /* =========================================================
     Tutorial
     ========================================================= */

  function tutorialSeen() {
    try {
      return localStorage.getItem(TUTORIAL_KEY) === '1';
    } catch (error) {
      return true;
    }
  }

  function markTutorialSeen() {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1');
    } catch (error) {
      /* ignore */
    }
  }

  function openTutorial() {
    if (!els.tutorialDialog || els.tutorialDialog.open) return;
    if (els.tutorialStart) {
      els.tutorialStart.textContent = state.collections.length
        ? 'Mengerti'
        : 'Buat koleksi pertama';
    }
    els.tutorialDialog.showModal();
  }

  function closeTutorial() {
    markTutorialSeen();
    if (els.tutorialDialog && els.tutorialDialog.open) els.tutorialDialog.close();
  }

  function finishTutorial() {
    closeTutorial();
    if (!state.collections.length) openCollectionDialog();
  }

  /* =========================================================
     Actions
     ========================================================= */

  function createNote() {
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
    renderAll();
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
      renderAll();
    });
  }

  function summarizeCollection() {
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

  function toggleTask(collectionId, noteId, taskId) {
    const note = getNote(collectionId, noteId);
    if (!note) return;
    const task = note.tasks.find((item) => item.id === taskId);
    if (!task) return;

    task.done = !task.done;
    note.updatedAt = Date.now();
    saveNow();
    renderCurrentView();
    renderSidebar();
  }

  function copyToClipboard(text) {
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

  function toast(message, actionLabel = null, action = null) {
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

  function hideToast() {
    clearTimeout(toastTimer);
    els.toast.classList.remove('is-visible');
  }

  /* =========================================================
     Events
     ========================================================= */

  document.addEventListener('click', (event) => {
    const copyNoteButton = event.target.closest('[data-copy-note-summary]');
    if (copyNoteButton) {
      if (!lastNoteSummary.length) return;
      copyToClipboard(lastNoteSummary.map((point) => `• ${point}`).join('\n'));
      copyNoteButton.textContent = 'Tersalin';
      setTimeout(() => {
        if (copyNoteButton.isConnected) copyNoteButton.textContent = 'Salin';
      }, 1500);
      return;
    }

    const copyCollectionButton = event.target.closest('[data-copy-summary]');
    if (copyCollectionButton) {
      const summary = ui.collectionSummary;
      if (!summary || !summary.points || !summary.points.length) return;
      copyToClipboard(summary.points.map((point) => `• ${point}`).join('\n'));
      toast('Ringkasan disalin.');
      return;
    }

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

  // Flashcard practice modal events
  els.fcClose.addEventListener('click', closeFcModal);
  els.fcModal.addEventListener('cancel', (e) => { e.preventDefault(); closeFcModal(); });
  els.fcModal.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeFcModal(); } });

  // Flip card on click, TTS, and context toggle
  els.fcModal.addEventListener('click', (e) => {
    // Rating buttons
    if (e.target.closest('[data-rate]')) {
      rateFcCard(e.target.closest('[data-rate]').dataset.rate);
      return;
    }

    // TTS speaker buttons
    const ttsFront = e.target.closest('#fc-tts-front');
    if (ttsFront) {
      e.stopPropagation();
      const text = $('#fc-front-text');
      if (text) speakText(text.textContent);
      return;
    }
    const ttsBack = e.target.closest('#fc-tts-back');
    if (ttsBack) {
      e.stopPropagation();
      const text = $('#fc-back-text');
      if (text) speakText(text.textContent);
      return;
    }

    // Context toggle (Word in use)
    const contextToggle = e.target.closest('#fc-context-toggle');
    if (contextToggle) {
      e.stopPropagation();
      const body = $('#fc-context-body');
      if (body) {
        body.hidden = !body.hidden;
        contextToggle.setAttribute('aria-expanded', String(!body.hidden));
      }
      return;
    }

    // Card flip
    if (e.target.closest('#fc-card-wrap') || e.target.closest('#fc-card')) {
      const card = $('#fc-card');
      if (card && !card.classList.contains('is-flipped')) {
        card.classList.add('is-flipped');
        const rating = $('#fc-rating');
        if (rating) rating.hidden = false;
      }
    }
  });

  // Keyboard for practice: space/enter = flip, 1=hard, 2=medium, 3=easy
  els.fcModal.addEventListener('keydown', (e) => {
    if (!fcSession) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const card = $('#fc-card');
      if (card && !card.classList.contains('is-flipped')) {
        card.classList.add('is-flipped');
        const rating = $('#fc-rating');
        if (rating) rating.hidden = false;
      }
    } else if (e.key === '1') { rateFcCard('hard'); }
    else if (e.key === '2') { rateFcCard('medium'); }
    else if (e.key === '3') { rateFcCard('easy'); }
  });

  // Flashcard card edit dialog form
  els.fcEditForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = els.fcQInput.value.trim();
    const a = els.fcAInput.value.trim();
    const context = els.fcContextInput ? els.fcContextInput.value.trim() : '';
    if (!q || !a) {
      toast('Isi pertanyaan dan jawaban dulu ya!');
      return;
    }

    const deck = getFcDeck(fcEditingDeckId);
    if (!deck) return;

    if (fcEditingCardId) {
      const card = deck.cards.find((c) => c.id === fcEditingCardId);
      if (card) {
        card.q = q;
        card.a = a;
        card.context = context;
      }
      toast('Kartu diperbarui.');
    } else {
      deck.cards.push({ id: uid(), q, a, context, lastRated: null });
      toast('Kartu baru ditambahkan.');
    }
    saveFcDecks();
    closeFcCardDialog();
    if (ui.view === 'flashcard-deck') renderFcDeckDetail(fcEditingDeckId);
    else if (ui.view === 'flashcard') renderFlashcard();
  });

  els.fcCardDelete.addEventListener('click', () => {
    if (!fcEditingCardId || !fcEditingDeckId) return;
    const deck = getFcDeck(fcEditingDeckId);
    if (!deck) return;
    const idx = deck.cards.findIndex((c) => c.id === fcEditingCardId);
    if (idx === -1) return;
    const [removed] = deck.cards.splice(idx, 1);
    saveFcDecks();
    closeFcCardDialog();
    if (ui.view === 'flashcard-deck') renderFcDeckDetail(fcEditingDeckId);
    else if (ui.view === 'flashcard') renderFlashcard();
    toast('Kartu dihapus.', 'Urungkan', () => {
      deck.cards.splice(Math.min(idx, deck.cards.length), 0, removed);
      saveFcDecks();
      if (ui.view === 'flashcard-deck') renderFcDeckDetail(fcEditingDeckId);
      else if (ui.view === 'flashcard') renderFlashcard();
    });
  });

  els.fcEditDialog.addEventListener('cancel', (e) => { e.preventDefault(); closeFcCardDialog(); });
  els.fcEditDialog.addEventListener('click', (e) => { if (e.target === els.fcEditDialog) closeFcCardDialog(); });

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

  // Editor events
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
    renderSidebar();
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
        renderSidebar();
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
      renderSidebar();
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

  // Tutorial events
  els.helpBtn.addEventListener('click', openTutorial);
  if (els.tutorialStart) els.tutorialStart.addEventListener('click', finishTutorial);

  if (els.tutorialDialog) {
    els.tutorialDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeTutorial();
    });

    els.tutorialDialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeTutorial();
    });

    els.tutorialDialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-close-tutorial]')) {
        closeTutorial();
        return;
      }
      if (event.target === els.tutorialDialog) closeTutorial();
    });
  }

  // Collection dialog events (ONLY for collections/notes)
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
      renderAll();
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

    renderAll();
    toast(`Koleksi "${collection.title}" dihapus.`, 'Urungkan', () => {
      state.collections.splice(Math.min(index, state.collections.length), 0, collection);
      saveNow();
      renderAll();
    });
  });

  // Flashcard Deck dialog events (DEDICATED - completely independent from collections)
  if (els.fcDeckForm) {
    els.fcDeckForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = els.fcDeckNameInput.value.trim();
      if (!name) {
        els.fcDeckNameInput.focus();
        return;
      }

      if (fcEditingDeckId2) {
        const deck = getFcDeck(fcEditingDeckId2);
        if (deck) {
          deck.name = name;
          deck.theme = fcDeckSelectedTheme;
        }
        saveFcDecks();
        closeFcDeckDialog();
        renderAll();
        toast('Deck diperbarui.');
      } else {
        const deck = {
          id: uid(),
          name,
          theme: fcDeckSelectedTheme,
          createdAt: Date.now(),
          cards: [],
        };
        fcDecks.unshift(deck);
        saveFcDecks();
        closeFcDeckDialog();
        openFcDeck(deck.id);
        toast('Deck baru dibuat.');
      }
    });
  }

  if (els.fcThemePicker) {
    els.fcThemePicker.addEventListener('click', (event) => {
      const swatch = event.target.closest('[data-fc-theme]');
      if (!swatch) return;
      fcDeckSelectedTheme = swatch.dataset.fcTheme;
      $$('.theme-swatch', els.fcThemePicker).forEach((button) => {
        const active = button === swatch;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    });
  }

  if (els.fcDeckDialog) {
    els.fcDeckDialog.addEventListener('click', (e) => {
      if (e.target === els.fcDeckDialog) closeFcDeckDialog();
    });
    els.fcDeckDialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeFcDeckDialog();
    });
  }

  if (els.fcDeckDelete) {
    els.fcDeckDelete.addEventListener('click', () => {
      if (!fcEditingDeckId2) return;
      if (els.fcDeckDelete.dataset.confirm !== '1') {
        els.fcDeckDelete.dataset.confirm = '1';
        els.fcDeckDelete.textContent = 'Yakin? Klik lagi';
        clearTimeout(fcDeckDeleteTimer);
        fcDeckDeleteTimer = setTimeout(resetFcDeckDeleteButton, 2600);
        return;
      }

      const deck = getFcDeck(fcEditingDeckId2);
      if (!deck) return;

      const idx = fcDecks.indexOf(deck);
      fcDecks.splice(idx, 1);
      saveFcDecks();
      const wasId = fcEditingDeckId2;
      fcEditingDeckId2 = null;
      closeFcDeckDialog();

      if (ui.view === 'flashcard-deck' && ui.fcDeckId === wasId) {
        go('flashcard');
      } else {
        renderAll();
      }

      toast(`Deck "${deck.name}" dihapus.`, 'Urungkan', () => {
        fcDecks.splice(Math.min(idx, fcDecks.length), 0, deck);
        saveFcDecks();
        renderAll();
      });
    });
  }

  window.addEventListener('beforeunload', () => { saveNow(); saveFcDecks(); });

  /* =========================================================
     Boot
     ========================================================= */

  function init() {
    const saved = loadState();
    state = saved || { collections: [] };
    if (!saved) saveNow();
    fcDecks = loadFcDecks();
    renderAll();

    if (!tutorialSeen()) {
      setTimeout(openTutorial, 420);
    }
  }

  init();
})();
