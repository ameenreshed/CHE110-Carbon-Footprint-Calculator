/* ==========================================================================
   Carbotrack — config.js
   Central configuration: storage keys, benchmarks, emission factors.
   Exposed globally as window.CT_CONFIG
   ========================================================================== */
window.CT_CONFIG = (function () {
  'use strict';

  return {
    version: '1.0.0',

    /* ---- localStorage keys ------------------------------------------- */
    storageKeys: {
      results:      'carbotrack:results',
      inputs:       'carbotrack:inputs',
      challenge:    'carbotrack:challenge',
      simulator:    'carbotrack:simulator',
      pendingDemo:  'carbotrack:pendingDemo'
    },

    /* ---- Global climate benchmarks (tonnes CO2e / year) -------------- */
    benchmarks: {
      parisTarget:  2.0,
      indiaAvg:     1.9,
      globalAvg:    4.7,
      developedAvg: 14.5
    },

    /* ---- Core emission factors --------------------------------------- */
    factors: {
      electricity:      0.820,   // kg CO2e / kWh  (CEA India grid baseline)
      publicTransit:    0.045,   // kg CO2e / passenger-km
      flightDomestic:   250,     // kg CO2e / round trip (~700 km hop)
      flightIntl:       1100,    // kg CO2e / long-haul round trip
      waterLitre:       0.00035, // kg CO2e / litre (pumping + heating)
      wastePerKg:       0.45,    // kg CO2e / kg landfill waste
      clothingItem:     8.5,     // kg CO2e / apparel item
      onlineOrder:      2.2      // kg CO2e / e-commerce delivery
    },

    /* ---- Vehicle tailpipe factors (kg CO2e / km) --------------------- */
    vehicleFactors: {
      petrol_car:      0.170,
      diesel_car:      0.185,
      cng_car:         0.125,
      electric_car:    0.053,
      motorcycle:      0.075,
      electric_scooter:0.022,
      none:            0.000
    },

    /* ---- Diet baselines (kg CO2e / year) ----------------------------- */
    dietBaselines: {
      vegan:      1400,
      vegetarian: 1750,
      pescatarian:2100,
      mixed_low:  2500,
      heavy_meat: 3300
    },

    /* ---- Cooking fuel add-ons (kg CO2e / year) ----------------------- */
    cookingFuel: {
      lpg:               180,
      piped_gas:         160,
      electric_induction: 95
    },

    /* ---- Appliance add-ons (kg CO2e / year) -------------------------- */
    applianceAddons: {
      ac:     140,
      geyser:  90,
      ev:     220
    },

    /* ---- Constants --------------------------------------------------- */
    constants: {
      commuteWeeks:   50,   // working weeks per year
      transitDays:    300,  // transit days per year
      daysPerYear:    365,
      dairyPerServing: 60,  // kg CO2e / yr per daily dairy serving
      meatlessSaving: 320,  // kg CO2e / yr for 2 plant-based dinners weekly
      wasteBagKg:     4     // kg per household waste bag
    },

    /* ---- Chart palette ----------------------------------------------- */
    palette: [
      '#28463a', // Commute
      '#396d59', // Flights
      '#10b981', // Electricity
      '#f59e0b', // Diet
      '#06b6d4', // Water
      '#84cc16', // Waste
      '#a855f7'  // Goods
    ],

    categoryLabels: ['Commute', 'Flights', 'Electricity', 'Diet', 'Water', 'Waste', 'Goods']
  };
})();