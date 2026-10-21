/* ==========================================================================
   Carbotrack — supabase-leaderboard.js
   FIX: fetchTop now accepts a `mode` param ('best' | 'latest') and forwards
   it to the get_leaderboard RPC. Returns latest_tons/latest_at per row.
   ========================================================================== */
window.CT_SB_LEADERBOARD = (function () {
  'use strict';

  const client = window.CT_SUPABASE_CLIENT;
  if (!client) {
    console.error('[Carbotrack] Supabase client missing — leaderboard disabled');
    return {
      fetchTop: async () => ({ ok: false, error: 'Supabase client not loaded', code: 'NO_CLIENT', data: [] }),
      fetchMyRank: async () => ({ ok: false, error: 'Supabase client not loaded', code: 'NO_CLIENT' }),
      submitScore: async () => ({ ok: false, error: 'Supabase client not loaded', code: 'NO_CLIENT' }),
      subscribe: () => ({ unsubscribe() {} })
    };
  }

  function classifyError(err) {
    if (!err) return { message: 'Unknown error', code: 'UNKNOWN' };
    const msg = (err.message || String(err)).toLowerCase();

    if (/row-level security|permission denied/.test(msg))
      return { message: 'Database permission denied — RLS policies missing.', code: 'RLS', raw: err };
    if (/does not exist|relation.*not found/.test(msg))
      return { message: 'Database schema incomplete — run schema.sql.', code: 'NO_SCHEMA', raw: err };
    if (/function.*does not exist|no function matches/.test(msg))
      return { message: 'RPC function missing — run schema-update.sql.', code: 'NO_RPC', raw: err };
    if (/failed to fetch|networkerror|timeout/.test(msg))
      return { message: 'Network error — check your connection.', code: 'NETWORK', raw: err };
    if (/jwt|token|session/.test(msg))
      return { message: 'Your session expired — please sign in again.', code: 'AUTH', raw: err };
    if (/no unique or exclusion constraint/.test(msg))
      return { message: 'Database configuration incomplete — run schema.sql.', code: 'NO_INDEX', raw: err };

    return { message: err.message || 'Unexpected error.', code: 'UNKNOWN', raw: err };
  }

  async function fetchTop(limit, period, mode) {
    limit = limit || 20;
    period = period || 'all';
    mode = mode || 'best';

    if (['all', 'week', 'month'].indexOf(period) === -1) period = 'all';
    if (['best', 'latest'].indexOf(mode) === -1) mode = 'best';

    try {
      const { data, error } = await client.rpc('get_leaderboard', {
        p_period: period,
        p_limit: limit,
        p_mode: mode
      });

      if (error) {
        const c = classifyError(error);
        console.error('[Carbotrack leaderboard] fetchTop failed:', c.code, error);
        return { ok: false, error: c.message, code: c.code, data: [] };
      }

      return { ok: true, data: data || [], period: period, mode: mode };
    } catch (err) {
      const c = classifyError(err);
      console.error('[Carbotrack leaderboard] fetchTop threw:', c.code, err);
      return { ok: false, error: c.message, code: c.code, data: [] };
    }
  }

  async function fetchMyRank() {
    const auth = window.CT_SB_AUTH;
    if (!auth || !auth.isLoggedIn || !auth.isLoggedIn()) {
      return { ok: false, code: 'NOT_LOGGED_IN', rank: null };
    }

    try {
      const { data, error } = await client.rpc('get_my_rank');

      if (error) {
        const c = classifyError(error);
        console.warn('[Carbotrack leaderboard] fetchMyRank failed:', c.code, error);
        return { ok: false, error: c.message, code: c.code, rank: null };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { ok: true, rank: null, unranked: true };

      return {
        ok: true,
        rank: Number(row.rank),
        totalTons: Number(row.total_tons),
        ecoScore: Number(row.eco_score),
        ratingKey: row.rating_key,
        ratingLabel: row.rating_label,
        createdAt: row.created_at,
        totalRanked: Number(row.total_ranked),
        latestTons: row.latest_tons != null ? Number(row.latest_tons) : null,
        latestAt: row.latest_at || null
      };
    } catch (err) {
      const c = classifyError(err);
      console.warn('[Carbotrack leaderboard] fetchMyRank threw:', c.code, err);
      return { ok: false, error: c.message, code: c.code, rank: null };
    }
  }

  async function submitScore(payload) {
    const auth = window.CT_SB_AUTH;
    if (!auth || !auth.isLoggedIn || !auth.isLoggedIn()) {
      return { ok: false, error: 'Not signed in', code: 'NOT_LOGGED_IN' };
    }

    const user = auth.getUser();
    if (!user) return { ok: false, error: 'Not signed in', code: 'NOT_LOGGED_IN' };

    if (!Number.isFinite(payload.totalTons) || payload.totalTons < 0) {
      return { ok: false, error: 'Invalid footprint value', code: 'INVALID_PAYLOAD' };
    }

    try {
      const { data, error } = await client.rpc('submit_carbon_result', {
        p_total_tons:   payload.totalTons,
        p_eco_score:    payload.ecoScore,
        p_rating_key:   payload.ratingKey,
        p_rating_label: payload.ratingLabel,
        p_breakdown:    payload.breakdown || {}
      });

      if (error) {
        const c = classifyError(error);
        console.error('[Carbotrack leaderboard] submitScore failed:', c.code, error);

        if (c.code === 'NO_RPC') {
          const { data: ins, error: insErr } = await client
            .from('carbon_results')
            .insert({
              user_id:      user.id,
              total_tons:   payload.totalTons,
              eco_score:    payload.ecoScore,
              rating_key:   payload.ratingKey,
              rating_label: payload.ratingLabel,
              breakdown:    payload.breakdown || {}
            })
            .select()
            .maybeSingle();

          if (insErr) {
            const c2 = classifyError(insErr);
            return { ok: false, error: c2.message, code: c2.code };
          }
          return { ok: true, data: ins, deduplicated: false };
        }

        return { ok: false, error: c.message, code: c.code };
      }

      const result = typeof data === 'object' && data !== null ? data : { ok: true };
      if (result.ok === false) {
        return { ok: false, error: result.error || 'Submit failed', code: 'RPC_REJECTED' };
      }

      return {
        ok: true,
        id: result.id,
        deduplicated: !!result.deduplicated
      };
    } catch (err) {
      const c = classifyError(err);
      console.error('[Carbotrack leaderboard] submitScore threw:', c.code, err);
      return { ok: false, error: c.message, code: c.code };
    }
  }

  function subscribe(onChange) {
    try {
      const channel = client
        .channel('leaderboard-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'carbon_results' },
          function () {
            if (typeof onChange === 'function') {
              try { onChange(); } catch (e) { console.warn('[Carbotrack leaderboard] onChange threw', e); }
            }
          }
        )
        .subscribe(function (status) {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[Carbotrack leaderboard] realtime status:', status);
          }
        });

      return {
        unsubscribe: function () {
          try { client.removeChannel(channel); } catch (e) { /* ignore */ }
        }
      };
    } catch (err) {
      console.warn('[Carbotrack leaderboard] subscribe failed', err);
      return { unsubscribe: function () {} };
    }
  }

  return {
    fetchTop: fetchTop,
    fetchMyRank: fetchMyRank,
    submitScore: submitScore,
    subscribe: subscribe
  };
})();