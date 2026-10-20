/* ==========================================================================
   Carbotrack — supabase-client.js
   ========================================================================== */
(function () {
  'use strict';

  if (typeof supabase === 'undefined') {
    console.error('[Carbotrack] supabase-js library not loaded');
    return;
  }

  const cfg = window.CT_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) {
    console.error('[Carbotrack] Supabase config missing. Check js/supabase-config.js');
    return;
  }

  const client = supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  window.CT_SUPABASE_CLIENT = client;
})();