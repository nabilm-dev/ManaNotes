/* =========================================================
   Tutorial — first-run guide logic.
   ========================================================= */

import { els, state, TUTORIAL_KEY } from './core.js';
import { openCollectionDialog } from './notes.js';

export function tutorialSeen() {
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

export function openTutorial() {
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

export function initTutorialEvents() {
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
}
