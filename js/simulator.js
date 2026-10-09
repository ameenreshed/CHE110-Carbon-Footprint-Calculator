/* ==========================================================================
   Carbotrack — simulator.js
   Live "What-If" habit simulator for simulator.html
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const K = window.CT_CONFIG.constants;

  let baseline = null;

  /* ------------------------------------------------------------------ */
  /*  Init baseline                                                     */
  /* ------------------------------------------------------------------ */
  function resolveBaseline() {
    const saved = window.CT_STORAGE.getResults();
    if (saved) return { data: saved, isDemo: false };
    return { data: window.CT_ENGINE.demoBaseline(), isDemo: true };
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  function update() {
    const driveSlider  = $('sim-drive-slider');
    const powerSlider  = $('sim-power-slider');
    const meatlessChk  = $('sim-meatless-check');
    const recycleChk   = $('sim-recycle-check');
    if (!driveSlider || !powerSlider) return;

    const drivePct   = parseFloat(driveSlider.value) || 0;
    const powerPct   = parseFloat(powerSlider.value) || 0;
    const meatless   = !!(meatlessChk && meatlessChk.checked);
    const recycling  = !!(recycleChk && recycleChk.checked);

    /* Slider labels */
    const dLabel = $('sim-drive-val');
    const pLabel = $('sim-power-val');
    if (dLabel) dLabel.textContent = `${drivePct}%`;
    if (pLabel) pLabel.textContent = `${powerPct}%`;

    /* Savings maths */
    const driveSaved = baseline.breakdown.commute * (drivePct / 100);
    const powerSaved = baseline.breakdown.energy  * (powerPct / 100);
    const foodSaved  = meatless ? K.meatlessSaving : 0;
    const wasteSaved = recycling ? baseline.breakdown.waste * 0.4 : 0;

    const totalSavedKg = driveSaved + powerSaved + foodSaved + wasteSaved;
    const projectedKg  = Math.max(600, baseline.totalKg - totalSavedKg);

    const baselineTons  = (baseline.totalKg / 1000).toFixed(2);
    const projectedTons = (projectedKg / 1000).toFixed(2);
    const savedTons     = (totalSavedKg / 1000).toFixed(2);
    const savedPct      = Math.round((totalSavedKg / baseline.totalKg) * 100);

    /* Text output */
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('sim-baseline-text',  `${baselineTons} tonnes CO₂e`);
    set('sim-projected-text', `${projectedTons} tonnes CO₂e`);
    set('sim-savings-text',   `${savedTons} Tonnes`);
    set('sim-savings-pct',    `(~${savedPct}% reduction)`);

    /* Visual comparison bar */
    const bar = $('sim-compare-fill');
    if (bar) {
      const ratio = Math.max(0, Math.min(100, (projectedKg / baseline.totalKg) * 100));
      bar.style.width = `${ratio}%`;
    }

    /* Trees */
    const trees = $('sim-trees-text');
    if (trees) {
      trees.textContent = Math.round((totalSavedKg / 1000) * 47);
    }

    /* Persist slider state */
    window.CT_STORAGE.saveSimulator({
      drivePct, powerPct, meatless, recycling
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Restore                                                           */
  /* ------------------------------------------------------------------ */
  function restore() {
    const saved = window.CT_STORAGE.getSimulator();
    if (!saved) return;

    const d = $('sim-drive-slider');
    const p = $('sim-power-slider');
    const m = $('sim-meatless-check');
    const r = $('sim-recycle-check');

    if (d && typeof saved.drivePct === 'number') d.value = saved.drivePct;
    if (p && typeof saved.powerPct === 'number') p.value = saved.powerPct;
    if (m) m.checked = saved.meatless !== false;
    if (r) r.checked = saved.recycling !== false;
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                              */
  /* ------------------------------------------------------------------ */
  function init() {
    const root = $('simulator-root');
    if (!root) return;

    const resolved = resolveBaseline();
    baseline = resolved.data;

    /* Demo notice */
    if (resolved.isDemo) {
      const notice = $('sim-demo-notice');
      if (notice) notice.classList.remove('hidden');
    }

    restore();

    ['sim-drive-slider', 'sim-power-slider', 'sim-meatless-check', 'sim-recycle-check']
      .forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', update);
      });

    update();
  }

  document.addEventListener('DOMContentLoaded', init);
})();