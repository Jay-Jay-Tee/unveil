/**
 * AuditContext — global audit state + authenticated user.
 *
 * New: tracks `user` and exposes `saveCurrentAudit()` so any page can
 * persist the in-progress audit to the user's dashboard.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthChange, getCurrentUser } from './auth';
import { saveAudit as persistAudit } from './storage';

const AuditContext = createContext(null);

export function AuditProvider({ children }) {
  // Files
  const [datasetFile, setDatasetFile] = useState(null);
  const [modelFile, setModelFile] = useState(null);

  // Mode
  const [auditMode, setAuditMode] = useState(null);

  // Part A
  const [schemaMap, setSchemaMap] = useState(null);
  const [proxyFlags, setProxyFlags] = useState(null);
  const [biasReport, setBiasReport] = useState(null);
  const [datasetMeta, setDatasetMeta] = useState(null);

  // Part B
  const [modelBiasReport, setModelBiasReport] = useState(null);
  const [modelMeta, setModelMeta] = useState(null);

  // UI state
  const [isMock, setIsMock] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);

  // Auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      // Initial read
      setUser(await getCurrentUser());
      setAuthReady(true);
      // Subscribe for changes (Firebase only — no-op in local mode)
      unsub = await onAuthChange((u) => setUser(u));
    })();
    return () => { try { unsub(); } catch {} };
  }, []);

  function resetAll() {
    setDatasetFile(null);
    setModelFile(null);
    setAuditMode(null);
    setSchemaMap(null);
    setProxyFlags(null);
    setBiasReport(null);
    setDatasetMeta(null);
    setModelBiasReport(null);
    setModelMeta(null);
    setIsMock(false);
    setBackendOnline(null);
  }

  // overrides lets callers pass fresh data directly (avoids stale React closure reads)
  async function saveCurrentAudit(note = '', overrides = {}) {
    if (!user) throw new Error('Sign in to save audits.');
    if (user.isGuest) throw new Error('Sign up to save audits.');
    return persistAudit(user, {
      datasetName: overrides.datasetName ?? datasetMeta?.datasetName ?? datasetMeta?.name ?? datasetFile?.name ?? 'Untitled',
      rowCount:    overrides.rowCount    ?? datasetMeta?.rowCount    ?? null,
      columnCount: overrides.columnCount ?? datasetMeta?.columnCount ?? null,
      schemaMap:   overrides.schemaMap   ?? schemaMap,
      biasReport:  overrides.biasReport  ?? biasReport,
      modelBiasReport: overrides.modelBiasReport ?? modelBiasReport,
      note,
      createdAt: Date.now(),
    });
  }

  function loadAudit(audit) {
    setSchemaMap(audit.schemaMap || null);
    setBiasReport(audit.biasReport || null);
    setModelBiasReport(audit.modelBiasReport || null);
    setDatasetMeta({
      name: audit.datasetName,
      rowCount: audit.rowCount,
      columnCount: audit.columnCount,
    });
    setIsMock(false);
  }

  return (
    <AuditContext.Provider value={{
      datasetFile, setDatasetFile,
      modelFile, setModelFile,
      auditMode, setAuditMode,
      schemaMap, setSchemaMap,
      proxyFlags, setProxyFlags,
      biasReport, setBiasReport,
      datasetMeta, setDatasetMeta,
      modelBiasReport, setModelBiasReport,
      modelMeta, setModelMeta,
      isMock, setIsMock,
      backendOnline, setBackendOnline,
      user, authReady, setUser,
      resetAll,
      saveCurrentAudit,
      loadAudit,
    }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used inside <AuditProvider>');
  return ctx;
}
