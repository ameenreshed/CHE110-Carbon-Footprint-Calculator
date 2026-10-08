/* =========================================================
   CarbonCalc — Main Script
   CHE 110 Group Project
   ========================================================= */

/* ---------------------------------------------------------
   1. THEME TOGGLE  (dark / light, saved in localStorage)
   --------------------------------------------------------- */
(function initTheme() {
  const saved = localStorage.getItem('cf-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    updateThemeIcon();
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('cf-theme', next);
      updateThemeIcon();
      // Update chart colours if visible
      if (window.updateChartTheme) window.updateChartTheme(next);
    });
  }

  function updateThemeIcon() {
    const icon = themeToggle.querySelector('i');
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
  }

  /* -------------------------------------------------------
     2. FOOTER YEAR
     ------------------------------------------------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* -------------------------------------------------------
     3. LOAD SAVED INPUTS (only on calculator page)
     ------------------------------------------------------- */
  const form = document.getElementById('calcForm');
  if (!form) return;

  const FIELD_IDS = [
    'electricity','lpg','gas',
    'carKm','carFuel','motoKm','busKm','trainKm','flightHours',
    'diet',
    'waste','shopping'
  ];

  const saved = JSON.parse(localStorage.getItem('cf-inputs') || '{}');
  FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && saved[id] !== undefined) el.value = saved[id];
  });

  /* -------------------------------------------------------
     4. EMISSION FACTORS (kg CO₂e per unit)
     ------------------------------------------------------- */
  const FACTORS = {
    electricity: 0.82,     // per kWh
    lpg:         42.3,     // per 14.2 kg cylinder
    gas:         2.0,      // per m³
    motoKm:      0.07,     // per km
    busKm:       0.08,     // per km
    trainKm:     0.04,     // per km
    flightHour:  150,      // per hour
    waste:       0.5       // per kg
  };

  /* -------------------------------------------------------
     5. CALCULATE
     ------------------------------------------------------- */
  let chartInstance = null;

  function calculate() {
    const get = id => parseFloat(document.getElementById(id).value) || 0;
    const getStr = id => document.getElementById(id).value;

    // --- Home Energy ---
    const home =
      get('electricity') * FACTORS.electricity * 12 +
      get('lpg')         * FACTORS.lpg         * 12 +
      get('gas')         * FACTORS.gas         * 12;

    // --- Transportation ---
    const carFuelFactor = parseFloat(getStr('carFuel')) || 0.192;
    const transport =
      get('carKm')      * carFuelFactor  * 52 +
      get('motoKm')     * FACTORS.motoKm * 52 +
      get('busKm')      * FACTORS.busKm  * 52 +
      get('trainKm')    * FACTORS.trainKm* 52 +
      get('flightHours')* FACTORS.flightHour;

    // --- Diet ---
    const diet = parseFloat(getStr('diet')) || 0;

    // --- Waste & Shopping ---
    const wasteShopping =
      get('waste') * FACTORS.waste * 52 +
      (parseFloat(getStr('shopping')) || 0);

    const totalKg = home + transport + diet + wasteShopping;
    const totalTonnes = totalKg / 1000;

    // --- Render ---
    animateNumber(document.getElementById('total'), totalTonnes);

    const cats = [
      { label: 'Home Energy',     value: home / 1000,          icon: 'fa-house' },
      { label: 'Transportation',  value: transport / 1000,     icon: 'fa-car-side' },
      { label: 'Diet',            value: diet / 1000,          icon: 'fa-utensils' },
      { label: 'Waste & Shopping',value: wasteShopping / 1000, icon: 'fa-recycle' }
    ];

    const breakdown = document.getElementById('breakdown');
    breakdown.innerHTML = cats.map(c =>
      `<li><span><i class="fas ${c.icon}"></i> ${c.label}</span><strong>${c.value.toFixed(2)} t</strong></li>`
    ).join('');

    const comparison = document.getElementById('comparison');
    comparison.textContent = getComparisonMessage(totalTonnes);

    document.getElementById('results').classList.remove('hidden');
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

    renderChart(cats);

    // Save inputs
    const data = {};
    FIELD_IDS.forEach(id => data[id] = document.getElementById(id).value);
    localStorage.setItem('cf-inputs', JSON.stringify(data));
  }

  /* -------------------------------------------------------
     6. ANIMATED NUMBER COUNTER
     ------------------------------------------------------- */
  function animateNumber(el, target) {
    const duration = 700;
    const start = parseFloat(el.textContent) || 0;
    const startTime = performance.now();

    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = (start + (target - start) * eased).toFixed(2);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* -------------------------------------------------------
     7. COMPARISON MESSAGE
     ------------------------------------------------------- */
  function getComparisonMessage(t) {
    if (t < 2)   return '🌱 Excellent! Your footprint is within the sustainable global target of ~2 t per person.';
    if (t < 4.7) return '👍 Good — your footprint is below the global average of ~4.7 t per person.';
    if (t < 10)  return '⚠️ Your footprint is above the global average. Focus on home energy, car use, or meat consumption.';
    return '🔴 Your footprint is quite high. The biggest opportunities are usually flights, car travel, and home energy.';
  }

  /* -------------------------------------------------------
     8. CHART.JS DOUGHNUT
     ------------------------------------------------------- */
  function renderChart(cats) {
    const canvas = document.getElementById('chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstance) chartInstance.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e7efec' : '#1f2d2b';

    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.label),
        datasets: [{
          data: cats.map(c => +c.value.toFixed(3)),
          backgroundColor: ['#2e7d32','#66bb6a','#a5d6a7','#c8e6c9'],
          borderColor: isDark ? '#16211f' : '#fff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { size: 12 }, padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(2)} t`
            }
          }
        }
      }
    });
  }

  // Expose for theme toggle
  window.updateChartTheme = () => {
    const canvas = document.getElementById('chart');
    if (!canvas || !chartInstance) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    chartInstance.options.plugins.legend.labels.color = isDark ? '#e7efec' : '#1f2d2b';
    chartInstance.data.datasets[0].borderColor = isDark ? '#16211f' : '#fff';
    chartInstance.update();
  };

  /* -------------------------------------------------------
     9. BUTTON WIRING
     ------------------------------------------------------- */
  document.getElementById('calcBtn')?.addEventListener('click', calculate);

  document.getElementById('resetBtn')?.addEventListener('click', () => {
    setTimeout(() => {
      document.getElementById('results').classList.add('hidden');
      localStorage.removeItem('cf-inputs');
    }, 0);
  });

  document.getElementById('shareBtn')?.addEventListener('click', async () => {
    const text = `My carbon footprint is ${document.getElementById('total').textContent} tonnes CO₂e/year. Calculate yours!`;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'Carbon Footprint Calculator', text, url }); }
      catch (e) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      alert('Result copied to clipboard!');
    }
  });

  document.getElementById('printBtn')?.addEventListener('click', () => window.print());

  /* -------------------------------------------------------
     10. LIVE VALIDATION
     ------------------------------------------------------- */
  FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.tagName === 'SELECT') return;
    el.addEventListener('input', () => {
      if (el.value < 0) el.value = 0;
    });
  });
});