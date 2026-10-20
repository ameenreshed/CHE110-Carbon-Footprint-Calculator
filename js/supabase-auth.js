/* ==========================================================================
   Carbotrack — supabase-auth.js
   Username + password authentication.
   A synthetic email ({username}@carbotrack.local) is used internally
   because Supabase Auth requires an email field.
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
    return data;
  }

  async function handleSession(session) {
    if (!session || !session.user) {
      currentUser = null;
      currentProfile = null;
      notify();
      return;
    }

    currentUser = session.user;
    currentProfile = await fetchProfile(session.user.id);
    notify();
  }

  async function init() {
    const { data: { session } } = await client.auth.getSession();
    await handleSession(session);

    client.auth.onAuthStateChange(function (_event, session) {
      handleSession(session);
    });
  }

  /* ---------- validation ---------- */
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

  /* ---------- auth ---------- */
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

    /* If email confirmation is enabled in Supabase, session is null. */
    if (!data.session) {
      return {
        ok: false,
        error: 'Sign-up succeeded but the session is not active. Ask the admin to disable "Confirm email" in Supabase.'
      };
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

  function getUser()    { return currentUser; }
  function getProfile() { return currentProfile; }
  function isLoggedIn() { return !!currentUser; }

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
    isLoggedIn: isLoggedIn,
    onChange: onChange,
    validateUsername: validateUsername,
    validatePassword: validatePassword
  };
})();