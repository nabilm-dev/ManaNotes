/* =========================================================
   To-do — aggregated to-do view and task toggling.
   ========================================================= */

import {
  els, state, ui, esc, globalStats, getNote, saveNow,
  CHECK_SVG, CHECK_SQUARE_SVG,
  refreshCurrentView, refreshSidebar,
} from './core.js';

export function renderTodo() {
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

export function toggleTask(collectionId, noteId, taskId) {
  const note = getNote(collectionId, noteId);
  if (!note) return;
  const task = note.tasks.find((item) => item.id === taskId);
  if (!task) return;

  task.done = !task.done;
  note.updatedAt = Date.now();
  saveNow();
  refreshCurrentView();
  refreshSidebar();
}
