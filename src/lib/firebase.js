/**
 * firebase.js - Lazy-loaded Firebase client.
 *
 * Firebase config comes from .env (VITE_FIREBASE_API_KEY etc).
 * If not configured, app falls back to localStorage.
 */

let _firebaseApp = null;
let _auth = null;
let _db = null;
let _initPromise = null;

export function isFirebaseConfigured() {
  return !!import.meta.env.VITE_FIREBASE_API_KEY && !!import.meta.env.VITE_FIREBASE_PROJECT_ID;
}

async function initFirebase() {
  if (_firebaseApp) return { app: _firebaseApp, auth: _auth, db: _db };

  if (!isFirebaseConfigured()) {
    return null;
  }

  // Dynamic imports so the app still builds if firebase isn't installed
  const [{ initializeApp }, authMod, firestoreMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  _firebaseApp = initializeApp(firebaseConfig);
  _auth = authMod.getAuth(_firebaseApp);
  _db = firestoreMod.getFirestore(_firebaseApp);

  // Also stash the helper fns on the module so auth.js / storage.js can use them
  _auth._helpers = authMod;
  _db._helpers = firestoreMod;

  return { app: _firebaseApp, auth: _auth, db: _db };
}

export function getFirebase() {
  if (!_initPromise) _initPromise = initFirebase();
  return _initPromise;
}

