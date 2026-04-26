/**
 * storage.js - Per-user audit storage.
 *
 * Saves audit results (schemaMap, biasReport, modelBiasReport, metadata)
 * keyed by user. Falls back to localStorage if Firestore is not configured.
 */

import { getFirebase, isFirebaseConfigured } from './firebase';

const LOCAL_AUDITS_KEY = (uid) => `unveil.audits.${uid}`;

// ── localStorage fallback ────────────────────────────────────────────────

function localList(uid) {
  try {
    const raw = localStorage.getItem(LOCAL_AUDITS_KEY(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function localWrite(uid, audits) {
  try {
    localStorage.setItem(LOCAL_AUDITS_KEY(uid), JSON.stringify(audits));
  } catch (e) {
    console.warn('[storage] localStorage write failed (quota?):', e);
  }
}

// ── public API ───────────────────────────────────────────────────────────

export async function saveAudit(user, audit) {
  if (!user?.uid) throw new Error('Must be signed in to save audits.');

  // Strip heavy slice payloads if the audit is huge - just keep summary + metadata
  const compact = {
    id: audit.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    datasetName: audit.datasetName || 'Untitled dataset',
    rowCount: audit.rowCount ?? null,
    columnCount: audit.columnCount ?? null,
    createdAt: audit.createdAt || Date.now(),
    schemaMap: audit.schemaMap || null,
    biasReport: audit.biasReport || null,
    modelBiasReport: audit.modelBiasReport || null,
    summary: audit.summary || derivedSummary(audit.biasReport),
    note: audit.note || '',
  };

  if (isFirebaseConfigured() && !user.isGuest) {
    const { db } = await getFirebase();
    const { doc, setDoc } = db._helpers;
    await setDoc(doc(db, 'users', user.uid, 'audits', compact.id), compact);
    return compact;
  }

  // Local fallback
  const existing = localList(user.uid);
  const deduped = existing.filter((a) => a.id !== compact.id);
  deduped.unshift(compact);
  // Cap at 50 audits locally to avoid quota issues
  localWrite(user.uid, deduped.slice(0, 50));
  return compact;
}

export async function listAudits(user) {
  if (!user?.uid) return [];

  if (isFirebaseConfigured() && !user.isGuest) {
    const { db } = await getFirebase();
    const { collection, getDocs, query, orderBy } = db._helpers;
    const snap = await getDocs(query(
      collection(db, 'users', user.uid, 'audits'),
      orderBy('createdAt', 'desc'),
    ));
    return snap.docs.map((d) => d.data());
  }

  return localList(user.uid);
}

export async function getAudit(user, auditId) {
  if (!user?.uid || !auditId) return null;

  if (isFirebaseConfigured() && !user.isGuest) {
    const { db } = await getFirebase();
    const { doc, getDoc } = db._helpers;
    const snap = await getDoc(doc(db, 'users', user.uid, 'audits', auditId));
    return snap.exists() ? snap.data() : null;
  }

  return localList(user.uid).find((a) => a.id === auditId) || null;
}

export async function deleteAudit(user, auditId) {
  if (!user?.uid || !auditId) return;

  if (isFirebaseConfigured() && !user.isGuest) {
    const { db } = await getFirebase();
    const { doc, deleteDoc } = db._helpers;
    await deleteDoc(doc(db, 'users', user.uid, 'audits', auditId));
    return;
  }

  const filtered = localList(user.uid).filter((a) => a.id !== auditId);
  localWrite(user.uid, filtered);
}

// ── helpers ──────────────────────────────────────────────────────────────

function derivedSummary(biasReport) {
  if (!biasReport?.column_results) return { unfair: 0, borderline: 0, fair: 0 };
  let unfair = 0, borderline = 0, fair = 0;
  for (const c of biasReport.column_results) {
    if (c.verdict === 'BIASED') unfair++;
    else if (c.verdict === 'AMBIGUOUS') borderline++;
    else if (c.verdict === 'CLEAN') fair++;
  }
  return { unfair, borderline, fair };
}

