/* ==========================================================================
   Carbotrack — supabase-challenge.js
   Cross-device challenge progress persistence.
   ========================================================================== */
window.CT_SB_CHALLENGE = (function () {
  'use strict';

  const client = window.CT_SUPABASE_CLIENT;
  if (!client) {
    console.error('[Carbotrack] Supabase client missing — challenge sync disabled');
    return {
      load:    async function () { return { ok: false, days: defaultDays() }; },
      save:    async function () { return { ok: false }; },
      reset:   async function () { return { ok: false }; },
      normalizeDays: defaultDays
    };
  }

  function defaultDays() {
    return [false, false, false, false, false, false, false];
  }

  function normalizeDays(days) {
    const out = defaultDays();
    if (!Array.isArray(days)) return out;
    for (let i = 0; i < 7; i++) out[i] = !!days[i];
    return out;
  }

  async function load(userId) {
    if (!userId) return { ok: false, days: defaultDays() };

    const { data, error } = await client
      .from('challenge_progress')
      .select('days, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[Carbotrack] challenge load failed', error);
      return { ok: false, days: defaultDays() };
    }

    if (!data) {
      return { ok: true, days: defaultDays(), exists: false };
    }

    return {
      ok: true,
      days: normalizeDays(data.days),
      updatedAt: data.updated_at,
      exists: true
    };
  }

  async function save(userId, days) {
    if (!userId) return { ok: false };

    const payload = {
      user_id: userId,
      days: normalizeDays(days),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from('challenge_progress')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Carbotrack] challenge save failed', error);
      return { ok: false, error: error.message };
    }
    return { ok: true, data: data };
  }

  async function reset(userId) {
    return save(userId, defaultDays());
  }

  return {
    load: load,
    save: save,
    reset: reset,
    normalizeDays: normalizeDays
  };
})();