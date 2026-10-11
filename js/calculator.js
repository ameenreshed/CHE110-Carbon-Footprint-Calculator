/* ==========================================================================
   Carbotrack — calculator.js
   Multi-step form controller + animated demo walkthrough
   Exposed globally as window.CT_CALCULATOR
   ========================================================================== */
window.CT_CALCULATOR = (function () {
  'use strict';

  const TOTAL_STEPS = 6;
  let currentStep = 1;

  const STEP_TITLES = [
    'Transportation', 'Home Energy & Grid', 'Food & Diet',
    'Domestic Water', 'Waste & Recycling', 'Shopping & Lifestyle'
  ];

  /* ------------------------------------------------------------------ */
  /*  DOM helpers                                                       */
  /* ------------------------------------------------------------------ */
  const $   = (id) => document.getElementById(id);
  const val = (id) => ($(id) ? $(id).value : '');
  const num = (id) => parseFloat(val(id)) || 0;
  const chk = (id) => !!($(id) && $(id).checked);
  const sleep = (ms) => new Promise(r => window.setTimeout(r, ms));

  /* ================================================================== */
  /*  STEP NAVIGATION                                                   */
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

  function applyInputs(inputs) {
    if (!inputs) return;

    const set = (id, v) => {
      const el = $(id);
      if (el && v !== undefined && v !== null) el.value = v;
    };
    const setChk = (id, v) => {
      const el = $(id);
      if (el && typeof v === 'boolean') el.checked = v;
    };

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

  /* ================================================================== */
  /*  EXECUTE — compute, store, and redirect with URL-hash payload      */
  /* ================================================================== */
  function execute() {
    if (!validateStep()) return;

    const rawInputs  = collectInputs();
    const normalized = window.CT_ENGINE.normalize(rawInputs);
    const results    = window.CT_ENGINE.calculate(normalized);

    /* Persist (best-effort — may fail on file://) */
    window.CT_STORAGE.saveInputs(normalized);
    window.CT_STORAGE.saveResults(results);

    /* Bulletproof transport: encode the normalized inputs into the hash.
       results.html decodes it, re-computes, and re-saves to storage.     */
    const payload = window.CT_STORAGE.encodeInputs(normalized);
    const hash = payload ? ('#d=' + payload) : '';

    if (window.CT_TOAST) {
      window.CT_TOAST.show(
        `Footprint computed: ${results.totalTons.toFixed(2)} t CO₂e / year`,
        'success',
        2400
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
  /*  DEMO DATA                                                         */
  /* ================================================================== */
  const DEMO_PROFILE = {
    vehicleType: 'petrol_car', personalKm: 15, commuteDays: 5, publicKm: 6,
    carpoolFactor: 0.75, domesticFlights: 2, intlFlights: 0,
    householdSize: 4, monthlyKwh: 280,
    applianceAC: true, applianceGeyser: true, applianceEV: false,
    cookingFuel: 'lpg',
    dietType: 'mixed_low', dairyServings: 2, foodWaste: 'medium',
    showerMinutes: 10, showersPerDay: 1, washingLoads: 4, tapHabits: 'average',
    wasteBags: 3, recyclingRate: 0.5, composting: 'no',
    clothingItems: 2, onlineOrders: 5, plasticHabits: 'moderate'
  };

  const DEMO_SEQUENCE = [
    { step: 1, icon: 'fa-car', title: 'Transportation',
      message: '15 km daily petrol commute · 2 domestic flights detected',
      inputs: { vehicleType: 'petrol_car', personalKm: 15, commuteDays: 5, publicKm: 6,
                carpoolFactor: 0.75, domesticFlights: 2, intlFlights: 0 },
      duration: 950 },
    { step: 2, icon: 'fa-bolt', title: 'Home Energy',
      message: '280 kWh household ÷ 4 members · AC + geyser in use',
      inputs: { householdSize: 4, monthlyKwh: 280,
                applianceAC: true, applianceGeyser: true, applianceEV: false,
                cookingFuel: 'lpg' },
      duration: 950 },
    { step: 3, icon: 'fa-utensils', title: 'Food & Diet',
      message: 'Mixed diet · 2 dairy servings · occasional food waste',
      inputs: { dietType: 'mixed_low', dairyServings: 2, foodWaste: 'medium' },
      duration: 950 },
    { step: 4, icon: 'fa-droplet', title: 'Domestic Water',
      message: '10-minute showers · 4 weekly laundry loads',
      inputs: { showerMinutes: 10, showersPerDay: 1, washingLoads: 4, tapHabits: 'average' },
      duration: 950 },
    { step: 5, icon: 'fa-recycle', title: 'Waste & Recycling',
      message: '3 bags weekly · 50% segregation · no composting yet',
      inputs: { wasteBags: 3, recyclingRate: 0.5, composting: 'no' },
      duration: 950 },
    { step: 6, icon: 'fa-bag-shopping', title: 'Lifestyle & Goods',
      message: '2 apparel items · 5 monthly e-commerce deliveries',
      inputs: { clothingItems: 2, onlineOrders: 5, plasticHabits: 'moderate' },
      duration: 950 }
  ];

  /* ================================================================== */
  /*  ANIMATED DEMO OVERLAY                                             */
  /* ================================================================== */
  let demoOverlayEl = null;
  let demoRunning = false;

  function buildDemoOverlay() {
    if (demoOverlayEl) return demoOverlayEl;

    const overlay = document.createElement('div');
    overlay.className = 'demo-overlay';
    overlay.id = 'demo-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Running demo profile');

    overlay.innerHTML = `
      <div class="demo-overlay__card">
        <div class="demo-overlay__head">
          <div class="demo-overlay__glyph"><i class="fa-solid fa-leaf"></i></div>
          <h3 class="demo-overlay__title">Running Demo Profile</h3>
          <p class="demo-overlay__sub">Auto-filling a sample assessment in real time…</p>
        </div>

        <div class="demo-steps" id="demo-steps-list"></div>

        <div class="demo-overlay__progress" aria-hidden="true">
          <div class="demo-overlay__progress-fill" id="demo-progress"></div>
        </div>

        <p class="demo-overlay__foot" id="demo-foot" aria-live="polite">
          <i class="fa-solid fa-spinner fa-spin"></i> Initializing engine…
        </p>
      </div>
    `;

    document.body.appendChild(overlay);
    demoOverlayEl = overlay;
    return overlay;
  }

  function renderDemoSteps(overlay) {
    const list = overlay.querySelector('#demo-steps-list');
    if (!list) return;

    list.innerHTML = DEMO_SEQUENCE.map((s, i) => `
      <div class="demo-step" data-demo-index="${i}">
        <span class="demo-step__icon">
          <i class="fa-solid ${s.icon}"></i>
        </span>
        <span class="demo-step__text">
          <span class="demo-step__title">${s.title}</span>
          <span class="demo-step__msg">${s.message}</span>
        </span>
      </div>
    `).join('');
  }

  async function runAnimatedDemo() {
    if (demoRunning) return;
    demoRunning = true;

    const prefersReducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      applyInputs(DEMO_PROFILE);
      goTo(TOTAL_STEPS, true);
      execute();
      demoRunning = false;
      return;
    }

    const calcSection = $('calculator-section') || $('footprint-form');
    if (calcSection && calcSection.scrollIntoView) {
      calcSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const overlay = buildDemoOverlay();
    renderDemoSteps(overlay);

    const progressFill = overlay.querySelector('#demo-progress');
    const foot         = overlay.querySelector('#demo-foot');
    const stepEls      = overlay.querySelectorAll('[data-demo-index]');

    requestAnimationFrame(() => overlay.classList.add('is-open'));
    await sleep(420);

    for (let i = 0; i < DEMO_SEQUENCE.length; i++) {
      const seq = DEMO_SEQUENCE[i];
      const el  = stepEls[i];

      if (el) el.classList.add('is-active');
      if (foot) foot.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${seq.message}`;

      applyInputs(seq.inputs);
      goTo(seq.step, true);

      const pct = Math.round(((i + 1) / DEMO_SEQUENCE.length) * 100);
      if (progressFill) progressFill.style.width = pct + '%';

      await sleep(seq.duration || 950);

      if (el) {
        el.classList.remove('is-active');
        el.classList.add('is-done');
        const iconWrap = el.querySelector('.demo-step__icon');
        if (iconWrap) iconWrap.innerHTML = '<i class="fa-solid fa-check"></i>';
      }
    }

    if (foot) foot.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Compiling your carbon report…';
    await sleep(850);

    overlay.classList.remove('is-open');
    await sleep(360);

    execute();
    demoRunning = false;
  }

  function fillDemo() {
    applyInputs(DEMO_PROFILE);
    goTo(TOTAL_STEPS, true);
    execute();
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
    if (window.CT_TOAST) {
      window.CT_TOAST.show('Calculator reset to defaults.', 'info', 2200);
    }
  }

  /* ================================================================== */
  /*  INIT                                                              */
  /* ================================================================== */
  function init() {
    const root = $('footprint-form');
    if (!root) return;

    const saved = window.CT_STORAGE.getInputs();
    if (saved) applyInputs(saved);

    const prevBtn  = $('prev-step-btn');
    const nextBtn  = $('next-step-btn');
    const calcBtn  = $('calc-submit-btn');
    const resetBtn = $('calc-reset-btn');

    if (prevBtn)  prevBtn.addEventListener('click', () => navigate(-1));
    if (nextBtn)  nextBtn.addEventListener('click', () => navigate(1));
    if (calcBtn)  calcBtn.addEventListener('click', execute);
    if (resetBtn) resetBtn.addEventListener('click', reset);

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (currentStep < TOTAL_STEPS) navigate(1);
        else execute();
      }
    });

    updateUI(1, 1, true);

    const urlDemo    = new URLSearchParams(window.location.search).get('demo') === '1';
    const storedDemo = window.CT_STORAGE.consumePendingDemo();

    if (urlDemo || storedDemo) {
      if (urlDemo && window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      window.setTimeout(() => {
        try { runAnimatedDemo(); }
        catch (err) {
          console.error('[Carbotrack] Animated demo failed, falling back:', err);
          fillDemo();
        }
      }, 260);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    fillDemo, runAnimatedDemo, reset, goTo,
    getCurrentStep: () => currentStep
  };
})();