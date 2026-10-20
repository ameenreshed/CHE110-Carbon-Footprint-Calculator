/* ==========================================================================
   Carbotrack — stats.js
   Anonymous platform counters: visits, footprints, certificates, shares.
   ========================================================================== */
window.CT_STATS = (function () {
  'use strict';

  const VISITOR_KEY    = 'carbotrack:visitor_id';
  const VISIT_SENT_KEY = 'carbotrack:visit_sent_day';
  const CACHE_TTL_MS   = 30 * 1000;

  let cachedStats = null;
  let cacheTime   = 0;
  let rendering   = false;
  let bootstrapped = false;

  /* ================================================================== */
  /*  IDS                                                               */
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
    } catch (e) {
      /* localStorage blocked (private mode) — ephemeral per page load */
      return 'e_' + generateId();
    }
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function haveSentVisitToday() {
    try {
      return localStorage.getItem(VISIT_SENT_KEY) === todayKey();
    } catch (e) { return false; }
  }

  function markVisitSent() {
    try { localStorage.setItem(VISIT_SENT_KEY, todayKey()); } catch (e) { /* ignore */ }
  }

  /* ================================================================== */
  /*  RPC CALLS                                                         */
  /* ================================================================== */
  async function recordVisit() {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return null;
    if (haveSentVisitToday()) return cachedStats;

    try {
      const { data, error } = await client.rpc('record_visit', {
        p_session_id: getVisitorId()
      });
      if (error) {
        console.warn('[Carbotrack stats] record_visit failed', error);
        return null;
      }
      markVisitSent();
      if (data) {
        cachedStats = Array.isArray(data) ? data[0] : data;
        cacheTime = Date.now();
        return cachedStats;
      }
    } catch (e) {
      console.warn('[Carbotrack stats] record_visit threw', e);
    }
    return null;
  }

  async function recordEvent(type, metadata) {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return;
    try {
      await client.rpc('record_event', {
        p_event_type: type,
        p_session_id: getVisitorId(),
        p_metadata: metadata || {}
      });
      /* Optimistic bump of local cache + UI */
      if (cachedStats) {
        const map = {
          footprint_computed:   'footprints_computed',
          certificate_issued:   'certificates_issued',
          share:                'shares',
          challenge_completed:  'challenge_completions'
        };
        const dbKey = map[type];
        if (dbKey && cachedStats[dbKey] != null) {
          cachedStats[dbKey] = Number(cachedStats[dbKey]) + 1;
          repaintNumbers();
        }
      }
    } catch (e) {
      console.warn('[Carbotrack stats] record_event failed', e);
    }
  }

  async function fetchStats(force) {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return null;
    if (!force && cachedStats && Date.now() - cacheTime < CACHE_TTL_MS) {
      return cachedStats;
    }
    try {
      const { data, error } = await client.rpc('get_public_stats');
      if (error) {
        console.warn('[Carbotrack stats] fetch failed', error);
        return cachedStats;
      }
      if (data) {
        cachedStats = Array.isArray(data) ? data[0] : data;
        cacheTime = Date.now();
        return cachedStats;
      }
    } catch (e) {
      console.warn('[Carbotrack stats] fetch threw', e);
    }
    return cachedStats;
  }

  /* ================================================================== */
  /*  FORMAT + RENDER                                                   */
  /* ================================================================== */
  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function itemList(stats) {
    return [
      { icon: 'fa-eye',             label: 'Visitors',             key: 'visits',                value: stats.visits },
      { icon: 'fa-chart-simple',    label: 'Footprints Measured',  key: 'footprints_computed',   value: stats.footprints_computed },
      { icon: 'fa-certificate',     label: 'Certificates Issued',  key: 'certificates_issued',   value: stats.certificates_issued },
      { icon: 'fa-share-nodes',     label: 'Shares',               key: 'shares',                value: stats.shares }
    ];
  }

  function renderInto(host, stats) {
    if (!host) return;
    host.innerHTML = itemList(stats).map(function (it) {
      return (
        '<div class="stat-card">' +
          '<div class="stat-card__icon"><i class="fa-solid ' + it.icon + '"></i></div>' +
          '<div class="stat-card__body">' +
            '<div class="stat-card__value" data-stat-key="' + it.key + '">' +
              fmt(it.value) +
            '</div>' +
            '<div class="stat-card__label">' + it.label + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function repaintNumbers() {
    if (!cachedStats) return;
    document.querySelectorAll('[data-stat-key]').forEach(function (el) {
      const key = el.getAttribute('data-stat-key');
      if (cachedStats[key] != null) {
        el.textContent = fmt(cachedStats[key]);
      }
    });
  }

  async function render(hostId) {
    const host = typeof hostId === 'string' ? document.getElementById(hostId) : hostId;
    if (!host || rendering) return;
    rendering = true;
    const stats = await fetchStats();
    rendering = false;
    if (stats) renderInto(host, stats);
  }

  /* ================================================================== */
  /*  INIT                                                              */
  /* ================================================================== */
  function init() {
    if (bootstrapped) return;
    bootstrapped = true;

    if (!window.CT_SUPABASE_CLIENT) return;

    /* Record the visit (debounced 1× per day per browser) */
    recordVisit();

    /* Render any [data-stats-strip] hosts on the current page */
    document.querySelectorAll('[data-stats-strip]').forEach(function (host) {
      if (!host.id) {
        host.id = 'ct-stats-' + Math.random().toString(36).slice(2, 8);
      }
      render(host.id);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    /* DOMContentLoaded may have already fired for late-loaded script */
    init();
  }

  return {
    recordVisit:   recordVisit,
    recordEvent:   recordEvent,
    fetchStats:    fetchStats,
    render:        render,
    formatNumber:  fmt
  };
})();