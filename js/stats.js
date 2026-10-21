/* ==========================================================================
   Carbotrack — stats.js
   Homepage counter shows ONLY total visits.

   VISIT SENSITIVITY — change VISIT_WINDOW_MS below:
   ==========================================================================
*/

/* ==========================================================================
   VISIT WINDOW
   How often a NEW visit counts for the same visitor.
   Smaller = more sensitive = counter grows faster.
   ========================================================================== */
// const VISIT_WINDOW_MS = 0;                // every page load counts (most sensitive)
// const VISIT_WINDOW_MS = 60 * 1000;        // 1 minute
// const VISIT_WINDOW_MS = 5 * 60 * 1000;    // 5 minutes
const VISIT_WINDOW_MS = 30 * 60 * 1000;      // 30 minutes (default, session-based)
// const VISIT_WINDOW_MS = 24 * 60 * 60 * 1000;  // once per day (old behavior)

window.CT_STATS = (function () {
  'use strict';

  const VISITOR_KEY     = 'carbotrack:visitor_id';
  const LAST_VISIT_KEY  = 'carbotrack:last_visit_at';
  const FIRED_KEY       = 'carbotrack:fired_events';
  const CACHE_TTL_MS    = 30 * 1000;
  const MAX_FIRED_KEYS  = 300;

  let cachedStats   = null;
  let cacheTime     = 0;
  let rendering     = false;
  let bootstrapped  = false;
  let inflightFetch = null;

  /* ================================================================== */
  /*  IDENTITY                                                          */
  /* ================================================================== */
  function generateId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    }
    let s = '';
    const chars = 'abcdef0123456789';
    for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function getVisitorId() {
    try {
      let id = localStorage.getItem(VISITOR_KEY);
      if (!id || id.length < 10) {
        id = 'v_' + generateId();
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (e) { return 'e_' + generateId(); }
  }

  /* ================================================================== */
  /*  VISIT TIMESTAMP (millisecond-precision, not day-precision)       */
  /* ================================================================== */
  function getLastVisitMs() {
    try {
      const raw = localStorage.getItem(LAST_VISIT_KEY);
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch (e) { return 0; }
  }

  function markVisitSentMs() {
    try { localStorage.setItem(LAST_VISIT_KEY, String(Date.now())); } catch (e) {}
  }

  function shouldSendVisit() {
    if (VISIT_WINDOW_MS <= 0) return true;         // every page load
    const last = getLastVisitMs();
    if (!last) return true;                         // never visited
    return (Date.now() - last) >= VISIT_WINDOW_MS;  // window expired
  }

  function pagePath() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  /* ================================================================== */
  /*  LOCAL DEDUPE (events)                                             */
  /* ================================================================== */
  function readFired() {
    try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function writeFired(obj) {
    try {
      const keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
      keys.slice(MAX_FIRED_KEYS).forEach(function (k) { delete obj[k]; });
      localStorage.setItem(FIRED_KEY, JSON.stringify(obj));
    } catch (e) { /* ignore */ }
  }

  function hasFiredLocally(key) {
    if (!key) return false;
    return !!readFired()[key];
  }

  function markFiredLocally(key) {
    if (!key) return;
    const fired = readFired();
    fired[key] = Date.now();
    writeFired(fired);
  }

  /* ================================================================== */
  /*  VISIT — time-window based                                        */
  /* ================================================================== */
  async function recordVisit() {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return null;

    // Skip entirely if window hasn't expired
    if (!shouldSendVisit()) return cachedStats;

    try {
      // Send window to server so both sides agree
      const windowSeconds = Math.max(0, Math.round(VISIT_WINDOW_MS / 1000));

      const { data, error } = await client.rpc('record_visit', {
        p_session_id:     getVisitorId(),
        p_window_seconds: windowSeconds
      });

      if (error) {
        console.warn('[CT stats] record_visit failed', error);
        return null;
      }

      // Mark locally ONLY after successful response
      markVisitSentMs();

      if (data) {
        cachedStats = Array.isArray(data) ? data[0] : data;
        cacheTime = Date.now();
        return cachedStats;
      }
    } catch (e) {
      console.warn('[CT stats] record_visit threw', e);
    }
    return null;
  }

  /* ================================================================== */
  /*  EVENT                                                             */
  /* ================================================================== */
  async function recordEvent(type, metadata, dedupeKey) {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return;

    if (dedupeKey && hasFiredLocally(dedupeKey)) return;

    try {
      const params = {
        p_event_type: type,
        p_session_id: getVisitorId(),
        p_metadata:   metadata || {}
      };
      if (dedupeKey) params.p_dedupe_key = dedupeKey;

      const { data: inserted, error } = await client.rpc('record_event', params);

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (/p_dedupe_key|unknown.*parameter|function.*record_event/i.test(msg)) {
          console.error('[CT stats] Run stats-dashboard.sql in Supabase.');
        } else {
          console.warn('[CT stats] record_event failed', error);
        }
        return;
      }

      if (dedupeKey) markFiredLocally(dedupeKey);
    } catch (e) {
      console.warn('[CT stats] record_event threw', e);
    }
  }

  /* ================================================================== */
  /*  PAGE VIEW                                                         */
  /* ================================================================== */
  function trackPageView() {
    recordEvent('page_view', { page: pagePath() });
  }

  /* ================================================================== */
  /*  FETCH                                                             */
  /* ================================================================== */
  async function fetchStats(force) {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return null;
    if (!force && cachedStats && Date.now() - cacheTime < CACHE_TTL_MS) return cachedStats;
    if (inflightFetch) return inflightFetch;

    inflightFetch = (async function () {
      try {
        const { data, error } = await client.rpc('get_public_stats');
        if (error) { console.warn('[CT stats] fetch failed', error); return cachedStats; }
        if (data) {
          cachedStats = Array.isArray(data) ? data[0] : data;
          cacheTime = Date.now();
          return cachedStats;
        }
      } catch (e) { console.warn('[CT stats] fetch threw', e); }
      return cachedStats;
    })();

    try { return await inflightFetch; }
    finally { inflightFetch = null; }
  }

  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  /* ================================================================== */
  /*  RENDER — SINGLE VISITS CARD                                      */
  /* ================================================================== */
  function renderVisits(host, stats) {
    if (!host) return;
    const visits = Number(stats.visits) || 0;
    host.innerHTML =
      '<div class="visit-counter__icon"><i class="fa-solid fa-eye"></i></div>' +
      '<div class="visit-counter__body">' +
        '<div class="visit-counter__value" data-stat-key="visits">' + fmt(visits) + '</div>' +
        '<div class="visit-counter__label">Total Site Visits</div>' +
      '</div>';
  }

  async function render(hostId) {
    const host = typeof hostId === 'string' ? document.getElementById(hostId) : hostId;
    if (!host || rendering) return;
    rendering = true;
    const stats = await fetchStats();
    rendering = false;
    if (stats) renderVisits(host, stats);
  }

  /* ================================================================== */
  /*  BOOT                                                              */
  /* ================================================================== */
  function init() {
    if (bootstrapped) return;
    bootstrapped = true;
    if (!window.CT_SUPABASE_CLIENT) return;

    trackPageView();

    // Record visit, then re-fetch + re-render with fresh number
    recordVisit().then(function () {
      const host = document.querySelector('[data-stats-strip]');
      if (host) {
        if (!host.id) host.id = 'ct-visits';
        // Force a fresh fetch so the displayed number reflects the new visit
        fetchStats(true).then(function (stats) {
          if (stats) renderVisits(host, stats);
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    recordVisit:   recordVisit,
    recordEvent:   recordEvent,
    fetchStats:    fetchStats,
    render:        render,
    formatNumber:  fmt,
    getVisitorId:  getVisitorId,
    trackPageView: trackPageView
  };
})();