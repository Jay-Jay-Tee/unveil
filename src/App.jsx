import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Upload from './pages/Upload';
import DatasetAudit from './pages/DatasetAudit';
import ModelAudit from './pages/ModelAudit';
import Report from './pages/Report';

export default function App() {
  const location = useLocation();

  return (
    <>
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Landing />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/audit/dataset" element={<DatasetAudit />} />
          <Route path="/audit/model" element={<ModelAudit />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}
