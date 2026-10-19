/* ==========================================================================
   Carbotrack — auth.js
   Local accounts. Simple collapsible account menu + mobile accordion.
   ========================================================================== */
window.CT_AUTH = (function () {
  'use strict';

  const S = window.CT_STORAGE;
  const $ = (id) => document.getElementById(id);

  let modalEl = null;
  let mode = 'login';
  let pending = null;
  let busy = false;

  /* ================================================================== */
  /*  CRYPTO                                                            */
  /* ================================================================== */
  function randomSalt() {
    const a = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(a);
    } else {
      for (let i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  async function hashPassword(password, salt) {
    const data = salt + '|carbotrack|' + password;

    if (window.crypto && window.crypto.subtle && window.isSecureContext) {
      try {
        const buf = new TextEncoder().encode(data);
        const dig = await window.crypto.subtle.digest('SHA-256', buf);
        return 'sha256$' + Array.from(new Uint8Array(dig), b =>
          b.toString(16).padStart(2, '0')).join('');
      } catch (e) { /* ignore */ }
    }

    let out = '';
    let seed = data;
    for (let i = 0; i < 4; i++) {
      seed = fnv1a(seed + '|' + i + '|' + data);
      out += seed;
    }
    return 'fnv$' + out;
  }

  const NAME_RE = /^[A-Za-z][A-Za-z .'\-]{1,39}$/;
  const USER_RE = /^[a-z0-9_]{3,20}$/;

  function validate(f) {
    if (!f.name || !NAME_RE.test(f.name.trim())) {
      return { ok: false, error: 'Full name must be 2–40 letters (spaces, dots and hyphens allowed).' };
    }
    if (!f.username || !USER_RE.test(f.username)) {
      return { ok: false, error: 'Username must be 3–20 characters — lowercase letters, numbers or underscore.' };
    }
    if (!f.password || f.password.length < 6) {
      return { ok: false, error: 'Password must be at least 6 characters.' };
    }
    if (f.password.length > 64) {
      return { ok: false, error: 'Password is too long (max 64 characters).' };
    }
    return { ok: true };
  }

  /* ================================================================== */
  /*  USER STORE                                                        */
  /* ================================================================== */
  function allUsers() { return S.getUsers() || {}; }
  function persist(u) { S.saveUsers(u); }

  function publicUser(u) {
    if (!u) return null;
    return {
      name: u.name,
      username: u.username,
      createdAt: u.createdAt,
      initials: (u.name || '?')
        .split(/\s+/).filter(Boolean).slice(0, 2)
        .map(w => w[0].toUpperCase()).join('')
    };
  }

  async function register(raw) {
    const name = (raw.name || '').trim().replace(/\s+/g, ' ');
    const username = (raw.username || '').trim().toLowerCase();
    const password = raw.password || '';

    const v = validate({ name, username, password });
    if (!v.ok) return v;

    const users = allUsers();
    if (users[username]) {
      return { ok: false, error: 'That username is already taken. Try another.' };
    }

    const salt = randomSalt();
    const passHash = await hashPassword(password, salt);

    const user = {
      name, username, salt, passHash,
      createdAt: new Date().toISOString()
    };

    users[username] = user;
    persist(users);
    S.saveSession({ username, loginAt: new Date().toISOString() });

    return { ok: true, user: publicUser(user) };
  }

  async function login(username, password) {
    username = (username || '').trim().toLowerCase();

    if (!username || !password) {
      return { ok: false, error: 'Enter your username and password.' };
    }

    const user = allUsers()[username];
    if (!user) {
      return { ok: false, error: 'No account found with that username.' };
    }

    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passHash) {
      return { ok: false, error: 'Incorrect password. Please try again.' };
    }

    S.saveSession({ username, loginAt: new Date().toISOString() });
    return { ok: true, user: publicUser(user) };
  }

  function logout() {
    S.clearSession();
    renderHeaderButton();
    renderMobileLinks();
    if (window.CT_TOAST) window.CT_TOAST.show('Signed out.', 'info', 2000);
  }

  function currentUser() {
    const session = S.getSession();
    if (!session || !session.username) return null;
    return publicUser(allUsers()[session.username]);
  }

  function isLoggedIn() { return !!currentUser(); }

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
        <p class="auth-intent" id="auth-intent">Members unlock the challenge tracker and certificate.</p>

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
                     placeholder="lowercase, no spaces" spellcheck="false">
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
          Accounts are stored <strong>only in this browser</strong>. No email, no phone, no tracking.
        </p>
      </div>
    `;

    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
    $('auth-close').addEventListener('click', closeModal);

    modalEl.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => setMode(tab.dataset.tab));
    });

    $('auth-eye').addEventListener('click', () => {
      const input = $('auth-password');
      const icon = $('auth-eye').querySelector('i');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      $('auth-eye').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });

    $('auth-form').addEventListener('submit', onSubmit);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeModal();
    });

    return modalEl;
  }

  function setMode(next) {
    mode = next === 'register' ? 'register' : 'login';

    modalEl.querySelectorAll('.auth-tab').forEach(t => {
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
        ? `Sign in to unlock ${pending.feature}. The calculator and results dashboard stay free.`
        : 'Members unlock the challenge tracker and certificate.';
    }

    modalEl.hidden = false;
    requestAnimationFrame(() => modalEl.classList.add('is-open'));
    document.body.style.overflow = 'hidden';

    window.setTimeout(() => {
      const focusId = mode === 'register' ? 'auth-name' : 'auth-username';
      const el = $(focusId);
      if (el) el.focus();
    }, 220);
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(() => { modalEl.hidden = true; }, 260);
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

    const name     = $('auth-name') ? $('auth-name').value : '';
    const username = $('auth-username').value;
    const password = $('auth-password').value;

    busy = true;
    hideError();

    const btn = $('auth-submit');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Please wait…</span>';

    let result;
    try {
      result = mode === 'register'
        ? await register({ name, username, password })
        : await login(username, password);
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
    renderHeaderButton();
    renderMobileLinks();

    if (window.CT_TOAST) {
      window.CT_TOAST.show(
        wasRegister
          ? `Welcome, ${result.user.name.split(' ')[0]}!`
          : `Signed in as ${result.user.name.split(' ')[0]}.`,
        'success', 2600
      );
    }

    if (redirect) {
      window.setTimeout(() => { window.location.href = redirect; }, 550);
    } else if (onSuccess) {
      onSuccess(result.user);
    } else {
      window.setTimeout(() => window.location.reload(), 500);
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
      wrap.innerHTML = `
        <button type="button" class="account-btn" id="account-toggle"
                aria-haspopup="true" aria-expanded="false">
          <span class="account-avatar">${user.initials}</span>
          <span class="account-name">${user.name.split(' ')[0]}</span>
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

      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const opening = !menu.classList.contains('is-open');
        menu.classList.toggle('is-open', opening);
        toggle.setAttribute('aria-expanded', String(opening));
        caret.style.transform = opening ? 'rotate(180deg)' : '';
      });

      /* Outside click */
      document.addEventListener('click', (e) => {
        if (!menu.classList.contains('is-open')) return;
        if (wrap.contains(e.target)) return;
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        caret.style.transform = '';
      });

      /* ESC */
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!menu.classList.contains('is-open')) return;
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        caret.style.transform = '';
        toggle.focus();
      });

      /* Links close menu */
      menu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          menu.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          caret.style.transform = '';
        });
      });

      /* Logout */
      wrap.querySelector('#account-logout').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        caret.style.transform = '';
        logout();
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
        .addEventListener('click', () => openModal('login'));
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

      head.addEventListener('click', () => {
        const opening = !block.classList.contains('is-open');
        block.classList.toggle('is-open', opening);
        head.setAttribute('aria-expanded', String(opening));
      });

      block.querySelector('#mobile-logout').addEventListener('click', () => {
        logout();
        if (window.CT_NAV) window.CT_NAV.close();
      });

    } else {
      block.innerHTML = `
        <button type="button" class="btn btn-primary btn-block" id="mobile-signin">
          <i class="fa-solid fa-user"></i> Sign In / Create Account
        </button>
      `;
      insertBeforeActions(menu, block);

      block.querySelector('#mobile-signin').addEventListener('click', () => {
        if (window.CT_NAV) window.CT_NAV.close();
        openModal('login');
      });
    }

    /* Every link inside the account block closes the drawer */
    block.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
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
    'certificate.html': { feature: 'your certificate',        icon: 'fa-certificate' }
  };

  function bindGatedLinks() {
    const here = window.location.pathname.split('/').pop() || 'index.html';

    document.querySelectorAll('a[href]').forEach(link => {
      const raw = link.getAttribute('href') || '';
      const target = raw.split('#')[0].split('?')[0];
      if (!GATED_PAGES[target] || target === here) return;
      if (link.dataset.authBound) return;
      link.dataset.authBound = '1';

      link.addEventListener('click', (e) => {
        if (isLoggedIn()) return;
        e.preventDefault();
        request({ feature: GATED_PAGES[target].feature, redirect: target });
      });
    });
  }

  function gateCurrentPage() {
    const here = window.location.pathname.split('/').pop() || 'index.html';
    const config = GATED_PAGES[here];
    if (!config || isLoggedIn()) return false;

    if (here === 'certificate.html' && window.location.hash.indexOf('#s=') === 0) return false;

    const main = document.querySelector('main');
    if (!main) return false;

    main.innerHTML = `
      <div class="section section--white" style="min-height:70vh;display:grid;place-items:center;">
        <div class="container" style="max-width:36rem;">
          <div class="lock-panel">
            <div class="lock-panel__icon"><i class="fa-solid fa-${config.icon}"></i></div>
            <span class="eyebrow">Members Only</span>
            <h2 class="lock-panel__title">Sign in to open ${config.feature}</h2>
            <p class="lock-panel__text">
              The <strong>calculator</strong> and <strong>results dashboard</strong> are completely
              free — no account needed. The challenge tracker and printable certificate are part
              of the member area.
            </p>

            <div class="lock-panel__actions">
              <button type="button" class="btn btn-primary btn-lg" id="lock-signin">
                <i class="fa-solid fa-right-to-bracket"></i>
                <span>Sign In / Create Account</span>
              </button>
              <a href="calculator.html" class="btn btn-outline btn-lg">
                <i class="fa-solid fa-calculator"></i>
                <span>Back to Calculator</span>
              </a>
            </div>

            <ul class="lock-perks">
              <li><i class="fa-solid fa-check"></i> Save your name on the certificate</li>
              <li><i class="fa-solid fa-check"></i> Track your 7-day challenge streaks</li>
              <li><i class="fa-solid fa-check"></i> Share your result with a unique link</li>
            </ul>

            <p class="lock-panel__note">
              <i class="fa-solid fa-shield-halved"></i>
              Only a name, username and password — stored in this browser.
            </p>
          </div>
        </div>
      </div>
    `;

    const btn = document.getElementById('lock-signin');
    if (btn) btn.addEventListener('click', () => openModal('register'));

    if (window.CT_TOAST) {
      window.CT_TOAST.show('Please sign in to continue.', 'info', 2600);
    }

    return true;
  }

  /* ================================================================== */
  /*  BOOT                                                              */
  /* ================================================================== */
  function init() {
    ensureModal();
    renderHeaderButton();
    renderMobileLinks();
    bindGatedLinks();
    gateCurrentPage();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    register, login, logout,
    currentUser, isLoggedIn,
    request, openModal, closeModal,
    gateCurrentPage
  };
})();