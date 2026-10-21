/* ==========================================================================
   Carbotrack — leaderboard.js  (HTML-escaped rendering)
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const RATING_ICONS = {
    low: 'fa-circle-check',
    moderate: 'fa-circle-exclamation',
    high: 'fa-triangle-exclamation',
    'very-high': 'fa-circle-xmark'
  };
  const SAFE_RATINGS = new Set(['low', 'moderate', 'high', 'very-high']);

  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderRow(row) {
    const safeInitials = escapeHTML((row.avatar_initials || '?').toUpperCase().slice(0, 2));
    const safeRatingKey = SAFE_RATINGS.has(row.rating_key) ? row.rating_key : 'moderate';
    const ratingCls = 'rating-' + safeRatingKey;
    const ratingIcon = RATING_ICONS[safeRatingKey] || RATING_ICONS.moderate;

    const safeDisplayName = escapeHTML(row.full_name || row.username || 'Anonymous');
    const safeUsername    = escapeHTML(row.username || '');
    const safeRatingLabel = escapeHTML(row.rating_label || '');
    const safeTons        = escapeHTML(Number(row.total_tons).toFixed(2));
    const safeScore       = escapeHTML(row.eco_score);
    const safeRank        = escapeHTML(row.rank);

    return (
      '<tr>' +
        '<td><strong>#' + safeRank + '</strong></td>' +
        '<td>' +
          '<div style="display:flex;align-items:center;gap:.6rem;">' +
            '<span style="width:1.9rem;height:1.9rem;border-radius:50%;' +
                         'display:grid;place-items:center;' +
                         'background:var(--forest-900);color:var(--leaf-400);' +
                         'font-size:.65rem;font-weight:800;flex-shrink:0;">' +
              safeInitials +
            '</span>' +
            '<div>' +
              '<div style="font-weight:600;color:var(--forest-950);">' + safeDisplayName + '</div>' +
              '<div style="font-size:.68rem;color:var(--text-muted);">@' + safeUsername + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><strong>' + safeTons + ' t</strong></td>' +
        '<td>' + safeScore + '/100</td>' +
        '<td>' +
          '<span class="rating-badge ' + ratingCls + '">' +
            '<i class="fa-solid ' + ratingIcon + '"></i> ' + safeRatingLabel +
          '</span>' +
        '</td>' +
      '</tr>'
    );
  }

  async function loadLeaderboard() {
    if (!window.CT_SB_LEADERBOARD) return;

    const res = await window.CT_SB_LEADERBOARD.fetchTop(20);

    const empty = $('leaderboard-empty');
    const shell = $('leaderboard-shell');
    const body  = $('leaderboard-body');
    const meta  = $('leaderboard-updated');

    if (!res.ok || !res.data.length) {
      if (empty) empty.classList.remove('hidden');
      if (shell) shell.classList.add('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');
    if (shell) shell.classList.remove('hidden');
    if (body) body.innerHTML = res.data.map(renderRow).join('');
    if (meta) meta.textContent = 'Updated ' + new Date().toLocaleTimeString();
  }

  function init() {
    if (!$('leaderboard-shell')) return;

    loadLeaderboard();

    if (window.CT_SB_LEADERBOARD && window.CT_SB_LEADERBOARD.subscribe) {
      window.CT_SB_LEADERBOARD.subscribe(function () {
        loadLeaderboard();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();