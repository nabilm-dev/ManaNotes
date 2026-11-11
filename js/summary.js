/* =========================================================
   Summary — local extractive summarizer.
   ========================================================= */

import { truncate } from './core.js';

const STOPWORDS = new Set(
  (
    'yang dan di ke dari untuk dengan ini itu ada adalah akan pada juga karena bisa atau saat sudah belum lebih sangat para kita kami kamu saya dia mereka ' +
    'tidak bukan dalam oleh sebagai agar supaya kalau jika tapi namun lalu kemudian setelah sebelum atas bawah hanya masih lagi para aja udah tuh nggak gak ' +
    'jadi buat bikin gitu kayak sama atau pun agar bahwa terhadap secara serta bagi hingga sampai antara tanpa harus dapat sedang telah ' +
    'the a an and or of to in on at for with is are was were be been being it this that these those as by from into over under then than so such'
  ).split(/\s+/)
);

const WORD_RE = /[a-z0-9\u00c0-\u024f]+/gi;

export function buildSummarySource(notes) {
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

export function cleanPoint(sentence) {
  const cleaned = sentence.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function summarize(text, maxPoints = 3) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const chunks = raw
    .split(/\r?\n|\u2022|;/)
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
