/* ==========================================================================
   Carbotrack — certificate.js
   Dual certificates + full-name resolution + Supabase challenge loading.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const S = window.CT_STORAGE;

  /* ================================================================== */
  /*  TIERS                                                             */
  /* ================================================================== */
  const TIERS = {
    champion: {
      key: 'champion',
      title: 'Climate Champion',
      subtitle: 'Nature Savior — Tier 1',
      badge: 'PARIS COMPLIANT',
      icon: 'fa-trophy',
      rangeIcon: 'fa-award',
      range: '0 – 2 t',
      message: 'You live within the Earth\'s natural biocapacity to absorb carbon. Your lifestyle aligns with the 1.5°C Paris Agreement target — you are a true champion of sustainability.'
    },
    moderate: {
      key: 'moderate',
      title: 'Global Citizen',
      subtitle: 'Moderate Impact — Tier 2',
      badge: 'TRANSITION ZONE',
      icon: 'fa-globe',
      rangeIcon: 'fa-earth-asia',
      range: '2 – 5 t',
      message: 'Your footprint matches the global average. You are in a transitional zone — significantly better than industrialized nations, yet with clear room to reach true planetary sustainability.'
    },
    high: {
      key: 'high',
      title: 'High Impact',
      subtitle: 'Urgent Action Needed — Tier 3',
      badge: 'UNSUSTAINABLE',
      icon: 'fa-triangle-exclamation',
      rangeIcon: 'fa-arrow-up',
      range: '5 – 10 t',
      message: 'Your footprint exceeds safe planetary boundaries. Typical of European averages, this level directly contributes to climate warming. Meaningful lifestyle changes are essential.'
    },
    severe: {
      key: 'severe',
      title: 'Severe Impact',
      subtitle: 'Critical Overconsumption — Tier 4',
      badge: 'CRITICAL',
      icon: 'fa-circle-exclamation',
      rangeIcon: 'fa-fire',
      range: '10+ t',
      message: 'Your footprint is in the critical overconsumption range. Comparable to U.S. or Canadian averages, this level heavily accelerates extreme weather events. Immediate, substantial action is critical.'
    }
  };

  function classifyTier(totalTons) {
    const n = Number(totalTons) || 0;
    if (n < 2)  return TIERS.champion;
    if (n < 5)  return TIERS.moderate;
    if (n < 10) return TIERS.high;
    return TIERS.severe;
  }

  const CAPTURE_W = 1123;
  const CAPTURE_H = 794;
  const CAPTURE_SCALE = 2.5;

  let currentCert = { mode: 'carbon', data: null, tier: null };
  let shareModalEl = null;
  let shareModalLastFocus = null;

  /* ================================================================== */
  /*  HELPERS                                                           */
  /* ================================================================== */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }

  function makeCertId(prefix, username, date) {
    const y = new Date(date).getFullYear();
    const h = fnv1a(username + '|' + date + '|' + prefix).slice(0, 6);
    return 'CT-' + prefix + '-' + y + '-' + h;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) { return iso; }
  }

  function initialsOf(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
  }

  /* ================================================================== */
  /*  NAME RESOLUTION                                                   */
  /* ================================================================== */
  function resolveUserFullName() {
    const sb = window.CT_SB_AUTH;
    if (!sb) return 'Friend';

    const u    = sb.getUser     ? sb.getUser()     : null;
    const p    = sb.getProfile  ? sb.getProfile()  : null;
    const meta = (u && u.user_metadata) || {};

    if (p && p.full_name && String(p.full_name).trim()) {
      return String(p.full_name).trim();
    }
    const mName = meta.full_name || meta.name || meta.display_name;
    if (mName && String(mName).trim()) {
      return String(mName).trim();
    }
    if (p && p.username) return String(p.username).trim();
    if (meta.username)   return String(meta.username).trim();
    if (u && u.email)    return u.email.split('@')[0];
    return 'Friend';
  }

  function resolveUsername() {
    const sb = window.CT_SB_AUTH;
    if (!sb) return 'user';
    const u = sb.getUser ? sb.getUser() : null;
    const p = sb.getProfile ? sb.getProfile() : null;
    const meta = (u && u.user_metadata) || {};
    return (p && p.username) || meta.username ||
      (u && u.email ? u.email.split('@')[0] : 'user');
  }

  /* ================================================================== */
  /*  WAIT HELPERS                                                      */
  /* ================================================================== */
  function waitForAuthReady(timeoutMs) {
    if (window.CT_AUTH_READY) return Promise.resolve();
    return new Promise(function (resolve) {
      const timer = setTimeout(resolve, timeoutMs || 3000);
      document.addEventListener('ct:auth-ready', function () {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  async function waitForProfile(maxWaitMs) {
    maxWaitMs = maxWaitMs || 4000;

    if (window.CT_SB_AUTH && window.CT_SB_AUTH.getProfile && window.CT_SB_AUTH.getProfile()) {
      return true;
    }
    if (window.CT_SB_AUTH && window.CT_SB_AUTH.waitForProfile) {
      try { return await window.CT_SB_AUTH.waitForProfile(maxWaitMs); }
      catch (e) { /* fall through */ }
    }

    return new Promise(function (resolve) {
      const start = Date.now();
      const iv = setInterval(function () {
        if (window.CT_SB_AUTH && window.CT_SB_AUTH.getProfile && window.CT_SB_AUTH.getProfile()) {
          clearInterval(iv);
          resolve(true);
        } else if (Date.now() - start >= maxWaitMs) {
          clearInterval(iv);
          resolve(false);
        }
      }, 120);
    });
  }

  /* ================================================================== */
  /*  CHALLENGE LOADER (Supabase first)                                 */
  /* ================================================================== */
  async function loadChallengeDays() {
    const sb = window.CT_SB_AUTH;

    if (sb && sb.isLoggedIn && sb.isLoggedIn() && window.CT_SB_CHALLENGE) {
      const user = sb.getUser ? sb.getUser() : null;
      if (user) {
        try {
          const remote = await window.CT_SB_CHALLENGE.load(user.id);
          if (remote.ok && remote.exists) {
            return remote.days;
          }
        } catch (e) {
          console.warn('[Carbotrack] challenge remote load failed', e);
        }
      }
    }

    /* Fallback to localStorage */
    const local = S.getChallenge();
    if (local && Array.isArray(local.days)) {
      const out = [false, false, false, false, false, false, false];
      for (let i = 0; i < 7; i++) out[i] = !!local.days[i];
      return out;
    }
    return [false, false, false, false, false, false, false];
  }

  /* ================================================================== */
  /*  FONT PRELOAD                                                      */
  /* ================================================================== */
  async function waitForFonts() {
    if (!document.fonts) return;
    const specs = [
      '300 1rem "Inter"', '400 1rem "Inter"', '500 1rem "Inter"',
      '600 1rem "Inter"', '700 1rem "Inter"',
      '500 1rem "Poppins"', '600 1rem "Poppins"', '700 1rem "Poppins"', '800 1rem "Poppins"',
      '600 1rem "Playfair Display"', '700 1rem "Playfair Display"',
      '800 1rem "Playfair Display"', '900 1rem "Playfair Display"',
      '400 1rem "Cormorant Garamond"', '500 1rem "Cormorant Garamond"',
      '600 1rem "Cormorant Garamond"', '700 1rem "Cormorant Garamond"',
      'italic 400 1rem "Cormorant Garamond"', 'italic 500 1rem "Cormorant Garamond"'
    ];
    try {
      await Promise.all(specs.map(function (s) { return document.fonts.load(s); }));
      await document.fonts.ready;
    } catch (e) { /* ignore */ }
  }

  /* ================================================================== */
  /*  CLIPBOARD                                                         */
  /* ================================================================== */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); resolve(); }
      catch (e) { reject(e); }
      finally { document.body.removeChild(ta); }
    });
  }

  /* ================================================================== */
  /*  RENDER — CARBON                                                   */
  /* ================================================================== */
  function renderCarbonCert(data) {
    const tier = classifyTier(data.totalTons);
    currentCert.mode = 'carbon';
    currentCert.data = data;
    currentCert.tier = tier;

    $('cert-shell-carbon').classList.remove('hidden');
    $('cert-shell-challenge').classList.add('hidden');

    const sheet = $('cert-sheet-carbon');
    sheet.className = 'cert-sheet cert-sheet--carbon cert-sheet--' + tier.key;

    const set = function (id, v) { const el = $(id); if (el) el.textContent = v; };

    set('cert-name', data.name);
    set('cert-tons', data.totalTons.toFixed(2) + ' t');
    set('cert-score', data.ecoScore + '/100');
    set('cert-date', formatDate(data.issuedAt));
    set('cert-id', data.certId);
    set('cert-tier-title', tier.title);
    set('cert-tier-subtitle', tier.subtitle);
    set('cert-tier-badge', tier.badge);
    set('cert-tier-range', tier.range);
    set('cert-tier-message', tier.message);

    const tierIcon = $('cert-tier-icon');
    if (tierIcon) tierIcon.className = 'fa-solid ' + tier.icon;

    const rangeIcon = $('cert-tier-range-icon');
    if (rangeIcon) rangeIcon.className = 'fa-solid ' + tier.rangeIcon;

    document.title = data.name + ' · ' + tier.title + ' Certificate — Carbotrack';
  }

  /* ================================================================== */
  /*  RENDER — CHALLENGE                                                */
  /* ================================================================== */
  function renderChallengeCert(data) {
    currentCert.mode = 'challenge';
    currentCert.data = data;
    currentCert.tier = null;

    $('cert-shell-carbon').classList.add('hidden');
    $('cert-shell-challenge').classList.remove('hidden');

    const set = function (id, v) { const el = $(id); if (el) el.textContent = v; };

    set('chal-cert-name', data.name);
    set('chal-cert-date', formatDate(data.issuedAt));
    set('chal-cert-id', data.certId);

    document.title = data.name + ' · Challenge Champion — Carbotrack';
  }

  /* ================================================================== */
  /*  BUILD                                                             */
  /* ================================================================== */
  function buildCarbonData(results) {
    const issuedAt = new Date().toISOString();
    const name = resolveUserFullName();
    const username = resolveUsername();
    return {
      type: 'carbon',
      name: name,
      username: username,
      totalTons: results.totalTons,
      ecoScore: results.ecoScore,
      issuedAt: issuedAt,
      certId: makeCertId('C', username, issuedAt)
    };
  }

  function buildChallengeData() {
    const issuedAt = new Date().toISOString();
    const name = resolveUserFullName();
    const username = resolveUsername();
    return {
      type: 'challenge',
      name: name,
      username: username,
      issuedAt: issuedAt,
      certId: makeCertId('H', username, issuedAt)
    };
  }

  /* ================================================================== */
  /*  SHARE ENCODE / DECODE                                             */
  /* ================================================================== */
  function encodeShare(data) {
    const payload = {
      typ: data.type === 'challenge' ? 'h' : 'c',
      n: data.name,
      u: data.username,
      d: data.issuedAt,
      i: data.certId
    };
    if (data.type === 'carbon') {
      payload.t = data.totalTons;
      payload.e = data.ecoScore;
    }
    return S.encodeInputs(payload);
  }

  function decodeShare(payload) {
    if (!payload) return null;
    const raw = S.decodeInputs(payload);
    if (!raw) return null;

    if (raw.typ === 'h') {
      return {
        type: 'challenge', name: raw.n, username: raw.u,
        issuedAt: raw.d, certId: raw.i, shared: true
      };
    }

    return {
      type: 'carbon', name: raw.n, username: raw.u,
      totalTons: parseFloat(raw.t) || 0,
      ecoScore: parseInt(raw.e, 10) || 0,
      issuedAt: raw.d, certId: raw.i, shared: true
    };
  }

  function getShareUrl() {
    if (!currentCert.data) return '';
    const base = window.location.href.split('#')[0];
    return base + '#s=' + encodeShare(currentCert.data);
  }

  function buildShareText() {
    if (!currentCert.data) return '';
    if (currentCert.mode === 'challenge') {
      return [
        '🏆 I completed the 7-Day Campus Eco Challenge on Carbotrack!',
        '',
        '🌿 7 sustainable actions. 7 days. 1 planet saved.',
        '🎖️ Challenge Champion Certificate unlocked.',
        '',
        'Join the challenge 👇'
      ].join('\n');
    }

    const tier = currentCert.tier;
    return [
      '🌿 I just measured my carbon footprint with Carbotrack!',
      '',
      '🏅 Tier: ' + tier.title + ' (' + tier.range + ')',
      '📊 Eco Score: ' + currentCert.data.ecoScore + '/100',
      '🌍 Annual Footprint: ' + currentCert.data.totalTons.toFixed(2) + ' t CO₂e',
      '',
      'Find out yours 👇'
    ].join('\n');
  }

  /* ================================================================== */
  /*  CAPTURE                                                           */
  /* ================================================================== */
  function activeSheet() {
    if (currentCert.mode === 'challenge') return $('cert-sheet-challenge');
    return $('cert-sheet-carbon');
  }

  function activeBgColor() {
    if (currentCert.mode === 'challenge') return '#07190f';
    const tier = currentCert.tier;
    if (!tier) return '#07130d';
    return {
      champion: '#071a10', moderate: '#071522',
      high: '#1a1005', severe: '#1a0404'
    }[tier.key] || '#07130d';
  }

  async function captureCanvas() {
    const sheet = activeSheet();
    if (!sheet) throw new Error('Certificate element not found');

    await waitForFonts();
    await new Promise(function (r) {
      requestAnimationFrame(function () { requestAnimationFrame(r); });
    });

    const bg = activeBgColor();

    const wrapper = document.createElement('div');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.style.cssText =
      'position:absolute;left:-99999px;top:0;width:' + CAPTURE_W + 'px;height:' + CAPTURE_H + 'px;' +
      'overflow:hidden;pointer-events:none;background:' + bg + ';';

    const clone = sheet.cloneNode(true);
    clone.id = 'cert-capture';

    Object.assign(clone.style, {
      width: CAPTURE_W + 'px',
      height: CAPTURE_H + 'px',
      maxWidth: 'none', maxHeight: 'none',
      aspectRatio: 'auto', borderRadius: '0',
      boxShadow: 'none', margin: '0', transform: 'none'
    });

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      if (typeof html2canvas === 'undefined') throw new Error('html2canvas not loaded');
      return await html2canvas(clone, {
        scale: CAPTURE_SCALE, useCORS: true, backgroundColor: bg,
        logging: false, width: CAPTURE_W, height: CAPTURE_H,
        windowWidth: 1400, windowHeight: 1000,
        scrollX: 0, scrollY: 0, imageTimeout: 30000,
        allowTaint: false, removeContainer: true
      });
    } finally {
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
  }

  /* ================================================================== */
  /*  DOWNLOAD PDF                                                      */
  /* ================================================================== */
  async function downloadPDF() {
    const btn = $('cert-download-pdf-btn');
    if (!btn) return;

    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Preparing PDF…</span>';

    try {
      if (typeof window.jspdf === 'undefined') throw new Error('jsPDF not loaded');
      const canvas = await captureCanvas();
      const imgData = canvas.toDataURL('image/png');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      const prefix = currentCert.mode === 'challenge' ? 'Challenge' : 'Certificate';
      pdf.save('Carbotrack-' + prefix + '-' + currentCert.data.certId + '.pdf');

      if (window.CT_TOAST) window.CT_TOAST.show('PDF downloaded successfully!', 'success', 2800);
    } catch (err) {
      console.error('[Carbotrack] PDF failed', err);
      if (window.CT_TOAST) window.CT_TOAST.show('PDF failed — try PNG instead.', 'error', 3400);
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  /* ================================================================== */
  /*  DOWNLOAD PNG                                                      */
  /* ================================================================== */
  async function downloadPNG() {
    const btn = $('cert-download-png-btn');
    if (!btn) return;

    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Preparing image…</span>';

    try {
      const canvas = await captureCanvas();
      const imgData = canvas.toDataURL('image/png');

      const link = document.createElement('a');
      const prefix = currentCert.mode === 'challenge' ? 'Challenge' : 'Certificate';
      link.download = 'Carbotrack-' + prefix + '-' + currentCert.data.certId + '.png';
      link.href = imgData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.CT_TOAST) window.CT_TOAST.show('PNG downloaded!', 'success', 2800);
    } catch (err) {
      console.error('[Carbotrack] PNG failed', err);
      if (window.CT_TOAST) window.CT_TOAST.show('Image download failed.', 'error', 3400);
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  /* ================================================================== */
  /*  QR                                                                */
  /* ================================================================== */
  function renderQRCode(container, text, size) {
    if (!container) return;
    container.innerHTML = '';
    if (typeof QRCode === 'undefined') {
      container.innerHTML = '<span class="share-qr__fallback">QR unavailable</span>';
      return;
    }
    try {
      new QRCode(container, {
        text: text, width: size, height: size,
        colorDark: '#e0b53c', colorLight: '#07130d',
        correctLevel: QRCode.CorrectLevel.L
      });
    } catch (err) {
      console.warn('[Carbotrack] QR failed', err);
      container.innerHTML = '<span class="share-qr__fallback">QR error</span>';
    }
  }

  function generateQRDataURL(text, size) {
    return new Promise(function (resolve) {
      if (typeof QRCode === 'undefined') return resolve('');
      const temp = document.createElement('div');
      temp.style.cssText = 'position:fixed;left:-99999px;top:0;';
      document.body.appendChild(temp);

      try {
        new QRCode(temp, {
          text: text, width: size, height: size,
          colorDark: '#e0b53c', colorLight: '#07130d',
          correctLevel: QRCode.CorrectLevel.L
        });
        setTimeout(function () {
          const canvas = temp.querySelector('canvas');
          const img = temp.querySelector('img');
          let url = '';
          if (canvas) { try { url = canvas.toDataURL('image/png'); } catch (e) {} }
          if (!url && img && img.src) url = img.src;
          document.body.removeChild(temp);
          resolve(url);
        }, 60);
      } catch (e) {
        document.body.removeChild(temp);
        resolve('');
      }
    });
  }

  /* ================================================================== */
  /*  SHARE TARGETS                                                     */
  /* ================================================================== */
  const SHARE_TARGETS = [
    { key: 'whatsapp', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp', color: '#25D366',
      build: function (t, u) { return 'https://wa.me/?text=' + encodeURIComponent(t + '\n\n' + u); } },
    { key: 'telegram', label: 'Telegram', icon: 'fa-brands fa-telegram', color: '#26A5E4',
      build: function (t, u) { return 'https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(t); } },
    { key: 'x', label: 'X / Twitter', icon: 'fa-brands fa-x-twitter', color: '#1a1a1a',
      build: function (t, u) { return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(u); } },
    { key: 'linkedin', label: 'LinkedIn', icon: 'fa-brands fa-linkedin-in', color: '#0A66C2',
      build: function (t, u) { return 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u); } },
    { key: 'facebook', label: 'Facebook', icon: 'fa-brands fa-facebook-f', color: '#1877F2',
      build: function (t, u) { return 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u); } },
    { key: 'email', label: 'Email', icon: 'fa-solid fa-envelope', color: '#64748b',
      build: function (t, u) { return 'mailto:?subject=' + encodeURIComponent('My Carbotrack Certificate') + '&body=' + encodeURIComponent(t + '\n\n' + u); } }
  ];

  function renderShareTargets() {
    const wrap = $('share-targets');
    if (!wrap) return;

    wrap.innerHTML = SHARE_TARGETS.map(function (t) {
      return '<button type="button" class="share-target" data-share-target="' + t.key + '">' +
        '<span class="share-target__icon" style="background:' + t.color + '">' +
          '<i class="' + t.icon + '"></i>' +
        '</span>' +
        '<span class="share-target__label">' + t.label + '</span>' +
        '<i class="fa-solid fa-chevron-right share-target__arrow"></i>' +
      '</button>';
    }).join('');

    wrap.querySelectorAll('[data-share-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-share-target');
        const target = SHARE_TARGETS.find(function (t) { return t.key === key; });
        if (!target) return;
        const dest = target.build(buildShareText(), getShareUrl());
        window.open(dest, '_blank', 'noopener,noreferrer,width=620,height=680');
        if (window.CT_TOAST) window.CT_TOAST.show('Opening ' + target.label + '…', 'info', 2200);
      });
    });
  }

  /* ================================================================== */
  /*  NATIVE SHARE                                                      */
  /* ================================================================== */
  function initNativeShare() {
    const btn = $('share-native-btn');
    if (!btn) return;
    if (!navigator.share) return;

    btn.classList.remove('hidden');
    btn.addEventListener('click', async function () {
      try {
        await navigator.share({
          title: currentCert.mode === 'challenge'
            ? 'My Carbotrack Challenge Certificate'
            : 'My Carbotrack Certificate',
          text: buildShareText(),
          url: getShareUrl()
        });
        if (window.CT_TOAST) window.CT_TOAST.show('Shared!', 'success', 2200);
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          if (window.CT_TOAST) window.CT_TOAST.show('Share cancelled.', 'info', 2400);
        }
      }
    });
  }

  /* ================================================================== */
  /*  SHARE MODAL                                                       */
  /* ================================================================== */
  function ensureShareModal() {
    shareModalEl = $('share-modal');
    if (!shareModalEl) return null;
    if (shareModalEl.dataset.wired === '1') return shareModalEl;
    shareModalEl.dataset.wired = '1';

    shareModalEl.querySelectorAll('[data-share-close]').forEach(function (el) {
      el.addEventListener('click', closeShareModal);
    });

    const urlInput = $('share-url-input');
    const copyUrlBtn = $('share-copy-url-btn');
    const copyTextBtn = $('share-copy-text-btn');
    const cardBtn = $('share-download-card-btn');

    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', async function () {
        try {
          await copyText(getShareUrl());
          if (window.CT_TOAST) window.CT_TOAST.show('Share link copied!', 'success', 2200);
        } catch (e) {
          if (urlInput) { urlInput.select(); urlInput.setSelectionRange(0, 99999); }
          if (window.CT_TOAST) window.CT_TOAST.show('Press Ctrl+C to copy.', 'info', 2600);
        }
      });
    }

    if (copyTextBtn) {
      copyTextBtn.addEventListener('click', async function () {
        try {
          await copyText(buildShareText() + '\n\n' + getShareUrl());
          if (window.CT_TOAST) window.CT_TOAST.show('Share text copied!', 'success', 2200);
        } catch (e) {
          if (window.CT_TOAST) window.CT_TOAST.show('Copy failed.', 'error', 2600);
        }
      });
    }

    if (cardBtn) cardBtn.addEventListener('click', downloadShareCard);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isShareModalOpen()) {
        e.preventDefault();
        closeShareModal();
      }
    });

    shareModalEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        shareModalEl.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(function (el) { return el.offsetParent !== null; });
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && (document.activeElement === first || !shareModalEl.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !shareModalEl.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    });

    return shareModalEl;
  }

  function isShareModalOpen() {
    return !!(shareModalEl && !shareModalEl.hidden);
  }

  function openShareModal() {
    if (!currentCert.data) return;
    const modal = ensureShareModal();
    if (!modal) return;

    shareModalLastFocus = document.activeElement;

    const av = $('share-preview-avatar');
    if (av) av.textContent = initialsOf(currentCert.data.name);
    const nameEl = $('share-preview-name');
    if (nameEl) nameEl.textContent = currentCert.data.name;

    if (currentCert.mode === 'challenge') {
      const sub = $('share-preview-sub'); if (sub) sub.textContent = '7-Day Challenge Champion';
      const s1 = $('share-preview-stat1-label'); if (s1) s1.textContent = 'Actions';
      const sc = $('share-preview-score'); if (sc) sc.textContent = '7/7';
      const s2 = $('share-preview-stat2-label'); if (s2) s2.textContent = 'Days';
      const tn = $('share-preview-tons'); if (tn) tn.textContent = '7';
    } else {
      const sub = $('share-preview-sub'); if (sub) sub.textContent = currentCert.tier.title + ' · Carbotrack Certified';
      const s1 = $('share-preview-stat1-label'); if (s1) s1.textContent = 'Score';
      const sc = $('share-preview-score'); if (sc) sc.textContent = currentCert.data.ecoScore + '/100';
      const s2 = $('share-preview-stat2-label'); if (s2) s2.textContent = 'Footprint';
      const tn = $('share-preview-tons'); if (tn) tn.textContent = currentCert.data.totalTons.toFixed(2) + ' t';
    }

    const urlInput = $('share-url-input');
    if (urlInput) urlInput.value = getShareUrl();

    const qrHost = $('share-qr-canvas');
    if (qrHost) renderQRCode(qrHost, getShareUrl(), 180);

    renderShareTargets();

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
    document.body.classList.add('is-share-open');

    window.setTimeout(function () {
      const closeBtn = modal.querySelector('.share-modal__close');
      if (closeBtn) closeBtn.focus();
    }, 120);
  }

  function closeShareModal() {
    if (!shareModalEl) return;
    shareModalEl.classList.remove('is-open');
    shareModalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-share-open');
    window.setTimeout(function () {
      shareModalEl.hidden = true;
      if (shareModalLastFocus && typeof shareModalLastFocus.focus === 'function') {
        shareModalLastFocus.focus();
      }
      shareModalLastFocus = null;
    }, 240);
  }

  /* ================================================================== */
  /*  SHARE CARD                                                        */
  /* ================================================================== */
  async function downloadShareCard() {
    if (!currentCert.data) return;
    const btn = $('share-download-card-btn');
    const original = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating…';
    }

    try {
      await waitForFonts();
      const url = getShareUrl();
      const qrDataUrl = await generateQRDataURL(url, 220);
      const initials = initialsOf(currentCert.data.name);

      const card = document.createElement('div');
      card.style.cssText = [
        'position:absolute', 'left:-99999px', 'top:0',
        'width:1080px', 'height:1080px', 'padding:72px', 'box-sizing:border-box',
        'display:flex', 'flex-direction:column', 'justify-content:space-between', 'align-items:center',
        'text-align:center', 'font-family:"Inter",sans-serif', 'color:#f5f0e1',
        'background-color:#07130d',
        'background-image:radial-gradient(ellipse at 15% 20%, rgba(52,211,153,.18), transparent 55%),radial-gradient(ellipse at 85% 80%, rgba(201,162,39,.16), transparent 55%),linear-gradient(135deg,#0a1a12 0%,#07130d 55%,#04100a 100%)'
      ].join(';');

      const statBlock = currentCert.mode === 'challenge'
        ? '<div style="display:flex;gap:18px;margin-top:8px">' +
            '<div style="min-width:200px;padding:22px 26px;background:linear-gradient(135deg,rgba(20,40,30,.85),rgba(10,22,15,.95));border:1px solid rgba(201,162,39,.4);border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#8fa89b">Days</span><strong style="font-family:\'Playfair Display\',serif;font-size:40px;font-weight:700;color:#f5e7b8;text-shadow:0 0 14px rgba(201,162,39,.4)">7<span style="font-size:20px;color:#8fa89b">/7</span></strong></div>' +
            '<div style="min-width:200px;padding:22px 26px;background:linear-gradient(135deg,rgba(20,40,30,.85),rgba(10,22,15,.95));border:1px solid rgba(201,162,39,.4);border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#8fa89b">Status</span><strong style="font-family:\'Playfair Display\',serif;font-size:32px;font-weight:700;color:#a7f3d0;text-shadow:0 0 14px rgba(52,211,153,.4)">CHAMPION</strong></div>' +
          '</div>'
        : '<div style="display:flex;gap:18px;margin-top:8px">' +
            '<div style="min-width:200px;padding:22px 26px;background:linear-gradient(135deg,rgba(20,40,30,.85),rgba(10,22,15,.95));border:1px solid rgba(201,162,39,.4);border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#8fa89b">Eco Score</span><strong style="font-family:\'Playfair Display\',serif;font-size:40px;font-weight:700;color:#f5e7b8;text-shadow:0 0 14px rgba(201,162,39,.4)">' + currentCert.data.ecoScore + '<span style="font-size:20px;color:#8fa89b">/100</span></strong></div>' +
            '<div style="min-width:200px;padding:22px 26px;background:linear-gradient(135deg,rgba(20,40,30,.85),rgba(10,22,15,.95));border:1px solid rgba(201,162,39,.4);border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#8fa89b">Footprint</span><strong style="font-family:\'Playfair Display\',serif;font-size:40px;font-weight:700;color:#f5e7b8;text-shadow:0 0 14px rgba(201,162,39,.4)">' + currentCert.data.totalTons.toFixed(2) + '<span style="font-size:20px;color:#8fa89b"> t</span></strong></div>' +
          '</div>';

      const tierBadge = currentCert.mode === 'challenge'
        ? '7-DAY CHALLENGE CHAMPION'
        : currentCert.tier.badge;

      card.innerHTML =
        '<div style="width:100%;display:flex;align-items:center;justify-content:center;gap:14px;font-family:\'Playfair Display\',serif;font-weight:800;font-size:34px;letter-spacing:.08em;color:#f5f0e1;text-shadow:0 0 20px rgba(201,162,39,.35)"><span style="color:#e0b53c;font-size:30px">🌿</span><span>Carbotrack</span></div>' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:32px">' +
          '<div style="width:132px;height:132px;border-radius:50%;background:linear-gradient(135deg,#1b3027,#0a1810);border:3px solid #c9a227;display:flex;align-items:center;justify-content:center;font-family:\'Playfair Display\',serif;font-weight:700;font-size:44px;color:#f5e7b8;text-shadow:0 0 20px rgba(201,162,39,.5);box-shadow:0 0 40px rgba(201,162,39,.35)">' + initials + '</div>' +
          '<div style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:26px;color:#8fa89b;margin-top:-8px">' + (currentCert.mode === 'challenge' ? 'Challenge Completion Certificate' : 'Certificate of Environmental Achievement') + '</div>' +
          '<div style="font-family:\'Playfair Display\',serif;font-weight:700;font-size:64px;color:#fffaf0;line-height:1.1;max-width:900px;text-shadow:0 2px 0 rgba(0,0,0,.4)">' + currentCert.data.name + '</div>' +
          '<div style="width:70%;height:2px;background:linear-gradient(to right,transparent,#c9a227,#f7e8b0,#c9a227,transparent);box-shadow:0 0 12px rgba(201,162,39,.55)"></div>' +
          statBlock +
          '<div style="font-size:15px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#c9a227;padding:10px 22px;border:1px solid rgba(201,162,39,.4);border-radius:999px;background:rgba(201,162,39,.08)">' + tierBadge + '</div>' +
        '</div>' +
        '<div style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:24px;padding-top:24px;border-top:1px solid rgba(201,162,39,.25)">' +
          '<div style="text-align:left"><div style="font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#8fa89b;margin-bottom:6px">Measure yours</div><div style="font-size:16px;font-weight:600;color:#f5e7b8;letter-spacing:.02em">carbotrack.app</div></div>' +
          '<div style="display:flex;align-items:center;gap:16px">' +
            (qrDataUrl ? '<img src="' + qrDataUrl + '" alt="QR" style="width:120px;height:120px;display:block;border-radius:8px;border:1px solid rgba(201,162,39,.4);padding:6px;background:#07130d">' : '') +
            '<div style="text-align:right"><div style="font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#8fa89b;margin-bottom:6px">Cert ID</div><div style="font-size:16px;font-weight:600;color:#f5e7b8;letter-spacing:.04em">' + currentCert.data.certId + '</div></div>' +
          '</div>' +
        '</div>';

      document.body.appendChild(card);

      try {
        const canvas = await html2canvas(card, {
          scale: 2, useCORS: true, backgroundColor: '#07130d',
          logging: false, width: 1080, height: 1080,
          scrollX: 0, scrollY: 0, allowTaint: false, removeContainer: true
        });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'Carbotrack-Share-' + currentCert.data.certId + '.png';
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (window.CT_TOAST) window.CT_TOAST.show('Share card downloaded!', 'success', 2800);
      } finally {
        if (card.parentNode) card.parentNode.removeChild(card);
      }
    } catch (err) {
      console.error('[Carbotrack] share card failed', err);
      if (window.CT_TOAST) window.CT_TOAST.show('Card generation failed.', 'error', 3200);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }

  /* ================================================================== */
  /*  WIRING                                                            */
  /* ================================================================== */
  function wireActions() {
    const pdfBtn = $('cert-download-pdf-btn');
    if (pdfBtn) pdfBtn.addEventListener('click', downloadPDF);
    const pngBtn = $('cert-download-png-btn');
    if (pngBtn) pngBtn.addEventListener('click', downloadPNG);
    const shareBtn = $('cert-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', openShareModal);
    initNativeShare();
  }

  /* ================================================================== */
  /*  STATES                                                            */
  /* ================================================================== */
  function showEmpty() {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = '<div class="section section--white" style="min-height:70vh;display:grid;place-items:center;"><div class="container" style="max-width:34rem;"><div class="empty-state"><div class="empty-state__icon"><i class="fa-solid fa-award"></i></div><h2 class="section-heading">No Certificate Yet</h2><p class="section-sub">Complete the six-step calculator first — we\'ll use your result to personalise your certificate.</p><div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1.75rem;"><a href="calculator.html" class="btn btn-primary btn-lg"><i class="fa-solid fa-calculator"></i><span>Open the Calculator</span></a></div></div></div></div>';
  }

  function showChallengeEmpty() {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = '<div class="section section--white" style="min-height:70vh;display:grid;place-items:center;"><div class="container" style="max-width:34rem;"><div class="empty-state"><div class="empty-state__icon"><i class="fa-solid fa-list-check"></i></div><h2 class="section-heading">Challenge Not Complete</h2><p class="section-sub">Complete all 7 days of the Campus Eco Challenge to unlock your Challenge Champion certificate.</p><div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1.75rem;"><a href="challenge.html" class="btn btn-primary btn-lg"><i class="fa-solid fa-list-check"></i><span>Go to Challenge</span></a></div></div></div></div>';
  }

  function showError(msg) {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = '<div class="section section--white" style="min-height:70vh;display:grid;place-items:center;"><div class="container" style="max-width:34rem;"><div class="empty-state"><div class="empty-state__icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h2 class="section-heading">Certificate Not Available</h2><p class="section-sub">' + msg + '</p><div style="margin-top:1.75rem;"><a href="index.html" class="btn btn-primary btn-lg"><i class="fa-solid fa-house"></i><span>Go Home</span></a></div></div></div></div>';
  }

  /* ================================================================== */
  /*  INIT                                                              */
  /* ================================================================== */
  async function init() {
    if (!$('cert-sheet-carbon')) return;

    waitForFonts();

    const hash = window.location.hash || '';
    const isChallengeMode = /(?:^|#|&)type=challenge(?:&|$)/.test(hash);

    /* 1. Share payload */
    const sharePayload = S.readSharePayload();
    if (sharePayload) {
      const data = decodeShare(sharePayload);
      if (!data) return showError('This share link is invalid or damaged.');

      if (data.type === 'challenge') renderChallengeCert(data);
      else renderCarbonCert(data);

      const banner = $('cert-shared-banner');
      if (banner) banner.style.display = 'flex';
      wireActions();
      return;
    }

    /* 2. Login required */
    if (!window.CT_AUTH || !window.CT_AUTH.isLoggedIn()) return;

    /* 3. Wait for auth + profile */
    await waitForAuthReady(3000);
    await waitForProfile(4000);

    /* 4. Challenge mode */
    if (isChallengeMode) {
      const days = await loadChallengeDays();
      const done = days.filter(Boolean).length;

      if (done < 7) return showChallengeEmpty();

      const data = buildChallengeData();
      renderChallengeCert(data);
      wireActions();
      return;
    }

    /* 5. Carbon mode */
    const results = S.getResults();
    if (!results) return showEmpty();

    const data = buildCarbonData(results);
    renderCarbonCert(data);
    wireActions();
  }

  document.addEventListener('DOMContentLoaded', init);
})();