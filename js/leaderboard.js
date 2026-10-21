/* ==========================================================================
   Carbotrack — leaderboard.js
   FIX: Added Best / Latest toggle + Latest sub-line so the user's most
   recent submission is always visible.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const escapeHTML = (str) => String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const RATING_ICONS = {
    low: 'fa-circle-check',
    moderate: 'fa-circle-exclamation',
    high: 'fa-triangle-exclamation',
    'very-high': 'fa-circle-xmark'
  };
  const SAFE_RATINGS = new Set(['low', 'moderate', 'high', 'very-high']);

  const STATE = {
    period: 'all',
    mode: 'best',
    loading: false,
    realtime: null,
    refetchTimer: null
  };

  /* ================================================================== */
  /*  ROW RENDERER                                                      */
  /*  New: footprint cell shows the ranking value big, and a small      */
  /*  "Latest: X t" line underneath when it differs.                    */
  /* ================================================================== */
  function renderRow(row, isCurrentUser) {
    const safeInitials = escapeHTML((row.avatar_initials || '?').toUpperCase().slice(0, 2));
    const ratingKey = SAFE_RATINGS.has(row.rating_key) ? row.rating_key : 'moderate';
    const ratingIcon = RATING_ICONS[ratingKey] || RATING_ICONS.moderate;

    const safeDisplayName = escapeHTML(row.full_name || row.username || 'Anonymous');
    const safeUsername    = escapeHTML(row.username || '');
    const safeRatingLabel = escapeHTML(row.rating_label || '');
    const safeTons        = escapeHTML(Number(row.total_tons).toFixed(2));
    const safeScore       = escapeHTML(row.eco_score != null ? row.eco_score : 0);
    const safeRank        = escapeHTML(row.rank);

    /* Latest line — only show if different from the ranking value */
    const latestTons = row.latest_tons != null ? Number(row.latest_tons) : null;
    const latestDiffers = latestTons != null &&
                          Math.abs(latestTons - Number(row.total_tons)) >= 0.005;

    const latestLine = latestDiffers
      ? '<div class="lb-fp-latest">Latest: <strong>' +
          escapeHTML(latestTons.toFixed(2)) + ' t</strong></div>'
      : '';

    const rowCls = isCurrentUser ? ' class="lb-row is-you"' : ' class="lb-row"';

    return (
      '<tr' + rowCls + '>' +
        '<td><strong>#' + safeRank + '</strong></td>' +
        '<td>' +
          '<div style="display:flex;align-items:center;gap:.6rem;">' +
            '<span class="lb-avatar">' + safeInitials + '</span>' +
            '<div>' +
              '<div class="lb-name">' + safeDisplayName +
                (isCurrentUser ? ' <span class="lb-you-badge">You</span>' : '') +
              '</div>' +
              '<div class="lb-handle">@' + safeUsername + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td>' +
          '<div class="lb-fp-main"><strong>' + safeTons + ' t</strong></div>' +
          latestLine +
        '</td>' +
        '<td>' + safeScore + '/100</td>' +
        '<td>' +
          '<span class="rating-badge rating-' + ratingKey + '">' +
            '<i class="fa-solid ' + ratingIcon + '"></i> ' + safeRatingLabel +
          '</span>' +
        '</td>' +
      '</tr>'
    );
  }

  /* ================================================================== */
  /*  STATE VISIBILITY                                                  */
  /* ================================================================== */
  function setState(name) {
    const loading = $('lb-loading');
    const error   = $('lb-error');
    const empty   = $('lb-empty');
    const shell   = $('lb-shell');

    [loading, error, empty, shell].forEach(function (el) {
      if (el) el.classList.add('hidden');
    });

    if (name === 'loading' && loading) loading.classList.remove('hidden');
    if (name === 'error'   && error)   error.classList.remove('hidden');
    if (name === 'empty'   && empty)   empty.classList.remove('hidden');
    if (name === 'loaded'  && shell)   shell.classList.remove('hidden');
  }

  /* ================================================================== */
  /*  YOUR RANK CARD                                                    */
  /*  New: shows both Best and Latest.                                  */
  /* ================================================================== */
  function renderYourRank(result) {
    const host = $('lb-your-rank');
    if (!host) return;

    if (!window.CT_SB_AUTH || !window.CT_SB_AUTH.isLoggedIn()) {
      host.classList.add('hidden');
      return;
    }

    host.classList.remove('hidden');

    if (!result || !result.ok) {
      host.innerHTML =
        '<div class="lb-rank-card lb-rank-card--muted">' +
          '<i class="fa-solid fa-circle-info"></i>' +
          '<div>' +
            '<strong>Rank unavailable</strong>' +
            '<p>Could not load your rank. Try refreshing.</p>' +
          '</div>' +
        '</div>';
      return;
    }

    if (result.unranked || result.rank == null) {
      host.innerHTML =
        '<div class="lb-rank-card">' +
          '<div class="lb-rank-card__icon"><i class="fa-solid fa-seedling"></i></div>' +
          '<div class="lb-rank-card__body">' +
            '<span class="lb-rank-card__eyebrow">Your Standing</span>' +
            '<strong class="lb-rank-card__title">Not yet ranked</strong>' +
            '<p class="lb-rank-card__sub">Run the calculator to claim your spot on the leaderboard.</p>' +
          '</div>' +
          '<a href="calculator.html" class="btn btn-primary btn-sm lb-rank-card__cta">' +
            '<i class="fa-solid fa-calculator"></i> Calculate' +
          '</a>' +
        '</div>';
      return;
    }

    const tierColors = { low: 'green', moderate: 'blue', high: 'amber', 'very-high': 'red' };
    const tierKey = SAFE_RATINGS.has(result.ratingKey) ? result.ratingKey : 'moderate';
    const tierColor = tierColors[tierKey] || 'green';

    const bestStr = Number(result.totalTons).toFixed(2);
    const latestStr = result.latestTons != null
      ? Number(result.latestTons).toFixed(2)
      : bestStr;
    const showLatest = Math.abs(Number(result.latestTons) - Number(result.totalTons)) >= 0.005;

    const latestBadge = showLatest
      ? ' <span class="lb-rank-card__latest">· latest ' + escapeHTML(latestStr) + ' t</span>'
      : '';

    host.innerHTML =
      '<div class="lb-rank-card lb-rank-card--' + tierColor + '">' +
        '<div class="lb-rank-card__icon"><i class="fa-solid fa-trophy"></i></div>' +
        '<div class="lb-rank-card__body">' +
          '<span class="lb-rank-card__eyebrow">Your Standing</span>' +
          '<strong class="lb-rank-card__title">' +
            '#' + escapeHTML(result.rank) +
            ' <span class="lb-rank-card__of">of ' + escapeHTML(result.totalRanked) + '</span>' +
          '</strong>' +
          '<p class="lb-rank-card__sub">' +
            'Best: ' + escapeHTML(bestStr) + ' t CO₂e/yr · Eco Score ' +
            escapeHTML(result.ecoScore) + '/100' + latestBadge +
          '</p>' +
        '</div>' +
        '<a href="results.html" class="btn btn-outline btn-sm lb-rank-card__cta">' +
          '<i class="fa-solid fa-chart-pie"></i> My Results' +
        '</a>' +
      '</div>';
  }

  /* ================================================================== */
  /*  LOAD                                                              */
  /* ================================================================== */
  async function load() {
    if (STATE.loading) return;
    STATE.loading = true;

    setState('loading');

    const body = $('lb-body');
    const meta = $('lb-meta');

    let currentUserId = null;
    try {
      const sb = window.CT_SB_AUTH;
      if (sb && sb.isLoggedIn && sb.isLoggedIn()) {
        const u = sb.getUser();
        currentUserId = u ? u.id : null;
      }
    } catch (e) { /* ignore */ }

    const results = await Promise.all([
      window.CT_SB_LEADERBOARD.fetchTop(20, STATE.period, STATE.mode),
      window.CT_SB_LEADERBOARD.fetchMyRank()
    ]);

    const listRes = results[0];
    const rankRes = results[1];

    renderYourRank(rankRes);

    STATE.loading = false;

    if (!listRes.ok) {
      const msgEl = $('lb-error-msg');
      if (msgEl) msgEl.textContent = listRes.error || 'Could not load the leaderboard.';
      setState('error');
      return;
    }

    if (!listRes.data.length) {
      setState('empty');
      return;
    }

    setState('loaded');

    if (body) {
      body.innerHTML = listRes.data.map(function (row) {
        const isYou = currentUserId && row.user_id === currentUserId;
        return renderRow(row, isYou);
      }).join('');
    }

    if (meta) {
      const periodLabel = { all: 'All-time', week: 'Last 7 days', month: 'Last 30 days' }[STATE.period] || 'All-time';
      const modeLabel = STATE.mode === 'latest' ? 'Latest' : 'Best';
      meta.textContent = modeLabel + ' · ' + periodLabel +
        ' · Updated ' + new Date().toLocaleTimeString();
    }
  }

  /* ================================================================== */
  /*  REALTIME                                                          */
  /* ================================================================== */
  function attachRealtime() {
    if (STATE.realtime) return;

    STATE.realtime = window.CT_SB_LEADERBOARD.subscribe(function () {
      if (STATE.refetchTimer) clearTimeout(STATE.refetchTimer);
      STATE.refetchTimer = setTimeout(function () {
        load();
      }, 1200);
    });
  }

  /* ================================================================== */
  /*  WIRE TABS (period + mode)                                         */
  /* ================================================================== */
  function wireTabs() {
    const periodTabs = document.querySelectorAll('[data-lb-period]');
    periodTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        const next = tab.getAttribute('data-lb-period');
        if (!next || next === STATE.period) return;
        STATE.period = next;
        periodTabs.forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        load();
      });
    });

    const modeTabs = document.querySelectorAll('[data-lb-mode]');
    modeTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        const next = tab.getAttribute('data-lb-mode');
        if (!next || next === STATE.mode) return;
        STATE.mode = next;
        modeTabs.forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        load();
      });
    });
  }

  function wireRetry() {
    const btn = $('lb-retry-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        load();
      });
    }
  }

  function dispose() {
    if (STATE.realtime && STATE.realtime.unsubscribe) STATE.realtime.unsubscribe();
    if (STATE.refetchTimer) clearTimeout(STATE.refetchTimer);
    STATE.realtime = null;
    STATE.refetchTimer = null;
  }

  async function init() {
    if (!$('lb-shell')) return;

    if (!window.CT_AUTH_READY) {
      await new Promise(function (resolve) {
        const timer = setTimeout(resolve, 3000);
        document.addEventListener('ct:auth-ready', function () {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }

    wireTabs();
    wireRetry();
    await load();
    attachRealtime();

    window.addEventListener('beforeunload', dispose);
  }

  document.addEventListener('DOMContentLoaded', init);
})();