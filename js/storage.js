/* ==========================================================================
   Carbotrack — storage.js
   Safe persistence layer. Falls back to an in-memory store when
   localStorage is unavailable (e.g. file:// in some browsers, private mode).
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

  function rawSet(key, value) {
    if (useMemory) { memory[key] = value; return; }
    try { window.localStorage.setItem(key, value); }
    catch (e) { useMemory = true; memory[key] = value; }
  }

  function rawGet(key) {
    if (useMemory) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
    try { return window.localStorage.getItem(key); }
    catch (e) { useMemory = true; return memory[key] ?? null; }
  }

  function rawRemove(key) {
    if (useMemory) { delete memory[key]; return; }
    try { window.localStorage.removeItem(key); }
    catch (e) { delete memory[key]; }
  }

  function setJSON(key, obj) {
    try { rawSet(key, JSON.stringify(obj)); }
    catch (e) { /* quota / circular — ignore */ }
  }

  function getJSON(key, fallback) {
    const raw = rawGet(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); }
    catch (e) { return fallback; }
  }

  return {
    /* ---- Results ----------------------------------------------------- */
    saveResults(results)  { setJSON(K.results, results); },
    getResults()          { return getJSON(K.results, null); },
    hasResults()          { return !!getJSON(K.results, null); },
    clearResults()        { rawRemove(K.results); },

    /* ---- Raw form inputs --------------------------------------------- */
    saveInputs(inputs)    { setJSON(K.inputs, inputs); },
    getInputs()           { return getJSON(K.inputs, null); },
    clearInputs()         { rawRemove(K.inputs); },

    /* ---- 7-Day challenge --------------------------------------------- */
    saveChallenge(state)  { setJSON(K.challenge, state); },
    getChallenge()        { return getJSON(K.challenge, null); },
    clearChallenge()      { rawRemove(K.challenge); },

    /* ---- Simulator sliders ------------------------------------------- */
    saveSimulator(state)  { setJSON(K.simulator, state); },
    getSimulator()        { return getJSON(K.simulator, null); },

    /* ---- Cross-page "Quick Demo" handoff ----------------------------- */
    setPendingDemo(flag)  { rawSet(K.pendingDemo, flag ? '1' : '0'); },
    consumePendingDemo() {
      const v = rawGet(K.pendingDemo) === '1';
      if (v) rawRemove(K.pendingDemo);
      return v;
    },

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