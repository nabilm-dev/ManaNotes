(() => {
  'use strict';

  /* =========================================================
     Constants & helpers
     ========================================================= */

  const STORAGE_KEY = 'mananotes.v2';
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
    toast: $('#toast'),
    toastText: $('#toast-text'),
    toastAction: $('#toast-action'),
  };

  /* =========================================================
     State
     ========================================================= */

  let state = { collections: [] };
  let ui = {
    view: 'dashboard',
    collectionId: null,
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
     Persistence
     ========================================================= */

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
        JSON.stringify({ version: 2, collections: state.collections })
      );
    } catch (error) {
      console.warn('ManaNotes: gagal menyimpan data.', error);
    }
  }

  const scheduleSave = debounce(saveNow, 400);

  /* =========================================================
     Seed data
     ========================================================= */

  function seedState() {
    const now = Date.now();
    const HOUR = 3600000;
    const DAY = HOUR * 24;

    const makeTask = (text, done = false) => ({ id: uid(), text, done });
    const makeNote = (title, body, tasks, ago) => ({
      id: uid(),
      title,
      body,
      tasks,
      createdAt: now - ago,
      updatedAt: now - ago,
    });

    return {
      collections: [
        {
          id: uid(),
          title: 'Daily memo',
          subtitle: 'Notes & Journaling',
          theme: 'ember',
          createdAt: now - DAY * 6,
          notes: [
            makeNote(
              'Rencana hari ini',
              'Fokus utama hari ini cuma tiga: beresin draft project, balas email yang nunggu, dan olahraga sore. Sisain waktu buat baca 20 menit sebelum tidur.',
              [
                makeTask('Beresin draft project'),
                makeTask('Balas email klien', true),
                makeTask('Olahraga 30 menit'),
                makeTask('Baca 20 menit'),
              ],
              HOUR * 2
            ),
            makeNote(
              'Catatan rapat mingguan',
              'Rapat tadi membahas timeline rilis minggu depan. Tim desain butuh aset final paling lambat hari Rabu. QA mulai Kamis pagi, lalu rilis Jumat sore. Risiko utamanya ada di approval konten yang biasanya molor.',
              [
                makeTask('Kirim aset final ke tim'),
                makeTask('Jadwalkan sesi QA', true),
                makeTask('Update timeline', true),
                makeTask('Follow up approval konten'),
              ],
              DAY + HOUR * 3
            ),
            makeNote(
              'Jurnal singkat',
              'Hari ini terasa lebih ringan dari kemarin. Berhasil nyelesaiin satu hal yang udah lama ditunda, dan itu cukup bikin mood naik. Besok mau mulai lebih pagi aja, tanpa target yang terlalu muluk.',
              [],
              DAY * 2
            ),
          ],
        },
        {
          id: uid(),
          title: 'Ide konten',
          subtitle: 'Random sparks',
          theme: 'ocean',
          createdAt: now - DAY * 11,
          notes: [
            makeNote(
              'Hook video pendek',
              "Ide pembuka: 'Kamu nggak butuh aplikasi baru, kamu butuh sistem yang lebih simpel.' Bisa dilanjutin dengan 3 contoh kebiasaan kecil yang bikin kerjaan beres. Visualnya pakai screen recording plus teks besar.",
              [makeTask('Tulis script 30 detik'), makeTask('Rekam screen')],
              DAY + HOUR * 5
            ),
            makeNote(
              'Referensi visual',
              'Cari referensi layout gelap dengan aksen oranye. Fokus ke tipografi besar, card rounded, dan gradient blur. Simpan semuanya di satu folder inspo biar gampang dilihat lagi.',
              [makeTask('Kumpulin 5 referensi', true)],
              DAY * 4
            ),
          ],
        },
        {
          id: uid(),
          title: 'Belanja',
          subtitle: 'Shopping & errands',
          theme: 'lime',
          createdAt: now - DAY * 3,
          notes: [
            makeNote(
              'Belanja mingguan',
              'Cek stok dapur dulu sebelum pergi. Prioritas: sayur, telur, kopi, sabun cuci piring. Jangan lapar pas belanja.',
              [
                makeTask('Sayur & buah'),
                makeTask('Telur'),
                makeTask('Kopi', true),
                makeTask('Sabun cuci piring'),
              ],
              HOUR * 8
            ),
          ],
        },
      ],
    };
  }

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
     Rendering
     ========================================================= */

  function renderAll() {
    els.viewDashboard.hidden = ui.view !== 'dashboard';
    els.viewCollection.hidden = ui.view !== 'collection';
    els.viewTodo.hidden = ui.view !== 'todo';

    renderSidebar();
    updateSearchPlaceholder();
    renderCurrentView();
  }

  function renderCurrentView() {
    if (ui.view === 'dashboard') renderDashboard();
    else if (ui.view === 'collection') renderCollection();
    else renderTodo();
  }

  function updateSearchPlaceholder() {
    const placeholders = {
      dashboard: 'Cari koleksi...',
      collection: 'Cari catatan...',
      todo: 'Cari to-do...',
    };
    els.search.placeholder = placeholders[ui.view] || 'Cari...';
  }

  function renderSidebar() {
    $$('.nav-btn').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.view === ui.view);
    });

    const stats = globalStats();
    els.navTodoCount.textContent = String(stats.open);
    els.navTodoCount.hidden = stats.open === 0;

    els.sidebarCollections.innerHTML = state.collections
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
      .join('');

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
          <p>Bikin koleksi pertama buat mulai nulis catatan, to-do, dan ringkasannya.</p>
          <button class="btn btn-primary" type="button" data-action="new-collection">Buat koleksi</button>
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
          <p>Buka catatan mana pun, lalu tambahkan checklist di panel To-do.</p>
          <button class="btn btn-primary" type="button" data-view="dashboard">Lihat koleksi</button>
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
      else if (action === 'summarize-collection') summarizeCollection();
      else if (action === 'close-summary') {
        ui.collectionSummary = null;
        renderCollection();
      }
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

  // Collection dialog events
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

  window.addEventListener('beforeunload', saveNow);

  /* =========================================================
     Boot
     ========================================================= */

  function init() {
    const saved = loadState();
    state = saved || seedState();
    if (!saved) saveNow();
    renderAll();
  }

  init();
})();
