/* ==========================================================================
   Carbotrack — results.js
   Renders the results dashboard.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const RATING_ICONS = {
    low:         'fa-circle-check',
    moderate:    'fa-circle-exclamation',
    high:        'fa-triangle-exclamation',
    'very-high': 'fa-circle-xmark'
  };

  const RECOMMENDATION_LIBRARY = {
    transport: {
      name: 'Transportation', icon: 'fa-car',
      tips: [
        'Switch to bus/metro two days a week to cut commute emissions by up to 35%.',
        'Maintain correct tyre pressure for 3–5% better fuel economy.',
        'Carpool with classmates or colleagues travelling similar routes.'
      ],
      potential: 'Save ~400–700 kg CO₂e / yr'
    },
    flights: {
      name: 'Air Travel', icon: 'fa-plane',
      tips: [
        'Replace one short-haul flight per year with rail or video conferencing.',
        'Choose direct flights — take-off and landing burn the most fuel.',
        'Offset unavoidable flights through verified reforestation programmes.'
      ],
      potential: 'Save ~250–1100 kg CO₂e / yr'
    },
    energy: {
      name: 'Home Energy', icon: 'fa-bolt',
      tips: [
        'Set AC thermostats to 24 °C instead of 18 °C — saves up to 24% per unit.',
        'Unplug standby chargers, monitors and TV setups before sleeping.',
        'Use 5-star BEE-rated inverter appliances for cooling and refrigeration.'
      ],
      potential: 'Save ~250–500 kg CO₂e / yr'
    },
    food: {
      name: 'Food & Nutrition', icon: 'fa-utensils',
      tips: [
        'Add two meat-free days per week to cut methane-intensive food impact.',
        'Plan portions carefully to eliminate discarded plate waste.',
        'Choose seasonal, locally-grown produce over cold-stored imports.'
      ],
      potential: 'Save ~300–600 kg CO₂e / yr'
    },
    water: {
      name: 'Water Usage', icon: 'fa-droplet',
      tips: [
        'Cap showers at five minutes — saves water and water-heating energy.',
        'Run washing machines only with full loads and on eco cycles.',
        'Fix leaking taps promptly; a drip can waste 20+ litres a day.'
      ],
      potential: 'Save ~40–90 kg CO₂e / yr'
    },
    waste: {
      name: 'Waste Management', icon: 'fa-recycle',
      tips: [
        'Rinse and segregate plastics and aluminium so recyclers can divert them.',
        'Start simple pot composting for fruit peels and tea leaves.',
        'Carry a stainless-steel bottle instead of buying packaged water.'
      ],
      potential: 'Save ~90–180 kg CO₂e / yr'
    },
    shopping: {
      name: 'Shopping & Goods', icon: 'fa-bag-shopping',
      tips: [
        'Apply a 30-day rule before non-essential purchases.',
        'Buy second-hand or repair clothing instead of fast fashion.',
        'Consolidate online orders to reduce packaging and delivery trips.'
      ],
      potential: 'Save ~120–350 kg CO₂e / yr'
    }
  };

  function resolve() {
    const hashInputs = window.CT_STORAGE.readHashPayload();
    if (hashInputs) {
      try {
        const normalized = window.CT_ENGINE.normalize(hashInputs);
        const results    = window.CT_ENGINE.calculate(normalized);
        window.CT_STORAGE.saveInputs(normalized);
        window.CT_STORAGE.saveResults(results);
        return { results, inputs: normalized };
      } catch (e) {
        console.warn('[Carbotrack] Hash payload invalid, falling through.', e);
      }
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
        return { results, inputs: normalized };
      } catch (e) {
        console.warn('[Carbotrack] Recompute failed.', e);
      }
    }

    return null;
  }

  function renderKPIs(r) {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

    set('res-total-tons', r.totalTons.toFixed(2));
    set('res-monthly-kg', r.monthlyKg.toLocaleString());
    set('res-daily-kg',   r.dailyKg);
    set('res-eco-score-pill', `${r.ecoScore}/100`);

    const bar = $('res-eco-score-bar');
    if (bar) bar.style.width = `${r.ecoScore}%`;

    const badge = $('res-rating-badge');
    if (badge) {
      const iconCls = RATING_ICONS[r.rating.key] || RATING_ICONS.moderate;
      badge.innerHTML = `<i class="fa-solid ${iconCls}"></i> <span>${r.rating.label}</span>`;
      badge.className = `rating-badge rating-${r.rating.key}`;
    }

    const cmp = $('res-comparison-note');
    if (cmp) {
      if (r.vsParis > 100) {
        cmp.innerHTML = `Your footprint is <strong>${r.vsParis}%</strong> of the Paris Agreement 2.0 t personal target — about <strong>${(r.totalTons - 2).toFixed(2)} t</strong> above it.`;
      } else {
        cmp.innerHTML = 'Excellent — you are within the Paris Agreement 2.0 t personal target.';
      }
    }

    const trees = $('res-trees-note');
    if (trees) {
      trees.textContent = `Equivalent to the annual carbon sequestered by ${r.treesEquivalent} mature urban trees.`;
    }

    const ts = $('res-timestamp');
    if (ts && r.generatedAt) {
      ts.textContent = `Generated ${new Date(r.generatedAt).toLocaleString()}`;
    }
  }

  function renderCharts(r) {
    if (typeof Chart === 'undefined') {
      console.warn('[Carbotrack] Chart.js not loaded — skipping charts.');
      return;
    }
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

    const entries = Object.keys(r.breakdown).map(key => ({
      key, amount: r.breakdown[key], meta: RECOMMENDATION_LIBRARY[key]
    })).filter(e => e.meta);

    entries.sort((a, b) => b.amount - a.amount);

    entries.slice(0, 3).forEach((entry, index) => {
      const isTop = index === 0;
      const card = document.createElement('article');
      card.className = `rec-card${isTop ? ' rec-card--top' : ''}`;

      const tips = entry.meta.tips
        .map(t => `<li><i class="fa-solid fa-check"></i><span>${t}</span></li>`)
        .join('');

      card.innerHTML = `
        <div class="rec-card__head">
          <span class="rec-card__icon"><i class="fa-solid ${entry.meta.icon}"></i></span>
          ${isTop ? '<span class="rec-card__flag">Highest Contributor</span>' : ''}
        </div>
        <h4 class="rec-card__title">${entry.meta.name} Optimisation</h4>
        <p class="rec-card__load">${entry.amount.toLocaleString()} kg CO₂e / year</p>
        <ul class="rec-card__tips">${tips}</ul>
        <div class="rec-card__foot">
          <span>Potential Reduction:</span>
          <strong>${entry.meta.potential}</strong>
        </div>
      `;
      container.appendChild(card);
    });
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

    btn.addEventListener('click', (e) => {
      if (!window.CT_AUTH || window.CT_AUTH.isLoggedIn()) return;
      e.preventDefault();
      window.CT_AUTH.request({
        feature: 'your printable certificate',
        redirect: 'certificate.html'
      });
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

    if (inputs) {
      const payload = window.CT_STORAGE.encodeInputs(inputs);
      if (payload) {
        const editLink = document.querySelector('.toolbar-actions a[href="calculator.html"]');
        if (editLink) editLink.href = 'calculator.html#d=' + payload;
      }
    }

    window.addEventListener('resize', () => {
      window.CT_CHARTS.destroyAll();
      renderCharts(results);
    });

    const printBtn = $('results-print-btn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const resetBtn = $('results-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!window.confirm('Clear all saved results and start over?')) return;
        window.CT_STORAGE.clearResults();
        window.CT_STORAGE.clearInputs();
        window.location.href = 'calculator.html';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();