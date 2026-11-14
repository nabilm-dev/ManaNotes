/* =========================================================
   ManaNotes — Books / PDF Reader module
   Uses PDF.js (loaded via CDN script tag in index.html).
   Stores book metadata in localStorage: mananotes.books.v1
   ========================================================= */

import {
  $, uid, esc, THEMES,
  toast, refresh, go,
} from './core.js';

/* =========================================================
   Constants & state
   ========================================================= */

const BOOKS_KEY = 'mananotes.books.v1';
const SPINE_THEMES = ['ember', 'ocean', 'violet', 'lime', 'rose', 'amber', 'auto'];

let books = [];            // [{ id, name, totalPages, lastPage, theme, addedAt }]
let reader = null;         // active reader state
let pdfDoc = null;         // PDF.js PDFDocumentProxy
let isFlipping = false;
let zoomLevel = 1.0;

/* =========================================================
   Persistence
   ========================================================= */

function loadBooks() {
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((b) => ({
      id: typeof b.id === 'string' ? b.id : uid(),
      name: String(b.name || 'Buku'),
      totalPages: Number(b.totalPages) || 0,
      lastPage: Number(b.lastPage) || 1,
      theme: THEMES.includes(b.theme) ? b.theme : 'auto',
      addedAt: Number(b.addedAt) || Date.now(),
    }));
  } catch (e) {
    return [];
  }
}

function saveBooks() {
  try {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
  } catch (e) {}
}

/* =========================================================
   DOM references (lazy — resolved once reader is open)
   ========================================================= */

function el(id) { return document.getElementById(id); }

/* =========================================================
   Render: Book grid
   ========================================================= */

export function renderBooks() {
  const view = el('view-books');
  if (!view) return;

  if (!books.length) {
    view.innerHTML = `
      <div class="books-header">
        <h2>📚 Perpustakaan</h2>
      </div>
      <div class="books-grid">
        <label class="books-upload-zone" title="Upload PDF">
          <input type="file" accept="application/pdf" id="books-file-input-empty" />
          <span class="books-upload-icon">📄</span>
          <span class="books-upload-title">Upload PDF pertama kamu</span>
          <span class="books-upload-hint">Klik atau seret file PDF ke sini</span>
        </label>
      </div>`;
    wireUploadInput(el('books-file-input-empty'));
    wireDragDrop(view.querySelector('.books-upload-zone'));
    return;
  }

  view.innerHTML = `
    <div class="books-header">
      <h2>📚 Perpustakaan</h2>
      <div class="books-header-actions">
        <label class="btn btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:.45rem;">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          <span>Tambah PDF</span>
          <input type="file" accept="application/pdf" id="books-file-input" style="display:none" />
        </label>
      </div>
    </div>
    <div class="books-grid">
      ${books.map(bookCardHTML).join('')}
    </div>`;

  wireUploadInput(el('books-file-input'));

  // Click handlers on grid
  view.querySelector('.books-grid').addEventListener('click', (e) => {
    const del = e.target.closest('[data-delete-book]');
    if (del) {
      e.stopPropagation();
      deleteBook(del.dataset.deleteBook);
      return;
    }
    const card = e.target.closest('[data-open-book]');
    if (card) openBook(card.dataset.openBook);
  });
}

function bookCardHTML(book) {
  const pct = book.totalPages ? Math.round((book.lastPage / book.totalPages) * 100) : 0;
  const pagesLabel = book.totalPages
    ? `Hal. ${book.lastPage} / ${book.totalPages}`
    : 'Halaman tidak diketahui';
  const themeClass = `book-spine-${book.theme}`;
  const isNew = Date.now() - book.addedAt < 86400000;
  return `
    <button class="book-card" type="button" data-open-book="${book.id}">
      ${isNew ? '<span class="book-card-new-badge">Baru</span>' : ''}
      <div class="book-card-cover">
        <div class="book-card-spine ${themeClass}"></div>
        <div class="book-card-cover-art"></div>
        <div class="book-card-cover-shade"></div>
        <div class="book-card-meta">
          <div class="book-card-name">${esc(book.name)}</div>
          <div class="book-card-pages">${pagesLabel}</div>
        </div>
      </div>
      <div class="book-card-progress-bar">
        <div class="book-card-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="book-card-footer">
        <span class="book-card-pct">${pct}% dibaca</span>
        <button class="book-card-delete" type="button" data-delete-book="${book.id}" title="Hapus buku" aria-label="Hapus buku">Hapus</button>
      </div>
    </button>`;
}

/* =========================================================
   Upload / file input
   ========================================================= */

function wireUploadInput(input) {
  if (!input) return;
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handlePdfFile(file);
    input.value = '';
  });
}

function wireDragDrop(zone) {
  if (!zone) return;
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') handlePdfFile(file);
    else toast('File harus berformat PDF.');
  });
}

function getPdfjsLib() {
  return window.pdfjsLib || window['pdfjs-dist/build/pdf'] || null;
}

async function handlePdfFile(file) {
  if (!file || file.type !== 'application/pdf') {
    toast('File harus berformat PDF.');
    return;
  }

  // Check PDF.js available
  const pdfjs = getPdfjsLib();
  if (!pdfjs) {
    toast('PDF.js belum dimuat. Cek koneksi internet dan refresh halaman.');
    return;
  }

  const name = file.name.replace(/\.pdf$/i, '');

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let totalPages = 0;
  try {
    const tempDoc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
    totalPages = tempDoc.numPages;
    await tempDoc.destroy();
  } catch (e) {
    toast('Gagal membaca PDF. File mungkin rusak atau terenkripsi.');
    return;
  }

  // Pick theme based on order
  const themeIndex = books.length % THEMES.length;
  const theme = THEMES[themeIndex] || 'ocean';

  const book = {
    id: uid(),
    name,
    totalPages,
    lastPage: 1,
    theme,
    addedAt: Date.now(),
  };

  books.unshift(book);
  saveBooks();

  // Store PDF data in IndexedDB for later reading
  await storePdfData(book.id, buffer);

  renderBooks();
  toast(`"${name}" ditambahkan — ${totalPages} halaman`);

  // Auto-open
  openBook(book.id);
}

/* =========================================================
   IndexedDB for PDF binary storage
   ========================================================= */

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mananotes-books', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('pdfs', { keyPath: 'id' });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function storePdfData(id, buffer) {
  try {
    const db = await openIDB();
    const tx = db.transaction('pdfs', 'readwrite');
    tx.objectStore('pdfs').put({ id, data: buffer });
    return new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch (e) {
    console.warn('Books: gagal simpan PDF di IndexedDB', e);
  }
}

async function loadPdfData(id) {
  try {
    const db = await openIDB();
    const tx = db.transaction('pdfs', 'readonly');
    const req = tx.objectStore('pdfs').get(id);
    return new Promise((res, rej) => {
      req.onsuccess = (e) => res(e.target.result?.data || null);
      req.onerror = (e) => rej(e.target.error);
    });
  } catch (e) {
    return null;
  }
}

async function deletePdfData(id) {
  try {
    const db = await openIDB();
    const tx = db.transaction('pdfs', 'readwrite');
    tx.objectStore('pdfs').delete(id);
  } catch (e) {}
}

/* =========================================================
   Reader — open / close
   ========================================================= */

export async function openBook(bookId) {
  const book = books.find((b) => b.id === bookId);
  if (!book) return;

  const pdfjs = getPdfjsLib();
  if (!pdfjs) {
    toast('PDF.js belum dimuat. Cek koneksi dan refresh halaman.');
    return;
  }

  const buffer = await loadPdfData(bookId);
  if (!buffer) {
    toast('Data PDF tidak ditemukan. Upload ulang buku ini.');
    return;
  }

  // Show reader UI
  const readerEl = el('book-reader');
  if (!readerEl) return;
  readerEl.hidden = false;
  document.body.style.overflow = 'hidden';

  // Set title
  el('reader-title').textContent = book.name;
  el('reader-page-info').textContent = `Hal. ${book.lastPage} / ${book.totalPages || '?'}`;

  // Show loading
  el('reader-loading').hidden = false;
  el('reader-book-wrap').style.opacity = '0';

  reader = { bookId, currentPage: book.lastPage || 1, totalPages: book.totalPages || 1, isSingle: false };
  pdfDoc = null;
  isFlipping = false;
  zoomLevel = 1.0;

  try {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfDoc = await pdfjs.getDocument({ data: buffer }).promise;
    reader.totalPages = pdfDoc.numPages;
    book.totalPages = pdfDoc.numPages;
    saveBooks();

    el('reader-loading').hidden = true;
    el('reader-book-wrap').style.opacity = '1';
    el('reader-book-wrap').style.transition = 'opacity 0.3s ease';

    updateReaderControls();
    await renderSpread(reader.currentPage);
  } catch (e) {
    el('reader-loading').hidden = true;
    toast('Gagal membuka PDF: ' + e.message);
    closeReader();
  }
}

export function closeReader() {
  const readerEl = el('book-reader');
  if (readerEl) readerEl.hidden = true;
  document.body.style.overflow = '';

  if (reader) {
    // Save last page
    const book = books.find((b) => b.id === reader.bookId);
    if (book) {
      book.lastPage = reader.currentPage;
      saveBooks();
    }
  }

  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }

  reader = null;
  isFlipping = false;

  // Refresh grid
  renderBooks();
}

/* =========================================================
   Render: spread (2 pages)
   ========================================================= */

async function renderSpread(startPage) {
  if (!pdfDoc) return;

  const wrap = el('reader-book-wrap');
  const leftEl = el('reader-page-left');
  const rightEl = el('reader-page-right');

  // Decide layout
  const viewW = wrap.offsetWidth || window.innerWidth - 32;
  const viewH = (el('reader-stage').offsetHeight || window.innerHeight - 160) - 32;

  // Render right page (current)
  const rightPage = startPage;
  const leftPage = startPage - 1;

  // Get page dims from first page for consistent sizing
  const samplePage = await pdfDoc.getPage(rightPage);
  const viewport = samplePage.getViewport({ scale: 1 });
  const pageAspect = viewport.width / viewport.height;

  // Fit into available space
  let pageH = Math.min(viewH, 900);
  let pageW = Math.round(pageH * pageAspect);
  if (pageW * 2 + 4 > viewW) {
    pageW = Math.floor((viewW - 4) / 2);
    pageH = Math.round(pageW / pageAspect);
  }
  pageW = Math.max(pageW, 180);
  pageH = Math.max(pageH, 240);

  // Apply zoom
  pageW = Math.round(pageW * zoomLevel);
  pageH = Math.round(pageH * zoomLevel);

  leftEl.style.width = pageW + 'px';
  leftEl.style.height = pageH + 'px';
  rightEl.style.width = pageW + 'px';
  rightEl.style.height = pageH + 'px';

  // Right page
  await renderPageToEl(rightEl, rightPage, pageW, pageH);

  // Left page (previous)
  if (leftPage >= 1) {
    leftEl.hidden = false;
    el('reader-spine').hidden = false;
    await renderPageToEl(leftEl, leftPage, pageW, pageH);
  } else {
    leftEl.hidden = true;
    el('reader-spine').hidden = true;
  }

  // Update info
  updateReaderControls();
}

async function renderPageToEl(container, pageNum, w, h) {
  if (!pdfDoc || pageNum < 1 || pageNum > pdfDoc.numPages) {
    container.innerHTML = '<div style="width:100%;height:100%;background:#f0f0f0;"></div>';
    return;
  }

  const page = await pdfDoc.getPage(pageNum);
  const scale = Math.min(w / page.getViewport({ scale: 1 }).width, h / page.getViewport({ scale: 1 }).height);
  const viewport = page.getViewport({ scale });

  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(viewport.width * devicePixelRatio);
  canvas.height = Math.round(viewport.height * devicePixelRatio);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  container.style.width = w + 'px';
  container.style.height = h + 'px';

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  await page.render({ canvasContext: ctx, viewport }).promise;
}

/* =========================================================
   Navigation
   ========================================================= */

async function goToPage(page) {
  if (!pdfDoc || isFlipping) return;
  page = Math.max(1, Math.min(page, reader.totalPages));
  if (page === reader.currentPage) return;

  const direction = page > reader.currentPage ? 'fwd' : 'bwd';
  reader.currentPage = page;
  await animateFlip(direction);
  updateReaderControls();
}

async function nextSpread() {
  if (!reader || isFlipping) return;
  // Move by 2 pages (spread), or 1 if on cover
  const step = reader.currentPage <= 1 ? 1 : 2;
  const next = Math.min(reader.currentPage + step, reader.totalPages);
  if (next === reader.currentPage) return;
  reader.currentPage = next;
  await animateFlip('fwd');
  updateReaderControls();
}

async function prevSpread() {
  if (!reader || isFlipping) return;
  const step = reader.currentPage <= 2 ? 1 : 2;
  const prev = Math.max(reader.currentPage - step, 1);
  if (prev === reader.currentPage) return;
  reader.currentPage = prev;
  await animateFlip('bwd');
  updateReaderControls();
}

async function animateFlip(direction) {
  isFlipping = true;
  const wrap = el('reader-book-wrap');

  // Render new spread first (hidden) then animate
  await renderSpread(reader.currentPage);

  // Trigger animation class
  wrap.classList.remove('is-flipping-fwd', 'is-flipping-bwd');
  void wrap.offsetWidth; // reflow
  wrap.classList.add(direction === 'fwd' ? 'is-flipping-fwd' : 'is-flipping-bwd');

  await new Promise((r) => setTimeout(r, 540));
  wrap.classList.remove('is-flipping-fwd', 'is-flipping-bwd');
  isFlipping = false;
}

function updateReaderControls() {
  if (!reader) return;
  const { currentPage, totalPages } = reader;

  const pageInput = el('reader-page-input');
  if (pageInput) pageInput.value = currentPage;

  const totalEl = el('reader-total-pages');
  if (totalEl) totalEl.textContent = totalPages;

  el('reader-page-info').textContent = `Hal. ${currentPage} / ${totalPages}`;

  const pct = totalPages ? (currentPage / totalPages) * 100 : 0;
  const fill = el('reader-progress-fill');
  if (fill) fill.style.width = pct + '%';

  const prevBtn = el('reader-prev');
  const nextBtn = el('reader-next');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  const zoomEl = el('reader-zoom-pct');
  if (zoomEl) zoomEl.textContent = Math.round(zoomLevel * 100) + '%';
}

/* =========================================================
   Delete book
   ========================================================= */

function deleteBook(bookId) {
  const book = books.find((b) => b.id === bookId);
  if (!book) return;
  const name = book.name;
  books = books.filter((b) => b.id !== bookId);
  saveBooks();
  deletePdfData(bookId);
  renderBooks();
  toast(`"${name}" dihapus.`);
}

/* =========================================================
   Touch / keyboard navigation
   ========================================================= */

let touchStartX = 0;

function initReaderInteractions() {
  const stage = el('reader-stage');
  if (!stage) return;

  // Touch swipe
  stage.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  stage.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) nextSpread();
      else prevSpread();
    }
  }, { passive: true });

  // Click left/right halves for navigation
  stage.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const rect = stage.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < rect.width * 0.3) prevSpread();
    else if (relX > rect.width * 0.7) nextSpread();
  });

  // Keyboard inside reader
  el('book-reader').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextSpread(); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); prevSpread(); }
    if (e.key === 'Escape') closeReader();
  });

  // Progress bar click
  const bar = el('reader-progress');
  if (bar) {
    bar.addEventListener('click', (e) => {
      if (!reader) return;
      const rect = bar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const page = Math.max(1, Math.round(pct * reader.totalPages));
      goToPage(page);
    });
  }
}

/* =========================================================
   Zoom
   ========================================================= */

function zoomIn() {
  zoomLevel = Math.min(zoomLevel + 0.2, 2.5);
  renderSpread(reader?.currentPage || 1);
  updateReaderControls();
}

function zoomOut() {
  zoomLevel = Math.max(zoomLevel - 0.2, 0.4);
  renderSpread(reader?.currentPage || 1);
  updateReaderControls();
}

/* =========================================================
   Init
   ========================================================= */

export function initBooks() {
  books = loadBooks();

  // Wire static reader buttons (once)
  const closeBtn = el('reader-close');
  if (closeBtn) closeBtn.addEventListener('click', closeReader);

  const prevBtn = el('reader-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => prevSpread());

  const nextBtn = el('reader-next');
  if (nextBtn) nextBtn.addEventListener('click', () => nextSpread());

  const zoomInBtn = el('reader-zoom-in');
  if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);

  const zoomOutBtn = el('reader-zoom-out');
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);

  const pageInput = el('reader-page-input');
  if (pageInput) {
    pageInput.addEventListener('change', () => {
      const page = parseInt(pageInput.value, 10);
      if (!isNaN(page)) goToPage(page);
    });
    pageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const page = parseInt(pageInput.value, 10);
        if (!isNaN(page)) goToPage(page);
      }
    });
  }

  initReaderInteractions();
}
