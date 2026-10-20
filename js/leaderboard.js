/* ==========================================================================
   Carbotrack — leaderboard.js
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

  function renderRow(row) {
    const initials = (row.avatar_initials || '?').toUpperCase();
    const ratingCls = 'rating-' + (row.rating_key || 'moderate');
    const ratingIcon = RATING_ICONS[row.rating_key] || RATING_ICONS.moderate;

    return (
      '<tr>' +
        '<td><strong>#' + row.rank + '</strong></td>' +
        '<td>' +
          '<div style="display:flex;align-items:center;gap:.6rem;">' +
            '<span style="width:1.9rem;height:1.9rem;border-radius:50%;' +
                         'display:grid;place-items:center;' +
                         'background:var(--forest-900);color:var(--leaf-400);' +
                         'font-size:.65rem;font-weight:800;flex-shrink:0;">' +
              initials +
            '</span>' +
            '<div>' +
              '<div style="font-weight:600;color:var(--forest-950);">' + (row.full_name || row.username) + '</div>' +
              '<div style="font-size:.68rem;color:var(--text-muted);">@' + row.username + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><strong>' + Number(row.total_tons).toFixed(2) + ' t</strong></td>' +
        '<td>' + row.eco_score + '/100</td>' +
        '<td>' +
          '<span class="rating-badge ' + ratingCls + '">' +
            '<i class="fa-solid ' + ratingIcon + '"></i> ' + row.rating_label +
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