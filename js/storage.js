/* ==========================================================================
   Carbotrack — storage.js
   Safe persistence + URL-hash transport + account/session storage.
   ========================================================================== */
window.CT_STORAGE = (function () {
  'use strict';

  const K = window.CT_CONFIG.storageKeys;
  const memory = {};
  let useMemory = false;

  const BRIDGE = 'CTv1:';

  function readBridge() {
    try {
      const raw = window.name || '';
      if (raw.indexOf(BRIDGE) === 0) {
        const obj = JSON.parse(raw.slice(BRIDGE.length));
        return obj && typeof obj === 'object' ? obj : {};
      }
    } catch (e) { /* ignore */ }
    return {};
  }

  function writeBridge() {
    try { window.name = BRIDGE + JSON.stringify(memory); }
    catch (e) { /* ignore */ }
  }

  try {
    const probe = '__ct_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch (e) {
    useMemory = true;
  }

  if (useMemory) {
    Object.assign(memory, readBridge());
    writeBridge();
  }

  function rawSet(key, value) {
    if (useMemory) { memory[key] = value; writeBridge(); return; }
    try { window.localStorage.setItem(key, value); }
    catch (e) { useMemory = true; memory[key] = value; writeBridge(); }
  }

  function rawGet(key) {
    if (useMemory) {
      if (Object.prototype.hasOwnProperty.call(memory, key)) return memory[key];
      const bridged = readBridge();
      return Object.prototype.hasOwnProperty.call(bridged, key) ? bridged[key] : null;
    }
    try { return window.localStorage.getItem(key); }
    catch (e) { useMemory = true; return memory[key] ?? null; }
  }

  function rawRemove(key) {
    if (useMemory) { delete memory[key]; writeBridge(); return; }
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

  function encodeInputs(obj) {
    try {
      const json = JSON.stringify(obj);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) { return ''; }
  }

  function decodeInputs(str) {
    if (!str) return null;
    try {
      let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) { return null; }
  }

  function readHashPayload() {
    const hash = window.location.hash || '';
    const m = hash.match(/[#&]d=([^&]+)/);
    return m ? decodeInputs(m[1]) : null;
  }

  function readSharePayload() {
    const hash = window.location.hash || '';
    const m = hash.match(/[#&]s=([^&]+)/);
    return m ? decodeInputs(m[1]) : null;
  }

  return {
    saveResults(r)  { setJSON(K.results, r); },
    getResults()    { return getJSON(K.results, null); },
    hasResults()    { return !!getJSON(K.results, null); },
    clearResults()  { rawRemove(K.results); },

    saveInputs(i)   { setJSON(K.inputs, i); },
    getInputs()     { return getJSON(K.inputs, null); },
    clearInputs()   { rawRemove(K.inputs); },

    saveChallenge(s){ setJSON(K.challenge, s); },
    getChallenge()  { return getJSON(K.challenge, null); },
    clearChallenge(){ rawRemove(K.challenge); },

    saveUsers(u)    { setJSON(K.users, u); },
    getUsers()      { return getJSON(K.users, null); },
    saveSession(s)  { setJSON(K.session, s); },
    getSession()    { return getJSON(K.session, null); },
    clearSession()  { rawRemove(K.session); },

    getRaw: rawGet,
    setRaw: rawSet,
    removeRaw: rawRemove,

    encodeInputs,
    decodeInputs,
    readHashPayload,
    readSharePayload,

    isPersistent() { return !useMemory; },

    clearAll() {
      [K.results, K.inputs, K.challenge].forEach(rawRemove);
    }
  };
})();