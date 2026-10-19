/* ==========================================================================
   Carbotrack — certificate.js
   Direct PDF/PNG download via html2canvas + jsPDF.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const S = window.CT_STORAGE;

  const RATING_ICONS = {
    low: 'fa-award', moderate: 'fa-medal',
    high: 'fa-triangle-exclamation', 'very-high': 'fa-circle-exclamation'
  };

  let certData = null;

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

  function makeCertId(username, date) {
    const y = new Date(date).getFullYear();
    const h = fnv1a(username + '|' + date).slice(0, 6);
    return `CT-${y}-${h}`;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) { return iso; }
  }

  /* ================================================================== */
  /*  RENDER                                                            */
  /* ================================================================== */
  function render(data) {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

    set('cert-name', data.name);
    set('cert-tons', data.totalTons.toFixed(2) + ' t');
    set('cert-score', data.ecoScore + '/100');
    set('cert-rating', data.ratingLabel);
    set('cert-date', formatDate(data.issuedAt));
    set('cert-id', data.certId);

    const icon = $('cert-rating-icon');
    if (icon) {
      const cls = RATING_ICONS[data.ratingKey] || RATING_ICONS.moderate;
      icon.className = `fa-solid ${cls}`;
    }

    document.title = `${data.name} · Certificate — Carbotrack`;
  }

  /* ================================================================== */
  /*  BUILD DATA                                                        */
  /* ================================================================== */
  function buildData(user, results) {
    const issuedAt = new Date().toISOString();
    return {
      name: user.name,
      username: user.username,
      totalTons: results.totalTons,
      ecoScore: results.ecoScore,
      ratingKey: results.rating.key,
      ratingLabel: results.rating.label,
      issuedAt,
      certId: makeCertId(user.username, issuedAt)
    };
  }

  function encodeShare(data) {
    return S.encodeInputs({
      n: data.name, u: data.username, t: data.totalTons,
      e: data.ecoScore, rk: data.ratingKey, rl: data.ratingLabel,
      d: data.issuedAt, i: data.certId
    });
  }

  function decodeShare(payload) {
    if (!payload) return null;
    const raw = S.decodeInputs(payload);
    if (!raw) return null;
    return {
      name: raw.n, username: raw.u,
      totalTons: parseFloat(raw.t),
      ecoScore: parseInt(raw.e, 10),
      ratingKey: raw.rk, ratingLabel: raw.rl,
      issuedAt: raw.d, certId: raw.i, shared: true
    };
  }

  /* ================================================================== */
  /*  CAPTURE — clone into a fixed-size wrapper offscreen               */
  /* ================================================================== */
  async function captureCanvas() {
    const sheet = $('cert-sheet');
    if (!sheet) throw new Error('Certificate element not found');

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) { /* ignore */ }
    }

    /* Wrapper keeps the clone out of layout and avoids position:fixed quirks */
    const wrapper = document.createElement('div');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.style.cssText =
      'position:absolute;left:-99999px;top:0;width:1123px;height:794px;overflow:hidden;pointer-events:none;background:#07130d;';

    const clone = sheet.cloneNode(true);
    clone.id = 'cert-capture';

    Object.assign(clone.style, {
      width: '1123px',
      height: '794px',
      maxWidth: 'none',
      maxHeight: 'none',
      aspectRatio: 'auto',
      borderRadius: '0',
      boxShadow: 'none',
      margin: '0'
    });

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas library not loaded');
      }

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#07130d',
        logging: false,
        width: 1123,
        height: 794,
        windowWidth: 1400,
        windowHeight: 1000,
        scrollX: 0,
        scrollY: 0
      });

      return canvas;
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
      if (typeof window.jspdf === 'undefined') throw new Error('jsPDF library not loaded');

      const canvas = await captureCanvas();
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
      pdf.save(`Carbotrack-Certificate-${(certData && certData.certId) || 'download'}.pdf`);

      if (window.CT_TOAST) window.CT_TOAST.show('PDF downloaded successfully!', 'success', 2800);
    } catch (err) {
      console.error('[Carbotrack] PDF download failed:', err);
      if (window.CT_TOAST) window.CT_TOAST.show('PDF download failed — try Print instead.', 'error', 3400);
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
      link.download = `Carbotrack-Certificate-${(certData && certData.certId) || 'download'}.png`;
      link.href = imgData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.CT_TOAST) window.CT_TOAST.show('PNG image downloaded!', 'success', 2800);
    } catch (err) {
      console.error('[Carbotrack] PNG download failed:', err);
      if (window.CT_TOAST) window.CT_TOAST.show('Image download failed — try Print instead.', 'error', 3400);
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  /* ================================================================== */
  /*  SHARE                                                             */
  /* ================================================================== */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); resolve(); }
      catch (e) { reject(e); }
      finally { document.body.removeChild(ta); }
    });
  }

  async function shareCert() {
    if (!certData) return;
    const base = window.location.href.split('#')[0];
    const url = base + '#s=' + encodeShare(certData);

    try {
      await copyText(url);
      if (window.CT_TOAST) window.CT_TOAST.show('Share link copied to clipboard!', 'success', 2600);
    } catch (e) {
      window.prompt('Copy this share link:', url);
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
    if (shareBtn) shareBtn.addEventListener('click', shareCert);

    const printBtn = $('cert-print-btn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
  }

  /* ================================================================== */
  /*  STATES                                                            */
  /* ================================================================== */
  function showEmpty() {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = `
      <div class="section section--white" style="min-height:70vh;display:grid;place-items:center;">
        <div class="container" style="max-width:34rem;">
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fa-solid fa-award"></i></div>
            <h2 class="section-heading">No Certificate Yet</h2>
            <p class="section-sub">Complete the six-step calculator first — we'll use your result to personalise your certificate.</p>
            <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1.75rem;">
              <a href="calculator.html" class="btn btn-primary btn-lg"><i class="fa-solid fa-calculator"></i><span>Open the Calculator</span></a>
            </div>
          </div>
        </div>
      </div>`;
  }

  function showError(msg) {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = `
      <div class="section section--white" style="min-height:70vh;display:grid;place-items:center;">
        <div class="container" style="max-width:34rem;">
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h2 class="section-heading">Certificate Not Available</h2>
            <p class="section-sub">${msg}</p>
            <div style="margin-top:1.75rem;">
              <a href="index.html" class="btn btn-primary btn-lg"><i class="fa-solid fa-house"></i><span>Go Home</span></a>
            </div>
          </div>
        </div>
      </div>`;
  }

  function hideForShared() {
    const shareBtn = $('cert-share-btn');
    if (shareBtn) shareBtn.style.display = 'none';
    const pdfBtn = $('cert-download-pdf-btn');
    if (pdfBtn) pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> <span>Download PDF</span>';
    const pngBtn = $('cert-download-png-btn');
    if (pngBtn) pngBtn.innerHTML = '<i class="fa-solid fa-image"></i> <span>Download PNG</span>';
  }

  /* ================================================================== */
  /*  INIT                                                              */
  /* ================================================================== */
  function init() {
    if (!$('cert-sheet')) return;

    const sharePayload = S.readSharePayload();

    if (sharePayload) {
      const data = decodeShare(sharePayload);
      if (!data) return showError('This share link is invalid or damaged.');
      certData = data;
      render(data);
      hideForShared();
      const banner = $('cert-shared-banner');
      if (banner) banner.style.display = 'flex';
      wireActions();
      return;
    }

    if (!window.CT_AUTH || !window.CT_AUTH.isLoggedIn()) return;

    const user = window.CT_AUTH.currentUser();
    const results = S.getResults();
    if (!results) return showEmpty();

    const data = buildData(user, results);
    certData = data;
    render(data);
    wireActions();
  }

  document.addEventListener('DOMContentLoaded', init);
})();