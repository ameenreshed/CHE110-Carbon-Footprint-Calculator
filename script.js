'use strict';
/* Emission factors: rounded approximations, see about.html */
const FACTORS = {
  vehicle: { petrol: 0.17, diesel: 0.15, cng: 0.12, ev: 0.08, bike: 0.05 }, // kg CO2 per km
  publicTransport: 0.04,   // kg CO2 per km
  flight: 250,             // kg CO2 per return flight
  electricity: 0.71,       // kg CO2 per kWh
  lpgCylinder: 42.5,       // kg CO2 per 14.2 kg cylinder
  waste: 0.45,             // kg CO2 per kg waste
  diet: { veg: 1000, mixed: 1500, non: 1900 }, // kg CO2 per year
  treePerYear: 21          // kg CO2 absorbed by one tree per year
};
const BENCHMARKS = [['India average', 1.9], ['World average', 4.7], ['Paris-aligned 2030', 2.3]];
const TIPS = {
  Transport: 'Switch short trips to walking, cycling, bus or train, or share rides.',
  Flights: 'Replace one flight with a train journey or a video call where you can.',
  'Home energy': 'Use 5-star appliances and LED lighting, switch off standby loads, and cook with lids on.',
  Food: 'Eat more seasonal, local and plant-based meals and avoid wasting food.',
  Waste: 'Segregate waste, compost kitchen scraps and cut single-use plastic.'
};
const STORE_KEY = 'carbontrace-history';

/** Pure calculation: returns yearly kg CO2 per category and total in tonnes. */
function calculate(v) {
  const parts = {
    Transport: v.carKm * 52 * FACTORS.vehicle[v.vehicle] + v.pubKm * 52 * FACTORS.publicTransport,
    Flights: v.flights * FACTORS.flight,
    'Home energy': v.kwh * 12 * FACTORS.electricity + v.lpg * FACTORS.lpgCylinder,
    Food: FACTORS.diet[v.diet],
    Waste: v.waste * 52 * FACTORS.waste
  };
  const kg = Object.values(parts).reduce((a, b) => a + b, 0);
  return { parts, kg, tonnes: kg / 1000 };
}

const $ = (id) => document.getElementById(id);

function readInputs() {
  const n = (id) => Number($(id).value);
  return { vehicle: $('vehicle').value, carKm: n('carKm'), pubKm: n('pubKm'), flights: n('flights'),
           kwh: n('kwh'), lpg: n('lpg'), waste: n('waste'), diet: $('diet').value };
}

function barRow(label, value, pct, cls) {
  return `<div class="bar-row"><div class="lab"><span>${label}</span><span>${value}</span></div>` +
         `<div class="track"><div class="fill ${cls || ''}" style="width:${pct}%"></div></div></div>`;
}

function render() {
  const v = readInputs();
  ['carKm', 'pubKm', 'flights', 'kwh', 'lpg', 'waste'].forEach((k) => { $('o-' + k).textContent = v[k]; });
  const r = calculate(v);
  $('total').textContent = r.tonnes.toFixed(2);
  $('verdict').textContent = r.tonnes <= 2.3 ? 'At or below a Paris-aligned level. Keep it up.'
    : r.tonnes <= 4.7 ? 'Below the world average, but above the 2030 target.'
    : 'Above the world average. Small changes will help a lot.';
  $('trees').textContent = `About ${Math.ceil(r.kg / FACTORS.treePerYear)} trees would be needed to absorb this in a year.`;
  const entries = Object.entries(r.parts);
  $('parts').innerHTML = entries.map(([k, kg]) => barRow(k, Math.round(kg) + ' kg', r.kg ? Math.round(kg / r.kg * 100) : 0)).join('');
  const rows = [['You', r.tonnes]].concat(BENCHMARKS);
  const max = Math.max(...rows.map((x) => x[1]), 0.1);
  $('compare').innerHTML = rows.map(([k, t]) => barRow(k, t.toFixed(1) + ' t', Math.round(t / max * 100), 'cmp')).join('');
  const top = entries.slice().sort((a, b) => b[1] - a[1])[0];
  $('tip').innerHTML = `<b>Start here:</b> ${top[0]} is your largest source. ${TIPS[top[0]]}`;
}

/* History (localStorage, wrapped in try/catch because storage can be blocked) */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
}
function saveHistory(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}
function renderHistory() {
  const list = loadHistory();
  $('history').innerHTML = list.length
    ? list.map((h) => `<li>${h.date}: <b>${h.t} t CO₂</b></li>`).join('')
    : '<li class="small">Nothing saved yet.</li>';
}

function initCalculator() {
  document.querySelectorAll('#calcForm input, #calcForm select').forEach((el) => el.addEventListener('input', render));
  $('saveBtn').addEventListener('click', () => {
    const list = loadHistory();
    list.unshift({ date: new Date().toLocaleDateString('en-IN'), t: calculate(readInputs()).tonnes.toFixed(2) });
    saveHistory(list.slice(0, 8));
    renderHistory();
  });
  $('clearBtn').addEventListener('click', () => { saveHistory([]); renderHistory(); });
  $('resetBtn').addEventListener('click', () => { $('calcForm').reset(); render(); });
  render();
  renderHistory();
}

function initNav() {
  const btn = $('menuBtn'), links = $('links');
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  if ($('calcForm')) initCalculator();
});
