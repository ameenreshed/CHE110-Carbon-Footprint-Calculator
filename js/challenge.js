/* ==========================================================================
   Carbotrack — challenge.js
   7-Day Challenge tracker.
   Fires: 'challenge_tick' (raw, every checkbox), 'challenge_completed'
   (deduped per user).
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TOTAL_DAYS = 7;

  let celebrateModalEl = null;
  let confirmModalEl = null;
  let authReady = false;
  let saveTimer = null;
  let lastSavedKey = null;

  function waitForAuthReady(timeoutMs) {
    if (window.CT_AUTH_READY) { authReady = true; return Promise.resolve(); }
    return new Promise(function (resolve) {
      const timer = setTimeout(() => { authReady = true; resolve(); }, timeoutMs || 3000);
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

  function saveLocal(days) {
    try {
      window.CT_STORAGE.saveChallenge({ days: days, updatedAt: new Date().toISOString() });
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

  function applyDays(days) {
    document.querySelectorAll('.challenge-checkbox').forEach((cb, i) => {
      cb.checked = i < days.length ? !!days[i] : false;
    });
  }

  function readDaysFromCheckboxes() {
    return Array.from(document.querySelectorAll('.challenge-checkbox')).map(cb => !!cb.checked);
  }

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

  function saveState() {
    const days = readDaysFromCheckboxes();
    saveLocal(days);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const user = getCurrentUser();
      if (!user || !window.CT_SB_CHALLENGE) return;
      const key = JSON.stringify(days);
      if (key === lastSavedKey) return;
      const result = await window.CT_SB_CHALLENGE.save(user.id, days);
      if (result.ok) lastSavedKey = key;
    }, 250);
  }

  function countChecked() {
    let done = 0;
    document.querySelectorAll('.challenge-checkbox').forEach(cb => { if (cb.checked) done++; });
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

  function spawnConfetti(count) {
    const colors = ['#34d399', '#f7e8b0', '#38bdf8', '#fbbf24', '#ef4444', '#a855f7', '#10b981'];
    for (let i = 0; i < (count || 90); i++) {
      const conf = document.createElement('div');
      conf.className = 'confetti';
      conf.setAttribute('aria-hidden', 'true');
      conf.style.left = Math.random() * 100 + 'vw';
      conf.style.background = colors[Math.floor(Math.random() * colors.length)];
      conf.style.animationDelay = (Math.random() * 1.8) + 's';
      conf.style.animationDuration = (2.6 + Math.random() * 1.8) + 's';
      conf.style.width = (5 + Math.random() * 8) + 'px';
      conf.style.height = (10 + Math.random() * 12) + 'px';
      conf.style.borderRadius = Math.random() > 0.5 ? '2px' : '50%';
      document.body.appendChild(conf);
      setTimeout(() => conf.remove(), 5200);
    }
  }

  function ensureCelebrateModal() {
    celebrateModalEl = $('celebrate-modal');
    if (!celebrateModalEl) return null;
    if (celebrateModalEl.dataset.wired === '1') return celebrateModalEl;
    celebrateModalEl.dataset.wired = '1';

    const closeBtn = $('celebrate-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeCelebration);

    celebrateModalEl.addEventListener('click', (e) => {
      if (e.target === celebrateModalEl || e.target.classList.contains('celebrate-modal__backdrop')) {
        closeCelebration();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && celebrateModalEl && !celebrateModalEl.hidden) closeCelebration();
    });

    celebrateModalEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        celebrateModalEl.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
      ).filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !celebrateModalEl.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !celebrateModalEl.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
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
    setTimeout(() => {
      const btn = modal.querySelector('.btn-primary');
      if (btn) btn.focus();
    }, 200);
  }

  function closeCelebration() {
    if (!celebrateModalEl) return;
    celebrateModalEl.classList.remove('is-open');
    celebrateModalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { celebrateModalEl.hidden = true; }, 300);
  }

  function ensureConfirmModal() {
    if (confirmModalEl) return confirmModalEl;
    confirmModalEl = document.createElement('div');
    confirmModalEl.id = 'ct-confirm-modal';
    confirmModalEl.className = 'celebrate-modal';
    confirmModalEl.hidden = true;
    confirmModalEl.setAttribute('aria-hidden', 'true');
    confirmModalEl.innerHTML = `
      <div class="celebrate-modal__backdrop" data-confirm-cancel></div>
      <div class="celebrate-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ct-confirm-title">
        <span class="celebrate-emoji" style="font-size:3rem;">❓</span>
        <h2 class="celebrate-title" id="ct-confirm-title" style="font-size:1.5rem;">Are you sure?</h2>
        <p class="celebrate-sub" id="ct-confirm-msg" style="font-size:1rem;"></p>
        <div class="celebrate-actions">
          <button type="button" class="btn btn-primary btn-lg" data-confirm-yes>
            <i class="fa-solid fa-check"></i> <span>Yes, Continue</span>
          </button>
          <button type="button" class="btn btn-ghost" data-confirm-cancel>
            <i class="fa-solid fa-xmark"></i> <span>Cancel</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmModalEl);
    confirmModalEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(confirmModalEl.querySelectorAll('button:not([disabled])')).filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !confirmModalEl.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !confirmModalEl.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    });
    return confirmModalEl;
  }

  function confirmDialog(message) {
    return new Promise(function (resolve) {
      const modal = ensureConfirmModal();
      const msgEl = modal.querySelector('#ct-confirm-msg');
      if (msgEl) msgEl.textContent = message;
      let settled = false;
      function finish(result) {
        if (settled) return;
        settled = true;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        setTimeout(() => { modal.hidden = true; }, 300);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      }
      function onKey(e) { if (e.key === 'Escape') finish(false); }
      modal.querySelector('[data-confirm-yes]').onclick = () => finish(true);
      modal.querySelectorAll('[data-confirm-cancel]').forEach(el => {
        el.onclick = () => finish(false);
      });
      document.addEventListener('keydown', onKey);
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => modal.classList.add('is-open'));
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        const btn = modal.querySelector('[data-confirm-yes]');
        if (btn) btn.focus();
      }, 120);
    });
  }

  function handleChange(e) {
    /* Fire challenge_tick when a box is checked (not unchecked) */
    if (e && e.target && e.target.checked && window.CT_STATS) {
      const idx = Array.from(document.querySelectorAll('.challenge-checkbox')).indexOf(e.target);
      window.CT_STATS.recordEvent('challenge_tick', {
        day: idx + 1
      });
    }

    const prevDone = window.__ctPrevDone || 0;
    const done = updateProgress();

    if (done === TOTAL_DAYS && prevDone < TOTAL_DAYS) {
      setTimeout(openCelebration, 220);
      if (window.CT_STATS) {
        const user = getCurrentUser();
        const key = user ? ('challenge_completed:' + user.id) : null;
        window.CT_STATS.recordEvent('challenge_completed', {}, key);
      }
      if (window.CT_TOAST) window.CT_TOAST.show('Challenge complete — you are a Champion!', 'success', 3200);
    }
    window.__ctPrevDone = done;
  }

  async function resetChallenge() {
    const ok = await confirmDialog('Reset all 7-day challenge progress? This cannot be undone.');
    if (!ok) return;
    document.querySelectorAll('.challenge-checkbox').forEach(cb => { cb.checked = false; });
    try { window.CT_STORAGE.clearChallenge(); } catch (e) { /* ignore */ }
    const user = getCurrentUser();
    if (user && window.CT_SB_CHALLENGE) {
      try { await window.CT_SB_CHALLENGE.reset(user.id); } catch (e) { /* ignore */ }
    }
    updateProgress();
    window.__ctPrevDone = 0;
    lastSavedKey = JSON.stringify([false, false, false, false, false, false, false]);
    if (window.CT_TOAST) window.CT_TOAST.show('Challenge progress reset.', 'info', 2200);
  }

  async function init() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    if (!boxes.length) return;

    await waitForAuthReady(3000);
    if (window.CT_SB_AUTH && !window.CT_SB_AUTH.isLoggedIn()) return;

    await loadAndRestore();
    boxes.forEach(cb => cb.addEventListener('change', handleChange));

    const resetBtn = $('challenge-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetChallenge);

    const done = updateProgress();
    window.__ctPrevDone = done;

    const badge = $('challenge-badge-banner');
    if (badge && done === TOTAL_DAYS) badge.classList.remove('hidden');

    window.addEventListener('beforeunload', () => {
      saveLocal(readDaysFromCheckboxes());
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();