/* ==========================================================================
   Carbotrack — supabase-leaderboard.js
   Fetch top scores, submit new scores (deduped), real-time subscribe.
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

  /* FIX: accepts clientResultId and upserts — duplicate submissions
     for the same calculation become no-ops instead of new rows. */
  async function submitScore(payload) {
    const auth = window.CT_SB_AUTH;
    if (!auth || !auth.isLoggedIn()) {
      return { ok: false, error: 'Not signed in' };
    }

    const user = auth.getUser();
    if (!user) return { ok: false, error: 'Not signed in' };

    if (!Number.isFinite(payload.totalTons) || payload.totalTons < 0) {
      return { ok: false, error: 'Invalid footprint value' };
    }

    const row = {
      user_id:          user.id,
      total_tons:       payload.totalTons,
      eco_score:        payload.ecoScore,
      rating_key:       payload.ratingKey,
      rating_label:     payload.ratingLabel,
      breakdown:        payload.breakdown || {},
      client_result_id: payload.clientResultId || null
    };

    /* Use upsert only when client_result_id is present, so we can
       deduplicate. Otherwise fall back to plain insert. */
    const query = payload.clientResultId
      ? client.from('carbon_results').upsert(row, {
          onConflict: 'user_id,client_result_id',
          ignoreDuplicates: true
        })
      : client.from('carbon_results').insert(row);

    const { data, error } = await query.select().maybeSingle();

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