/* ==========================================================================
   Carbotrack — app.js
   Shared behaviour loaded on EVERY page.
   ========================================================================== */
(function () {
  'use strict';

  const TOAST_ICONS = {
    info:    'fa-circle-info',
    success: 'fa-check',
    warning: 'fa-triangle-exclamation',
    error:   'fa-xmark'
  };

  let toastContainer = null;

  function ensureToastContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'false');
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  function showToast(message, type = 'success', duration = 3200) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `
      <span class="toast__icon">
        <i class="fa-solid ${TOAST_ICONS[type] || TOAST_ICONS.success}"></i>
      </span>
      <span class="toast__msg">${message}</span>
    `;
    container.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 320);
    }, duration);
  }

  window.CT_TOAST = { show: showToast };

  function initMobileNav() {
    const btn  = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
      const expanded = !menu.classList.contains('hidden');
      btn.setAttribute('aria-expanded', String(expanded));
      btn.innerHTML = expanded
        ? '<i class="fa-solid fa-xmark text-xl"></i>'
        : '<i class="fa-solid fa-bars text-xl"></i>';
    });

    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
      });
    });
  }

  function initHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;

    const onScroll = () => {
      if (window.scrollY > 12) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initActiveNav() {
    const path = window.location.pathname.split('/').pop() || 'index.html';

    document.querySelectorAll('[data-nav-link]').forEach(link => {
      const href = link.getAttribute('href') || '';
      const target = href.split('#')[0] || 'index.html';
      if (target === path) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
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
    document.querySelectorAll('[data-current-year]').forEach(el => {
      el.textContent = new Date().getFullYear();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initHeaderScroll();
    initActiveNav();
    initSmoothAnchors();
    initFooterYear();
  });
})();