import { createContext, useContext, useState } from 'react';

const AuditContext = createContext(null);

export function AuditProvider({ children }) {
  // Files
  const [datasetFile, setDatasetFile] = useState(null);
  const [modelFile,   setModelFile]   = useState(null);

  // What mode are we in? 'dataset' | 'model' | 'both'
  const [auditMode, setAuditMode] = useState(null);

  // Part A results (dataset)
  const [schemaMap,   setSchemaMap]   = useState(null);
  const [proxyFlags,  setProxyFlags]  = useState(null);
  const [biasReport,  setBiasReport]  = useState(null);
  const [datasetMeta, setDatasetMeta] = useState(null);

  // Part B results (model)
  const [modelBiasReport, setModelBiasReport] = useState(null);
  const [modelMeta,       setModelMeta]       = useState(null); // { modelName, isDemo }

  // UI state
  const [isMock,        setIsMock]        = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);

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

  return (
    <AuditContext.Provider value={{
      datasetFile, setDatasetFile,
      modelFile,   setModelFile,
      auditMode,   setAuditMode,
      schemaMap,   setSchemaMap,
      proxyFlags,  setProxyFlags,
      biasReport,  setBiasReport,
      datasetMeta, setDatasetMeta,
      modelBiasReport, setModelBiasReport,
      modelMeta,       setModelMeta,
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
