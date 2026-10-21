/* ==========================================================================
   Carbotrack — calculator.js
   Multi-step form controller with DEDUPED platform stats tracking.

   FIX: footprint_computed event now uses a dedupe key
   (totalTons + ecoScore + today's date) so re-submitting the same
   values on the same day counts once.
   ========================================================================== */
window.CT_CALCULATOR = (function () {
  'use strict';

  const TOTAL_STEPS = 6;
  let currentStep = 1;

  const STEP_TITLES = [
    'Transportation', 'Home Energy & Grid', 'Food & Diet',
    'Domestic Water', 'Waste & Recycling', 'Shopping & Lifestyle'
  ];

  const $ = (id) => document.getElementById(id);
  const val = (id) => ($(id) ? $(id).value : '');
  const num = (id) => parseFloat(val(id)) || 0;
  const chk = (id) => !!($(id) && $(id).checked);

  /* ================================================================== */
  /*  NAVIGATION                                                        */
  /* ================================================================== */
  function navigate(direction) {
    if (direction === 1 && !validateStep()) return;
    hideError();
    const previous = currentStep;
    currentStep = Math.min(TOTAL_STEPS, Math.max(1, currentStep + direction));
    if (previous !== currentStep) updateUI(previous, currentStep);
  }

  function goTo(step, skipFocus) {
    const previous = currentStep;
    currentStep = Math.min(TOTAL_STEPS, Math.max(1, step));
    if (previous !== currentStep) updateUI(previous, currentStep, skipFocus);
  }

  function updateUI(prev, current, skipFocus) {
    const prevPanel = $(`step-${prev}`);
    const nextPanel = $(`step-${current}`);
    if (prevPanel) prevPanel.classList.add('hidden');
    if (nextPanel) nextPanel.classList.remove('hidden');

    const pct       = Math.round((current / TOTAL_STEPS) * 100);
    const indicator = $('step-indicator-text');
    const percentEl = $('step-percentage');
    const bar       = $('step-progress-bar');

    if (indicator) indicator.textContent = `Step ${current} of ${TOTAL_STEPS}: ${STEP_TITLES[current - 1]}`;
    if (percentEl) percentEl.textContent = `${pct}% Completed`;
    if (bar)       bar.style.width = `${pct}%`;

    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const badge = $(`badge-step-${i}`);
      if (!badge) continue;
      badge.classList.remove('is-active', 'is-done', 'is-pending');
      if (i === current)    badge.classList.add('is-active');
      else if (i < current) badge.classList.add('is-done');
      else                  badge.classList.add('is-pending');
    }

    const prevBtn = $('prev-step-btn');
    const nextBtn = $('next-step-btn');
    const calcBtn = $('calc-submit-btn');

    if (prevBtn) prevBtn.disabled = current === 1;

    if (current === TOTAL_STEPS) {
      if (nextBtn) nextBtn.classList.add('hidden');
      if (calcBtn) calcBtn.classList.remove('hidden');
    } else {
      if (nextBtn) nextBtn.classList.remove('hidden');
      if (calcBtn) calcBtn.classList.add('hidden');
    }

    if (!skipFocus && nextPanel) {
      const heading = nextPanel.querySelector('h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }
  }

  /* ================================================================== */
  /*  VALIDATION                                                        */
  /* ================================================================== */
  function validateStep() {
    hideError();

    if (currentStep === 1) {
      const km = num('personal-km'), days = num('commute-days');
      const dom = num('flights-domestic'), intl = num('flights-intl');
      if (km < 0 || km > 500)   return fail('Please enter a valid personal travel distance between 0 and 500 km.');
      if (days < 0 || days > 7) return fail('Commute days per week must be between 0 and 7.');
      if (dom < 0 || dom > 100 || intl < 0 || intl > 50) {
        return fail('Flight counts look unrealistic. Please check your entries.');
      }
    }
    if (currentStep === 2) {
      const kwh = num('power-kwh'), members = num('household-size');
      if (kwh < 0 || kwh > 10000)      return fail('Please enter valid monthly electricity units (0 – 10,000 kWh).');
      if (members < 1 || members > 30) return fail('Household size must be between 1 and 30 people.');
    }
    if (currentStep === 4) {
      const mins = num('shower-minutes');
      if (mins < 1 || mins > 60) return fail('Shower duration must be between 1 and 60 minutes.');
    }
    if (currentStep === 5) {
      const bags = num('waste-bags');
      if (bags < 1 || bags > 25) return fail('Weekly waste bags must be between 1 and 25.');
    }
    return true;
  }

  function fail(msg) { showError(msg); return false; }

  function showError(msg) {
    const banner = $('calculator-error-banner');
    const text   = $('calculator-error-msg');
    if (text)   text.textContent = msg;
    if (banner) banner.classList.remove('hidden');
    if (window.CT_TOAST) window.CT_TOAST.show(msg, 'error', 4000);
  }

  function hideError() {
    const banner = $('calculator-error-banner');
    if (banner) banner.classList.add('hidden');
  }

  /* ================================================================== */
  /*  INPUT COLLECTION                                                  */
  /* ================================================================== */
  function collectInputs() {
    return {
      vehicleType: val('vehicle-type'), personalKm: num('personal-km'),
      commuteDays: num('commute-days'), publicKm: num('public-km'),
      carpoolFactor: num('carpool-freq'), domesticFlights: num('flights-domestic'),
      intlFlights: num('flights-intl'),

      householdSize: num('household-size'), monthlyKwh: num('power-kwh'),
      applianceAC: chk('appliance-ac'), applianceGeyser: chk('appliance-geyser'),
      applianceEV: chk('appliance-ev'), cookingFuel: val('cooking-fuel'),

      dietType: val('diet-type'), dairyServings: num('dairy-servings'),
      foodWaste: val('food-waste-freq'),

      showerMinutes: num('shower-minutes'), showersPerDay: num('showers-per-day'),
      washingLoads: num('washing-loads'), tapHabits: val('tap-habits'),

      wasteBags: num('waste-bags'), recyclingRate: num('recycling-rate'),
      composting: val('composting-status'),

      clothingItems: num('clothing-items'), onlineOrders: num('online-orders'),
      plasticHabits: val('plastic-habits')
    };
  }

  /* ================================================================== */
  /*  APPLY INPUTS                                                      */
  /* ================================================================== */
  function setText(id, v) {
    const el = $(id);
    if (el && v !== undefined && v !== null && v !== '') el.value = v;
  }

  function setCheck(id, v) {
    const el = $(id);
    if (el && typeof v === 'boolean') el.checked = v;
  }

  function setSelect(id, v) {
    const el = $(id);
    if (!el) return;

    const asString = String(v);
    if (Array.from(el.options).some(o => o.value === asString)) {
      el.value = asString;
      return;
    }

    const n = parseFloat(v);
    if (Number.isFinite(n)) {
      let best = null, bestDelta = Infinity;
      Array.from(el.options).forEach(o => {
        const on = parseFloat(o.value);
        if (!Number.isFinite(on)) return;
        const d = Math.abs(on - n);
        if (d < bestDelta) { bestDelta = d; best = o.value; }
      });
      if (best !== null) el.value = best;
    }
  }

  function setYesNo(id, v) {
    const el = $(id);
    if (!el) return;
    el.value = (v === true || v === 'yes') ? 'yes' : 'no';
  }

  function applyInputs(inputs) {
    if (!inputs) return;

    setSelect('vehicle-type', inputs.vehicleType);
    setText('personal-km', inputs.personalKm);
    setText('commute-days', inputs.commuteDays);
    setText('public-km', inputs.publicKm);
    setSelect('carpool-freq', inputs.carpoolFactor);
    setText('flights-domestic', inputs.domesticFlights);
    setText('flights-intl', inputs.intlFlights);

    setText('household-size', inputs.householdSize);
    setText('power-kwh', inputs.monthlyKwh);
    setCheck('appliance-ac', inputs.applianceAC);
    setCheck('appliance-geyser', inputs.applianceGeyser);
    setCheck('appliance-ev', inputs.applianceEV);
    setSelect('cooking-fuel', inputs.cookingFuel);

    setSelect('diet-type', inputs.dietType);
    setSelect('dairy-servings', inputs.dairyServings);
    setSelect('food-waste-freq', inputs.foodWaste);

    setText('shower-minutes', inputs.showerMinutes);
    setText('showers-per-day', inputs.showersPerDay);
    setText('washing-loads', inputs.washingLoads);
    setSelect('tap-habits', inputs.tapHabits);

    setText('waste-bags', inputs.wasteBags);
    setSelect('recycling-rate', inputs.recyclingRate);
    setYesNo('composting-status', inputs.composting);

    setText('clothing-items', inputs.clothingItems);
    setText('online-orders', inputs.onlineOrders);
    setSelect('plastic-habits', inputs.plasticHabits);
  }

  /* ================================================================== */
  /*  EXECUTE                                                           */
  /* ================================================================== */
  function execute() {
    if (!validateStep()) return;

    const rawInputs  = collectInputs();
    const normalized = window.CT_ENGINE.normalize(rawInputs);
    const results    = window.CT_ENGINE.calculate(normalized);

    window.CT_STORAGE.saveInputs(normalized);
    window.CT_STORAGE.saveResults(results);

    /* FIX: dedupe footprint_computed by (totalTons + ecoScore + today).
       Re-submitting the same values on the same day = 1 count. */
    if (window.CT_STATS) {
      var today = new Date().toISOString().slice(0, 10);
      var sig = 'footprint_computed:'
        + results.totalTons.toFixed(2)
        + ':' + results.ecoScore
        + ':' + today;
      window.CT_STATS.recordEvent(
        'footprint_computed',
        { totalTons: results.totalTons, rating: results.rating.key },
        sig
      );
    }

    const payload = window.CT_STORAGE.encodeInputs(normalized);
    const hash = payload ? ('#d=' + payload) : '';

    if (window.CT_TOAST) {
      window.CT_TOAST.show(
        `Footprint computed: ${results.totalTons.toFixed(2)} t CO₂e / year`,
        'success', 2400
      );
    }

    const calcBtn = $('calc-submit-btn');
    if (calcBtn) {
      calcBtn.disabled = true;
      calcBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Computing…';
    }

    window.setTimeout(() => {
      window.location.href = 'results.html' + hash;
    }, 480);
  }

  /* ================================================================== */
  /*  RESET                                                             */
  /* ================================================================== */
  function reset() {
    const form = $('footprint-form');
    if (form) form.reset();
    window.CT_STORAGE.clearInputs();
    window.CT_STORAGE.clearResults();
    goTo(1);
    hideError();
    if (window.CT_TOAST) window.CT_TOAST.show('Calculator reset to defaults.', 'info', 2200);
  }

  /* ================================================================== */
  /*  INIT                                                              */
  /* ================================================================== */
  function init() {
    const root = $('footprint-form');
    if (!root) return;

    /* Priority 1: #d= hash payload */
    const hashInputs = window.CT_STORAGE.readHashPayload();
    if (hashInputs) {
      applyInputs(hashInputs);
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else {
      /* Priority 2: last-saved inputs */
      const saved = window.CT_STORAGE.getInputs();
      if (saved) applyInputs(saved);
    }

    const prevBtn  = $('prev-step-btn');
    const nextBtn  = $('next-step-btn');
    const calcBtn  = $('calc-submit-btn');
    const resetBtn = $('calc-reset-btn');

    if (prevBtn)  prevBtn.addEventListener('click', () => navigate(-1));
    if (nextBtn)  nextBtn.addEventListener('click', () => navigate(1));
    if (calcBtn)  calcBtn.addEventListener('click', execute);
    if (resetBtn) resetBtn.addEventListener('click', reset);

    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const tag = e.target.tagName;
      if (tag !== 'INPUT') return;
      const type = (e.target.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit') return;

      e.preventDefault();
      if (currentStep < TOTAL_STEPS) navigate(1);
      else execute();
    });

    updateUI(1, 1, true);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { reset, goTo, getCurrentStep: () => currentStep };
})();