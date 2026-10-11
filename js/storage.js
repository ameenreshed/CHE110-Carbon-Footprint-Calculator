/* ==========================================================================
   Carbotrack — storage.js
   Safe persistence layer + URL-hash transport (works on file://, incognito).
   Exposed globally as window.CT_STORAGE
   ========================================================================== */
window.CT_STORAGE = (function () {
  'use strict';

  const K = window.CT_CONFIG.storageKeys;
  const memory = {};
  let useMemory = false;

  /* Feature-detect localStorage once */
  try {
    const probe = '__ct_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch (e) {
    useMemory = true;
  }

  /* ---- raw get/set/remove ----------------------------------------- */
  function rawSet(key, value) {
    if (useMemory) { memory[key] = value; return; }
    try { window.localStorage.setItem(key, value); }
    catch (e) { useMemory = true; memory[key] = value; }
  }

  function rawGet(key) {
    if (useMemory) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    }
    try { return window.localStorage.getItem(key); }
    catch (e) { useMemory = true; return memory[key] ?? null; }
  }

  function rawRemove(key) {
    if (useMemory) { delete memory[key]; return; }
    try { window.localStorage.removeItem(key); }
    catch (e) { delete memory[key]; }
  }

  function setJSON(key, obj) {
    try { rawSet(key, JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }

  function getJSON(key, fallback) {
    const raw = rawGet(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); }
    catch (e) { return fallback; }
  }

  /* ================================================================== */
  /*  URL-HASH TRANSPORT                                                */
  /*  Base64url-encoded JSON — survives file://, incognito, cross-tab.  */
  /* ================================================================== */
  function encodeInputs(obj) {
    try {
      const json = JSON.stringify(obj);
      /* UTF-8 safe base64 */
      const b64 = btoa(unescape(encodeURIComponent(json)));
      /* Convert to base64url so '+' '/' '=' don't confuse URL parsers */
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) { return ''; }
  }

  function decodeInputs(str) {
    if (!str) return null;
    try {
      let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const json = decodeURIComponent(escape(atob(b64)));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  /* Read the "d=..." fragment from a URL hash string */
  function readHashPayload() {
    const hash = window.location.hash || '';
    const m = hash.match(/[#&]d=([^&]+)/);
    return m ? decodeInputs(m[1]) : null;
  }

  return {
    /* ---- Results ----------------------------------------------------- */
    saveResults(r)  { setJSON(K.results, r); },
    getResults()    { return getJSON(K.results, null); },
    hasResults()    { return !!getJSON(K.results, null); },
    clearResults()  { rawRemove(K.results); },

    /* ---- Inputs ------------------------------------------------------ */
    saveInputs(i)   { setJSON(K.inputs, i); },
    getInputs()     { return getJSON(K.inputs, null); },
    clearInputs()   { rawRemove(K.inputs); },

    /* ---- 7-Day challenge --------------------------------------------- */
    saveChallenge(s){ setJSON(K.challenge, s); },
    getChallenge()  { return getJSON(K.challenge, null); },
    clearChallenge(){ rawRemove(K.challenge); },

    /* ---- Simulator sliders ------------------------------------------- */
    saveSimulator(s){ setJSON(K.simulator, s); },
    getSimulator()  { return getJSON(K.simulator, null); },

    /* ---- Cross-page demo flag ---------------------------------------- */
    setPendingDemo(flag)  { rawSet(K.pendingDemo, flag ? '1' : '0'); },
    consumePendingDemo() {
      const v = rawGet(K.pendingDemo) === '1';
      if (v) rawRemove(K.pendingDemo);
      return v;
    },

    /* ---- URL-hash helpers -------------------------------------------- */
    encodeInputs,
    decodeInputs,
    readHashPayload,

    /* ---- Wipe everything --------------------------------------------- */
    clearAll() {
      rawRemove(K.results);
      rawRemove(K.inputs);
      rawRemove(K.challenge);
      rawRemove(K.simulator);
      rawRemove(K.pendingDemo);
    }
  };
})();