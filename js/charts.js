/* ==========================================================================
   Carbotrack — charts.js
   Chart.js wrappers. Theme-aware — reads current theme at render time.
   ========================================================================== */
window.CT_CHARTS = (function () {
  'use strict';

  let donutInstance = null;
  let barInstance   = null;

  function themeColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      font: { family: 'Inter', size: 11, color: dark ? '#cbd5e1' : '#334155' },
      grid: dark ? '#22352c' : '#f1f5f3',
      border: dark ? '#0a110e' : '#ffffff',
      tooltipBg: dark ? '#131e19' : '#1e293b',
      tooltipTitle: dark ? '#f2f7f4' : '#ffffff',
      tooltipBody: dark ? '#cbd5e1' : '#e2e8f0'
    };
  }

  function destroyAll() {
    if (donutInstance) { donutInstance.destroy(); donutInstance = null; }
    if (barInstance)   { barInstance.destroy();   barInstance   = null; }
  }

  function baseTooltip(c) {
    return {
      backgroundColor: c.tooltipBg,
      titleColor: c.tooltipTitle,
      bodyColor: c.tooltipBody,
      borderColor: c.grid,
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8
    };
  }

  function renderDonut(canvasId, labels, values, palette) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    if (donutInstance) donutInstance.destroy();
    const c = themeColors();

    donutInstance = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: palette,
          borderWidth: 2,
          borderColor: c.border
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: c.font,
              padding: 14,
              color: c.font.color
            }
          },
          tooltip: Object.assign(baseTooltip(c), {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} kg (${pct}%)`;
              }
            }
          })
        }
      }
    });
  }

  function renderBar(canvasId, labels, values, palette) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    if (barInstance) barInstance.destroy();
    const c = themeColors();

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
          tooltip: Object.assign(baseTooltip(c), {
            callbacks: {
              label(ctx) {
                return ` ${ctx.parsed.y.toLocaleString()} kg CO₂e / year`;
              }
            }
          })
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: c.font, color: c.font.color },
            grid: { color: c.grid }
          },
          x: {
            ticks: { font: c.font, color: c.font.color },
            grid: { display: false }
          }
        }
      }
    });
  }

  return { renderDonut, renderBar, destroyAll };
})();