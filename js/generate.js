/* =========================================================
   Generate — ubah isi catatan jadi draft flashcard.
   Lokal, tanpa API: definisi, daftar, dan cloze deletion.
   ========================================================= */

import { esc, toast } from './core.js';
import {
  listFcDeckSummaries,
  addGeneratedCards,
  createGeneratedDeck,
} from './flashcards.js';

const MAX_CARDS = 12;
const MAX_CLOZE = 4;
const LAST_DECK_KEY = 'mananotes.gen.v1';

const TYPE_LABEL = {
  definition: 'Definisi',
  list: 'Daftar',
  cloze: 'Isian',
};

const LIST_KEYWORDS =
  /(tahap|langkah|contoh|jenis|fungsi|manfaat|ciri|unsur|bagian|komponen|faktor|tujuan|dampak|macam|klasifikasi)/i;

const STOPWORDS = new Set(
  (
    'yang dan di ke dari untuk dengan ini itu ada adalah akan pada juga karena bisa atau saat sudah belum lebih sangat para kita kami kamu saya dia mereka ' +
    'tidak bukan dalam oleh sebagai agar supaya kalau jika tapi namun lalu kemudian setelah sebelum atas bawah hanya masih lagi aja udah tuh nggak gak ' +
    'jadi buat bikin gitu kayak sama pun bahwa terhadap secara serta bagi hingga sampai antara tanpa harus dapat sedang telah ' +
    'the a an and or of to in on at for with is are was were be been being it this that these those as by from into over under then than so such ' +
    'ialah merupakan yaitu menjadi sebagai pada untuk dari dengan'
  ).split(/\s+/)
);

/* =========================================================
   Text helpers
   ========================================================= */

function squeeze(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/`+/g, '')
    .replace(/\*\*|__/g, '')
    .trim();
}

function cleanLine(line) {
  return stripMarkdown(
    String(line || '')
      .replace(/^\s{0,3}#{1,6}\s*/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*(?:[-*•–—]+|\d{1,2}[.)])\s+/, '')
      .trim()
  );
}

function normalizeKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, ' ')
    .trim();
}

function lowerFirst(text) {
  if (!text) return text;
  const [first, ...rest] = text.split(' ');
  if (/^[A-Z]{2,}$/.test(first)) return text;
  return [first.charAt(0).toLowerCase() + first.slice(1), ...rest].join(' ');
}

function ensureQuestion(text) {
  const clean = squeeze(text).replace(/[.!,;:]+$/, '');
  return /[?]$/.test(clean) ? clean : `${clean}?`;
}

function isExplicitItem(rawLine) {
  return /^\s*(?:[-*•–—]+|\d{1,2}[.)]|[a-zA-Z][.)])\s+/.test(rawLine);
}

/* =========================================================
   Extraction
   ========================================================= */

function splitColon(line) {
  if (/^https?:\/\//i.test(line)) return null;
  const match = line.match(/^(.{2,70}?)\s*[:：]\s*(.{2,})$/);
  if (!match) return null;

  const term = match[1].trim();
  const value = match[2].trim();

  if (!/[a-zA-Z\u00c0-\u024f]/.test(term)) return null;
  if (!/[a-zA-Z0-9\u00c0-\u024f]/.test(value)) return null;
  // Skip times ("Jam 08:00") and ratios.
  if (/\d$/.test(term) && /^\d{2}$/.test(value)) return null;

  return { term, value };
}

function isGoodTerm(term) {
  const words = term.split(/\s+/).filter(Boolean);
  return (
    term.length >= 3 &&
    term.length <= 70 &&
    words.length <= 9 &&
    !/[?]$/.test(term) &&
    !/^\d+$/.test(term)
  );
}

function isGoodAnswer(answer) {
  const words = answer.split(/\s+/).filter(Boolean);
  return (
    answer.length >= 2 &&
    answer.length <= 500 &&
    words.length <= 45 &&
    /[a-zA-Z0-9\u00c0-\u024f]/.test(answer)
  );
}

function definitionFront(term) {
  const clean = term.replace(/[:.?!]+$/, '').trim();
  if (/^apa\s+itu\b/i.test(clean)) return ensureQuestion(clean);
  return `Apa itu ${clean}?`;
}

function splitListItems(value) {
  return value
    .split(/\s*[,;]\s*/)
    .map((item) => squeeze(item).replace(/[.;:]+$/, ''))
    .filter((item) => item.length >= 2 && item.length <= 60)
    .slice(0, 6);
}

function isListish(term, value) {
  const items = splitListItems(value);
  if (items.length < 2) return false;

  const leftWords = term.split(/\s+/).filter(Boolean).length;
  if (LIST_KEYWORDS.test(term)) {
    return items.every((item) => item.split(/\s+/).length <= 8);
  }

  const shortItems = items.every(
    (item) => item.split(/\s+/).length <= 4 && item.length <= 40
  );
  return leftWords <= 4 && items.length >= 3 && shortItems;
}

function collectSentences(rawLines) {
  const sentences = [];
  rawLines.forEach((rawLine) => {
    if (!rawLine || isExplicitItem(rawLine)) return;
    const line = cleanLine(rawLine);
    if (!line || line.length < 26) return;

    const pieces = line.match(/[^.!?]+[.!?]?/g) || [];
    pieces.forEach((piece) => {
      const sentence = squeeze(piece);
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length >= 7 && words.length <= 40 && sentence.length >= 30) {
        sentences.push(sentence);
      }
    });
  });
  return sentences;
}

function pickKeyword(sentence) {
  const tokens = Array.from(
    sentence.matchAll(/[a-zA-Z\u00c0-\u024f0-9][a-zA-Z\u00c0-\u024f0-9'’-]*/g)
  );
  let best = null;

  tokens.forEach((match, index) => {
    const word = match[0];
    if (match.index === 0) return;
    if (word.length < 4) return;
    if (STOPWORDS.has(word.toLowerCase())) return;
    if (/^\d{1,2}$/.test(word) && Number(word) < 10) return;

    let score = word.length / 4;
    if (/\d/.test(word)) score += 1.4;
    if (/^[A-Z\u00c0-\u024f]/.test(word)) score += 1.1;
    if (!best || score > best.score) best = { word, score };
  });

  if (!best) return null;

  const escaped = best.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const occurrences = (sentence.match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length;
  return occurrences === 1 ? best.word : null;
}

/* =========================================================
   Draft builder
   ========================================================= */

export function generateDrafts(note) {
  const title = squeeze(note && note.title);
  const body = String((note && note.body) || '').replace(/\r\n?/g, '\n');
  const rawLines = body.split('\n').map((line) => line.trim());
  const lines = rawLines.map(cleanLine).filter((line) => line && !/^[-–—_=*\s]+$/.test(line));

  if (!lines.length) return [];

  const context = title ? `Dari catatan: ${title}` : '';
  const state = {
    drafts: [],
    seen: new Set(),
    answers: new Set(),
    context,
  };

  const pushDraft = (type, question, answer) => {
    const q = squeeze(stripMarkdown(question));
    const a = squeeze(stripMarkdown(answer));
    if (q.length < 4 || q.length > 300) return false;
    if (a.length < 2 || a.length > 500) return false;

    const qKey = normalizeKey(q);
    const aKey = normalizeKey(a);
    if (!qKey || !aKey || qKey === aKey) return false;
    if (state.seen.has(qKey)) return false;

    state.seen.add(qKey);
    state.answers.add(aKey);
    state.drafts.push({ type, q, a, context });
    return true;
  };

  const pushList = (topic, items) => {
    const cleanItems = items
      .map((item) => squeeze(item).replace(/[.;:]+$/, ''))
      .filter((item) => item.length >= 2)
      .slice(0, 6);

    if (cleanItems.length < 2) return;

    const cleanTopic = squeeze(topic).replace(/[:.?!]+$/, '');
    if (!cleanTopic) return;

    const question = /^(apa|sebutkan|jelaskan)\b/i.test(cleanTopic)
      ? ensureQuestion(cleanTopic)
      : `Apa saja ${lowerFirst(cleanTopic)}?`;

    pushDraft('list', question, cleanItems.join(', '));
  };

  // 1. "Istilah: penjelasan" dan "X adalah Y"
  lines.forEach((line) => {
    const colon = splitColon(line);
    if (colon && isGoodTerm(colon.term)) {
      if (isListish(colon.term, colon.value)) {
        pushList(colon.term, splitListItems(colon.value));
      } else if (isGoodAnswer(colon.value)) {
        pushDraft('definition', definitionFront(colon.term), colon.value);
      }
    }

    const idMarker = line.match(/^(.{2,70}?)\s+(adalah|ialah|merupakan|yaitu)\s+(.{2,})$/i);
    if (idMarker) {
      const term = idMarker[1].trim();
      const value = idMarker[3].trim();
      if (isGoodTerm(term)) {
        // "Organel yang berperan adalah A, B, dan C" → kartu daftar, bukan definisi.
        if (isListish(term, value)) {
          pushList(term, splitListItems(value));
        } else if (isGoodAnswer(value)) {
          pushDraft('definition', definitionFront(term), value);
        }
      }
      return;
    }

    const enMarker = line.match(/^(.{2,70}?)\s+(is|are|means|refers to)\s+(.{2,})$/i);
    if (enMarker) {
      const term = enMarker[1].trim();
      const value = enMarker[3].trim();
      if (isGoodTerm(term) && isGoodAnswer(value)) {
        pushDraft('definition', definitionFront(term), value);
      }
    }
  });

  // 2. Heading "Tahapan:" diikuti baris daftar.
  for (let index = 0; index < rawLines.length; index += 1) {
    const current = cleanLine(rawLines[index]);
    if (!/[:：]\s*$/.test(current)) continue;

    const topic = current.replace(/[:：]\s*$/, '').trim();
    if (!topic || topic.length < 3 || topic.length > 70) continue;

    const items = [];
    let cursor = index + 1;

    while (cursor < rawLines.length && items.length < 6) {
      const raw = rawLines[cursor];
      if (!raw) {
        cursor += 1;
        if (items.length) break;
        continue;
      }

      const next = cleanLine(raw);
      if (!next) {
        cursor += 1;
        continue;
      }
      if (/[:：]\s*$/.test(next)) break;

      const explicit = isExplicitItem(raw);
      const looksLikeItem =
        next.length <= 90 &&
        next.split(/\s+/).filter(Boolean).length <= 12 &&
        !/[.!?]$/.test(next);

      if (!explicit && !looksLikeItem) break;

      items.push(next.replace(/[.;:]+$/, ''));
      cursor += 1;
    }

    if (items.length >= 2) {
      pushList(topic, items);
      index = cursor - 1;
    }
  }

  // 3. Cloze dari kalimat yang belum jadi jawaban.
  let clozeCount = 0;
  for (const sentence of collectSentences(rawLines)) {
    if (state.drafts.length >= MAX_CARDS || clozeCount >= MAX_CLOZE) break;
    if (state.answers.has(normalizeKey(sentence))) continue;
    if (/^(apa|what|sebutkan|jelaskan)\b/i.test(sentence)) continue;
    // Kalimat definisi sudah jadi kartu definisi/daftar; cloze-nya cuma duplikat.
    if (/\b(adalah|ialah|merupakan|yaitu)\b/i.test(sentence)) continue;

    const keyword = pickKeyword(sentence);
    if (!keyword) continue;

    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const front = sentence.replace(new RegExp(`\\b${escaped}\\b`), '_____');
    if (front === sentence) continue;

    if (pushDraft('cloze', front, keyword)) clozeCount += 1;
  }

  return state.drafts.slice(0, MAX_CARDS);
}

/* =========================================================
   Dialog
   ========================================================= */

const el = (id) => document.getElementById(id);

let genNote = null;
let genCollection = null;
let genDrafts = [];
let genEventsBound = false;

function wordCount(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function readLastDeck() {
  try {
    const raw = localStorage.getItem(LAST_DECK_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.deckId === 'string' ? parsed.deckId : '';
  } catch (error) {
    return '';
  }
}

function saveLastDeck(deckId) {
  try {
    localStorage.setItem(LAST_DECK_KEY, JSON.stringify({ deckId }));
  } catch (error) {
    /* ignore */
  }
}

function closeGenerateDialog() {
  const dialog = el('gen-dialog');
  if (dialog && dialog.open) dialog.close();
}

function toggleNewDeckField() {
  const select = el('gen-deck');
  const field = el('gen-new-deck-field');
  const input = el('gen-new-deck');
  if (!select || !field || !input) return;

  const isNew = select.value === '__new__';
  field.hidden = !isNew;

  if (isNew && !input.value.trim()) {
    const fallback = squeeze((genNote && genNote.title) || (genCollection && genCollection.title) || '');
    input.value = fallback.slice(0, 40);
  }
}

function renderDeckSelect() {
  const select = el('gen-deck');
  if (!select) return;

  const decks = listFcDeckSummaries();
  const previous = select.value;
  const lastDeck = readLastDeck();

  select.innerHTML = decks
    .map((deck) => `<option value="${deck.id}">${esc(deck.name)} · ${deck.count} kartu</option>`)
    .join('');
  select.insertAdjacentHTML('beforeend', '<option value="__new__">+ Deck baru…</option>');

  let desired = '';
  if (previous && (previous === '__new__' || decks.some((deck) => deck.id === previous))) {
    desired = previous;
  } else if (lastDeck && decks.some((deck) => deck.id === lastDeck)) {
    desired = lastDeck;
  } else {
    const match = decks.find(
      (deck) =>
        deck.name.toLowerCase() ===
        String((genCollection && genCollection.title) || '').toLowerCase()
    );
    desired = match ? match.id : decks[0] ? decks[0].id : '__new__';
  }

  select.value = desired;
  toggleNewDeckField();
}

function updateGenCount() {
  const list = el('gen-list');
  if (!list) return;

  const rows = Array.from(list.querySelectorAll('[data-gen-index]'));
  const checked = rows.filter((row) => {
    const box = row.querySelector('[data-gen-pick]');
    return box && box.checked;
  });

  const count = el('gen-count');
  const saveButton = el('gen-save');

  if (count) {
    count.textContent = rows.length
      ? `${checked.length} dari ${rows.length} kartu dipilih`
      : 'Belum ada draft';
  }

  if (saveButton) {
    saveButton.disabled = checked.length === 0;
    saveButton.textContent = checked.length ? `Simpan ${checked.length} kartu` : 'Simpan kartu';
  }

  rows.forEach((row) => {
    const box = row.querySelector('[data-gen-pick]');
    row.classList.toggle('is-off', !(box && box.checked));
  });
}

function renderDraftList() {
  const list = el('gen-list');
  if (!list) return;

  if (!genDrafts.length) {
    list.innerHTML = `
      <div class="gen-empty">
        <strong>Belum ada pola yang bisa dijadikan kartu</strong>
        <p>Coba tulis definisi (<b>X adalah ...</b>), daftar bernomor, atau <b>Istilah: penjelasan</b>. Setelah itu buka lagi.</p>
        <p class="gen-empty-tip">Generator ini jalan lokal tanpa AI, jadi hasilnya tergantung kerapian catatan.</p>
      </div>`;
    updateGenCount();
    return;
  }

  list.innerHTML = genDrafts
    .map(
      (draft, index) => `
        <article class="gen-item" data-gen-index="${index}">
          <div class="gen-pick">
            <input type="checkbox" data-gen-pick ${draft.selected === false ? '' : 'checked'} aria-label="Pilih kartu ${index + 1}" />
          </div>
          <div class="gen-item-main">
            <div class="gen-item-head">
              <span class="gen-type gen-type-${draft.type}">${TYPE_LABEL[draft.type] || 'Kartu'}</span>
              <button class="gen-remove" type="button" data-gen-remove="${index}">Hapus</button>
            </div>
            <input class="gen-input gen-q" data-gen-q type="text" value="${esc(draft.q)}"
              maxlength="300" aria-label="Pertanyaan kartu ${index + 1}" />
            <textarea class="gen-input gen-a" data-gen-a rows="2" maxlength="500"
              aria-label="Jawaban kartu ${index + 1}">${esc(draft.a)}</textarea>
          </div>
        </article>`
    )
    .join('');

  updateGenCount();
}

function readCardsFromList() {
  const list = el('gen-list');
  if (!list) return [];

  return Array.from(list.querySelectorAll('[data-gen-index]'))
    .filter((row) => {
      const box = row.querySelector('[data-gen-pick]');
      return box && box.checked;
    })
    .map((row) => ({
      q: squeeze(row.querySelector('[data-gen-q]').value),
      a: squeeze(row.querySelector('[data-gen-a]').value),
      context: squeeze(genNote && genNote.title ? `Dari catatan: ${genNote.title}` : ''),
    }))
    .filter((card) => card.q && card.a);
}

function handleSave(event) {
  event.preventDefault();

  const cards = readCardsFromList();
  if (!cards.length) {
    toast('Pilih minimal satu kartu yang punya pertanyaan dan jawaban.');
    return;
  }

  const select = el('gen-deck');
  const deckValue = select ? select.value : '';
  let added = 0;
  let deckName = '';
  let savedDeckId = deckValue;

  if (deckValue === '__new__') {
    const nameInput = el('gen-new-deck');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      if (nameInput) nameInput.focus();
      toast('Kasih nama deck baru dulu.');
      return;
    }

    const result = createGeneratedDeck(name, cards);
    if (!result.added || !result.deck) {
      toast('Gagal menyimpan kartu. Coba lagi.');
      return;
    }

    added = result.added;
    deckName = result.deck.name;
    savedDeckId = result.deck.id;
  } else {
    added = addGeneratedCards(deckValue, cards);
    if (!added) {
      toast('Deck tujuan tidak ditemukan.');
      return;
    }
    const deck = listFcDeckSummaries().find((item) => item.id === deckValue);
    deckName = deck ? deck.name : 'deck';
  }

  saveLastDeck(savedDeckId);
  closeGenerateDialog();
  toast(`${added} kartu masuk ke "${deckName}".`);
}

function initGenerateEvents() {
  if (genEventsBound) return;

  const dialog = el('gen-dialog');
  const form = el('gen-form');
  const list = el('gen-list');
  const deckSelect = el('gen-deck');
  if (!dialog || !form || !list || !deckSelect) return;

  genEventsBound = true;

  form.addEventListener('submit', handleSave);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeGenerateDialog();

    if (event.target.closest('[data-gen-select-all]')) {
      list.querySelectorAll('[data-gen-pick]').forEach((box) => {
        box.checked = true;
      });
      genDrafts.forEach((draft) => {
        draft.selected = true;
      });
      updateGenCount();
    } else if (event.target.closest('[data-gen-select-none]')) {
      list.querySelectorAll('[data-gen-pick]').forEach((box) => {
        box.checked = false;
      });
      genDrafts.forEach((draft) => {
        draft.selected = false;
      });
      updateGenCount();
    }
  });

  dialog.querySelectorAll('[data-close-gen]').forEach((button) => {
    button.addEventListener('click', closeGenerateDialog);
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeGenerateDialog();
  });

  deckSelect.addEventListener('change', toggleNewDeckField);

  list.addEventListener('input', (event) => {
    const row = event.target.closest('[data-gen-index]');
    if (!row) return;
    const index = Number(row.dataset.genIndex);
    if (!genDrafts[index]) return;

    if (event.target.matches('[data-gen-q]')) {
      genDrafts[index].q = event.target.value;
    } else if (event.target.matches('[data-gen-a]')) {
      genDrafts[index].a = event.target.value;
    }
  });

  list.addEventListener('change', (event) => {
    if (!event.target.matches('[data-gen-pick]')) return;
    const row = event.target.closest('[data-gen-index]');
    const index = Number(row && row.dataset.genIndex);
    if (genDrafts[index]) genDrafts[index].selected = event.target.checked;
    updateGenCount();
  });

  list.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-gen-remove]');
    if (!remove) return;
    genDrafts.splice(Number(remove.dataset.genRemove), 1);
    renderDraftList();
  });
}

export function openGenerateDialog(collection, note) {
  if (!note) return;

  const body = String(note.body || '');
  if (!body.trim()) {
    toast('Catatan ini masih kosong. Tulis materi dulu ya.');
    return;
  }

  const dialog = el('gen-dialog');
  if (!dialog) return;

  initGenerateEvents();

  genCollection = collection || null;
  genNote = note;
  genDrafts = generateDrafts(note);

  const title = el('gen-source-title');
  const meta = el('gen-source-meta');
  if (title) title.textContent = note.title || 'Tanpa judul';
  if (meta) {
    const collectionName = (collection && collection.title) || 'Koleksi';
    meta.textContent = `${collectionName} · ${wordCount(body)} kata · ${genDrafts.length} draft`;
  }

  renderDeckSelect();
  renderDraftList();

  if (!dialog.open) dialog.showModal();
}
