/* ==========================================================================
   Carbotrack — challenge-notifications.js
   Daily reminder system for the 7-Day Campus Eco Challenge.
   Fires while Carbotrack is open (any tab); recovers missed days on load.
   ========================================================================== */
window.CT_CHALLENGE_NOTIF = (function () {
  'use strict';

  const STORAGE_KEY  = 'carbotrack:notif';
  const DEFAULT_HOUR = 8;
  const DEFAULT_MIN = 0;
  const TOTAL_DAYS   = 7;

  let swRegistration = null;
  let timeoutId      = null;
  let initDone       = false;

  /* ================================================================== */
  /*  SUPPORT                                                           */
  /* ================================================================== */
  function isSupported() {
    return ('Notification' in window) && ('serviceWorker' in navigator);
  }

  /* ================================================================== */
  /*  SETTINGS                                                          */
  /* ================================================================== */
  function getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return {
        enabled:      !!s.enabled,
        hour:         Number.isFinite(s.hour)   ? s.hour   : DEFAULT_HOUR,
        minute:       Number.isFinite(s.minute) ? s.minute : DEFAULT_MIN,
        lastFiredAt:  s.lastFiredAt  || null,
        lastFiredDay: s.lastFiredDay || null
      };
    } catch (e) { return null; }
  }

  function saveSettings(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function formatTime(hour, minute) {
    const h    = hour % 12 || 12;
    const m    = String(minute).padStart(2, '0');
    const ampm = hour < 12 ? 'AM' : 'PM';
    return h + ':' + m + ' ' + ampm;
  }

  /* ================================================================== */
  /*  SERVICE WORKER                                                    */
  /* ================================================================== */
  async function registerSW() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      await navigator.serviceWorker.register('sw.js');
      swRegistration = await navigator.serviceWorker.ready;
      return swRegistration;
    } catch (e) {
      console.warn('[Carbotrack] SW registration failed', e);
      return null;
    }
  }

  /* ================================================================== */
  /*  PERMISSION                                                        */
  /* ================================================================== */
  async function ensurePermission() {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied')  return 'denied';
    try {
      const p = await Notification.requestPermission();
      return p;
    } catch (e) { return 'denied'; }
  }

  /* ================================================================== */
  /*  PROGRESS HELPERS                                                  */
  /* ================================================================== */
  function countDone() {
    const boxes = document.querySelectorAll('.challenge-checkbox');
    if (boxes.length > 0) {
      let done = 0;
      boxes.forEach(function (cb) { if (cb.checked) done++; });
      return done;
    }
    /* On non-challenge pages, read from storage */
    if (window.CT_STORAGE && window.CT_STORAGE.getChallenge) {
      const chal = window.CT_STORAGE.getChallenge();
      if (chal && Array.isArray(chal.days)) {
        return chal.days.filter(Boolean).length;
      }
    }
    return 0;
  }

  function nextDayNumber(done) {
    if (done >= TOTAL_DAYS) return null;
    const boxes = document.querySelectorAll('.challenge-checkbox');
    if (boxes.length > 0) {
      for (let i = 0; i < boxes.length; i++) {
        if (!boxes[i].checked) return i + 1;
      }
    }
    return done + 1;
  }

  function buildBody() {
    const done = countDone();
    if (done >= TOTAL_DAYS) {
      return '🏆 Challenge complete! Tap to view your Champion certificate.';
    }
    const next = nextDayNumber(done);
    if (done === 0) {
      return 'Day 1 of 7 — start your eco streak today! Tap to check in.';
    }
    const word = done === 1 ? 'day' : 'days';
    return 'Day ' + next + ' of 7 — ' + done + ' ' + word +
           ' done. Keep the streak alive! Tap to mark today.';
  }

  /* ================================================================== */
  /*  FIRE                                                              */
  /* ================================================================== */
  async function fireNotification(customBody) {
    if (!isSupported()) return { ok: false };
    if (Notification.permission !== 'granted') return { ok: false };

    const today = todayKey();

    /* Once-per-day guard (unless a customBody is passed for a one-shot) */
    if (!customBody) {
      const s = getSettings();
      if (s && s.lastFiredDay === today) return { ok: false, skipped: 'already-fired' };
    }

    const title = '🌿 Carbotrack Eco Challenge';
    const body  = customBody || buildBody();

    try {
      const reg = swRegistration || await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌿</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌿</text></svg>',
        tag: 'carbotrack-daily',
        renotify: true,
        requireInteraction: false,
        data: { url: 'challenge.html' }
      });
    } catch (e) {
      /* Fallback — desktop-only, no SW required */
      try {
        const n = new Notification(title, { body: body, tag: 'carbotrack-daily' });
        n.onclick = function () {
          window.focus();
          window.location.href = 'challenge.html';
        };
      } catch (err) {
        console.warn('[Carbotrack] notification fallback failed', err);
        return { ok: false };
      }
    }

    /* Record fire */
    const s = getSettings() || {
      enabled: true, hour: DEFAULT_HOUR, minute: DEFAULT_MIN
    };
    s.lastFiredAt  = new Date().toISOString();
    s.lastFiredDay = today;
    saveSettings(s);

    return { ok: true };
  }

  /* ================================================================== */
  /*  SCHEDULE                                                          */
  /* ================================================================== */
  function nextTargetTime(settings) {
    const now    = new Date();
    const target = new Date();
    target.setHours(settings.hour, settings.minute, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  function scheduleNext() {
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }

    const s = getSettings();
    if (!s || !s.enabled) return;
    if (!isSupported() || Notification.permission !== 'granted') return;

    const target = nextTargetTime(s);
    const delay  = Math.max(1000, target.getTime() - Date.now());

    timeoutId = setTimeout(async function () {
      const still = getSettings();
      if (!still || !still.enabled) return;
      await fireNotification();
      scheduleNext();
    }, delay);
  }

  function checkMissedOnLoad() {
    const s = getSettings();
    if (!s || !s.enabled) return;
    if (!isSupported() || Notification.permission !== 'granted') return;

    const today = todayKey();
    if (s.lastFiredDay === today) return; /* Already fired today */

    const now    = new Date();
    const target = new Date();
    target.setHours(s.hour, s.minute, 0, 0);

    /* Only fire if today's target time has already passed */
    if (now.getTime() >= target.getTime()) {
      setTimeout(function () { fireNotification(); }, 3000);
    }
  }

  /* ================================================================== */
  /*  PUBLIC ACTIONS                                                    */
  /* ================================================================== */
  async function enable(hour, minute) {
    if (!isSupported()) {
      return { ok: false, error: 'Notifications are not supported in this browser.' };
    }

    const perm = await ensurePermission();
    if (perm === 'denied') {
      return { ok: false, error: 'Notifications are blocked. Enable them in your browser settings.' };
    }
    if (perm !== 'granted') {
      return { ok: false, error: 'Notification permission was not granted.' };
    }

    const reg = await registerSW();
    if (!reg) {
      return { ok: false, error: 'Could not register the service worker.' };
    }

    const s = {
      enabled:      true,
      hour:         Number.isFinite(hour)   ? hour   : DEFAULT_HOUR,
      minute:       Number.isFinite(minute) ? minute : DEFAULT_MIN,
      lastFiredAt:  null,
      lastFiredDay: null
    };
    saveSettings(s);
    scheduleNext();
    return { ok: true };
  }

  function disable() {
    const s = getSettings() || {};
    s.enabled = false;
    saveSettings(s);
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
  }

  async function test() {
    if (!isSupported()) return { ok: false, error: 'Notifications not supported.' };
    const perm = await ensurePermission();
    if (perm !== 'granted') {
      return { ok: false, error: 'Please allow notifications first.' };
    }
    await registerSW();
    await fireNotification('This is your daily reminder preview — see you at ' +
      formatTime(getSettings() ? getSettings().hour : DEFAULT_HOUR,
                 getSettings() ? getSettings().minute : DEFAULT_MIN) + '!');
    return { ok: true };
  }

  /* ================================================================== */
  /*  UI BINDING (only present on challenge.html)                       */
  /* ================================================================== */
  function populateTimeSelectors() {
    const hourSel   = document.getElementById('notif-hour');
    const minuteSel = document.getElementById('notif-minute');
    if (!hourSel || !minuteSel) return;

    if (hourSel.options.length === 0) {
      for (let h = 0; h < 24; h++) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h.toString().padStart(2, '0');
        hourSel.appendChild(opt);
      }
    }
    if (minuteSel.options.length === 0) {
      [0, 15, 30, 45].forEach(function (m) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m.toString().padStart(2, '0');
        minuteSel.appendChild(opt);
      });
    }
  }

  function updateUI() {
    const card = document.getElementById('notif-card');
    if (!card) return;

    const s = getSettings();
    const enabled = !!(s && s.enabled);
    const perm    = isSupported() ? Notification.permission : 'unsupported';

    const status     = document.getElementById('notif-status');
    const toggle     = document.getElementById('notif-toggle');
    const timeRow    = document.getElementById('notif-time-row');
    const hourSel    = document.getElementById('notif-hour');
    const minuteSel  = document.getElementById('notif-minute');
    const testBtn    = document.getElementById('notif-test-btn');
    const unsupported = document.getElementById('notif-unsupported');

    if (!isSupported()) {
      if (unsupported) unsupported.hidden = false;
      if (toggle) toggle.disabled = true;
      if (status) status.textContent = 'Notifications are not supported in this browser.';
      return;
    }

    if (status) {
      if (perm === 'denied') {
        status.textContent = 'Notifications are blocked — enable them in your browser settings.';
      } else if (enabled) {
        status.textContent = 'Reminder at ' + formatTime(s.hour, s.minute) +
          ' — fires while Carbotrack is open in a tab.';
      } else {
        status.textContent = 'Turn on daily reminders so you never miss a day.';
      }
    }

    if (toggle) toggle.checked = enabled;
    if (timeRow) timeRow.hidden = !enabled;
    if (hourSel && s)   hourSel.value = String(s.hour);
    if (minuteSel && s) minuteSel.value = String(s.minute);
    if (testBtn) testBtn.hidden = !enabled;
  }

  async function handleToggle() {
    const toggle    = document.getElementById('notif-toggle');
    const hourSel   = document.getElementById('notif-hour');
    const minuteSel = document.getElementById('notif-minute');

    if (toggle.checked) {
      const h = parseInt(hourSel.value, 10);
      const m = parseInt(minuteSel.value, 10);
      const res = await enable(h, m);
      if (!res.ok) {
        toggle.checked = false;
        if (window.CT_TOAST) window.CT_TOAST.show(res.error, 'error', 3200);
      } else {
        if (window.CT_TOAST) window.CT_TOAST.show('Daily reminders enabled!', 'success', 2400);
      }
    } else {
      disable();
      if (window.CT_TOAST) window.CT_TOAST.show('Reminders disabled.', 'info', 2200);
    }
    updateUI();
  }

  function handleTimeChange() {
    const s = getSettings();
    if (!s || !s.enabled) return;

    const hourSel   = document.getElementById('notif-hour');
    const minuteSel = document.getElementById('notif-minute');

    s.hour   = parseInt(hourSel.value, 10);
    s.minute = parseInt(minuteSel.value, 10);
    saveSettings(s);
    scheduleNext();
    updateUI();
  }

  async function handleTest() {
    const btn = document.getElementById('notif-test-btn');
    if (!btn) return;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
    const res = await test();
    btn.disabled = false;
    btn.innerHTML = original;
    if (!res.ok && window.CT_TOAST) {
      window.CT_TOAST.show(res.error, 'error', 2800);
    }
  }

  /* ================================================================== */
  /*  BOOT                                                              */
  /* ================================================================== */
  function onCheckboxChange() {
    /* Auto-disable + celebrate when done */
    setTimeout(function () {
      const done = countDone();
      if (done >= TOTAL_DAYS) {
        const s = getSettings();
        if (s && s.enabled) {
          disable();
          updateUI();
          fireNotification('🏆 Challenge complete! Tap to view your Champion certificate.');
        }
      }
    }, 120);
  }

  function init() {
    if (initDone) return;
    initDone = true;

    /* Register the SW on every page so scheduling works site-wide */
    registerSW().then(function () {
      /* Bind UI only if the challenge card exists */
      if (document.getElementById('notif-card')) {
        populateTimeSelectors();

        const toggle    = document.getElementById('notif-toggle');
        const hourSel   = document.getElementById('notif-hour');
        const minuteSel = document.getElementById('notif-minute');
        const testBtn   = document.getElementById('notif-test-btn');

        if (toggle)    toggle.addEventListener('change', handleToggle);
        if (hourSel)   hourSel.addEventListener('change', handleTimeChange);
        if (minuteSel) minuteSel.addEventListener('change', handleTimeChange);
        if (testBtn)   testBtn.addEventListener('click', handleTest);

        /* If already 7/7 on load, reflect the "complete" state */
        if (countDone() >= TOTAL_DAYS) {
          disable();
        }

        updateUI();
      }

      /* Any page: schedule + catch up on missed reminders */
      checkMissedOnLoad();
      scheduleNext();
    });

    /* Wire checkbox listeners if this page has the challenge grid */
    document.querySelectorAll('.challenge-checkbox').forEach(function (cb) {
      cb.addEventListener('change', onCheckboxChange);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    enable:       enable,
    disable:      disable,
    test:         test,
    isSupported:  isSupported,
    getSettings:  getSettings
  };
})();