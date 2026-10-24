/* ==========================================================================
   Carbotrack — app.js
   Shared behaviour. Mobile drawer with focus trap + focusin guard.
   FIX: added profile.html + leaderboard.html icons to MOBILE_ICON_MAP.
   ========================================================================== */
(function () {
  'use strict';

  const TOAST_ICONS = {
    info: 'fa-circle-info', success: 'fa-check',
    warning: 'fa-triangle-exclamation', error: 'fa-xmark'
  };

  let toastContainer = null;

  function ensureToastContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  function showToast(message, type = 'success', duration = 3200) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const iconWrap = document.createElement('span');
    iconWrap.className = 'toast__icon';
    const icon = document.createElement('i');
    icon.className = `fa-solid ${TOAST_ICONS[type] || TOAST_ICONS.success}`;
    icon.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(icon);

    const messageEl = document.createElement('span');
    messageEl.className = 'toast__msg';
    messageEl.textContent = String(message == null ? '' : message);

    toast.append(iconWrap, messageEl);
    container.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 320);
    }, duration);
  }

  window.CT_TOAST = { show: showToast };

  /* ================================================================== */
  /*  MOBILE DRAWER                                                     */
  /* ================================================================== */
  const MOBILE_ICON_MAP = {
    'index.html':                 'fa-house',
    'index.html#problem-section': 'fa-circle-info',
    'calculator.html':            'fa-calculator',
    'results.html':               'fa-chart-pie',
    'challenge.html':             'fa-list-check',
    'leaderboard.html':           'fa-ranking-star',
    'methodology.html':           'fa-flask',
    'about.html':                 'fa-graduation-cap',
    'profile.html':               'fa-user'
  };

  let toggleEl    = null;
  let menuEl      = null;
  let backdropEl  = null;
  let lastFocused = null;

  function log() {
    if (window.location.search.indexOf('debug=1') !== -1) {
      console.log('[CT_NAV]', ...arguments);
    }
  }

  function isOpen() { return !!(menuEl && menuEl.classList.contains('is-open')); }

  function getFocusable() {
    if (!menuEl) return [];
    return Array.from(menuEl.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function trapFocus(e) {
    if (e.key !== 'Tab' || !isOpen()) return;
    const items = getFocusable();
    if (!items.length) return;
    const first = items[0];
    const last  = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !menuEl.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !menuEl.contains(document.activeElement))) {
      e.preventDefault(); first.focus();
    }
  }

  function openMenu() {
    if (!menuEl) return;
    lastFocused = document.activeElement;
    menuEl.classList.remove('hidden');
    menuEl.classList.add('is-open');
    menuEl.removeAttribute('aria-hidden');
    if (backdropEl) backdropEl.classList.add('is-open');
    document.body.classList.add('is-menu-open');
    if (toggleEl) {
      toggleEl.setAttribute('aria-expanded', 'true');
      toggleEl.innerHTML = '<i class="fa-solid fa-xmark text-xl"></i>';
    }
    window.setTimeout(() => {
      const items = getFocusable();
      if (items.length) items[0].focus();
    }, 80);
    log('opened');
  }

  function closeMenu() {
    if (!menuEl) return;
    menuEl.classList.remove('is-open');
    menuEl.setAttribute('aria-hidden', 'true');
    if (backdropEl) backdropEl.classList.remove('is-open');
    document.body.classList.remove('is-menu-open');
    if (toggleEl) {
      toggleEl.setAttribute('aria-expanded', 'false');
      toggleEl.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
    }
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
    log('closed');
  }

  function toggleMenu() { if (isOpen()) closeMenu(); else openMenu(); }

  function injectHead() {
    if (!menuEl || menuEl.querySelector('.mobile-menu__head')) return;

    const head = document.createElement('div');
    head.className = 'mobile-menu__head';
    head.innerHTML =
      `<a href="index.html" class="brand">
         <span class="brand__mark"><i class="fa-solid fa-leaf"></i></span>
         <span>
           <span class="brand__name">Carbotrack</span>
           <span class="brand__tag">Understand Your Impact</span>
         </span>
       </a>
       <button type="button" class="mobile-menu__close" aria-label="Close menu">
         <i class="fa-solid fa-xmark"></i>
       </button>`;
    menuEl.insertBefore(head, menuEl.firstChild);
    head.querySelector('.mobile-menu__close').addEventListener('click', function (e) {
      e.preventDefault(); closeMenu();
    });
  }

  function decorateLinks() {
    if (!menuEl) return;
    const links = menuEl.querySelectorAll(':scope > a');
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (link.dataset.ctDecorated) continue;
      link.dataset.ctDecorated = '1';
      if (link.querySelector('i')) continue;
      const href = link.getAttribute('href') || '';
      const raw  = (link.textContent || '').trim();
      const icon = MOBILE_ICON_MAP[href] || 'fa-angle-right';
      link.innerHTML =
        `<i class="fa-solid ${icon} mobile-menu__link-icon"></i>
         <span class="mobile-menu__link-text">${raw}</span>`;
    }
  }

  function highlightActiveLink() {
    if (!menuEl) return;
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const links = menuEl.querySelectorAll(':scope > a');
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const href = link.getAttribute('href') || '';
      if (href.indexOf('#') !== -1) continue;
      const target = href.split('?')[0].split('/').pop();
      if (target === path) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    }
  }

  function initMobileNav() {
    toggleEl = document.getElementById('mobile-menu-btn');
    menuEl   = document.getElementById('mobile-menu');
    if (!toggleEl || !menuEl) return;

    /* Reparent drawer to <body> (breaks out of header stacking context). */
    if (menuEl.parentNode !== document.body) {
      document.body.appendChild(menuEl);
    }
    menuEl.classList.remove('hidden');
    menuEl.setAttribute('aria-hidden', 'true');

    if (!backdropEl) {
      backdropEl = document.createElement('div');
      backdropEl.className = 'nav-backdrop';
      backdropEl.id = 'nav-backdrop';
      backdropEl.setAttribute('aria-hidden', 'true');
      backdropEl.addEventListener('click', closeMenu);
      document.body.appendChild(backdropEl);
    }

    injectHead();
    decorateLinks();
    highlightActiveLink();

    toggleEl.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    menuEl.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { closeMenu(); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        e.preventDefault();
        closeMenu();
      }
    });

    menuEl.addEventListener('keydown', trapFocus);

    /* focusin guard — keeps focus from escaping the drawer even if
       Tab is pressed while focus is already outside (belt & suspenders). */
    document.addEventListener('focusin', function (e) {
      if (!isOpen()) return;
      if (menuEl.contains(e.target)) return;
      if (backdropEl && backdropEl.contains(e.target)) return;
      const items = getFocusable();
      if (items.length) items[0].focus();
    });

    window.CT_NAV = { open: openMenu, close: closeMenu, toggle: toggleMenu, isOpen };
  }

  function initHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;
    const onScroll = function () {
      if (window.scrollY > 12) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initActiveNav() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const links = document.querySelectorAll('[data-nav-link]');
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const href = link.getAttribute('href') || '';
      const target = href.split('#')[0] || 'index.html';
      if (target === path) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    }
  }

  function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        const id = link.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function initFooterYear() {
    document.querySelectorAll('[data-current-year]').forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    initHeaderScroll();
    initActiveNav();
    initSmoothAnchors();
    initFooterYear();
  });
})();