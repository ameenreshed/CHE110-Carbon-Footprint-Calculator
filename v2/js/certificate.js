/* ==========================================================================
   Carbotrack — certificate.js
   Printable/shareable certificate page. Handles own certificate (logged in)
   and shared certificate (#s= payload, no login required).
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const S = window.CT_STORAGE;

  const RATING_ICONS = {
    low:         'fa-award',
    moderate:    'fa-medal',
    high:        'fa-triangle-exclamation',
    'very-high': 'fa-circle-exclamation'
  };

  /* ================================================================== */
  /*  CERT ID                                                           */
  /* ================================================================== */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }

  function makeCertId(username, date) {
    const y = new Date(date).getFullYear();
    const h = fnv1a(username + '|' + date).slice(0, 6);
    return `CT-${y}-${h}`;
  }

  /* ================================================================== */
  /*  FORMATTING                                                        */
  /* ================================================================== */
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) { return iso; }
  }

  /* ================================================================== */
  /*  RENDER                                                            */
  /* ================================================================== */
  function render(data) {
    const name = $('cert-name');
    const tons = $('cert-tons');
    const score = $('cert-score');
    const rating = $('cert-rating');
    const ratingIcon = $('cert-rating-icon');
    const date = $('cert-date');
    const id = $('cert-id');
    const subtitle = $('cert-subtitle');

    if (name)   name.textContent = data.name;
    if (tons)   tons.textContent = data.totalTons.toFixed(2) + ' t';
    if (score)  score.textContent = data.ecoScore + '/100';
    if (rating) rating.textContent = data.ratingLabel;

    if (ratingIcon) {
      const cls = RATING_ICONS[data.ratingKey] || RATING_ICONS.moderate;
      ratingIcon.className = `fa-solid ${cls}`;
    }

    if (date) date.textContent = formatDate(data.issuedAt);
    if (id)   id.textContent = data.certId;

    if (subtitle) {
      subtitle.textContent = data.shared
        ? 'Shared Certificate — viewed from a Carbotrack verification link'
        : 'Verified by the Carbotrack Carbon Assessment Engine';
    }

    document.title = `${data.name}'s Certificate — Carbotrack`;
  }

  /* ================================================================== */
  /*  BUILD PAYLOAD                                                     */
  /* ================================================================== */
  function buildData(user, results) {
    const issuedAt = new Date().toISOString();
    return {
      name: user.name,
      username: user.username,
      totalTons: results.totalTons,
      ecoScore: results.ecoScore,
      ratingKey: results.rating.key,
      ratingLabel: results.rating.label,
      issuedAt,
      certId: makeCertId(user.username, issuedAt)
    };
  }

  function encodeShare(data) {
    return S.encodeInputs({
      n: data.name,
      u: data.username,
      t: data.totalTons,
      e: data.ecoScore,
      rk: data.ratingKey,
      rl: data.ratingLabel,
      d: data.issuedAt,
      i: data.certId
    });
  }

  function decodeShare(payload) {
    if (!payload) return null;
    const raw = S.decodeInputs(payload);
    if (!raw) return null;
    return {
      name: raw.n,
      username: raw.u,
      totalTons: parseFloat(raw.t),
      ecoScore: parseInt(raw.e, 10),
      ratingKey: raw.rk,
      ratingLabel: raw.rl,
      issuedAt: raw.d,
      certId: raw.i,
      shared: true
    };
  }

  /* ================================================================== */
  /*  ACTIONS                                                           */
  /* ================================================================== */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); resolve(); }
      catch (e) { reject(e); }
      finally { document.body.removeChild(ta); }
    });
  }

  /* ================================================================== */
  /*  INIT                                                              */
  /* ================================================================== */
  function init() {
    if (!$('cert-sheet')) return;

    const sharePayload = S.readSharePayload();

    if (sharePayload) {
      /* ---- shared view ---- */
      const data = decodeShare(sharePayload);
      if (!data) return showError('This share link is invalid or damaged.');
      render(data);
      hideForShared();
      return;
    }

    /* ---- personal view ---- */
    if (!window.CT_AUTH || !window.CT_AUTH.isLoggedIn()) return;

    const user = window.CT_AUTH.currentUser();
    const results = S.getResults();

    if (!results) return showEmpty();

    const data = buildData(user, results);
    render(data);
    wireActions(data);
  }

  function hideForShared() {
    const actions = document.querySelector('.cert-actions');
    if (actions) actions.innerHTML = `
      <a href="index.html" class="btn btn-primary btn-lg">
        <i class="fa-solid fa-leaf"></i>
        <span>Try Carbotrack Yourself</span>
      </a>
      <button type="button" class="btn btn-outline btn-lg" onclick="window.print()">
        <i class="fa-solid fa-print"></i>
        <span>Print This Certificate</span>
      </button>
    `;
  }

  function wireActions(data) {
    const printBtn = $('cert-print-btn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const shareBtn = $('cert-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const base = window.location.href.split('#')[0];
        const url = base + '#s=' + encodeShare(data);
        try {
          await copyText(url);
          if (window.CT_TOAST) window.CT_TOAST.show('Share link copied to clipboard.', 'success', 2600);
        } catch (e) {
          window.prompt('Copy this share link:', url);
        }
      });
    }

    const downloadBtn = $('cert-download-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', () => window.print());
  }

  function showEmpty() {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = `
      <div class="section section--white" style="min-height:70vh;display:grid;place-items:center;">
        <div class="container" style="max-width:34rem;">
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fa-solid fa-award"></i></div>
            <h2 class="section-heading">No Certificate Yet</h2>
            <p class="section-sub">
              Complete the six-step calculator first — we'll use your result to personalise
              your certificate.
            </p>
            <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1.75rem;">
              <a href="calculator.html" class="btn btn-primary btn-lg">
                <i class="fa-solid fa-calculator"></i>
                <span>Open the Calculator</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function showError(msg) {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = `
      <div class="section section--white" style="min-height:70vh;display:grid;place-items:center;">
        <div class="container" style="max-width:34rem;">
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h2 class="section-heading">Certificate Not Available</h2>
            <p class="section-sub">${msg}</p>
            <div style="margin-top:1.75rem;">
              <a href="index.html" class="btn btn-primary btn-lg">
                <i class="fa-solid fa-house"></i>
                <span>Go to Home</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', init);
})();