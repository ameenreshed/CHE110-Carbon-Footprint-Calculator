/* ==========================================================================
   Carbotrack — challenge.js
   7-Day Campus Eco Challenge tracker + celebration confetti + modal.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TOTAL_DAYS = 7;

  let celebrateModalEl = null;

  /* ================================================================== */
  /*  SAVE / RESTORE                                                    */
  /* ================================================================== */
  function saveState() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    const state = Array.from(boxes).map(cb => !!cb.checked);
    window.CT_STORAGE.saveChallenge({
      days: state,
      updatedAt: new Date().toISOString()
    });
  }

  function restoreState() {
    const saved = window.CT_STORAGE.getChallenge();
    if (!saved || !Array.isArray(saved.days)) return;
    const boxes = document.querySelectorAll('.challenge-checkbox');
    boxes.forEach((cb, i) => {
      if (typeof saved.days[i] === 'boolean') cb.checked = saved.days[i];
    });
  }

  /* ================================================================== */
  /*  PROGRESS                                                          */
  /* ================================================================== */
  function countChecked() {
    let done = 0;
    document.querySelectorAll('.challenge-checkbox').forEach(cb => {
      if (cb.checked) done++;
    });
    return done;
  }

  function updateProgress() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    const total = boxes.length || TOTAL_DAYS;
    const done = countChecked();
    const pct = Math.round((done / total) * 100);

    const fill  = $('challenge-progress-fill');
    const label = $('challenge-score-label');
    const badge = $('challenge-badge-banner');

    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = done + ' / ' + total + ' Completed';
    if (badge) badge.classList.toggle('hidden', done !== total);

    saveState();
    return done;
  }

  /* ================================================================== */
  /*  CONFETTI                                                          */
  /* ================================================================== */
  function spawnConfetti(count) {
    const colors = ['#34d399', '#f7e8b0', '#38bdf8', '#fbbf24', '#ef4444', '#a855f7', '#10b981'];
    const total = count || 90;

    for (let i = 0; i < total; i++) {
      const conf = document.createElement('div');
      conf.className = 'confetti';
      conf.style.left = Math.random() * 100 + 'vw';
      conf.style.background = colors[Math.floor(Math.random() * colors.length)];
      conf.style.animationDelay = (Math.random() * 1.8) + 's';
      conf.style.animationDuration = (2.6 + Math.random() * 1.8) + 's';
      conf.style.width = (5 + Math.random() * 8) + 'px';
      conf.style.height = (10 + Math.random() * 12) + 'px';
      conf.style.borderRadius = Math.random() > 0.5 ? '2px' : '50%';
      document.body.appendChild(conf);
      window.setTimeout(() => conf.remove(), 5200);
    }
  }

  /* ================================================================== */
  /*  CELEBRATION MODAL                                                 */
  /* ================================================================== */
  function ensureCelebrateModal() {
    celebrateModalEl = $('celebrate-modal');
    if (!celebrateModalEl) return null;

    if (celebrateModalEl.dataset.wired === '1') return celebrateModalEl;
    celebrateModalEl.dataset.wired = '1';

    const closeBtn = $('celebrate-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeCelebration);

    celebrateModalEl.addEventListener('click', function (e) {
      if (e.target === celebrateModalEl ||
          e.target.classList.contains('celebrate-modal__backdrop')) {
        closeCelebration();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && celebrateModalEl && !celebrateModalEl.hidden) {
        closeCelebration();
      }
    });

    return celebrateModalEl;
  }

  function openCelebration() {
    const modal = ensureCelebrateModal();
    if (!modal) return;

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    document.body.style.overflow = 'hidden';

    spawnConfetti(90);

    window.setTimeout(() => {
      const btn = modal.querySelector('.btn-primary');
      if (btn) btn.focus();
    }, 200);
  }

  function closeCelebration() {
    if (!celebrateModalEl) return;
    celebrateModalEl.classList.remove('is-open');
    celebrateModalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    window.setTimeout(function () {
      celebrateModalEl.hidden = true;
    }, 300);
  }

  /* ================================================================== */
  /*  HANDLERS                                                          */
  /* ================================================================== */
  function handleChange(e) {
    const prevDone = window.__ctPrevDone || 0;
    const done = updateProgress();

    /* Trigger celebration when crossing 7/7 boundary */
    if (done === TOTAL_DAYS && prevDone < TOTAL_DAYS) {
      window.setTimeout(openCelebration, 220);

      if (window.CT_TOAST) {
        window.CT_TOAST.show('Challenge complete — you are a Champion!', 'success', 3200);
      }
    }

    window.__ctPrevDone = done;
  }

  function resetChallenge() {
    if (!window.confirm('Reset all 7-day challenge progress?')) return;

    document.querySelectorAll('.challenge-checkbox').forEach(cb => { cb.checked = false; });
    window.CT_STORAGE.clearChallenge();
    updateProgress();
    window.__ctPrevDone = 0;

    if (window.CT_TOAST) {
      window.CT_TOAST.show('Challenge progress reset.', 'info', 2200);
    }
  }

  /* ================================================================== */
  /*  INIT                                                              */
  /* ================================================================== */
  function init() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    if (!boxes.length) return;

    restoreState();

    boxes.forEach(cb => cb.addEventListener('change', handleChange));

    const resetBtn = $('challenge-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetChallenge);

    /* Initial progress + baseline */
    const done = updateProgress();
    window.__ctPrevDone = done;

    /* If already complete on page load, show the banner (but not the
       celebration modal — the celebration should only fire on the
       action of completing the last checkbox) */
    const badge = $('challenge-badge-banner');
    if (badge && done === TOTAL_DAYS) badge.classList.remove('hidden');
  }

  document.addEventListener('DOMContentLoaded', init);
})();