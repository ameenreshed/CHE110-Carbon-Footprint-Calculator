/* ==========================================================================
   Carbotrack — theme.js
   Dark mode toggle (compact icon button) + back-to-top. Persisted state.
   ========================================================================== */
(function () {
  'use strict';

  const KEY = 'carbotrack:theme';
  const $ = (s) => document.querySelector(s);

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function setStored(t) {
    try { localStorage.setItem(KEY, t); } catch (e) { /* ignore */ }
  }
  function preferred() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
  function current() {
    return document.documentElement.getAttribute('data-theme') || stored() || preferred();
  }

  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    updateIcons();
    try {
      document.dispatchEvent(new CustomEvent('ct:themechange', { detail: { theme: t } }));
    } catch (e) { /* ignore */ }
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    setStored(next);
    apply(next);
  }

  function updateIcons() {
    const t = current();
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      const icon = btn.querySelector('i');
      if (icon) icon.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function injectHeaderToggle() {
    const host = $('.header-actions');
    if (!host || host.querySelector('[data-theme-toggle]')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('data-theme-toggle', '');
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.setAttribute('title', 'Toggle dark mode');
    btn.innerHTML = '<i class="fa-solid fa-moon"></i>';

    /* Insert as the LAST action so it sits to the right of the primary CTA */
    host.appendChild(btn);
    btn.addEventListener('click', toggle);
  }

  function injectMobileToggle() {
    const menu = document.getElementById('mobile-menu');
    if (!menu || menu.querySelector('[data-theme-toggle]')) return;

    const block = document.createElement('div');
    block.className = 'mobile-theme';
    block.innerHTML = `
      <button type="button" class="mobile-theme__btn" data-theme-toggle>
        <i class="fa-solid fa-moon"></i>
        <span data-theme-label>Dark Mode</span>
      </button>
    `;

    const actions = menu.querySelector('.mobile-menu__actions');
    if (actions) menu.insertBefore(block, actions);
    else menu.appendChild(block);

    block.querySelector('button').addEventListener('click', toggle);
  }

  /* Mobile label updater — separate from data-theme-toggle icon logic
     because the mobile button has a text label. */
  function updateMobileLabel() {
    const t = current();
    document.querySelectorAll('.mobile-theme [data-theme-label]').forEach(el => {
      el.textContent = t === 'dark' ? 'Light Mode' : 'Dark Mode';
    });
  }

  function injectBackToTop() {
    if ($('.back-to-top')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);

    let raf = null;
    function update() {
      raf = null;
      if (window.scrollY > 500) btn.classList.add('is-visible');
      else btn.classList.remove('is-visible');
    }
    window.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function init() {
    if (!document.documentElement.getAttribute('data-theme')) {
      document.documentElement.setAttribute('data-theme', stored() || preferred());
    }

    injectHeaderToggle();
    injectMobileToggle();
    injectBackToTop();
    updateIcons();
    updateMobileLabel();

    /* Keep mobile label in sync when theme changes */
    document.addEventListener('ct:themechange', updateMobileLabel);

    if (window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        if (!stored()) apply(mql.matches ? 'dark' : 'light');
      };
      if (mql.addEventListener) mql.addEventListener('change', handler);
      else if (mql.addListener) mql.addListener(handler);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  window.CT_THEME = {
    get: current,
    set: (t) => { setStored(t); apply(t); },
    toggle,
    updateIcons
  };
})();