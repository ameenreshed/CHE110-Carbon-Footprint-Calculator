/* ==========================================================================
   Eco — Real Visit Counter (Supabase-backed)

   HOW IT WORKS
   - Each new visitor (once per day per browser) increments the counter by 1.
   - The count is stored in Supabase → identical on every device.
   - Refreshing or revisiting the same day does NOT increment.
   - No admin panel, no fake additions. Real traffic only.

   DEDUPE
   - The browser remembers the last visit day in localStorage.
   - Clearing localStorage allows one more increment — standard behavior.
   - This is exactly how "unique visitors per day" counters work.
   ========================================================================== */
window.CT_VISITS = (function () {
  'use strict';

  const VISITOR_ID_KEY = 'carbotrack:visitor_id';
  const LAST_VISIT_KEY = 'carbotrack:last_visit_day';

  let cachedCount = null;
  let bootstrapped = false;

  /* ================================================================== */
  /*  CLIENT                                                            */
  /* ================================================================== */
  function getClient() {
    return window.CT_SUPABASE_CLIENT || null;
  }

  async function waitForClient(maxMs) {
    maxMs = maxMs || 3000;
    const start = Date.now();
    while (!getClient()) {
      if (Date.now() - start > maxMs) return null;
      await new Promise(function (r) { setTimeout(r, 80); });
    }
    return getClient();
  }

  /* ================================================================== */
  /*  IDENTITY                                                          */
  /* ================================================================== */
  function getVisitorId() {
    try {
      let id = localStorage.getItem(VISITOR_ID_KEY);
      if (!id || id.length < 10) {
        id = 'v_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        localStorage.setItem(VISITOR_ID_KEY, id);
      }
      return id;
    } catch (e) {
      return 'v_anon_' + Math.random().toString(36).slice(2, 12);
    }
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function hasVisitedToday() {
    try { return localStorage.getItem(LAST_VISIT_KEY) === todayKey(); }
    catch (e) { return false; }
  }

  function markVisitedToday() {
    try { localStorage.setItem(LAST_VISIT_KEY, todayKey()); } catch (e) {}
  }

  /* ================================================================== */
  /*  RPC CALLS                                                         */
  /* ================================================================== */
  async function getCount() {
    const c = getClient();
    if (!c) return cachedCount;

    try {
      const { data, error } = await c.rpc('get_visit_count');
      if (error) {
        console.warn('[visits] get_visit_count failed', error);
        return cachedCount;
      }
      cachedCount = Number(data) || 0;
      return cachedCount;
    } catch (e) {
      console.warn('[visits] get_visit_count threw', e);
      return cachedCount;
    }
  }

  async function recordVisit() {
    const c = getClient();
    if (!c) return null;

    // Already counted today in this browser — don't inflate
    if (hasVisitedToday()) {
      return await getCount();
    }

    try {
      const { data, error } = await c.rpc('record_visit');
      if (error) {
        console.warn('[visits] record_visit failed', error);
        return await getCount();
      }
      markVisitedToday();
      cachedCount = Number(data) || 0;
      return cachedCount;
    } catch (e) {
      console.warn('[visits] record_visit threw', e);
      return await getCount();
    }
  }

  /* ================================================================== */
  /*  FORMAT                                                            */
  /* ================================================================== */
  function formatNumber(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    return n.toLocaleString('en-US');
  }

  /* ================================================================== */
  /*  RENDER                                                            */
  /* ================================================================== */
  function renderCounter(host, count) {
    if (!host) return;
    host.innerHTML =
      '<div class="vc-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
             'stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
          '<circle cx="12" cy="12" r="3"></circle>' +
        '</svg>' +
      '</div>' +
      '<div class="vc-body">' +
        '<div class="vc-value" id="vc-value-el">' + formatNumber(count) + '</div>' +
        '<div class="vc-label">Total Visits</div>' +
      '</div>';
  }

  function bumpAnimation() {
    const el = document.getElementById('vc-value-el');
    if (!el) return;
    el.classList.add('is-bumped');
    setTimeout(function () { el.classList.remove('is-bumped'); }, 400);
  }

  /* ================================================================== */
  /*  BOOT                                                              */
  /* ================================================================== */
  async function init() {
    if (bootstrapped) return;
    bootstrapped = true;

    const host = document.getElementById('visit-counter');
    if (!host) return;

    const client = await waitForClient(3000);
    if (!client) {
      console.warn('[visits] Supabase client not ready');
      host.innerHTML =
        '<div class="vc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>' +
        '<div class="vc-body"><div class="vc-value">—</div><div class="vc-label">Total Visits</div></div>';
      return;
    }

    const count = await recordVisit();
    renderCounter(host, count);
    bumpAnimation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    get: getCount,
    formatNumber: formatNumber,
    getVisitorId: getVisitorId
  };
})();