/* ==========================================================================
   Carbotrack — config.js
   Central configuration: storage keys, benchmarks, emission factors.
   ========================================================================== */
window.CT_CONFIG = (function () {
  'use strict';

  return {
    version: '1.3.0',

    storageKeys: {
      results:     'carbotrack:results',
      inputs:      'carbotrack:inputs',
      challenge:   'carbotrack:challenge',
      users:       'carbotrack:users',
      session:     'carbotrack:session'
    },

    benchmarks: {
      parisTarget:  2.0,
      indiaAvg:     1.9,
      globalAvg:    4.7,
      developedAvg: 14.5
    },

    factors: {
      electricity:      0.820,
      publicTransit:    0.045,
      flightDomestic:   250,
      flightIntl:       1100,
      waterLitre:       0.00035,
      wastePerKg:       0.45,
      clothingItem:     8.5,
      onlineOrder:      2.2
    },

    vehicleFactors: {
      petrol_car:      0.170,
      diesel_car:      0.185,
      cng_car:         0.125,
      electric_car:    0.053,
      motorcycle:      0.075,
      electric_scooter:0.022,
      none:            0.000
    },

    dietBaselines: {
      vegan:       1400,
      vegetarian:  1750,
      pescatarian: 2100,
      mixed_low:   2500,
      heavy_meat:  3300
    },

    cookingFuel: {
      lpg:                180,
      piped_gas:          160,
      electric_induction:  95
    },

    applianceAddons: { ac: 140, geyser: 90, ev: 220 },

    constants: {
      commuteWeeks:    50,
      transitDays:     300,
      daysPerYear:     365,
      dairyPerServing: 60,
      meatlessSaving:  320,
      wasteBagKg:      4
    },

    palette: [
      '#28463a', '#396d59', '#10b981', '#f59e0b',
      '#06b6d4', '#84cc16', '#a855f7'
    ],

    categoryLabels: ['Commute', 'Flights', 'Electricity', 'Diet', 'Water', 'Waste', 'Goods']
  };
})();