/* ==========================================================================
   Carbotrack — stats.js
   Anonymous counters with server-side deduplication.

   FIX: recordEvent now accepts an optional dedupeKey. The RPC returns
   true/false — true means it was newly counted, false means duplicate.
   Local increment only happens when server returns true. Local dedupe
   short-circuits repeated calls within the same browser/session.
   ========================================================================== */
window.CT_STATS = (function () {
  'use strict';

  const VISITOR_KEY     = 'carbotrack:visitor_id';
  const VISIT_SENT_KEY  = 'carbotrack:visit_sent_day';
  const FIRED_KEY       = 'carbotrack:fired_events';
  const CACHE_TTL_MS    = 30 * 1000;
  const MAX_FIRED_KEYS  = 300;

  let cachedStats   = null;
  let cacheTime     = 0;
  let rendering     = false;
  let bootstrapped  = false;
  let inflightFetch = null;

  /* ================================================================== */
  /*  HELPERS                                                           */
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

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function haveSentVisitToday() {
    try { return localStorage.getItem(VISIT_SENT_KEY) === todayKey(); }
    catch (e) { return false; }
  }

  function markVisitSent() {
    try { localStorage.setItem(VISIT_SENT_KEY, todayKey()); } catch (e) {}
  }

  /* ================================================================== */
  /*  LOCAL DEDUPE (fast short-circuit before RPC)                      */
  /* ================================================================== */
  function readFired() {
    try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function writeFired(obj) {
    try {
      /* Keep only the newest 300 keys to prevent localStorage bloat */
      const keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
      keys.slice(MAX_FIRED_KEYS).forEach(function (k) { delete obj[k]; });
      localStorage.setItem(FIRED_KEY, JSON.stringify(obj));
    } catch (e) { /* ignore */ }
  }

  function hasFiredLocally(key) {
    if (!key) return false;
    const fired = readFired();
    return !!fired[key];
  }

  function markFiredLocally(key) {
    if (!key) return;
    const fired = readFired();
    fired[key] = Date.now();
    writeFired(fired);
  }

  /* ================================================================== */
  /*  VISITS                                                            */
  /* ================================================================== */
  async function recordVisit() {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return null;
    if (haveSentVisitToday()) return cachedStats;

    try {
      const { data, error } = await client.rpc('record_visit', {
        p_session_id: getVisitorId()
      });
      if (error) { console.warn('[Carbotrack stats] record_visit failed', error); return null; }
      markVisitSent();
      if (data) {
        cachedStats = Array.isArray(data) ? data[0] : data;
        cacheTime = Date.now();
        return cachedStats;
      }
    } catch (e) { console.warn('[Carbotrack stats] record_visit threw', e); }
    return null;
  }

  /* ================================================================== */
  /*  EVENTS  (server-side dedupe via p_dedupe_key)                     */
  /* ================================================================== */
  async function recordEvent(type, metadata, dedupeKey) {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return;

    /* 1. Local dedupe — skip entirely if already fired in this browser */
    if (dedupeKey && hasFiredLocally(dedupeKey)) {
      return;
    }

    try {
      const params = {
        p_event_type: type,
        p_session_id: getVisitorId(),
        p_metadata:   metadata || {}
      };
      if (dedupeKey) params.p_dedupe_key = dedupeKey;

      const { data: inserted, error } = await client.rpc('record_event', params);

      if (error) {
        /* If the DB hasn't been updated with the new RPC signature,
           tell the developer clearly. */
        const msg = (error.message || '').toLowerCase();
        if (/p_dedupe_key|unknown.*parameter|function.*record_event/i.test(msg)) {
          console.error(
            '[Carbotrack stats] record_event RPC signature mismatch. ' +
            'Run stats-dedupe.sql in Supabase SQL Editor to enable deduplication.'
          );
        } else {
          console.warn('[Carbotrack stats] record_event failed', error);
        }
        return;
      }

      /* 2. Mark local dedupe as fired regardless of server response —
            server may also dedupe if this browser fired it before
            localStorage was cleared. */
      if (dedupeKey) markFiredLocally(dedupeKey);

      /* 3. Only increment local cache if server confirms it inserted */
      if (inserted === true && cachedStats) {
        const map = {
          footprint_computed:  'footprints_computed',
          certificate_issued:  'certificates_issued',
          share:               'shares',
          challenge_completed: 'challenge_completions'
        };
        const dbKey = map[type];
        if (dbKey && cachedStats[dbKey] != null) {
          cachedStats[dbKey] = Number(cachedStats[dbKey]) + 1;
          repaintNumbers();
        }
      }
    } catch (e) {
      console.warn('[Carbotrack stats] record_event threw', e);
    }
  }

  /* ================================================================== */
  /*  FETCH STATS                                                       */
  /* ================================================================== */
  async function fetchStats(force) {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return null;
    if (!force && cachedStats && Date.now() - cacheTime < CACHE_TTL_MS) return cachedStats;
    if (inflightFetch) return inflightFetch;

    inflightFetch = (async function () {
      try {
        const { data, error } = await client.rpc('get_public_stats');
        if (error) { console.warn('[Carbotrack stats] fetch failed', error); return cachedStats; }
        if (data) {
          cachedStats = Array.isArray(data) ? data[0] : data;
          cacheTime = Date.now();
          return cachedStats;
        }
      } catch (e) { console.warn('[Carbotrack stats] fetch threw', e); }
      return cachedStats;
    })();

    try { return await inflightFetch; }
    finally { inflightFetch = null; }
  }

  /* ================================================================== */
  /*  RENDER                                                            */
  /* ================================================================== */
  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function itemList(stats) {
    return [
      { icon: 'fa-eye',          label: 'Visitors',             key: 'visits',              value: stats.visits },
      { icon: 'fa-chart-simple', label: 'Footprints Measured',  key: 'footprints_computed', value: stats.footprints_computed },
      { icon: 'fa-certificate',  label: 'Certificates Issued',  key: 'certificates_issued', value: stats.certificates_issued },
      { icon: 'fa-share-nodes',  label: 'Shares',               key: 'shares',              value: stats.shares }
    ];
  }

  function renderInto(host, stats) {
    if (!host) return;
    host.innerHTML = itemList(stats).map(function (it) {
      return (
        '<div class="stat-card">' +
          '<div class="stat-card__icon"><i class="fa-solid ' + it.icon + '"></i></div>' +
          '<div class="stat-card__body">' +
            '<div class="stat-card__value" data-stat-key="' + it.key + '">' + fmt(it.value) + '</div>' +
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
      if (cachedStats[key] != null) el.textContent = fmt(cachedStats[key]);
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
  /*  BOOT                                                              */
  /* ================================================================== */
  function init() {
    if (bootstrapped) return;
    bootstrapped = true;
    if (!window.CT_SUPABASE_CLIENT) return;

    recordVisit();

    document.querySelectorAll('[data-stats-strip]').forEach(function (host) {
      if (!host.id) host.id = 'ct-stats-' + Math.random().toString(36).slice(2, 8);
      render(host.id);
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
    getVisitorId:  getVisitorId
  };
})();