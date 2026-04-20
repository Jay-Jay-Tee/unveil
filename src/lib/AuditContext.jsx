/**
 * AuditContext.jsx
 * Holds the analysis results from Part A and Part B so all pages can read them.
 * Also exposes the uploaded file and loading/error state.
 */

import { createContext, useContext, useState } from 'react';

const AuditContext = createContext(null);

export function AuditProvider({ children }) {
  // Raw uploaded files — kept so Part B can re-send the dataset
  const [datasetFile, setDatasetFile] = useState(null);
  const [modelFile, setModelFile]     = useState(null);

  // Part A results
  const [schemaMap, setSchemaMap]     = useState(null);
  const [proxyFlags, setProxyFlags]   = useState(null);
  const [biasReport, setBiasReport]   = useState(null);
  const [datasetMeta, setDatasetMeta] = useState(null); // { datasetName, rowCount, warnings }

  // Part B results
  const [modelBiasReport, setModelBiasReport] = useState(null);

  // UI state
  const [isMock, setIsMock]           = useState(false);
  const [backendOnline, setBackendOnline] = useState(null); // null = unknown

  function resetAll() {
    setDatasetFile(null);
    setModelFile(null);
    setSchemaMap(null);
    setProxyFlags(null);
    setBiasReport(null);
    setDatasetMeta(null);
    setModelBiasReport(null);
    setIsMock(false);
    setBackendOnline(null);
  }

  return (
    <AuditContext.Provider value={{
      // files
      datasetFile, setDatasetFile,
      modelFile,   setModelFile,
      // Part A
      schemaMap,   setSchemaMap,
      proxyFlags,  setProxyFlags,
      biasReport,  setBiasReport,
      datasetMeta, setDatasetMeta,
      // Part B
      modelBiasReport, setModelBiasReport,
      // meta
      isMock,      setIsMock,
      backendOnline, setBackendOnline,
      resetAll,
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
