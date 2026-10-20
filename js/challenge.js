/* ==========================================================================
   Carbotrack — challenge.js
   7-Day Challenge tracker with Supabase persistence + platform stats.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TOTAL_DAYS = 7;

  let celebrateModalEl = null;
  let authReady = false;
  let saveTimer = null;
  let lastSavedKey = null;

  /* ================================================================== */
  /*  AUTH WAIT                                                         */
  /* ================================================================== */
  function waitForAuthReady(timeoutMs) {
    if (window.CT_AUTH_READY) {
      authReady = true;
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      const timer = setTimeout(function () {
        authReady = true;
        resolve();
      }, timeoutMs || 3000);

      document.addEventListener('ct:auth-ready', function () {
        clearTimeout(timer);
        authReady = true;
        resolve();
      }, { once: true });
    });
  }

  function getCurrentUser() {
    if (window.CT_SB_AUTH && window.CT_SB_AUTH.isLoggedIn && window.CT_SB_AUTH.isLoggedIn()) {
      return window.CT_SB_AUTH.getUser();
    }
    return null;
  }

  /* ================================================================== */
  /*  LOCALSTORAGE                                                      */
  /* ================================================================== */
  function saveLocal(days) {
    try {
      window.CT_STORAGE.saveChallenge({
        days: days,
        updatedAt: new Date().toISOString()
      });
    } catch (e) { /* ignore */ }
  }

  function getLocal() {
    try {
      const chal = window.CT_STORAGE.getChallenge();
      if (chal && Array.isArray(chal.days)) {
        const out = [false, false, false, false, false, false, false];
        for (let i = 0; i < 7; i++) out[i] = !!chal.days[i];
        return out;
      }
    } catch (e) { /* ignore */ }
    return [false, false, false, false, false, false, false];
  }

  /* ================================================================== */
  /*  APPLY / READ                                                      */
  /* ================================================================== */
  function applyDays(days) {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    boxes.forEach(function (cb, i) {
      cb.checked = i < days.length ? !!days[i] : false;
    });
  }

  function readDaysFromCheckboxes() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    return Array.from(boxes).map(function (cb) { return !!cb.checked; });
  }

  /* ================================================================== */
  /*  LOAD                                                              */
  /* ================================================================== */
  async function loadAndRestore() {
    const user = getCurrentUser();
    const localDays = getLocal();

    if (user && window.CT_SB_CHALLENGE) {
      try {
        const remote = await window.CT_SB_CHALLENGE.load(user.id);

        if (remote.ok && remote.exists) {
          applyDays(remote.days);
          saveLocal(remote.days);
          lastSavedKey = JSON.stringify(remote.days);
          return;
        }

        if (localDays.some(Boolean)) {
          const migrated = await window.CT_SB_CHALLENGE.save(user.id, localDays);
          if (migrated.ok) {
            applyDays(localDays);
            saveLocal(localDays);
            lastSavedKey = JSON.stringify(localDays);
            return;
          }
        }

        applyDays([false, false, false, false, false, false, false]);
        saveLocal([false, false, false, false, false, false, false]);
        lastSavedKey = JSON.stringify([false, false, false, false, false, false, false]);
        return;
      } catch (e) {
        console.warn('[Carbotrack] challenge remote load failed — using local', e);
      }
    }

    applyDays(localDays);
    lastSavedKey = JSON.stringify(localDays);
  }

  /* ================================================================== */
  /*  SAVE                                                              */
  /* ================================================================== */
  function saveState() {
    const days = readDaysFromCheckboxes();

    saveLocal(days);

    if (saveTimer) clearTimeout(saveTimer);

    saveTimer = setTimeout(async function () {
      const user = getCurrentUser();
      if (!user || !window.CT_SB_CHALLENGE) return;

      const key = JSON.stringify(days);
      if (key === lastSavedKey) return;

      const result = await window.CT_SB_CHALLENGE.save(user.id, days);
      if (result.ok) {
        lastSavedKey = key;
      }
    }, 250);
  }

  /* ================================================================== */
  /*  PROGRESS                                                          */
  /* ================================================================== */
  function countChecked() {
    let done = 0;
    document.querySelectorAll('.challenge-checkbox').forEach(function (cb) {
      if (cb.checked) done++;
    });
    return done;
  }

  function updateProgress() {
    const total = document.querySelectorAll('.challenge-checkbox').length || TOTAL_DAYS;
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
      window.setTimeout(function () { conf.remove(); }, 5200);
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
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
    document.body.style.overflow = 'hidden';

    spawnConfetti(90);

    window.setTimeout(function () {
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
  function handleChange() {
    const prevDone = window.__ctPrevDone || 0;
    const done = updateProgress();

    if (done === TOTAL_DAYS && prevDone < TOTAL_DAYS) {
      window.setTimeout(openCelebration, 220);

      /* Record challenge_completed event */
      if (window.CT_STATS) {
        window.CT_STATS.recordEvent('challenge_completed');
      }

      if (window.CT_TOAST) {
        window.CT_TOAST.show('Challenge complete — you are a Champion!', 'success', 3200);
      }
    }

    window.__ctPrevDone = done;
  }

  async function resetChallenge() {
    if (!window.confirm('Reset all 7-day challenge progress?')) return;

    document.querySelectorAll('.challenge-checkbox').forEach(function (cb) {
      cb.checked = false;
    });

    try { window.CT_STORAGE.clearChallenge(); } catch (e) { /* ignore */ }

    const user = getCurrentUser();
    if (user && window.CT_SB_CHALLENGE) {
      try { await window.CT_SB_CHALLENGE.reset(user.id); } catch (e) { /* ignore */ }
    }

    updateProgress();
    window.__ctPrevDone = 0;
    lastSavedKey = JSON.stringify([false, false, false, false, false, false, false]);

    if (window.CT_TOAST) {
      window.CT_TOAST.show('Challenge progress reset.', 'info', 2200);
    }
  }

  /* ================================================================== */
  /*  INIT                                                              */
  /* ================================================================== */
  async function init() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    if (!boxes.length) return;

    await waitForAuthReady(3000);

    await loadAndRestore();

    boxes.forEach(function (cb) {
      cb.addEventListener('change', handleChange);
    });

    const resetBtn = $('challenge-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetChallenge);

    const done = updateProgress();
    window.__ctPrevDone = done;

    const badge = $('challenge-badge-banner');
    if (badge && done === TOTAL_DAYS) badge.classList.remove('hidden');

    window.addEventListener('beforeunload', function () {
      const days = readDaysFromCheckboxes();
      saveLocal(days);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();