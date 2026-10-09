/* ==========================================================================
   Carbotrack — challenge.js
   7-Day Campus Eco Challenge tracker (challenge.html)
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TOTAL_DAYS = 7;

  /* ------------------------------------------------------------------ */
  /*  Save / Restore                                                    */
  /* ------------------------------------------------------------------ */
  function saveState() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    const state = Array.from(boxes).map(cb => !!cb.checked);
    window.CT_STORAGE.saveChallenge({ days: state, updatedAt: new Date().toISOString() });
  }

  function restoreState() {
    const saved = window.CT_STORAGE.getChallenge();
    if (!saved || !Array.isArray(saved.days)) return;

    const boxes = document.querySelectorAll('.challenge-checkbox');
    boxes.forEach((cb, i) => {
      if (typeof saved.days[i] === 'boolean') cb.checked = saved.days[i];
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Progress                                                          */
  /* ------------------------------------------------------------------ */
  function updateProgress() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    const total = boxes.length || TOTAL_DAYS;
    let done = 0;

    boxes.forEach(cb => { if (cb.checked) done++; });

    const pct = Math.round((done / total) * 100);

    const fill  = $('challenge-progress-fill');
    const label = $('challenge-score-label');
    const badge = $('challenge-badge-banner');

    if (fill)  fill.style.width = `${pct}%`;
    if (label) label.textContent = `${done} / ${total} Completed`;

    if (badge) badge.classList.toggle('hidden', done !== total);

    /* Persist */
    saveState();
  }

  /* ------------------------------------------------------------------ */
  /*  Reset                                                             */
  /* ------------------------------------------------------------------ */
  function resetChallenge() {
    if (!window.confirm('Reset all 7-day challenge progress?')) return;
    document.querySelectorAll('.challenge-checkbox').forEach(cb => { cb.checked = false; });
    window.CT_STORAGE.clearChallenge();
    updateProgress();
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                              */
  /* ------------------------------------------------------------------ */
  function init() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    if (!boxes.length) return;

    restoreState();

    boxes.forEach(cb => cb.addEventListener('change', updateProgress));

    const resetBtn = $('challenge-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetChallenge);

    updateProgress();
  }

  document.addEventListener('DOMContentLoaded', init);
})();