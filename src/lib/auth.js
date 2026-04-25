/**
 * auth.js - Authentication helpers.
 *
 * Uses Firebase Auth when configured. Otherwise exposes a local-only
 * "guest" mode where the user has a persistent uuid in localStorage but
 * no real account. This lets the demo work without Firebase setup.
 */

import { getFirebase, isFirebaseConfigured } from './firebase';

const LOCAL_GUEST_KEY = 'unveil.guest.user';

// ── local guest user for demo / offline mode ────────────────────────────

function getOrCreateGuest() {
  try {
    const existing = localStorage.getItem(LOCAL_GUEST_KEY);
    if (existing) return JSON.parse(existing);
  } catch {}

  const guest = {
    uid: 'guest_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
    email: null,
    displayName: 'Guest',
    isGuest: true,
    createdAt: Date.now(),
  };
  try { localStorage.setItem(LOCAL_GUEST_KEY, JSON.stringify(guest)); } catch {}
  return guest;
}

// ── public API ──────────────────────────────────────────────────────────

export async function signUp({ email, password, displayName }) {
  if (!isFirebaseConfigured()) {
    // Local-only demo mode: create a named local account keyed by email.
    // Each email gets its own stable uid so accounts don't bleed into each other.
    const uid = 'local_' + btoa(email || Math.random().toString(36)).replace(/[^a-z0-9]/gi, '').slice(0, 16);
    const user = {
      uid,
      email: email || null,
      displayName: displayName || email?.split('@')[0] || 'User',
      isGuest: false,
      isLocalOnly: true,
      createdAt: Date.now(),
    };
    try { localStorage.setItem(LOCAL_GUEST_KEY, JSON.stringify(user)); } catch {}
    return user;
  }

  const { auth } = await getFirebase();
  const { createUserWithEmailAndPassword, updateProfile } = auth._helpers;
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return serializeUser(cred.user);
}

export async function signIn({ email, password }) {
  if (!isFirebaseConfigured()) {
    // Local-only demo mode: check if a local account was created with this email.
    try {
      const stored = localStorage.getItem(LOCAL_GUEST_KEY);
      if (stored) {
        const user = JSON.parse(stored);
        if (user.email && email && user.email.toLowerCase() === email.trim().toLowerCase()) {
          return user;
        }
        if (!email && !user.email) {
          // Guest continue (no email entered)
          return user;
        }
      }
    } catch {}
    // No matching local account - create a temporary guest session
    return getOrCreateGuest();
  }
  const { auth } = await getFirebase();
  const { signInWithEmailAndPassword } = auth._helpers;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return serializeUser(cred.user);
}

export async function signOutUser() {
  if (!isFirebaseConfigured()) {
    try { localStorage.removeItem(LOCAL_GUEST_KEY); } catch {}
    return;
  }
  const { auth } = await getFirebase();
  const { signOut } = auth._helpers;
  await signOut(auth);
}

export async function getCurrentUser() {
  if (!isFirebaseConfigured()) {
    try {
      const existing = localStorage.getItem(LOCAL_GUEST_KEY);
      return existing ? JSON.parse(existing) : null;
    } catch {
      return null;
    }
  }
  const { auth } = await getFirebase();
  return auth.currentUser ? serializeUser(auth.currentUser) : null;
}

export async function getAuthToken(forceRefresh = false) {
  if (!isFirebaseConfigured()) return null;
  const { auth } = await getFirebase();
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}

export async function onAuthChange(callback) {
  if (!isFirebaseConfigured()) {
    // No realtime events in local mode - just fire once with current state
    const user = await getCurrentUser();
    callback(user);
    return () => {};
  }
  const { auth } = await getFirebase();
  const { onAuthStateChanged } = auth._helpers;
  return onAuthStateChanged(auth, (u) => callback(u ? serializeUser(u) : null));
}

function serializeUser(u) {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    isGuest: false,
    createdAt: u.metadata?.creationTime ? Date.parse(u.metadata.creationTime) : Date.now(),
  };
}

export { isFirebaseConfigured };

