/* ==========================================================================
   Carbotrack — app.js
   Shared behaviour loaded on EVERY page:
     • mobile navigation
     • header scroll elevation
     • active nav link highlighting
     • "Quick Demo" handoff (URL-param based — works on file://)
     • footer year stamp
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- Mobile navigation ------------------------------- */
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

  /* ---------------- Header elevation on scroll ---------------------- */
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

  /* ---------------- Active nav link --------------------------------- */
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

  /* ---------------- Quick Demo handoff ------------------------------ */
  function initQuickDemo() {
    document.querySelectorAll('[data-action="quick-demo"]').forEach(btn => {
      btn.addEventListener('click', () => {

        /* Case 1 — already on the calculator page: fill it in-place. */
        if (window.CT_CALCULATOR && document.getElementById('footprint-form')) {
          window.CT_CALCULATOR.fillDemo();
          return;
        }

        /* Case 2 — any other page: redirect with a URL param.
           URL params survive file://, http://, https://, private mode,
           and every browser — unlike localStorage on file://.           */
        try { window.CT_STORAGE.setPendingDemo(true); } catch (e) { /* ignore */ }
        window.location.href = 'calculator.html?demo=1';
      });
    });
  }

  /* ---------------- Smooth-scroll for in-page anchors --------------- */
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

  /* ---------------- Footer year ------------------------------------- */
  function initFooterYear() {
    document.querySelectorAll('[data-current-year]').forEach(el => {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ---------------- Boot -------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initHeaderScroll();
    initActiveNav();
    initQuickDemo();
    initSmoothAnchors();
    initFooterYear();
  });
})();