/* ==========================================================================
   Carbotrack — profile.js
   Renders user hero, stats, certificate vault and history.
   Depends on: config.js, storage.js, supabase-auth.js,
               supabase-challenge.js, auth.js (for gating).
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ================================================================== */
  /*  HELPERS                                                           */
  /* ================================================================== */
  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initialsOf(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) { return String(iso); }
  }

  function shortId(uuid) {
    if (!uuid) return '—';
    return uuid.split('-')[0];
  }

  /* Mirrors certificate.js TIERS for classification */
  function classifyTier(tons) {
    const T = (window.CT_CONFIG && window.CT_CONFIG.tierThresholds) ||
              { lowMax: 2, moderateMax: 5, highMax: 10 };
    const n = Number(tons);
    const t = Number.isFinite(n) && n >= 0 ? n : 0;
    if (t < T.lowMax)      return { key: 'champion', title: 'Climate Champion', icon: 'fa-trophy',           range: '0 – 2 t' };
    if (t < T.moderateMax) return { key: 'moderate', title: 'Global Citizen',   icon: 'fa-globe',            range: '2 – 5 t' };
    if (t < T.highMax)     return { key: 'high',     title: 'High Impact',      icon: 'fa-triangle-exclamation', range: '5 – 10 t' };
    return                        { key: 'severe',   title: 'Severe Impact',    icon: 'fa-circle-exclamation', range: '10+ t' };
  }

  /* Minimal FNV-1a — same algorithm as certificate.js for display IDs */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }

  function makeCertId(prefix, username, date) {
    const y = new Date(date).getFullYear();
    const h = fnv1a(username + '|' + date + '|' + prefix).slice(0, 6);
    return 'CT-' + prefix + '-' + y + '-' + h;
  }

  /* ================================================================== */
  /*  AUTH HELPERS                                                      */
  /* ================================================================== */
  function waitForAuthReady(timeoutMs) {
    if (window.CT_AUTH_READY) return Promise.resolve();
    return new Promise(function (resolve) {
      const timer = setTimeout(resolve, timeoutMs || 3000);
      document.addEventListener('ct:auth-ready', function () {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  function currentUser() {
    return window.CT_SB_AUTH && window.CT_SB_AUTH.isLoggedIn && window.CT_SB_AUTH.isLoggedIn()
      ? window.CT_SB_AUTH.getUser()
      : null;
  }

  /* ================================================================== */
  /*  HERO                                                              */
  /* ================================================================== */
  function renderHero() {
    const sb = window.CT_SB_AUTH;
    const user = sb.getUser ? sb.getUser() : null;
    const profile = sb.getProfile ? sb.getProfile() : null;
    const meta = (user && user.user_metadata) || {};

    const displayName =
      (profile && profile.full_name && String(profile.full_name).trim()) ||
      (meta.full_name || meta.name || '').trim() ||
      (profile && profile.username) ||
      meta.username ||
      (user && user.email ? user.email.split('@')[0] : 'Friend');

    const username =
      (profile && profile.username) ||
      meta.username ||
      (user && user.email ? user.email.split('@')[0] : 'user');

    const joined =
      (profile && profile.created_at) ||
      (user && user.created_at) ||
      null;

    const userId = (user && user.id) || '';

    $('profile-avatar').textContent = initialsOf(displayName);
    $('profile-name').textContent = displayName;
    $('profile-handle').textContent = '@' + username;
    $('profile-joined').textContent = joined ? formatDate(joined) : '—';
    $('profile-id-short').textContent = shortId(userId);
    $('profile-id-copy').dataset.fullId = userId;
  }

  /* ================================================================== */
  /*  STATS                                                             */
  /* ================================================================== */
  function renderStats(results, rankData, challenge) {
    /* Best footprint */
    if (results && results.length) {
      const best = results.reduce(function (a, b) {
        return Number(a.total_tons) <= Number(b.total_tons) ? a : b;
      });
      $('stat-best-footprint').textContent = Number(best.total_tons).toFixed(2) + ' t';
      $('stat-eco-score').textContent = (best.eco_score || 0) + '/100';
    } else {
      $('stat-best-footprint').textContent = '—';
      $('stat-eco-score').textContent = '—';
    }

    /* Rank */
    if (rankData && rankData.rank != null) {
      $('stat-rank').textContent = '#' + rankData.rank;
    } else if (results && results.length === 0) {
      $('stat-rank').textContent = 'Unranked';
    } else {
      $('stat-rank').textContent = '—';
    }

    /* Challenge days */
    if (challenge && challenge.ok && Array.isArray(challenge.days)) {
      const done = challenge.days.filter(Boolean).length;
      $('stat-challenge').textContent = done + '/7';
    } else {
      $('stat-challenge').textContent = '0/7';
    }
  }

  /* ================================================================== */
  /*  CERTIFICATE VAULT                                                 */
  /* ================================================================== */
  function renderCertificates(results, challenge) {
    const host = $('profile-certs');
    if (!host) return;

    const sb = window.CT_SB_AUTH;
    const profile = sb.getProfile ? sb.getProfile() : null;
    const meta = (currentUser() && currentUser().user_metadata) || {};
    const username =
      (profile && profile.username) ||
      meta.username ||
      (currentUser() && currentUser().email ? currentUser().email.split('@')[0] : 'user');

    const cards = [];

    /* Carbon certificate — earned if any results exist */
    if (results && results.length) {
      const best = results.reduce(function (a, b) {
        return Number(a.total_tons) <= Number(b.total_tons) ? a : b;
      });
      const tier = classifyTier(best.total_tons);
      const certId = makeCertId('C', username, best.created_at);
      cards.push({
        kind: 'carbon',
        state: 'earned',
        tierKey: tier.key,
        icon: tier.icon,
        title: tier.title,
        subtitle: 'Carbon Footprint Certificate',
        badgeLabel: 'EARNED',
        meta: {
          date: best.created_at,
          certId: certId
        },
        href: 'certificate.html'
      });
    } else {
      cards.push({
        kind: 'carbon',
        state: 'locked',
        tierKey: 'locked',
        icon: 'fa-lock',
        title: 'Carbon Certificate',
        subtitle: 'Complete the calculator to unlock',
        badgeLabel: 'LOCKED',
        href: 'calculator.html'
      });
    }

    /* Challenge certificate — earned if all 7 days done */
    const challengeDone = !!(challenge && challenge.ok && challenge.days && challenge.days.every(Boolean));
    if (challengeDone) {
      const certId = makeCertId('H', username, challenge.updatedAt || new Date().toISOString());
      cards.push({
        kind: 'challenge',
        state: 'earned',
        tierKey: 'challenge',
        icon: 'fa-trophy',
        title: 'Challenge Champion',
        subtitle: '7-Day Campus Eco Challenge',
        badgeLabel: 'EARNED',
        meta: {
          date: challenge.updatedAt,
          certId: certId
        },
        href: 'certificate.html#type=challenge'
      });
    } else {
      const done = challenge && challenge.days ? challenge.days.filter(Boolean).length : 0;
      cards.push({
        kind: 'challenge',
        state: 'locked',
        tierKey: 'locked',
        icon: 'fa-lock',
        title: 'Challenge Certificate',
        subtitle: 'Complete all 7 days to earn (' + done + '/7 done)',
        badgeLabel: 'LOCKED',
        href: 'challenge.html'
      });
    }

    host.innerHTML = cards.map(renderCertCard).join('');
  }

  function renderCertCard(card) {
    const isEarned = card.state === 'earned';
    const mods = 'profile-cert-card--' + card.tierKey + (isEarned ? ' is-earned' : ' is-locked');

    const metaHtml = isEarned
      ? '<p class="profile-cert-card__meta">' +
          '<span><i class="fa-solid fa-calendar-check"></i> Issued ' + escapeHTML(formatDate(card.meta.date)) + '</span>' +
          '<span class="profile-cert-card__id">' + escapeHTML(card.meta.certId) + '</span>' +
        '</p>'
      : '';

    const actionHtml = isEarned
      ? '<a href="' + escapeHTML(card.href) + '" class="btn btn-leaf btn-sm">' +
          '<i class="fa-solid fa-award"></i> View Certificate' +
        '</a>'
      : '<a href="' + escapeHTML(card.href) + '" class="btn btn-outline btn-sm">' +
          '<i class="fa-solid fa-arrow-right"></i> ' +
          (card.kind === 'carbon' ? 'Open Calculator' : 'Start Challenge') +
        '</a>';

    return (
      '<article class="profile-cert-card ' + mods + '">' +
        '<div class="profile-cert-card__icon">' +
          '<i class="fa-solid ' + escapeHTML(card.icon) + '"></i>' +
        '</div>' +
        '<div class="profile-cert-card__body">' +
          '<span class="profile-cert-card__badge">' + escapeHTML(card.badgeLabel) + '</span>' +
          '<h3 class="profile-cert-card__title">' + escapeHTML(card.title) + '</h3>' +
          '<p class="profile-cert-card__sub">' + escapeHTML(card.subtitle) + '</p>' +
          metaHtml +
        '</div>' +
        '<div class="profile-cert-card__actions">' + actionHtml + '</div>' +
      '</article>'
    );
  }

  /* ================================================================== */
  /*  HISTORY                                                           */
  /* ================================================================== */
  const RATING_ICONS = {
    low: 'fa-circle-check',
    moderate: 'fa-circle-exclamation',
    high: 'fa-triangle-exclamation',
    'very-high': 'fa-circle-xmark'
  };
  const SAFE_RATINGS = new Set(['low', 'moderate', 'high', 'very-high']);

  function renderHistory(results) {
    const empty = $('profile-history-empty');
    const shell = $('profile-history-shell');
    const body  = $('profile-history-body');

    if (!results || !results.length) {
      if (empty) empty.classList.remove('hidden');
      if (shell) shell.classList.add('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');
    if (shell) shell.classList.remove('hidden');

    if (body) {
      body.innerHTML = results.map(function (row) {
        const ratingKey = SAFE_RATINGS.has(row.rating_key) ? row.rating_key : 'moderate';
        const ratingIcon = RATING_ICONS[ratingKey] || RATING_ICONS.moderate;
        const ratingLabel = escapeHTML(row.rating_label || '');
        const tons = escapeHTML(Number(row.total_tons).toFixed(2));
        const score = escapeHTML(row.eco_score != null ? row.eco_score : 0);
        const dateStr = escapeHTML(formatDate(row.created_at));

        return (
          '<tr>' +
            '<td>' + dateStr + '</td>' +
            '<td><strong>' + tons + ' t</strong></td>' +
            '<td>' + score + '/100</td>' +
            '<td>' +
              '<span class="rating-badge rating-' + ratingKey + '">' +
                '<i class="fa-solid ' + ratingIcon + '"></i> ' + ratingLabel +
              '</span>' +
            '</td>' +
          '</tr>'
        );
      }).join('');
    }
  }

  /* ================================================================== */
  /*  LOAD DATA                                                         */
  /* ================================================================== */
  async function loadData() {
    const user = currentUser();
    if (!user) return;

    const client = window.CT_SUPABASE_CLIENT;
    let results = [];
    let rankData = null;
    let challenge = { ok: false, days: [false,false,false,false,false,false,false] };

    if (client) {
      try {
        const { data: r, error: rErr } = await client
          .from('carbon_results')
          .select('id, total_tons, eco_score, rating_key, rating_label, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!rErr && Array.isArray(r)) results = r;
      } catch (e) {
        console.warn('[Carbotrack profile] results fetch failed', e);
      }

      try {
        const { data: rank, error: rankErr } = await client
          .from('leaderboard_view')
          .select('rank, total_tons, eco_score')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!rankErr) rankData = rank;
      } catch (e) {
        console.warn('[Carbotrack profile] rank fetch failed', e);
      }
    }

    if (window.CT_SB_CHALLENGE) {
      try {
        const loaded = await window.CT_SB_CHALLENGE.load(user.id);
        if (loaded && loaded.ok) challenge = loaded;
      } catch (e) {
        console.warn('[Carbotrack profile] challenge fetch failed', e);
      }
    }

    renderStats(results, rankData, challenge);
    renderCertificates(results, challenge);
    renderHistory(results);
  }

  /* ================================================================== */
  /*  EDIT NAME MODAL                                                   */
  /* ================================================================== */
  function wireEditModal() {
    const overlay = $('profile-edit-modal');
    const input   = $('profile-edit-input');
    const form    = $('profile-edit-form');
    const errEl   = $('profile-edit-error');
    const submit  = $('profile-edit-submit');
    const closeBtn = $('profile-edit-close');
    const openBtn  = $('profile-edit-name-btn');

    if (!overlay || !form) return;

    function open() {
      const sb = window.CT_SB_AUTH;
      const profile = sb.getProfile ? sb.getProfile() : null;
      const user = sb.getUser ? sb.getUser() : null;
      const meta = (user && user.user_metadata) || {};

      input.value =
        (profile && profile.full_name) ||
        meta.full_name ||
        meta.name ||
        '';

      errEl.hidden = true;
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function () { overlay.classList.add('is-open'); });
      document.body.style.overflow = 'hidden';

      setTimeout(function () { input.focus(); input.select(); }, 180);
    }

    function close() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      setTimeout(function () { overlay.hidden = true; }, 260);
    }

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) close();
    });

    overlay.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        overlay.querySelectorAll('button:not([disabled]), input:not([disabled])')
      ).filter(function (el) { return el.offsetParent !== null; });
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errEl.hidden = true;

      const newName = input.value.trim();
      const sb = window.CT_SB_AUTH;

      if (!sb || !sb.updateProfile) {
        errEl.textContent = 'Update not available. Please refresh.';
        errEl.hidden = false;
        return;
      }

      const original = submit.innerHTML;
      submit.disabled = true;
      submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Saving…</span>';

      const res = await sb.updateProfile({ full_name: newName });

      submit.disabled = false;
      submit.innerHTML = original;

      if (!res.ok) {
        errEl.textContent = res.error || 'Could not save.';
        errEl.hidden = false;
        return;
      }

      if (window.CT_TOAST) window.CT_TOAST.show('Display name updated.', 'success', 2400);
      renderHero();
      close();
    });
  }

  /* ================================================================== */
  /*  WIRING                                                            */
  /* ================================================================== */
  function wireActions() {
    const copyBtn = $('profile-id-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async function () {
        const fullId = copyBtn.dataset.fullId || '';
        if (!fullId) return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
            await navigator.clipboard.writeText(fullId);
          } else {
            const ta = document.createElement('textarea');
            ta.value = fullId;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          if (window.CT_TOAST) window.CT_TOAST.show('Account ID copied.', 'success', 2000);
        } catch (e) {
          if (window.CT_TOAST) window.CT_TOAST.show('Copy failed.', 'error', 2200);
        }
      });
    }

    const signoutBtn = $('profile-signout-btn');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', async function () {
        if (!window.confirm('Sign out of Carbotrack on this device?')) return;
        await window.CT_SB_AUTH.signOut();
        try {
          if (window.CT_STORAGE) {
            if (window.CT_STORAGE.clearChallenge) window.CT_STORAGE.clearChallenge();
            if (window.CT_STORAGE.clearResults)   window.CT_STORAGE.clearResults();
            if (window.CT_STORAGE.clearInputs)    window.CT_STORAGE.clearInputs();
          }
          try { localStorage.removeItem('carbotrack:last_submitted_sig'); } catch (e) {}
        } catch (e) { /* ignore */ }
        window.location.href = 'index.html';
      });
    }
  }

  /* ================================================================== */
  /*  BOOT                                                              */
  /* ================================================================== */
  async function init() {
    if (!$('profile-hero')) return;

    await waitForAuthReady(3000);

    if (!window.CT_AUTH || !window.CT_AUTH.isLoggedIn()) {
      /* gateCurrentPage in auth.js will replace the page */
      return;
    }

    if (window.CT_SB_AUTH && window.CT_SB_AUTH.waitForProfile) {
      try { await window.CT_SB_AUTH.waitForProfile(4000); } catch (e) { /* ignore */ }
    }

    renderHero();
    wireActions();
    wireEditModal();
    await loadData();

    /* React to auth state changes (e.g. sign-out from header dropdown) */
    if (window.CT_SB_AUTH && window.CT_SB_AUTH.onChange) {
      window.CT_SB_AUTH.onChange(function () {
        if (!window.CT_SB_AUTH.isLoggedIn()) {
          window.location.reload();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();