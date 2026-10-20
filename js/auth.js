/* ==========================================================================
   Carbotrack — auth.js
   Username + password UI. Full name resolution + logout cleanup.
   ========================================================================== */
window.CT_AUTH = (function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const sb = window.CT_SB_AUTH;

  let modalEl = null;
  let mode = 'login';
  let pending = null;
  let busy = false;

  /* ================================================================== */
  /*  HELPERS                                                           */
  /* ================================================================== */
  function resolveDisplayName(profile, meta, username, email) {
    if (profile && profile.full_name && profile.full_name.trim()) {
      return profile.full_name.trim();
    }
    if (meta && (meta.full_name || meta.name || meta.display_name)) {
      const m = meta.full_name || meta.name || meta.display_name;
      if (String(m).trim()) return String(m).trim();
    }
    if (username && String(username).trim()) return String(username).trim();
    if (email) return email.split('@')[0];
    return 'Friend';
  }

  function resolveInitials(name, profile) {
    if (profile && profile.avatar_initials) return profile.avatar_initials;
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
  }

  function publicUser() {
    if (!sb || !sb.isLoggedIn()) return null;
    const u = sb.getUser();
    const p = sb.getProfile();
    const meta = (u && u.user_metadata) || {};

    const username = (p && p.username) || meta.username ||
      (u.email ? u.email.split('@')[0] : '');
    const fullName = resolveDisplayName(p, meta, username, u.email ? u.email : '');

    return {
      id: u.id,
      email: u.email,
      name: fullName,
      username: username,
      initials: resolveInitials(fullName, p)
    };
  }

  function currentUser() { return publicUser(); }
  function isLoggedIn()  { return !!(sb && sb.isLoggedIn()); }

  /* ================================================================== */
  /*  CLEANUP — clear user-specific local data on logout                */
  /* ================================================================== */
  function clearUserLocalData() {
    try {
      if (window.CT_STORAGE && window.CT_STORAGE.clearChallenge) {
        window.CT_STORAGE.clearChallenge();
      }
    } catch (e) { /* ignore */ }
  }

  /* ================================================================== */
  /*  MODAL                                                             */
  /* ================================================================== */
  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.className = 'auth-overlay';
    modalEl.id = 'auth-overlay';
    modalEl.hidden = true;

    modalEl.innerHTML = `
      <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" class="auth-close" id="auth-close" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="auth-brand">
          <span class="auth-brand__mark"><i class="fa-solid fa-leaf"></i></span>
          <span>Carbotrack</span>
        </div>

        <h3 class="auth-title" id="auth-title">Welcome back</h3>
        <p class="auth-intent" id="auth-intent">Sign in to save scores and unlock the leaderboard.</p>

        <div class="auth-tabs" role="tablist">
          <button type="button" class="auth-tab is-active" data-tab="login" role="tab">
            <i class="fa-solid fa-right-to-bracket"></i> Sign In
          </button>
          <button type="button" class="auth-tab" data-tab="register" role="tab">
            <i class="fa-solid fa-user-plus"></i> Create Account
          </button>
        </div>

        <form class="auth-form" id="auth-form" novalidate>
          <label class="auth-field" id="auth-name-field" hidden>
            <span>Full Name</span>
            <div class="auth-input-wrap">
              <i class="fa-solid fa-id-card"></i>
              <input id="auth-name" type="text" autocomplete="name" placeholder="e.g. Ananya Sharma">
            </div>
          </label>

          <label class="auth-field">
            <span>Username</span>
            <div class="auth-input-wrap">
              <i class="fa-solid fa-at"></i>
              <input id="auth-username" type="text" autocomplete="username"
                     placeholder="lowercase, 3–20 chars" spellcheck="false" autocapitalize="none">
            </div>
          </label>

          <label class="auth-field">
            <span>Password</span>
            <div class="auth-input-wrap">
              <i class="fa-solid fa-lock"></i>
              <input id="auth-password" type="password" autocomplete="current-password" placeholder="min 6 characters">
              <button type="button" class="auth-eye" id="auth-eye" aria-label="Show password">
                <i class="fa-solid fa-eye"></i>
              </button>
            </div>
          </label>

          <p class="auth-error" id="auth-error" hidden></p>

          <button type="submit" class="btn btn-primary btn-block" id="auth-submit">
            <i class="fa-solid fa-right-to-bracket"></i>
            <span>Sign In</span>
          </button>
        </form>

        <p class="auth-note">
          <i class="fa-solid fa-shield-halved"></i>
          No email needed — just username &amp; password. Accounts secured by Supabase.
        </p>
      </div>
    `;

    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
    $('auth-close').addEventListener('click', closeModal);

    modalEl.querySelectorAll('.auth-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { setMode(tab.dataset.tab); });
    });

    $('auth-eye').addEventListener('click', function () {
      const input = $('auth-password');
      const icon = $('auth-eye').querySelector('i');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      $('auth-eye').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });

    $('auth-username').addEventListener('input', function (e) {
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      e.target.value = e.target.value.toLowerCase().replace(/\s+/g, '');
      try { e.target.setSelectionRange(start, end); } catch (err) { /* ignore */ }
    });

    $('auth-form').addEventListener('submit', onSubmit);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeModal();
    });

    return modalEl;
  }

  function setMode(next) {
    mode = next === 'register' ? 'register' : 'login';

    modalEl.querySelectorAll('.auth-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === mode);
    });

    const nameField = $('auth-name-field');
    if (nameField) nameField.hidden = mode !== 'register';

    const title = $('auth-title');
    const submit = $('auth-submit');
    const pw = $('auth-password');

    if (mode === 'register') {
      title.textContent = 'Create your account';
      submit.innerHTML = '<i class="fa-solid fa-user-plus"></i><span>Create Account</span>';
      pw.setAttribute('autocomplete', 'new-password');
    } else {
      title.textContent = 'Welcome back';
      submit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>Sign In</span>';
      pw.setAttribute('autocomplete', 'current-password');
    }

    hideError();
  }

  function openModal(initialMode, opts) {
    ensureModal();
    pending = opts || null;
    setMode(initialMode || 'login');

    const intent = $('auth-intent');
    if (intent) {
      intent.textContent = pending && pending.feature
        ? 'Sign in to unlock ' + pending.feature + '.'
        : 'Sign in to save scores and unlock the leaderboard.';
    }

    modalEl.hidden = false;
    requestAnimationFrame(function () { modalEl.classList.add('is-open'); });
    document.body.style.overflow = 'hidden';

    window.setTimeout(function () {
      const focusId = mode === 'register' ? 'auth-name' : 'auth-username';
      const el = $(focusId);
      if (el) el.focus();
    }, 220);
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(function () { modalEl.hidden = true; }, 260);
    pending = null;
  }

  function showError(msg) {
    const el = $('auth-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function hideError() {
    const el = $('auth-error');
    if (el) el.hidden = true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const name     = $('auth-name') ? $('auth-name').value.trim() : '';
    const username = $('auth-username').value.trim().toLowerCase();
    const password = $('auth-password').value;

    busy = true;
    hideError();

    const btn = $('auth-submit');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Please wait…</span>';

    let result;
    try {
      if (mode === 'register') {
        result = await sb.signUp(username, password, name);
      } else {
        result = await sb.signIn(username, password);
      }
    } catch (err) {
      result = { ok: false, error: 'Something went wrong. Please try again.' };
      console.error('[Carbotrack auth]', err);
    }

    btn.disabled = false;
    btn.innerHTML = original;
    busy = false;

    if (!result.ok) { showError(result.error); return; }

    const redirect = pending && pending.redirect;
    const onSuccess = pending && pending.onSuccess;
    const wasRegister = mode === 'register';

    closeModal();

    if (sb && sb.waitForProfile) {
      try { await sb.waitForProfile(2000); } catch (err) { /* ignore */ }
    }

    renderHeaderButton();
    renderMobileLinks();

    const user = publicUser();

    if (window.CT_TOAST) {
      window.CT_TOAST.show(
        wasRegister
          ? 'Welcome, ' + (user ? user.name.split(' ')[0] : 'friend') + '!'
          : 'Signed in successfully.',
        'success', 2600
      );
    }

    if (redirect) {
      window.setTimeout(function () { window.location.href = redirect; }, 550);
    } else if (onSuccess) {
      onSuccess(publicUser());
    } else {
      window.setTimeout(function () { window.location.reload(); }, 550);
    }
  }

  /* ================================================================== */
  /*  HEADER ACCOUNT DROPDOWN                                           */
  /* ================================================================== */
  function renderHeaderButton() {
    const host = document.querySelector('.header-actions');
    if (!host) return;

    const existing = host.querySelector('.account-wrap');
    if (existing) existing.remove();

    const user = currentUser();
    const wrap = document.createElement('div');
    wrap.className = 'account-wrap';

    if (user) {
      const first = user.name.split(' ')[0];
      wrap.innerHTML = `
        <button type="button" class="account-btn" id="account-toggle"
                aria-haspopup="true" aria-expanded="false">
          <span class="account-avatar">${user.initials}</span>
          <span class="account-name">${first}</span>
          <i class="fa-solid fa-chevron-down account-caret"></i>
        </button>
        <div class="account-menu" id="account-menu">
          <div class="account-menu__head">
            <span class="account-avatar account-avatar--lg">${user.initials}</span>
            <div>
              <strong>${user.name}</strong>
              <small>@${user.username}</small>
            </div>
          </div>
          <a href="leaderboard.html"><i class="fa-solid fa-ranking-star"></i> Leaderboard</a>
          <a href="certificate.html"><i class="fa-solid fa-certificate"></i> My Certificate</a>
          <a href="challenge.html"><i class="fa-solid fa-list-check"></i> 7-Day Challenge</a>
          <a href="results.html"><i class="fa-solid fa-chart-pie"></i> My Results</a>
          <button type="button" id="account-logout">
            <i class="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      `;
      host.appendChild(wrap);

      const toggle = wrap.querySelector('#account-toggle');
      const menu   = wrap.querySelector('#account-menu');
      const caret  = toggle.querySelector('.account-caret');

      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const opening = !menu.classList.contains('is-open');
        menu.classList.toggle('is-open', opening);
        toggle.setAttribute('aria-expanded', String(opening));
        caret.style.transform = opening ? 'rotate(180deg)' : '';
      });

      document.addEventListener('click', function (e) {
        if (!menu.classList.contains('is-open')) return;
        if (wrap.contains(e.target)) return;
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        caret.style.transform = '';
      });

      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (!menu.classList.contains('is-open')) return;
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        caret.style.transform = '';
        toggle.focus();
      });

      menu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          menu.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          caret.style.transform = '';
        });
      });

      wrap.querySelector('#account-logout').addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        caret.style.transform = '';
        await sb.signOut();
        clearUserLocalData();
        if (window.CT_TOAST) window.CT_TOAST.show('Signed out.', 'info', 2000);
        renderHeaderButton();
        renderMobileLinks();
      });

    } else {
      wrap.innerHTML = `
        <button type="button" class="account-btn account-btn--ghost" id="account-signin">
          <i class="fa-solid fa-user"></i>
          <span>Sign In</span>
        </button>
      `;
      host.appendChild(wrap);
      wrap.querySelector('#account-signin')
        .addEventListener('click', function () { openModal('login'); });
    }
  }

  /* ================================================================== */
  /*  MOBILE DRAWER ACCOUNT PANEL                                       */
  /* ================================================================== */
  function renderMobileLinks() {
    const menu = document.getElementById('mobile-menu');
    if (!menu) return;

    const old = menu.querySelector('.mobile-account');
    if (old) old.remove();

    const user = currentUser();
    const block = document.createElement('div');
    block.className = 'mobile-account';

    if (user) {
      block.innerHTML = `
        <button type="button" class="mobile-account__head" aria-expanded="false">
          <span class="account-avatar">${user.initials}</span>
          <span class="mobile-account__meta">
            <strong>${user.name}</strong>
            <small>@${user.username}</small>
          </span>
          <i class="fa-solid fa-chevron-down mobile-account__chevron"></i>
        </button>
        <div class="mobile-account__body">
          <a href="leaderboard.html"><i class="fa-solid fa-ranking-star"></i> Leaderboard</a>
          <a href="certificate.html"><i class="fa-solid fa-certificate"></i> My Certificate</a>
          <a href="challenge.html"><i class="fa-solid fa-list-check"></i> 7-Day Challenge</a>
          <a href="results.html"><i class="fa-solid fa-chart-pie"></i> My Results</a>
          <button type="button" id="mobile-logout">
            <i class="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      `;
      insertBeforeActions(menu, block);

      const head = block.querySelector('.mobile-account__head');
      head.addEventListener('click', function () {
        const opening = !block.classList.contains('is-open');
        block.classList.toggle('is-open', opening);
        head.setAttribute('aria-expanded', String(opening));
      });

      block.querySelector('#mobile-logout').addEventListener('click', async function () {
        await sb.signOut();
        clearUserLocalData();
        if (window.CT_NAV) window.CT_NAV.close();
        if (window.CT_TOAST) window.CT_TOAST.show('Signed out.', 'info', 2000);
        renderHeaderButton();
        renderMobileLinks();
      });

    } else {
      block.innerHTML = `
        <button type="button" class="btn btn-primary btn-block" id="mobile-signin">
          <i class="fa-solid fa-user"></i> Sign In / Create Account
        </button>
      `;
      insertBeforeActions(menu, block);

      block.querySelector('#mobile-signin').addEventListener('click', function () {
        if (window.CT_NAV) window.CT_NAV.close();
        openModal('login');
      });
    }

    block.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        if (window.CT_NAV) window.CT_NAV.close();
      });
    });
  }

  function insertBeforeActions(menu, block) {
    const actions = menu.querySelector('.mobile-menu__actions');
    if (actions) menu.insertBefore(block, actions);
    else menu.appendChild(block);
  }

  /* ================================================================== */
  /*  GATING                                                            */
  /* ================================================================== */
  const GATED_PAGES = {
    'challenge.html':   { feature: 'the 7-Day Eco Challenge', icon: 'fa-list-check' },
    'certificate.html': { feature: 'your certificate',        icon: 'fa-certificate' },
    'leaderboard.html': { feature: 'the leaderboard',         icon: 'fa-ranking-star' }
  };

  function bindGatedLinks() {
    const here = window.location.pathname.split('/').pop() || 'index.html';

    document.querySelectorAll('a[href]').forEach(function (link) {
      const raw = link.getAttribute('href') || '';
      const target = raw.split('#')[0].split('?')[0];
      if (!GATED_PAGES[target] || target === here) return;
      if (link.dataset.authBound) return;
      link.dataset.authBound = '1';

      link.addEventListener('click', function (e) {
        if (isLoggedIn()) return;
        e.preventDefault();
        request({ feature: GATED_PAGES[target].feature, redirect: target });
      });
    });
  }

  function request(opts) {
    opts = opts || {};
    if (isLoggedIn()) {
      if (opts.redirect) window.location.href = opts.redirect;
      else if (opts.onSuccess) opts.onSuccess(currentUser());
      return true;
    }
    openModal('login', opts);
    return false;
  }

  function gateCurrentPage() {
    const here = window.location.pathname.split('/').pop() || 'index.html';
    const config = GATED_PAGES[here];
    if (!config || isLoggedIn()) return false;

    if (here === 'certificate.html' && window.location.hash.indexOf('#s=') === 0) return false;

    const main = document.querySelector('main');
    if (!main) return false;

    main.innerHTML = '<div class="section section--white" style="min-height:70vh;display:grid;place-items:center;"><div class="container" style="max-width:36rem;"><div class="lock-panel"><div class="lock-panel__icon"><i class="fa-solid fa-' + config.icon + '"></i></div><span class="eyebrow">Members Only</span><h2 class="lock-panel__title">Sign in to open ' + config.feature + '</h2><p class="lock-panel__text">The <strong>calculator</strong> and <strong>results dashboard</strong> are completely free — no account needed. The leaderboard, challenge tracker and printable certificate are part of the member area.</p><div class="lock-panel__actions"><button type="button" class="btn btn-primary btn-lg" id="lock-signin"><i class="fa-solid fa-right-to-bracket"></i><span>Sign In / Create Account</span></button><a href="calculator.html" class="btn btn-outline btn-lg"><i class="fa-solid fa-calculator"></i><span>Back to Calculator</span></a></div><ul class="lock-perks"><li><i class="fa-solid fa-check"></i> No email needed — username &amp; password only</li><li><i class="fa-solid fa-check"></i> Save your scores to the global leaderboard</li><li><i class="fa-solid fa-check"></i> Sync challenge progress across all devices</li><li><i class="fa-solid fa-check"></i> Generate a printable certificate</li></ul></div></div></div>';

    const btn = document.getElementById('lock-signin');
    if (btn) btn.addEventListener('click', function () { openModal('register'); });

    if (window.CT_TOAST) {
      window.CT_TOAST.show('Please sign in to continue.', 'info', 2600);
    }

    return true;
  }

  /* ================================================================== */
  /*  BOOT                                                              */
  /* ================================================================== */
  async function init() {
    if (!sb || !sb.init) return;

    await sb.init();

    if (sb.isLoggedIn() && !sb.getProfile() && sb.waitForProfile) {
      sb.waitForProfile(3000).then(function () {
        renderHeaderButton();
        renderMobileLinks();
      });
    }

    sb.onChange(function () {
      renderHeaderButton();
      renderMobileLinks();
    });

    renderHeaderButton();
    renderMobileLinks();
    bindGatedLinks();
    gateCurrentPage();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    currentUser: currentUser,
    isLoggedIn: isLoggedIn,
    request: request,
    openModal: openModal,
    closeModal: closeModal,
    gateCurrentPage: gateCurrentPage
  };
})();