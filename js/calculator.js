/* ==========================================================================
   Carbotrack — calculator.js
   Multi-step form controller for calculator.html
   Exposed globally as window.CT_CALCULATOR
   ========================================================================== */
window.CT_CALCULATOR = (function () {
  'use strict';

  const TOTAL_STEPS = 6;
  let currentStep = 1;

  const STEP_TITLES = [
    'Transportation',
    'Home Energy & Grid',
    'Food & Diet',
    'Domestic Water',
    'Waste & Recycling',
    'Shopping & Lifestyle'
  ];

  /* ------------------------------------------------------------------ */
  /*  DOM helpers                                                       */
  /* ------------------------------------------------------------------ */
  const $   = (id) => document.getElementById(id);
  const val = (id) => ($(id) ? $(id).value : '');
  const num = (id) => parseFloat(val(id)) || 0;
  const chk = (id) => !!($(id) && $(id).checked);

  /* ------------------------------------------------------------------ */
  /*  Step navigation                                                   */
  /* ------------------------------------------------------------------ */
  function navigate(direction) {
    if (direction === 1 && !validateStep()) return;

    hideError();
    const previous = currentStep;
    currentStep = Math.min(TOTAL_STEPS, Math.max(1, currentStep + direction));

    if (previous !== currentStep) updateUI(previous, currentStep);
  }

  function goTo(step) {
    const previous = currentStep;
    currentStep = Math.min(TOTAL_STEPS, Math.max(1, step));
    if (previous !== currentStep) updateUI(previous, currentStep);
  }

  function updateUI(prev, current) {
    /* Toggle panels */
    const prevPanel = $(`step-${prev}`);
    const nextPanel = $(`step-${current}`);
    if (prevPanel) prevPanel.classList.add('hidden');
    if (nextPanel) nextPanel.classList.remove('hidden');

    /* Header text + progress */
    const pct = Math.round((current / TOTAL_STEPS) * 100);
    const indicator = $('step-indicator-text');
    const percentEl = $('step-percentage');
    const bar       = $('step-progress-bar');

    if (indicator) indicator.textContent = `Step ${current} of ${TOTAL_STEPS}: ${STEP_TITLES[current - 1]}`;
    if (percentEl) percentEl.textContent = `${pct}% Completed`;
    if (bar)       bar.style.width = `${pct}%`;

    /* Badges */
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const badge = $(`badge-step-${i}`);
      if (!badge) continue;

      badge.classList.remove('is-active', 'is-done', 'is-pending');

      if (i === current)      badge.classList.add('is-active');
      else if (i < current)   badge.classList.add('is-done');
      else                    badge.classList.add('is-pending');
    }

    /* Buttons */
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

    /* Move focus to the panel heading for accessibility */
    if (nextPanel) {
      const heading = nextPanel.querySelector('h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Validation                                                        */
  /* ------------------------------------------------------------------ */
  function validateStep() {
    hideError();

    if (currentStep === 1) {
      const km   = num('personal-km');
      const days = num('commute-days');
      const dom  = num('flights-domestic');
      const intl = num('flights-intl');

      if (km < 0 || km > 500) {
        return fail('Please enter a valid personal travel distance between 0 and 500 km.');
      }
      if (days < 0 || days > 7) {
        return fail('Commute days per week must be between 0 and 7.');
      }
      if (dom < 0 || dom > 100 || intl < 0 || intl > 50) {
        return fail('Flight counts look unrealistic. Please check your entries.');
      }
    }

    if (currentStep === 2) {
      const kwh     = num('power-kwh');
      const members = num('household-size');

      if (kwh < 0 || kwh > 10000) {
        return fail('Please enter valid monthly electricity units (0 – 10,000 kWh).');
      }
      if (members < 1 || members > 30) {
        return fail('Household size must be between 1 and 30 people.');
      }
    }

    if (currentStep === 4) {
      const mins = num('shower-minutes');
      if (mins < 1 || mins > 60) {
        return fail('Shower duration must be between 1 and 60 minutes.');
      }
    }

    if (currentStep === 5) {
      const bags = num('waste-bags');
      if (bags < 1 || bags > 25) {
        return fail('Weekly waste bags must be between 1 and 25.');
      }
    }

    return true;
  }

  function fail(msg) { showError(msg); return false; }

  function showError(msg) {
    const banner = $('calculator-error-banner');
    const text   = $('calculator-error-msg');
    if (text)   text.textContent = msg;
    if (banner) banner.classList.remove('hidden');
  }

  function hideError() {
    const banner = $('calculator-error-banner');
    if (banner) banner.classList.add('hidden');
  }

  /* ------------------------------------------------------------------ */
  /*  Input collection                                                  */
  /* ------------------------------------------------------------------ */
  function collectInputs() {
    return {
      vehicleType:     val('vehicle-type'),
      personalKm:      num('personal-km'),
      commuteDays:     num('commute-days'),
      publicKm:        num('public-km'),
      carpoolFactor:   num('carpool-freq'),
      domesticFlights: num('flights-domestic'),
      intlFlights:     num('flights-intl'),

      householdSize:   num('household-size'),
      monthlyKwh:      num('power-kwh'),
      applianceAC:     chk('appliance-ac'),
      applianceGeyser: chk('appliance-geyser'),
      applianceEV:     chk('appliance-ev'),
      cookingFuel:     val('cooking-fuel'),

      dietType:        val('diet-type'),
      dairyServings:   num('dairy-servings'),
      foodWaste:       val('food-waste-freq'),

      showerMinutes:   num('shower-minutes'),
      showersPerDay:   num('showers-per-day'),
      washingLoads:    num('washing-loads'),
      tapHabits:       val('tap-habits'),

      wasteBags:       num('waste-bags'),
      recyclingRate:   num('recycling-rate'),
      composting:      val('composting-status'),

      clothingItems:   num('clothing-items'),
      onlineOrders:    num('online-orders'),
      plasticHabits:   val('plastic-habits')
    };
  }

  function applyInputs(inputs) {
    if (!inputs) return;
    const set    = (id, v) => { const el = $(id); if (el && v !== undefined && v !== null) el.value = v; };
    const setChk = (id, v) => { const el = $(id); if (el) el.checked = !!v; };

    set('vehicle-type', inputs.vehicleType);
    set('personal-km', inputs.personalKm);
    set('commute-days', inputs.commuteDays);
    set('public-km', inputs.publicKm);
    set('carpool-freq', inputs.carpoolFactor);
    set('flights-domestic', inputs.domesticFlights);
    set('flights-intl', inputs.intlFlights);

    set('household-size', inputs.householdSize);
    set('power-kwh', inputs.monthlyKwh);
    setChk('appliance-ac', inputs.applianceAC);
    setChk('appliance-geyser', inputs.applianceGeyser);
    setChk('appliance-ev', inputs.applianceEV);
    set('cooking-fuel', inputs.cookingFuel);

    set('diet-type', inputs.dietType);
    set('dairy-servings', inputs.dairyServings);
    set('food-waste-freq', inputs.foodWaste);

    set('shower-minutes', inputs.showerMinutes);
    set('showers-per-day', inputs.showersPerDay);
    set('washing-loads', inputs.washingLoads);
    set('tap-habits', inputs.tapHabits);

    set('waste-bags', inputs.wasteBags);
    set('recycling-rate', inputs.recyclingRate);
    set('composting-status', inputs.composting);

    set('clothing-items', inputs.clothingItems);
    set('online-orders', inputs.onlineOrders);
    set('plastic-habits', inputs.plasticHabits);
  }

  /* ------------------------------------------------------------------ */
  /*  Execute calculation                                               */
  /* ------------------------------------------------------------------ */
  function execute() {
    if (!validateStep()) return;

    const rawInputs  = collectInputs();
    const normalized = window.CT_ENGINE.normalize(rawInputs);
    const results    = window.CT_ENGINE.calculate(normalized);

    window.CT_STORAGE.saveInputs(normalized);
    window.CT_STORAGE.saveResults(results);

    /* Brief button feedback, then navigate */
    const calcBtn = $('calc-submit-btn');
    if (calcBtn) {
      calcBtn.disabled = true;
      calcBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Computing…';
    }

    setTimeout(() => { window.location.href = 'results.html'; }, 420);
  }

  /* ------------------------------------------------------------------ */
  /*  Demo profile                                                      */
  /* ------------------------------------------------------------------ */
  function fillDemo() {
    applyInputs({
      vehicleType: 'petrol_car', personalKm: 15, commuteDays: 5, publicKm: 6,
      carpoolFactor: 0.75, domesticFlights: 2, intlFlights: 0,
      householdSize: 4, monthlyKwh: 280,
      applianceAC: true, applianceGeyser: true, applianceEV: false,
      cookingFuel: 'lpg',
      dietType: 'mixed_low', dairyServings: 2, foodWaste: 'medium',
      showerMinutes: 10, showersPerDay: 1, washingLoads: 4, tapHabits: 'average',
      wasteBags: 3, recyclingRate: 0.5, composting: 'no',
      clothingItems: 2, onlineOrders: 5, plasticHabits: 'moderate'
    });

    goTo(TOTAL_STEPS);
    execute();
  }

  /* ------------------------------------------------------------------ */
  /*  Reset                                                             */
  /* ------------------------------------------------------------------ */
  function reset() {
    const form = $('footprint-form');
    if (form) form.reset();
    window.CT_STORAGE.clearInputs();
    window.CT_STORAGE.clearResults();
    goTo(1);
    hideError();
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                              */
  /* ------------------------------------------------------------------ */
  function init() {
    const root = $('footprint-form');
    if (!root) return;                       // not the calculator page

    /* Restore previously entered inputs, if any */
    const saved = window.CT_STORAGE.getInputs();
    if (saved) applyInputs(saved);

    /* Wire up buttons */
    const prevBtn  = $('prev-step-btn');
    const nextBtn  = $('next-step-btn');
    const calcBtn  = $('calc-submit-btn');
    const resetBtn = $('calc-reset-btn');

    if (prevBtn)  prevBtn.addEventListener('click', () => navigate(-1));
    if (nextBtn)  nextBtn.addEventListener('click', () => navigate(1));
    if (calcBtn)  calcBtn.addEventListener('click', execute);
    if (resetBtn) resetBtn.addEventListener('click', reset);

    /* Enter key advances (but never submits) */
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (currentStep < TOTAL_STEPS) navigate(1);
        else execute();
      }
    });

    updateUI(1, 1);

    /* ---------- Quick Demo handoff -------------------------------- */
    /* Priority 1: URL param (?demo=1) — reliable on file:// too.     */
    /* Priority 2: localStorage flag   — used when the URL is clean.  */
    const urlDemo =
      new URLSearchParams(window.location.search).get('demo') === '1';
    const storedDemo = window.CT_STORAGE.consumePendingDemo();

    if (urlDemo || storedDemo) {
      /* Strip ?demo=1 so a manual refresh doesn't re-trigger the demo */
      if (urlDemo && window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      setTimeout(() => {
        try {
          fillDemo();
        } catch (err) {
          console.error('[Carbotrack] Quick Demo failed:', err);
        }
      }, 200);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    fillDemo,
    reset,
    goTo,
    getCurrentStep: () => currentStep
  };
})();