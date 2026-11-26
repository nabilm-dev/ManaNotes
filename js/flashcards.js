/* =========================================================
   Flashcards — deck grid, deck detail, deck/card dialogs,
   practice session, timer, TTS, context, rating & results.
   ========================================================= */

import {
  $, $$, esc, pad2, uid, els, ui,
  THEMES, THEME_LABELS, FC_STORAGE_KEY, CARDS_SVG, ARROW_LEFT_SVG,
  toast, refresh, go,
} from './core.js';

/* =========================================================
   Module state
   ========================================================= */

let fcDecks = []; // [{ id, name, theme, cards: [{id,q,a,lastRated}] }]
let fcSession = null; // { deckId, queue:[cardId,...], idx, results:{easy,medium,hard} }
let fcEditingDeckId = null;
let fcEditingCardId = null;

let fcEditingDeckId2 = null;
let fcDeckSelectedTheme = 'ocean';
let fcDeckDeleteTimer = 0;

let fcTimerInterval = null;
let fcTimerSeconds = 0;
let fcStageMarkup = null;

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

export function saveFcDecks() {
  try {
    localStorage.setItem(FC_STORAGE_KEY, JSON.stringify(fcDecks));
  } catch (e) {}
}

/* =========================================================
   Bridge for "Buat flashcard" from notes.
   Keeps generated cards inside the normal deck model.
   ========================================================= */

function normalizeGeneratedCard(card) {
  if (!card) return null;
  const q = String(card.q || '').trim().slice(0, 400);
  const a = String(card.a || '').trim().slice(0, 800);
  if (!q || !a) return null;
  return {
    id: uid(),
    q,
    a,
    context: String(card.context || '').trim().slice(0, 400),
    lastRated: null,
  };
}

function cardQuestionKey(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, ' ')
    .trim();
}

function renderAfterCardImport(deckId) {
  if (ui.view === 'flashcard-deck' && ui.fcDeckId === deckId) {
    renderFcDeckDetail(deckId);
  } else if (ui.view === 'flashcard') {
    renderFlashcard();
  }
}

export function listFcDeckSummaries() {
  return fcDecks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    theme: deck.theme,
    count: deck.cards.length,
  }));
}

export function addGeneratedCards(deckId, cards) {
  const deck = getFcDeck(deckId);
  if (!deck) return 0;

  const prepared = (Array.isArray(cards) ? cards : [])
    .map(normalizeGeneratedCard)
    .filter(Boolean);

  if (!prepared.length) return 0;

  // Jangan dobel: lewati kartu yang pertanyaannya sudah ada di deck ini.
  const existing = new Set(deck.cards.map((card) => cardQuestionKey(card.q)));
  const fresh = prepared.filter((card) => {
    const key = cardQuestionKey(card.q);
    if (!key || existing.has(key)) return false;
    existing.add(key);
    return true;
  });

  if (!fresh.length) return 0;

  deck.cards.push(...fresh);
  saveFcDecks();
  renderAfterCardImport(deck.id);
  return fresh.length;
}

export function createGeneratedDeck(name, cards) {
  const safeName =
    String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Flashcard';
  const deck = {
    id: uid(),
    name: safeName,
    theme: THEMES[fcDecks.length % THEMES.length] || 'ocean',
    createdAt: Date.now(),
    cards: [],
  };

  fcDecks.unshift(deck);
  const added = addGeneratedCards(deck.id, cards);

  if (!added) {
    fcDecks = fcDecks.filter((item) => item !== deck);
    saveFcDecks();
    return { deck: null, added: 0 };
  }

  return { deck, added };
}

function getFcDeck(id) {
  return fcDecks.find((d) => d.id === id) || null;
}

/* =========================================================
   Rendering
   ========================================================= */

export function renderFlashcard() {
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

export function renderFcDeckDetail(deckId) {
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
   Deck create/edit dialog (dedicated)
   ========================================================= */

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

export function openFcDeckDialog(deckId = null) {
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

export function closeFcDeckDialog() {
  if (els.fcDeckDialog && els.fcDeckDialog.open) els.fcDeckDialog.close();
  fcEditingDeckId2 = null;
}

/* =========================================================
   Card create/edit dialog
   ========================================================= */

export function openFcCardDialog(deckId, cardId = null) {
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

export function closeFcCardDialog() {
  if (els.fcEditDialog.open) els.fcEditDialog.close();
}

/* =========================================================
   Practice session (timer, TTS, context, rating)
   ========================================================= */

function speakText(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
}

export function startFcSession(deckId) {
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

function openFcDeck(deckId) {
  if (!getFcDeck(deckId)) return;
  ui.view = 'flashcard-deck';
  ui.fcDeckId = deckId;
  ui.search = '';
  els.search.value = '';
  refresh();
  els.main.scrollTop = 0;
}

/* =========================================================
   Event wiring
   ========================================================= */

export function initFlashcards() {
  fcDecks = loadFcDecks();

  // Practice modal
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

  // Card edit dialog form
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

  // Deck dialog events (DEDICATED - completely independent from collections)
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
        refresh();
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
        refresh();
      }

      toast(`Deck "${deck.name}" dihapus.`, 'Urungkan', () => {
        fcDecks.splice(Math.min(idx, fcDecks.length), 0, deck);
        saveFcDecks();
        refresh();
      });
    });
  }
}
