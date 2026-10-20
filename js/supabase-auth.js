/* ==========================================================================
   Carbotrack — supabase-auth.js
   Username + password authentication.
   Includes profile self-heal from user_metadata if the trigger missed.
   ========================================================================== */
window.CT_SB_AUTH = (function () {
  'use strict';

  const client = window.CT_SUPABASE_CLIENT;
  if (!client) {
    console.error('[Carbotrack] Supabase client missing');
    return {};
  }

  /* ---------- synthetic email ---------- */
  const EMAIL_DOMAIN = '@carbotrack.local';

  function usernameToEmail(username) {
    return String(username || '').trim().toLowerCase() + EMAIL_DOMAIN;
  }

  /* ---------- state ---------- */
  let currentUser = null;
  let currentProfile = null;
  const listeners = [];

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(currentUser, currentProfile); } catch (e) { /* ignore */ }
    });
  }

  /* ================================================================== */
  /*  METADATA HELPERS                                                  */
  /* ================================================================== */
  function getMeta(user) {
    return (user && user.user_metadata) || {};
  }

  function metaFullName(user) {
    const m = getMeta(user);
    return (m.full_name || m.name || m.display_name || '').trim();
  }

  function metaUsername(user) {
    const m = getMeta(user);
    if (m.username) return String(m.username).toLowerCase().trim();
    if (user && user.email) return user.email.split('@')[0].toLowerCase();
    return '';
  }

  function initialsOf(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
  }

  /* ================================================================== */
  /*  PROFILE — fetch + self-heal                                       */
  /* ================================================================== */
  async function fetchProfile(userId) {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[Carbotrack] profile fetch failed', error);
      return null;
    }
    return data || null;
  }

  async function selfHealProfile(user) {
    if (!user) return null;
    const userId = user.id;
    const fullName = metaFullName(user);
    const username = metaUsername(user);

    const payload = {
      id: userId,
      username: username || null,
      full_name: fullName || username || null,
      avatar_initials: initialsOf(fullName || username)
    };

    try {
      const { data, error } = await client
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[Carbotrack] profile self-heal failed', error);
        return null;
      }
      return data || null;
    } catch (e) {
      console.warn('[Carbotrack] profile self-heal threw', e);
      return null;
    }
  }

  /* ================================================================== */
  /*  SESSION                                                           */
  /* ================================================================== */
  async function handleSession(session) {
    if (!session || !session.user) {
      currentUser = null;
      currentProfile = null;
      notify();
      return;
    }

    currentUser = session.user;

    /* Try to fetch the profile row */
    let profile = await fetchProfile(session.user.id);

    /* Self-heal if it's missing OR full_name is blank */
    if (!profile || !profile.full_name) {
      const healed = await selfHealProfile(session.user);
      if (healed) profile = healed;
    }

    /* Final safety: if still no profile, synthesize one from metadata
       so downstream code always has something usable. */
    if (!profile) {
      profile = {
        id: session.user.id,
        username: metaUsername(session.user),
        full_name: metaFullName(session.user) || metaUsername(session.user),
        avatar_initials: initialsOf(metaFullName(session.user) || metaUsername(session.user))
      };
    }

    currentProfile = profile;
    notify();
  }

  async function init() {
    const { data: { session } } = await client.auth.getSession();
    await handleSession(session);

    client.auth.onAuthStateChange(function (_event, session) {
      handleSession(session);
    });
  }

  /* ================================================================== */
  /*  VALIDATION                                                        */
  /* ================================================================== */
  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

  function validateUsername(username) {
    if (!username) return 'Please enter a username.';
    if (!USERNAME_RE.test(username)) {
      return 'Username must be 3–20 characters — lowercase letters, numbers or underscore.';
    }
    return null;
  }

  function validatePassword(password) {
    if (!password) return 'Please enter a password.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password.length > 64) return 'Password is too long (max 64 characters).';
    return null;
  }

  /* ================================================================== */
  /*  AUTH                                                              */
  /* ================================================================== */
  async function signUp(username, password, fullName) {
    username = String(username || '').trim().toLowerCase();
    fullName = String(fullName || '').trim();

    const userErr = validateUsername(username);
    if (userErr) return { ok: false, error: userErr };

    const passErr = validatePassword(password);
    if (passErr) return { ok: false, error: passErr };

    if (!fullName) return { ok: false, error: 'Please enter your full name.' };

    const { data, error } = await client.auth.signUp({
      email: usernameToEmail(username),
      password: password,
      options: {
        data: {
          username: username,
          full_name: fullName
        }
      }
    });

    if (error) {
      let msg = error.message || 'Sign-up failed.';
      if (/already registered/i.test(msg) || /already exists/i.test(msg)) {
        msg = 'That username is already taken. Please choose another.';
      }
      return { ok: false, error: msg };
    }

    if (!data.session) {
      return {
        ok: false,
        error: 'Sign-up succeeded but the session is not active. Ask the admin to disable "Confirm email" in Supabase.'
      };
    }

    /* Immediately self-heal in case the trigger is delayed */
    if (data.user) {
      const profile = await selfHealProfile(data.user);
      if (profile) {
        currentUser = data.user;
        currentProfile = profile;
      }
    }

    return { ok: true, user: data.user, session: data.session };
  }

  async function signIn(username, password) {
    username = String(username || '').trim().toLowerCase();

    if (!username) return { ok: false, error: 'Please enter your username.' };
    if (!password) return { ok: false, error: 'Please enter your password.' };

    const { data, error } = await client.auth.signInWithPassword({
      email: usernameToEmail(username),
      password: password
    });

    if (error) {
      let msg = error.message || 'Sign-in failed.';
      if (/invalid login/i.test(msg) || /invalid credentials/i.test(msg)) {
        msg = 'Incorrect username or password.';
      } else if (/email not confirmed/i.test(msg)) {
        msg = 'Your account is not confirmed. Ask the admin to disable "Confirm email" in Supabase.';
      }
      return { ok: false, error: msg };
    }

    /* Await profile load so callers can immediately read full_name */
    await handleSession({ user: data.user });

    return { ok: true, user: data.user, session: data.session };
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) return { ok: false, error: error.message };

    currentUser = null;
    currentProfile = null;
    notify();
    return { ok: true };
  }

  /* ================================================================== */
  /*  ACCESSORS                                                         */
  /* ================================================================== */
  function getUser()       { return currentUser; }
  function getProfile()    { return currentProfile; }
  function isLoggedIn()    { return !!currentUser; }
  function getUserMeta()   { return getMeta(currentUser); }

  function waitForProfile(maxWaitMs) {
    maxWaitMs = maxWaitMs || 4000;
    return new Promise(function (resolve) {
      if (currentProfile) return resolve(true);
      const start = Date.now();
      const iv = setInterval(function () {
        if (currentProfile) {
          clearInterval(iv);
          resolve(true);
        } else if (Date.now() - start >= maxWaitMs) {
          clearInterval(iv);
          resolve(false);
        }
      }, 120);
    });
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  return {
    init: init,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    getUser: getUser,
    getProfile: getProfile,
    getUserMeta: getUserMeta,
    isLoggedIn: isLoggedIn,
    onChange: onChange,
    waitForProfile: waitForProfile,
    validateUsername: validateUsername,
    validatePassword: validatePassword
  };
})();