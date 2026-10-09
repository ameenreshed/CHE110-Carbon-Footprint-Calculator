'use strict';
/* CarbonTrace: calculation, canvas charts, planner, quiz, tracker, theme. Factors are rounded approximations (see about.html). */
const FACTORS = {
  vehicle: { petrol: 0.17, diesel: 0.15, cng: 0.12, ev: 0.08, bike: 0.05 },
  publicTransport: 0.04, flight: 250, electricity: 0.71, lpgCylinder: 42.5, waste: 0.45,
  diet: { veg: 1000, mixed: 1500, non: 1900 }, treePerYear: 21
};
const CAT_COLORS = { Transport: '#3B82F6', Flights: '#F43F5E', 'Home energy': '#F59E0B', Food: '#10B981', Waste: '#8B5CF6' };
const TIPS = {
  Transport: 'Switch short trips to walking, cycling, bus or train, or share rides.',
  Flights: 'Replace one flight with a train journey or a video call where you can.',
  'Home energy': 'Use 5-star appliances and LED lighting, switch off standby loads, and cook with lids on.',
  Food: 'Eat more seasonal, local and plant-based meals and avoid wasting food.',
  Waste: 'Segregate waste, compost kitchen scraps and cut single-use plastic.'
};
const ACTIONS = [
  { id: 'ev', icon: 'fa-charging-station', label: 'Switch to an electric vehicle', apply: (v) => ({ ...v, vehicle: 'ev' }) },
  { id: 'transit', icon: 'fa-bus', label: 'Replace half my car trips with bus or train', apply: (v) => ({ ...v, carKm: v.carKm / 2, pubKm: v.pubKm + v.carKm / 2 }) },
  { id: 'flight', icon: 'fa-plane-slash', label: 'Take one fewer flight a year', apply: (v) => ({ ...v, flights: Math.max(0, v.flights - 1) }) },
  { id: 'power', icon: 'fa-lightbulb', label: 'Cut electricity use by 20% (LEDs, efficient AC)', apply: (v) => ({ ...v, kwh: v.kwh * 0.8 }) },
  { id: 'lpg', icon: 'fa-fire-burner', label: 'Use 20% less cooking gas', apply: (v) => ({ ...v, lpg: v.lpg * 0.8 }) },
  { id: 'veg', icon: 'fa-carrot', label: 'Move to a vegetarian diet', apply: (v) => ({ ...v, diet: 'veg' }) },
  { id: 'waste', icon: 'fa-recycle', label: 'Halve my household waste (compost and recycle)', apply: (v) => ({ ...v, waste: v.waste / 2 }) }
];
const CAT_ICONS = { Transport: 'fa-car-side', Flights: 'fa-plane', 'Home energy': 'fa-bolt', Food: 'fa-utensils', Waste: 'fa-recycle' };
const SHARE_ICON = { WhatsApp: 'fa-whatsapp', X: 'fa-x-twitter', LinkedIn: 'fa-linkedin-in', Facebook: 'fa-facebook-f', Telegram: 'fa-telegram' };
const PLAT_ICON = { YouTube: 'fa-brands fa-youtube', Instagram: 'fa-brands fa-instagram', LinkedIn: 'fa-brands fa-linkedin', Facebook: 'fa-brands fa-facebook', 'X (Twitter)': 'fa-brands fa-x-twitter', WhatsApp: 'fa-brands fa-whatsapp', Other: 'fa-solid fa-share-nodes' };
const KEYS = { hist: 'carbontrace-history', pledge: 'carbontrace-pledges', theme: 'carbontrace-theme', quiz: 'carbontrace-quiz', social: 'carbontrace-social' };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
function toast(msg) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
async function copyText(text, el) {
  try { await navigator.clipboard.writeText(text); el.textContent = 'Copied to clipboard.'; toast('Copied to clipboard'); }
  catch (e) { el.textContent = 'Copy failed. Select the text manually.'; }
}

/* ---------- Calculation ---------- */
function calculate(v) {
  const people = Math.max(1, v.people || 1);
  const parts = {
    Transport: v.carKm * 52 * FACTORS.vehicle[v.vehicle] + v.pubKm * 52 * FACTORS.publicTransport,
    Flights: v.flights * FACTORS.flight,
    'Home energy': (v.kwh * 12 * FACTORS.electricity + v.lpg * FACTORS.lpgCylinder) / people,
    Food: FACTORS.diet[v.diet],
    Waste: v.waste * 52 * FACTORS.waste
  };
  const kg = Object.values(parts).reduce((a, b) => a + b, 0);
  return { parts, kg, tonnes: kg / 1000 };
}
const gradeOf = (t) => (t <= 1.5 ? 'A' : t <= 2.3 ? 'B' : t <= 3.5 ? 'C' : t <= 4.7 ? 'D' : 'E');
const gradeColor = (t) => (t <= 2.3 ? '#10B981' : t <= 4.7 ? '#F59E0B' : '#F43F5E');
function readInputs() {
  const n = (id) => Number($(id).value);
  return { vehicle: document.querySelector('input[name=vehicle]:checked').value, carKm: n('carKm'), pubKm: n('pubKm'), flights: n('flights'), kwh: n('kwh'),
           lpg: n('lpg'), waste: n('waste'), diet: document.querySelector('input[name=diet]:checked').value, people: n('people') };
}
function pledgedInputs(v) {
  const p = load(KEYS.pledge, []);
  return ACTIONS.filter((a) => p.includes(a.id)).reduce((acc, a) => a.apply(acc), v);
}
const resultText = (r) => `My yearly carbon footprint is ${r.tonnes.toFixed(2)} t CO₂ (grade ${gradeOf(r.tonnes)}). Calculate yours with CarbonTrace:`;

/* ---------- Canvas helpers and charts ---------- */
function setup(id, w, h) {
  const c = $(id), d = window.devicePixelRatio || 1;
  c.width = w * d; c.height = h * d; c.style.width = w + 'px';
  const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
  return { g, w, h, ink: getComputedStyle(document.body).color, grid: 'rgba(128,128,128,.3)' };
}
function drawDonut(parts, tonnes) {
  const { g, w } = setup('donut', 240, 240), cx = w / 2, R = cx - 6;
  const vals = Object.entries(parts), tot = vals.reduce((a, [, v]) => a + v, 0) || 1;
  let a0 = -Math.PI / 2;
  vals.forEach(([k, v]) => {
    const a1 = a0 + (v / tot) * Math.PI * 2;
    g.beginPath(); g.moveTo(cx, cx); g.arc(cx, cx, R, a0, a1); g.closePath(); g.fillStyle = CAT_COLORS[k]; g.fill();
    g.strokeStyle = '#064E3B'; g.lineWidth = 2; g.stroke(); a0 = a1;
  });
  g.beginPath(); g.arc(cx, cx, R * 0.58, 0, Math.PI * 2); g.fillStyle = '#064E3B'; g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 30px Inter, sans-serif'; g.fillText(tonnes.toFixed(1) + ' t', cx, cx + 6);
  g.font = '14px Inter, sans-serif'; g.fillStyle = '#CFE0D3'; g.fillText('CO₂ per year', cx, cx + 28);
}
function drawBars(t) {
  const { g, w, h, ink, grid } = setup('barChart', 520, 280);
  const data = [['You', t, gradeColor(t)], ['India', 1.9, '#3B82F6'], ['World', 4.7, '#F43F5E'], ['Paris 2030', 2.3, '#10B981']];
  const max = Math.max(...data.map((d) => d[1]), 1) * 1.15, base = h - 40, top = 20, bw = 70, gap = (w - 40 - bw * 4) / 3;
  g.strokeStyle = grid; g.fillStyle = ink; g.font = '13px Inter, sans-serif'; g.textAlign = 'right';
  for (let i = 0; i <= 4; i++) { const y = base - (base - top) * i / 4; g.beginPath(); g.moveTo(40, y); g.lineTo(w, y); g.stroke(); g.fillText((max * i / 4).toFixed(1), 34, y + 4); }
  data.forEach(([n, v, col], i) => {
    const x = 50 + i * (bw + gap), bh = (v / max) * (base - top);
    g.fillStyle = col; g.fillRect(x, base - bh, bw, bh);
    g.fillStyle = ink; g.textAlign = 'center'; g.font = '700 14px Inter, sans-serif'; g.fillText(v.toFixed(1) + ' t', x + bw / 2, base - bh - 6);
    g.font = '14px Inter, sans-serif'; g.fillText(n, x + bw / 2, base + 20);
  });
}
function drawProjection(t1, t2) {
  const { g, w, h, ink, grid } = setup('projChart', 520, 280), L = 50, B = h - 36, T = 24, R = w - 16;
  const max = Math.max(t1 * 10, 1) * 1.1, X = (y) => L + (y / 10) * (R - L), Y = (v) => B - (v / max) * (B - T);
  g.strokeStyle = grid; g.fillStyle = ink; g.font = '13px Inter, sans-serif'; g.textAlign = 'right';
  for (let i = 0; i <= 4; i++) { const y = B - (B - T) * i / 4; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.fillText((max * i / 4).toFixed(0), L - 6, y + 4); }
  g.textAlign = 'center'; for (let y = 0; y <= 10; y += 2) g.fillText('Y' + y, X(y), B + 20);
  g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(10), Y(t1 * 10)); g.lineTo(X(10), Y(t2 * 10)); g.lineTo(X(0), Y(0)); g.closePath(); g.fillStyle = 'rgba(16,185,129,.3)'; g.fill();
  g.lineWidth = 3; g.strokeStyle = '#F43F5E'; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(10), Y(t1 * 10)); g.stroke();
  g.strokeStyle = '#10B981'; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(10), Y(t2 * 10)); g.stroke();
  g.textAlign = 'left'; g.font = '700 14px Inter, sans-serif'; g.fillStyle = '#F43F5E'; g.fillText('Now: ' + (t1 * 10).toFixed(1) + ' t', L + 8, T + 8);
  g.fillStyle = '#10B981'; g.fillText('With pledges: ' + (t2 * 10).toFixed(1) + ' t', L + 8, T + 28);
}
function drawTrend() {
  const { g, w, h, ink } = setup('trend', 900, 240);
  const pts = load(KEYS.hist, []).slice().reverse().map((x) => Number(x.t));
  g.fillStyle = ink; g.font = '16px Inter, sans-serif'; g.textAlign = 'center';
  if (pts.length < 2) { g.fillText('Save at least two results to see a trend.', w / 2, h / 2); return; }
  const max = Math.max(...pts, 4.7) * 1.1, pad = 44, step = (w - pad * 2) / (pts.length - 1), y = (t) => h - pad - (t / max) * (h - pad * 2);
  g.strokeStyle = '#10B981'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(pad, y(2.3)); g.lineTo(w - pad, y(2.3)); g.stroke(); g.setLineDash([]);
  g.textAlign = 'left'; g.fillText('2.3 t target', pad + 4, y(2.3) - 6);
  g.strokeStyle = '#3B82F6'; g.lineWidth = 3; g.beginPath(); pts.forEach((t, i) => (i ? g.lineTo(pad + i * step, y(t)) : g.moveTo(pad, y(t)))); g.stroke();
  pts.forEach((t, i) => { g.beginPath(); g.arc(pad + i * step, y(t), 6, 0, 7); g.fillStyle = gradeColor(t); g.fill(); g.fillStyle = ink; g.textAlign = 'center'; g.fillText(t.toFixed(1), pad + i * step, y(t) - 12); });
}

/* ---------- Calculator page ---------- */
const barRow = (label, value, pct, color) => `<div class="bar-row"><div class="lab"><span>${label}</span><span>${value}</span></div><div class="track"><div class="fill" style="width:${pct}%;background:${color}"></div></div></div>`;
function renderPlanner(v, base) {
  const pledged = load(KEYS.pledge, []);
  $('planner').innerHTML = ACTIONS.map((a) => `<label class="chk"><input type="checkbox" data-id="${a.id}" ${pledged.includes(a.id) ? 'checked' : ''}><i class="fa-solid ${a.icon} ci"></i><span>${a.label}</span><span class="sv">saves ${Math.round(base.kg - calculate(a.apply(v)).kg)} kg/yr</span></label>`).join('');
  const r2 = calculate(pledgedInputs(v)), saved = base.kg - r2.kg, pct = base.kg ? Math.round(saved / base.kg * 100) : 0;
  $('pbar').style.width = Math.min(100, pct) + '%';
  $('psum').textContent = pledged.length ? `Your pledges would save about ${Math.round(saved)} kg a year (${pct}%), bringing you to ${r2.tonnes.toFixed(2)} t. Over 10 years that is about ${(saved * 10 / 1000).toFixed(1)} t.` : 'No pledges yet. Tick an action above to see your new footprint.';
  return r2;
}
function renderShare(r) {
  const url = encodeURIComponent(location.href.replace(/calculator\.html.*/, 'index.html')), txt = encodeURIComponent(resultText(r));
  const L = [['WhatsApp', `https://wa.me/?text=${txt}%20${url}`], ['X', `https://twitter.com/intent/tweet?text=${txt}&url=${url}`], ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${url}`], ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${url}`], ['Telegram', `https://t.me/share/url?url=${url}&text=${txt}`]];
  $('share').innerHTML = L.map(([n, h]) => `<a href="${h}" target="_blank" rel="noopener"><i class="fa-brands ${SHARE_ICON[n]}"></i> ${n}</a>`).join('');
}
function render() {
  const v = readInputs();
  ['carKm', 'pubKm', 'flights', 'kwh', 'lpg', 'waste', 'people'].forEach((k) => { const el = $(k); $('o-' + k).textContent = v[k]; el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); });
  const r = calculate(v), t = r.tonnes;
  $('total').textContent = t.toFixed(2);
  $('grade').textContent = 'Eco grade ' + gradeOf(t);
  $('grade').style.background = gradeColor(t);
  $('verdict').textContent = t <= 2.3 ? 'At or below a Paris-aligned level. Keep it up.' : t <= 4.7 ? 'Below the world average, but above the 2030 target.' : 'Above the world average. Small changes will help a lot.';
  $('trees').textContent = `About ${Math.ceil(r.kg / FACTORS.treePerYear)} trees would be needed to absorb this in a year.`;
  const entries = Object.entries(r.parts);
  $('parts').innerHTML = entries.map(([k, kg]) => barRow(`<i class="fa-solid ${CAT_ICONS[k]}" style="color:${CAT_COLORS[k]};width:20px"></i> ${k}`, Math.round(kg) + ' kg', r.kg ? Math.round(kg / r.kg * 100) : 0, CAT_COLORS[k])).join('');
  const top = entries.slice().sort((a, b) => b[1] - a[1])[0];
  $('tip').innerHTML = `<b>Start here:</b> ${top[0]} is your largest source. ${TIPS[top[0]]}`;
  const r2 = renderPlanner(v, r);
  drawDonut(r.parts, t); drawBars(t); drawProjection(t, r2.tonnes); drawTrend(); renderShare(r);
}
function renderHistory() {
  const list = load(KEYS.hist, []);
  $('history').innerHTML = list.length ? list.map((h) => `<li>${esc(h.date)}: <b>${esc(h.t)} t CO₂</b></li>`).join('') : '<li class="small">Nothing saved yet.</li>';
}
function initCalculator() {
  document.querySelectorAll('#calcForm input, #calcForm select').forEach((el) => el.addEventListener('input', render));
  $('planner').addEventListener('change', (e) => {
    const id = e.target.dataset.id; if (!id) return;
    const s = new Set(load(KEYS.pledge, [])); e.target.checked ? s.add(id) : s.delete(id);
    save(KEYS.pledge, [...s]); render();
  });
  $('saveBtn').addEventListener('click', () => {
    const list = load(KEYS.hist, []);
    list.unshift({ date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), t: calculate(readInputs()).tonnes.toFixed(2) });
    save(KEYS.hist, list.slice(0, 12)); renderHistory(); drawTrend(); toast('Result saved');
  });
  $('clearBtn').addEventListener('click', () => { save(KEYS.hist, []); renderHistory(); drawTrend(); });
  $('resetBtn').addEventListener('click', () => { $('calcForm').reset(); render(); });
  $('copyBtn').addEventListener('click', () => copyText(resultText(calculate(readInputs())) + ' ' + location.href, $('msg')));
  if (!navigator.share) $('nativeShare').style.display = 'none';
  $('nativeShare').addEventListener('click', () => navigator.share({ title: 'CarbonTrace', text: resultText(calculate(readInputs())), url: location.href }).catch(() => {}));
  $('csvBtn').addEventListener('click', () => download('carbon-history.csv', 'date,tonnes_co2\n' + load(KEYS.hist, []).map((h) => `"${h.date}",${h.t}`).join('\n')));
  $('printBtn').addEventListener('click', () => window.print());
  render(); renderHistory();
}

/* ---------- Quiz ---------- */
const QUIZ = [
  { q: 'Which gas contributes most to human-caused global warming?', o: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'], a: 1, e: 'Carbon dioxide from burning fossil fuels is the largest contributor.' },
  { q: 'Which usually emits the least CO₂ per passenger-km?', o: ['Petrol car with one person', 'Domestic flight', 'Train', 'Diesel SUV'], a: 2, e: 'Trains carry many people efficiently, so emissions per passenger are low.' },
  { q: 'About how much CO₂ does a mature tree absorb in a year?', o: ['2 kg', '21 kg', '210 kg', '2,100 kg'], a: 1, e: 'Roughly 21 kg a year is a commonly used estimate, so cutting emissions matters more than relying on trees alone.' },
  { q: 'Where should a banana peel go?', o: ['Dry waste', 'Hazardous waste', 'Wet (biodegradable) waste', 'E-waste'], a: 2, e: 'Kitchen scraps are biodegradable and can be composted.' },
  { q: 'Which bulb uses the least electricity for the same light?', o: ['Incandescent', 'Halogen', 'LED', 'Candle'], a: 2, e: 'LEDs use far less power than incandescent or halogen bulbs.' },
  { q: 'What does the Paris Agreement aim to limit warming to?', o: ['Well below 2 °C', 'Below 5 °C', 'Below 4 °C', 'Below 3 °C'], a: 0, e: 'It aims for well below 2 °C, pursuing 1.5 °C.' },
  { q: 'Which diet generally has the lowest footprint?', o: ['Meat-heavy', 'Mixed', 'Plant-based', 'They are all equal'], a: 2, e: 'Plant-based diets generally cause fewer emissions than meat-heavy ones.' },
  { q: 'Which is a renewable energy source?', o: ['Coal', 'Natural gas', 'Solar', 'Petrol'], a: 2, e: 'Solar energy is replenished naturally and produces no CO₂ while generating power.' }
];
function initQuiz() {
  const box = $('quizBox'); let i = 0, score = 0;
  function show() {
    if (i >= QUIZ.length) {
      const best = Math.max(score, load(KEYS.quiz, 0)); save(KEYS.quiz, best);
      const badge = score >= 7 ? '<i class="fa-solid fa-trophy"></i> Eco Champion' : score >= 5 ? '<i class="fa-solid fa-seedling"></i> Green Learner' : '<i class="fa-solid fa-earth-asia"></i> Eco Beginner';
      box.innerHTML = `<h2>Your score: ${score} / ${QUIZ.length}</h2><p class="lead" style="color:var(--ink)">Badge: <b>${badge}</b>. Best score: ${best}.</p><br><button class="btn" id="again">Try again</button>`;
      $('again').addEventListener('click', () => { i = 0; score = 0; show(); }); return;
    }
    const Q = QUIZ[i];
    box.innerHTML = `<p class="small" style="margin:0">Question ${i + 1} of ${QUIZ.length}</p><div class="qprog"><div style="width:${i / QUIZ.length * 100}%"></div></div><h2 style="font-size:26px">${Q.q}</h2>` + Q.o.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join('') + '<p id="fb"></p><div id="nx"></div>';
    box.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      const k = Number(b.dataset.k); if (k === Q.a) score++;
      box.querySelectorAll('.opt').forEach((x) => { x.disabled = true; if (Number(x.dataset.k) === Q.a) x.classList.add('right'); });
      if (k !== Q.a) b.classList.add('wrong');
      $('fb').textContent = (k === Q.a ? 'Correct. ' : 'Not quite. ') + Q.e;
      $('nx').innerHTML = `<button class="btn" id="next">${i === QUIZ.length - 1 ? 'See score' : 'Next question'}</button>`;
      $('next').addEventListener('click', () => { i++; show(); });
    }));
  }
  show();
}

/* ---------- Social media tracker ---------- */
function initTracker() {
  $('tDate').valueAsDate = new Date();
  const num = (id) => Math.max(0, Number($(id).value) || 0), rows = () => load(KEYS.social, []);
  function draw() {
    const L = rows(), sum = (k) => L.reduce((a, p) => a + p[k], 0);
    $('tBody').innerHTML = L.length ? L.map((p, i) => `<tr><td>${i + 1}</td><td><i class="${PLAT_ICON[p.plat] || 'fa-solid fa-share-nodes'}"></i> ${esc(p.plat)}</td><td><a href="${esc(p.url)}" target="_blank" rel="noopener">Open</a></td><td>${esc(p.date)}</td><td>${p.views}</td><td>${p.likes}</td><td>${p.shares}</td><td>${p.com}</td><td><button class="del" data-i="${i}" aria-label="Delete post ${i + 1}">Delete</button></td></tr>`).join('') : '<tr><td colspan="9">No posts added yet.</td></tr>';
    $('tFoot').innerHTML = L.length ? `<tr><th colspan="4">Total (${L.length} posts)</th><th>${sum('views')}</th><th>${sum('likes')}</th><th>${sum('shares')}</th><th>${sum('com')}</th><th></th></tr>` : '';
  }
  $('tAdd').addEventListener('click', () => {
    const url = $('tUrl').value.trim();
    if (!/^https?:\/\//i.test(url)) { $('tMsg').textContent = 'Enter a valid link starting with https://'; return; }
    const L = rows(); L.push({ plat: $('tPlat').value, url, date: $('tDate').value, views: num('tViews'), likes: num('tLikes'), shares: num('tShares'), com: num('tCom') });
    save(KEYS.social, L); $('tUrl').value = ''; $('tMsg').textContent = 'Post added.'; toast('Post added'); draw();
  });
  $('tBody').addEventListener('click', (e) => { const i = e.target.dataset.i; if (i === undefined) return; const L = rows(); L.splice(Number(i), 1); save(KEYS.social, L); draw(); });
  $('tCopy').addEventListener('click', () => copyText('S.No\tPlatform\tLink\tDate\tViews\tLikes\tShares\tComments\n' + rows().map((p, i) => [i + 1, p.plat, p.url, p.date, p.views, p.likes, p.shares, p.com].join('\t')).join('\n'), $('tMsg')));
  $('tCsv').addEventListener('click', () => download('social-media-coverage.csv', 'platform,link,date,views,likes,shares,comments\n' + rows().map((p) => [p.plat, p.url, p.date, p.views, p.likes, p.shares, p.com].join(',')).join('\n')));
  draw();
}

/* ---------- Theme and navigation ---------- */
function initTheme() {
  const root = document.documentElement, btn = $('themeBtn');
  if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const paint = () => { btn.innerHTML = root.getAttribute('data-theme') === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>'; };
  paint();
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next); save(KEYS.theme, next); paint();
    if ($('calcForm')) render();
  });
}
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.1 });
  els.forEach((e) => io.observe(e));
}
function initNav() {
  const btn = $('menuBtn'), links = $('links');
  btn.addEventListener('click', () => { const open = links.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open)); });
}
document.addEventListener('DOMContentLoaded', () => {
  initNav(); initTheme(); initReveal();
  if ($('calcForm')) initCalculator();
  if ($('quizBox')) initQuiz();
  if ($('tForm')) initTracker();
});
