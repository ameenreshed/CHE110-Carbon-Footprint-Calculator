/* ==========================================================================
   Carbotrack — charts.js
   Chart.js wrappers for the results dashboard.
   Exposed globally as window.CT_CHARTS
   ========================================================================== */
window.CT_CHARTS = (function () {
  'use strict';

  let donutInstance = null;
  let barInstance   = null;

  const FONT = { family: 'Inter', size: 11 };

  function destroyAll() {
    if (donutInstance) { donutInstance.destroy(); donutInstance = null; }
    if (barInstance)   { barInstance.destroy();   barInstance   = null; }
  }

  function renderDonut(canvasId, labels, values, palette) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;

    if (donutInstance) donutInstance.destroy();

    donutInstance = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: palette,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: FONT, padding: 14 }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} kg (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  function renderBar(canvasId, labels, values, palette) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;

    if (barInstance) barInstance.destroy();

    barInstance = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Emissions (kg CO₂e/yr)',
          data: values,
          backgroundColor: palette,
          borderRadius: 8,
          maxBarThickness: 46
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) { return ` ${ctx.parsed.y.toLocaleString()} kg CO₂e / year`; }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: FONT },
            grid: { color: '#f1f5f3' }
          },
          x: {
            ticks: { font: FONT },
            grid: { display: false }
          }
        }
      }
    });
  }

  return { renderDonut, renderBar, destroyAll };
})();