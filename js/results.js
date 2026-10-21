/* ==========================================================================
   Carbotrack — results.js
   Dashboard render + PDF report download.
   FIXES:
   - PDF export no longer triggers 4 chart re-renders (2 theme-change events
     + 1 resize event). Export now suppresses the change listeners and
     re-renders charts explicitly.
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

  const RECOMMENDATION_LIBRARY = {
    transport: { name: 'Transportation', icon: 'fa-car',
      tips: ['Switch to bus/metro two days a week to cut commute emissions by up to 35%.','Maintain correct tyre pressure for 3–5% better fuel economy.','Carpool with classmates or colleagues travelling similar routes.'],
      potential: 'Save ~400–700 kg CO₂e / yr' },
    flights: { name: 'Air Travel', icon: 'fa-plane',
      tips: ['Replace one short-haul flight per year with rail or video conferencing.','Choose direct flights — take-off and landing burn the most fuel.','Offset unavoidable flights through verified reforestation programmes.'],
      potential: 'Save ~250–1100 kg CO₂e / yr' },
    energy: { name: 'Home Energy', icon: 'fa-bolt',
      tips: ['Set AC thermostats to 24 °C instead of 18 °C — saves up to 24% per unit.','Unplug standby chargers, monitors and TV setups before sleeping.','Use 5-star BEE-rated inverter appliances for cooling and refrigeration.'],
      potential: 'Save ~250–500 kg CO₂e / yr' },
    food: { name: 'Food & Nutrition', icon: 'fa-utensils',
      tips: ['Add two meat-free days per week to cut methane-intensive food impact.','Plan portions carefully to eliminate discarded plate waste.','Choose seasonal, locally-grown produce over cold-stored imports.'],
      potential: 'Save ~300–600 kg CO₂e / yr' },
    water: { name: 'Water Usage', icon: 'fa-droplet',
      tips: ['Cap showers at five minutes — saves water and water-heating energy.','Run washing machines only with full loads and on eco cycles.','Fix leaking taps promptly; a drip can waste 20+ litres a day.'],
      potential: 'Save ~40–90 kg CO₂e / yr' },
    waste: { name: 'Waste Management', icon: 'fa-recycle',
      tips: ['Rinse and segregate plastics and aluminium so recyclers can divert them.','Start simple pot composting for fruit peels and tea leaves.','Carry a stainless-steel bottle instead of buying packaged water.'],
      potential: 'Save ~90–180 kg CO₂e / yr' },
    shopping: { name: 'Shopping & Goods', icon: 'fa-bag-shopping',
      tips: ['Apply a 30-day rule before non-essential purchases.','Buy second-hand or repair clothing instead of fast fashion.','Consolidate online orders to reduce packaging and delivery trips.'],
      potential: 'Save ~120–350 kg CO₂e / yr' }
  };

  /* FIX: export-mode flag suppresses theme + resize chart re-renders. */
  let isExporting = false;

  function resolve() {
    const hashInputs = window.CT_STORAGE.readHashPayload();
    if (hashInputs) {
      try {
        const normalized = window.CT_ENGINE.normalize(hashInputs);
        const results    = window.CT_ENGINE.calculate(normalized);
        window.CT_STORAGE.saveInputs(normalized);
        window.CT_STORAGE.saveResults(results);
        return { results: results, inputs: normalized };
      } catch (e) { console.warn('[Carbotrack] Hash payload invalid, falling through.', e); }
    }

    const stored = window.CT_STORAGE.getResults();
    if (stored && typeof stored.totalKg === 'number') {
      return { results: stored, inputs: window.CT_STORAGE.getInputs() };
    }

    const inputs = window.CT_STORAGE.getInputs();
    if (inputs) {
      try {
        const normalized = window.CT_ENGINE.normalize(inputs);
        const results    = window.CT_ENGINE.calculate(normalized);
        window.CT_STORAGE.saveResults(results);
        return { results: results, inputs: normalized };
      } catch (e) { console.warn('[Carbotrack] Recompute failed.', e); }
    }
    return null;
  }

  function renderKPIs(r) {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('res-total-tons', r.totalTons.toFixed(2));
    set('res-monthly-kg', r.monthlyKg.toLocaleString());
    set('res-daily-kg',   r.dailyKg);
    set('res-eco-score-pill', r.ecoScore + '/100');

    const bar = $('res-eco-score-bar');
    if (bar) bar.style.width = r.ecoScore + '%';

    const badge = $('res-rating-badge');
    if (badge) {
      const iconCls = RATING_ICONS[r.rating.key] || RATING_ICONS.moderate;
      badge.innerHTML = '<i class="fa-solid ' + iconCls + '"></i> <span>' + r.rating.label + '</span>';
      badge.className = 'rating-badge rating-' + r.rating.key;
    }

    const cmp = $('res-comparison-note');
    if (cmp) {
      if (r.vsParis > 100) {
        cmp.innerHTML = 'Your footprint is <strong>' + r.vsParis + '%</strong> of the Paris Agreement 2.0 t personal target — about <strong>' + (r.totalTons - 2).toFixed(2) + ' t</strong> above it.';
      } else {
        cmp.innerHTML = 'Excellent — you are within the Paris Agreement 2.0 t personal target.';
      }
    }

    const trees = $('res-trees-note');
    if (trees) trees.textContent = 'Equivalent to the annual carbon sequestered by ' + r.treesEquivalent + ' mature urban trees.';

    const ts = $('res-timestamp');
    if (ts && r.generatedAt) ts.textContent = 'Generated ' + new Date(r.generatedAt).toLocaleString();
  }

  function renderCharts(r) {
    if (typeof Chart === 'undefined') return;
    const labels = window.CT_CONFIG.categoryLabels;
    const values = [
      r.breakdown.commute, r.breakdown.flights, r.breakdown.energy,
      r.breakdown.food, r.breakdown.water, r.breakdown.waste, r.breakdown.shopping
    ];
    window.CT_CHARTS.renderDonut('categoryDonutChart', labels, values, window.CT_CONFIG.palette);
    window.CT_CHARTS.renderBar('categoryBarChart', labels, values, window.CT_CONFIG.palette);
  }

  function renderRecommendations(r) {
    const container = $('dynamic-recommendations-list');
    if (!container) return;
    container.innerHTML = '';

    const entries = Object.keys(r.breakdown).map(function (key) {
      return { key: key, amount: r.breakdown[key], meta: RECOMMENDATION_LIBRARY[key] };
    }).filter(function (e) { return e.meta; });

    entries.sort(function (a, b) { return b.amount - a.amount; });

    entries.slice(0, 3).forEach(function (entry, index) {
      const isTop = index === 0;
      const card = document.createElement('article');
      card.className = 'rec-card' + (isTop ? ' rec-card--top' : '');
      const tips = entry.meta.tips.map(function (t) {
        return '<li><i class="fa-solid fa-check"></i><span>' + t + '</span></li>';
      }).join('');

      card.innerHTML =
        '<div class="rec-card__head">' +
          '<span class="rec-card__icon"><i class="fa-solid ' + entry.meta.icon + '"></i></span>' +
          (isTop ? '<span class="rec-card__flag">Highest Contributor</span>' : '') +
        '</div>' +
        '<h4 class="rec-card__title">' + entry.meta.name + ' Optimisation</h4>' +
        '<p class="rec-card__load">' + entry.amount.toLocaleString() + ' kg CO₂e / year</p>' +
        '<ul class="rec-card__tips">' + tips + '</ul>' +
        '<div class="rec-card__foot"><span>Potential Reduction:</span><strong>' + entry.meta.potential + '</strong></div>';

      container.appendChild(card);
    });
  }

  async function submitScoreToSupabase(results) {
    if (!window.CT_SB_LEADERBOARD) return;
    if (!window.CT_SB_AUTH || !window.CT_SB_AUTH.isLoggedIn()) return;
    const user = window.CT_SB_AUTH.getUser();
    if (!user) return;

    const sig = user.id + '|' + (results.generatedAt || '') + '|' + results.totalTons + '|' + results.ecoScore;
    const sigKey = 'carbotrack:last_submitted_sig';
    try { if (localStorage.getItem(sigKey) === sig) return; } catch (e) {}

    const clientResultId = user.id + '|' + (results.generatedAt || Date.now());

    const res = await window.CT_SB_LEADERBOARD.submitScore({
      totalTons:       results.totalTons,
      ecoScore:        results.ecoScore,
      ratingKey:       results.rating.key,
      ratingLabel:     results.rating.label,
      breakdown:       results.breakdown,
      clientResultId:  clientResultId
    });

    if (res.ok) {
      try { localStorage.setItem(sigKey, sig); } catch (e) {}
      if (window.CT_TOAST) window.CT_TOAST.show('Score saved to leaderboard!', 'success', 2800);
    }
  }

  /* ================================================================== */
  /*  EXPORT — A4 PDF                                                   */
  /* ================================================================== */
  function hash6(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(6, '0').toUpperCase();
  }

  function ensureExportStyles() {
    if (document.getElementById('ct-export-style')) return;
    const style = document.createElement('style');
    style.id = 'ct-export-style';
    style.textContent = `
      body.ct-exporting { background: #fbf9f5 !important; overflow-x: hidden !important; }
      body.ct-exporting .site-header, body.ct-exporting .site-footer,
      body.ct-exporting .toolbar-actions, body.ct-exporting .no-print,
      body.ct-exporting .about-panel, body.ct-exporting .back-to-top,
      body.ct-exporting .toast-container, body.ct-exporting .theme-toggle,
      body.ct-exporting #nav-backdrop, body.ct-exporting #mobile-menu,
      body.ct-exporting .header-actions { display: none !important; }
      body.ct-exporting #results-section {
        display: block !important; width: 1240px !important;
        max-width: 1240px !important; min-width: 1240px !important;
        padding: 40px !important; margin: 0 !important;
        background: #fbf9f5 !important; box-sizing: border-box !important;
        border: none !important;
      }
      body.ct-exporting #results-section > .container {
        max-width: 100% !important; width: 100% !important;
        padding: 0 !important; margin: 0 !important;
      }
      body.ct-exporting .results-toolbar { margin-bottom: 28px !important; }
    `;
    document.head.appendChild(style);
  }

  function findBreakPoints(section, scale) {
    const sectionRect = section.getBoundingClientRect();
    const candidates = section.querySelectorAll(
      '.results-toolbar, .kpi-hero, .kpi-card, ' +
      '.chart-container, .rec-panel, .rec-card'
    );
    const points = [];
    candidates.forEach(function (el) {
      const r = el.getBoundingClientRect();
      const top    = Math.max(0, (r.top    - sectionRect.top) * scale);
      const bottom = Math.max(0, (r.bottom - sectionRect.top) * scale);
      if (bottom > top) points.push({ top, bottom });
    });
    points.sort(function (a, b) { return a.bottom - b.bottom; });
    return points;
  }

  function paginateCanvas(canvas, breakables, pdfW, pdfH) {
    const pxPerMm = canvas.width / pdfW;
    const pageHeightPx = pdfH * pxPerMm;
    const pages = [];
    let startY = 0;

    while (startY < canvas.height - 2) {
      const idealEnd = Math.min(canvas.height, startY + pageHeightPx);
      if (idealEnd >= canvas.height - 2) {
        pages.push({ startY, endY: canvas.height });
        break;
      }
      const minY = startY + pageHeightPx * 0.4;
      let bestEnd = idealEnd;
      for (let i = breakables.length - 1; i >= 0; i--) {
        const b = breakables[i];
        if (b.bottom >= minY && b.bottom <= idealEnd) { bestEnd = b.bottom; break; }
      }
      if (bestEnd <= startY + 4) bestEnd = idealEnd;
      pages.push({ startY, endY: bestEnd });
      startY = bestEnd;
    }
    return pages;
  }

  async function downloadReport() {
    const btn = $('results-print-btn');
    if (!btn) return;

    const results = window.CT_STORAGE.getResults();
    if (!results) {
      if (window.CT_TOAST) window.CT_TOAST.show('No results to download. Please calculate first.', 'error', 3000);
      return;
    }

    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing PDF…';

    const html      = document.documentElement;
    const origTheme = html.getAttribute('data-theme');
    const hadExportClass = document.body.classList.contains('ct-exporting');
    let canvas = null;

    /* FIX: block theme + resize listeners for the whole export */
    isExporting = true;

    try {
      if (typeof html2canvas === 'undefined') throw new Error('html2canvas not loaded');
      if (typeof window.jspdf === 'undefined') throw new Error('jsPDF not loaded');

      ensureExportStyles();

      if (origTheme === 'dark') {
        html.setAttribute('data-theme', 'light');
        /* FIX: manually re-render charts in light theme; do NOT dispatch */
        window.CT_CHARTS.destroyAll();
        renderCharts(results);
        await new Promise(r => setTimeout(r, 380));
      }

      document.body.classList.add('ct-exporting');

      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 120));

      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) {}
      }

      const section = $('results-section');
      if (!section) throw new Error('Results section not found');

      const scale = 2;
      canvas = await html2canvas(section, {
        scale, useCORS: true, backgroundColor: '#fbf9f5',
        logging: false,
        width:  section.scrollWidth,
        height: section.scrollHeight,
        windowWidth: 1400,
        windowHeight: section.scrollHeight,
        scrollX: 0, scrollY: 0,
        imageTimeout: 30000,
        allowTaint: false,
        removeContainer: true
      });

      const breakables = findBreakPoints(section, scale);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      const pages = paginateCanvas(canvas, breakables, pdfW, pdfH);
      const pxPerMm = canvas.width / pdfW;

      pages.forEach(function (page, idx) {
        if (idx > 0) pdf.addPage();
        const sliceH = page.endY - page.startY;
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext('2d');
        ctx.fillStyle = '#fbf9f5';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, page.startY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.94);
        const sliceHmm  = sliceH / pxPerMm;
        pdf.addImage(sliceData, 'JPEG', 0, 0, pdfW, sliceHmm, undefined, 'FAST');
      });

      const user = (window.CT_AUTH && window.CT_AUTH.currentUser) ? window.CT_AUTH.currentUser() : null;
      const username = user ? user.username : 'guest';
      const year = new Date().getFullYear();
      const id = 'RPT-' + year + '-' + hash6(username + (results.generatedAt || ''));

      pdf.save('Carbotrack-Report-' + id + '.pdf');
      if (window.CT_TOAST) window.CT_TOAST.show('Report downloaded successfully!', 'success', 2800);
    } catch (err) {
      console.error('[Carbotrack] Report download failed:', err);
      if (window.CT_TOAST) window.CT_TOAST.show('Report download failed. Please try again.', 'error', 3400);
    } finally {
      if (!hadExportClass) document.body.classList.remove('ct-exporting');
      if (origTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        /* FIX: manually restore dark charts; do NOT dispatch */
        window.CT_CHARTS.destroyAll();
        renderCharts(results);
      }
      isExporting = false;
      btn.disabled = false;
      btn.innerHTML = original;
      canvas = null;
    }
  }

  function injectCertificateButton() {
    const actions = document.querySelector('.toolbar-actions');
    if (!actions || document.getElementById('results-cert-btn')) return;
    const btn = document.createElement('a');
    btn.id = 'results-cert-btn';
    btn.className = 'btn btn-leaf btn-sm';
    btn.href = 'certificate.html';
    btn.dataset.authBound = '1';
    btn.innerHTML = '<i class="fa-solid fa-certificate"></i> Get Certificate';
    btn.addEventListener('click', function (e) {
      if (!window.CT_AUTH || window.CT_AUTH.isLoggedIn()) return;
      e.preventDefault();
      window.CT_AUTH.request({ feature: 'your printable certificate', redirect: 'certificate.html' });
    });
    actions.prepend(btn);
  }

  function showEmptyState() {
    const empty = $('results-empty');
    const main  = $('results-section');
    if (empty) empty.classList.remove('hidden');
    if (main)  main.classList.add('hidden');
  }

  function showResults() {
    const empty = $('results-empty');
    const main  = $('results-section');
    if (empty) empty.classList.add('hidden');
    if (main)  main.classList.remove('hidden');
  }

  function init() {
    if (!$('results-section')) return;

    const resolved = resolve();
    if (!resolved) { showEmptyState(); return; }

    const results = resolved.results;
    const inputs  = resolved.inputs;

    showResults();
    renderKPIs(results);
    renderCharts(results);
    renderRecommendations(results);
    injectCertificateButton();
    submitScoreToSupabase(results);

    if (inputs) {
      const payload = window.CT_STORAGE.encodeInputs(inputs);
      if (payload) {
        const editLink = document.querySelector('.toolbar-actions a[href="calculator.html"]');
        if (editLink) editLink.href = 'calculator.html#d=' + payload;
      }
    }

    let resizeTimer = null;
    window.addEventListener('resize', function () {
      /* FIX: skip while exporting */
      if (isExporting) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        window.CT_CHARTS.destroyAll();
        renderCharts(results);
      }, 180);
    });

    document.addEventListener('ct:themechange', function () {
      /* FIX: skip while exporting — we drive the re-render manually */
      if (isExporting) return;
      window.CT_CHARTS.destroyAll();
      renderCharts(results);
    });

    const downloadBtn = $('results-print-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadReport);

    const resetBtn = $('results-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!window.confirm('Clear all saved results and start over?')) return;
        window.CT_STORAGE.clearResults();
        window.CT_STORAGE.clearInputs();
        try { localStorage.removeItem('carbotrack:last_submitted_sig'); } catch (e) {}
        window.location.href = 'calculator.html';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();