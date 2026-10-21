/* ==========================================================================
   Carbotrack — dashboard.js
   Live activity dashboard. Requires sign-in.
   Polls Supabase every 15 seconds while tab is visible.
   ========================================================================== */
(function () {
  'use strict';

  const REFRESH_INTERVAL = 15000;

  const $ = (id) => document.getElementById(id);
  const escapeHTML = (str) => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let refreshTimer = null;
  let stopped = false;
  let lastValues = {};

  const EVENT_LABELS = {
    calculator_start:     { icon: 'fa-play',             color: '#10b981', label: 'started the calculator' },
    calculator_submit:    { icon: 'fa-calculator',       color: '#059669', label: 'computed a result' },
    footprint_computed:   { icon: 'fa-leaf',             color: '#34d399', label: 'measured their footprint' },
    certificate_view:     { icon: 'fa-eye',              color: '#3b82f6', label: 'viewed a certificate' },
    certificate_download: { icon: 'fa-download',         color: '#2563eb', label: 'downloaded a certificate' },
    certificate_issued:   { icon: 'fa-award',            color: '#7c3aed', label: 'earned a certificate' },
    share_click:          { icon: 'fa-hand-pointer',     color: '#f59e0b', label: 'clicked share' },
    share:                { icon: 'fa-share-nodes',      color: '#d97706', label: 'shared a certificate' },
    signup:               { icon: 'fa-user-plus',        color: '#ec4899', label: 'created an account' },
    signin:               { icon: 'fa-right-to-bracket', color: '#8b5cf6', label: 'signed in' },
    challenge_tick:       { icon: 'fa-check',            color: '#10b981', label: 'completed a challenge day' },
    challenge_completed:  { icon: 'fa-trophy',           color: '#eab308', label: 'finished the challenge' }
  };

  const ALL_KEYS = [
    'page_views','visits','unique_visits',
    'calculator_starts','calculator_submits','footprints_computed',
    'challenge_ticks','challenge_completions',
    'certificate_views','certificate_downloads','certificates_issued',
    'share_clicks','shares',
    'signups','signins','total_events'
  ];

  function formatNumber(n) {
    const num = Number(n) || 0;
    return num.toLocaleString();
  }

  function formatRelative(iso) {
    if (!iso) return 'just now';
    const ms = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 10) return 'just now';
    if (sec < 60) return sec + 's ago';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + 'm ago';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ago';
    const day = Math.floor(hr / 24);
    return day + 'd ago';
  }

  function setStatus(text, isError) {
    const el = $('dash-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'dash-status' + (isError ? ' dash-status--error' : '');
  }

  function paintCounter(key, value) {
    document.querySelectorAll('[data-key="' + key + '"] .dash-card__value').forEach(el => {
      el.textContent = formatNumber(value);
    });
    /* Flash green if changed */
    if (lastValues[key] != null && lastValues[key] !== value) {
      document.querySelectorAll('[data-key="' + key + '"]').forEach(card => {
        card.classList.add('is-updated');
        setTimeout(() => card.classList.remove('is-updated'), 700);
      });
    }
    lastValues[key] = value;
  }

  async function loadStats() {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) { setStatus('DB offline', true); return; }

    try {
      const { data, error } = await client.rpc('get_dashboard_stats');
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (/does not exist|function/.test(msg)) {
          setStatus('Run stats-dashboard.sql', true);
        } else {
          setStatus('Error', true);
        }
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { setStatus('No data', true); return; }

      ALL_KEYS.forEach(key => {
        if (row[key] != null) paintCounter(key, row[key]);
      });

      const updatedEl = $('dash-updated');
      if (updatedEl) updatedEl.textContent = 'Last updated ' + new Date().toLocaleTimeString();
      setStatus('Live', false);
    } catch (err) {
      setStatus('Network error', true);
    }
  }

  async function loadFeed() {
    const client = window.CT_SUPABASE_CLIENT;
    if (!client) return;

    try {
      const { data, error } = await client.rpc('get_recent_events', { p_limit: 25 });
      if (error) return;

      const host = $('dash-feed');
      if (!host) return;

      if (!data || !data.length) {
        host.innerHTML = '<p class="dash-feed__empty">No activity yet. Every action will appear here in real time.</p>';
        return;
      }

      host.innerHTML = data.map(ev => {
        const meta = EVENT_LABELS[ev.event_type] || { icon: 'fa-circle', color: '#64748b', label: ev.event_type };
        const extra = ev.metadata && ev.metadata.page
          ? ' (' + escapeHTML(ev.metadata.page) + ')'
          : ev.metadata && ev.metadata.channel
            ? ' (' + escapeHTML(ev.metadata.channel) + ')'
            : ev.metadata && ev.metadata.day
              ? ' (day ' + escapeHTML(ev.metadata.day) + ')'
              : '';
        return (
          '<div class="dash-feed__item">' +
            '<span class="dash-feed__icon" style="background:' + meta.color + '18;color:' + meta.color + '">' +
              '<i class="fa-solid ' + meta.icon + '"></i>' +
            '</span>' +
            '<span class="dash-feed__text">Someone <strong>' + escapeHTML(meta.label) + '</strong>' + extra + '</span>' +
            '<span class="dash-feed__time">' + escapeHTML(formatRelative(ev.created_at)) + '</span>' +
          '</div>'
        );
      }).join('');
    } catch (err) { /* silent */ }
  }

  async function refreshAll() {
    if (stopped) return;
    await Promise.all([loadStats(), loadFeed()]);
  }

  function startLoop() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshAll, REFRESH_INTERVAL);
  }

  function stopLoop() {
    stopped = true;
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  async function init() {
    /* Only run on dashboard page */
    if (!window.location.pathname.endsWith('dashboard.html')) return;
    if (!$('dash-feed')) return;

    /* Wait for auth ready */
    if (!window.CT_AUTH_READY) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 3000);
        document.addEventListener('ct:auth-ready', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }

    /* Gate: sign-in required (auth.js may replace <main> already — check first) */
    const loggedIn = window.CT_SB_AUTH && window.CT_SB_AUTH.isLoggedIn && window.CT_SB_AUTH.isLoggedIn();
    if (!loggedIn) {
      /* auth.js's gateCurrentPage already handled it via GATED_PAGES */
      return;
    }

    const refreshBtn = $('dash-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.disabled = true;
        refreshAll().finally(() => { refreshBtn.disabled = false; });
      });
    }

    /* Pause when tab hidden */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
      } else if (!stopped) {
        refreshAll();
        startLoop();
      }
    });

    await refreshAll();
    startLoop();

    window.addEventListener('beforeunload', stopLoop);
  }

  document.addEventListener('DOMContentLoaded', init);
})();