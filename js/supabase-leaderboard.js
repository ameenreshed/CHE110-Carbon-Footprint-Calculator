/* ==========================================================================
   Carbotrack — supabase-leaderboard.js
   Fetch top scores, submit new scores, real-time subscribe.
   ========================================================================== */
window.CT_SB_LEADERBOARD = (function () {
  'use strict';

  const client = window.CT_SUPABASE_CLIENT;
  if (!client) {
    console.error('[Carbotrack] Supabase client missing');
    return {};
  }

  async function fetchTop(limit) {
    limit = limit || 20;

    const { data, error } = await client
      .from('leaderboard_view')
      .select('*')
      .order('rank', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Carbotrack] leaderboard fetch failed', error);
      return { ok: false, error: error.message };
    }
    return { ok: true, data: data || [] };
  }

  async function submitScore(payload) {
    const auth = window.CT_SB_AUTH;
    if (!auth || !auth.isLoggedIn()) {
      return { ok: false, error: 'Not signed in' };
    }

    const user = auth.getUser();

    const { data, error } = await client
      .from('carbon_results')
      .insert({
        user_id: user.id,
        total_tons: payload.totalTons,
        eco_score: payload.ecoScore,
        rating_key: payload.ratingKey,
        rating_label: payload.ratingLabel,
        breakdown: payload.breakdown || {}
      })
      .select()
      .single();

    if (error) {
      console.error('[Carbotrack] score submit failed', error);
      return { ok: false, error: error.message };
    }
    return { ok: true, data: data };
  }

  function subscribe(onChange) {
    return client
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carbon_results' },
        function () { if (typeof onChange === 'function') onChange(); }
      )
      .subscribe();
  }

  return {
    fetchTop: fetchTop,
    submitScore: submitScore,
    subscribe: subscribe
  };
})();