/* ==========================================================================
   Carbotrack — engine.js
   Pure, side-effect-free carbon calculation engine.
   Exposed globally as window.CT_ENGINE
   ========================================================================== */
window.CT_ENGINE = (function () {
  'use strict';

  const C = window.CT_CONFIG;
  const F = C.factors;
  const K = C.constants;

  /**
   * Calculate the full annual footprint from a normalized input object.
   * @param {Object} i - normalized inputs (see normalize() below)
   * @returns {Object} results
   */
  function calculate(i) {
    /* ---------- 1. TRANSPORTATION ---------------------------------- */
    const vehicleFactor      = C.vehicleFactors[i.vehicleType] ?? 0;
    const annualPersonalKm   = i.personalKm * i.commuteDays * K.commuteWeeks;
    const vehicleEmission    = annualPersonalKm * vehicleFactor * i.carpoolFactor;

    const annualTransitKm    = i.publicKm * K.transitDays;
    const transitEmission    = annualTransitKm * F.publicTransit;

    const commute            = vehicleEmission + transitEmission;

    const flights            = (i.domesticFlights * F.flightDomestic) +
                               (i.intlFlights * F.flightIntl);

    /* ---------- 2. HOME ENERGY ------------------------------------- */
    const personalMonthlyKwh = i.monthlyKwh / Math.max(1, i.householdSize);
    let energy               = personalMonthlyKwh * 12 * F.electricity;

    if (i.applianceAC)     energy += C.applianceAddons.ac;
    if (i.applianceGeyser) energy += C.applianceAddons.geyser;
    if (i.applianceEV)     energy += C.applianceAddons.ev;

    energy += C.cookingFuel[i.cookingFuel] ?? 0;

    /* ---------- 3. FOOD & DIET ------------------------------------- */
    let food = C.dietBaselines[i.dietType] ?? C.dietBaselines.vegetarian;
    food += i.dairyServings * K.dairyPerServing;
    if (i.foodWaste === 'medium') food *= 1.10;
    if (i.foodWaste === 'high')   food *= 1.25;

    /* ---------- 4. WATER ------------------------------------------- */
    const dailyLitres =
      (i.showerMinutes * 9 * i.showersPerDay) +
      ((i.washingLoads * 60) / 7) +
      (i.tapHabits === 'lavish' ? 60 : i.tapHabits === 'frugal' ? 20 : 30);

    const water = dailyLitres * K.daysPerYear * F.waterLitre;

    /* ---------- 5. WASTE ------------------------------------------- */
    let waste = i.wasteBags * 52 * K.wasteBagKg * F.wastePerKg;
    waste = waste * (1 - (i.recyclingRate * 0.5));
    if (i.composting) waste *= 0.8;

    /* ---------- 6. SHOPPING & LIFESTYLE ---------------------------- */
    let shopping = (i.clothingItems * 12 * F.clothingItem) +
                   (i.onlineOrders  * 12 * F.onlineOrder);

    if (i.plasticHabits === 'heavy') shopping += 65;
    if (i.plasticHabits === 'eco')   shopping -= 20;
    shopping = Math.max(0, shopping);

    /* ---------- TOTALS --------------------------------------------- */
    const totalKg =
      commute + flights + energy + food + water + waste + shopping;

    const totalTons = totalKg / 1000;

    /* ---------- ECO SCORE (higher = better) ------------------------ */
    const ecoScore = Math.max(20, Math.min(96, Math.round(100 - (totalTons * 8.5))));

    /* ---------- BREAKDOWN ------------------------------------------ */
    const breakdown = {
      commute:     Math.round(commute),
      flights:     Math.round(flights),
      energy:      Math.round(energy),
      food:        Math.round(food),
      water:       Math.round(water),
      waste:       Math.round(waste),
      shopping:    Math.round(shopping)
    };

    const series = C.categoryLabels.map((label, idx) => ({
      label,
      value: Object.values(breakdown)[idx] || 0
    }));

    const percentages = series.map(s => ({
      label: s.label,
      pct: totalKg > 0 ? +((s.value / totalKg) * 100).toFixed(1) : 0
    }));

    /* ---------- CLASSIFICATION ------------------------------------- */
    let rating;
    if (totalTons <= 2.2)      rating = { key: 'low',       label: '🟢 Lower Impact (Target Compliant)' };
    else if (totalTons <= 4.5) rating = { key: 'moderate',  label: '🟡 Moderate Impact' };
    else if (totalTons <= 7.5) rating = { key: 'high',      label: '🟠 High Impact' };
    else                       rating = { key: 'very-high', label: '🔴 Very High Impact' };

    /* ---------- COMPARISON vs BENCHMARKS --------------------------- */
    const vsParis = totalTons > 0
      ? +((totalTons / C.benchmarks.parisTarget) * 100).toFixed(0)
      : 0;

    const treesEquivalent = Math.round((totalKg / 1000) * 47);

    return {
      breakdown,
      series,
      percentages,
      totalKg:   Math.round(totalKg),
      totalTons: +totalTons.toFixed(2),
      monthlyKg: Math.round(totalKg / 12),
      dailyKg:   +(totalKg / K.daysPerYear).toFixed(1),
      ecoScore,
      rating,
      vsParis,
      treesEquivalent,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Normalize a raw DOM-derived input object, applying safe defaults
   * and clamping to valid ranges.
   */
  function normalize(raw) {
    const num = (v, d) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : d;
    };
    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

    return {
      /* Transport */
      vehicleType:     raw.vehicleType     || 'petrol_car',
      personalKm:      clamp(num(raw.personalKm, 0),   0, 500),
      commuteDays:     clamp(num(raw.commuteDays, 0),  0, 7),
      publicKm:        clamp(num(raw.publicKm, 0),     0, 300),
      carpoolFactor:   clamp(num(raw.carpoolFactor, 1), 0.1, 1),
      domesticFlights: clamp(num(raw.domesticFlights, 0), 0, 100),
      intlFlights:     clamp(num(raw.intlFlights, 0),     0, 50),

      /* Energy */
      householdSize:   clamp(num(raw.householdSize, 1), 1, 30),
      monthlyKwh:      clamp(num(raw.monthlyKwh, 0),    0, 10000),
      applianceAC:     !!raw.applianceAC,
      applianceGeyser: !!raw.applianceGeyser,
      applianceEV:     !!raw.applianceEV,
      cookingFuel:     raw.cookingFuel || 'lpg',

      /* Food */
      dietType:        raw.dietType || 'vegetarian',
      dairyServings:   clamp(num(raw.dairyServings, 0), 0, 6),
      foodWaste:       raw.foodWaste || 'low',

      /* Water */
      showerMinutes:   clamp(num(raw.showerMinutes, 8),  1, 60),
      showersPerDay:   clamp(num(raw.showersPerDay, 1),  0, 5),
      washingLoads:    clamp(num(raw.washingLoads, 3),   0, 30),
      tapHabits:       raw.tapHabits || 'average',

      /* Waste */
      wasteBags:       clamp(num(raw.wasteBags, 3),      1, 25),
      recyclingRate:   clamp(num(raw.recyclingRate, 0.25), 0, 0.95),
      composting:      raw.composting === 'yes' || raw.composting === true,

      /* Shopping */
      clothingItems:   clamp(num(raw.clothingItems, 2), 0, 30),
      onlineOrders:    clamp(num(raw.onlineOrders, 4),  0, 60),
      plasticHabits:   raw.plasticHabits || 'moderate'
    };
  }

  /**
   * A representative demo profile — used as a fallback baseline.
   */
  function demoBaseline() {
    return calculate(normalize({
      vehicleType: 'petrol_car', personalKm: 15, commuteDays: 5, publicKm: 6,
      carpoolFactor: 0.75, domesticFlights: 2, intlFlights: 0,
      householdSize: 4, monthlyKwh: 280,
      applianceAC: true, applianceGeyser: true, applianceEV: false,
      cookingFuel: 'lpg',
      dietType: 'mixed_low', dairyServings: 2, foodWaste: 'medium',
      showerMinutes: 10, showersPerDay: 1, washingLoads: 4, tapHabits: 'average',
      wasteBags: 3, recyclingRate: 0.5, composting: 'no',
      clothingItems: 2, onlineOrders: 5, plasticHabits: 'moderate'
    }));
  }

  return { calculate, normalize, demoBaseline };
})();