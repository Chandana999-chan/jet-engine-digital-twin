import { Routes, Route } from "react-router-dom";

import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import LiveMonitoring from "./pages/LiveMonitoring";
import DigitalTwin from "./pages/DigitalTwin";
import Analytics from "./pages/Analytics";
import AcousticAnalysis from "./pages/AcousticAnalysis";
import ExplainableAI from "./pages/ExplainableAI";
import Maintenance from "./pages/Maintenance";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="live" element={<LiveMonitoring />} />
        <Route path="digital-twin" element={<DigitalTwin />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="acoustic" element={<AcousticAnalysis />} />
        <Route path="xai" element={<ExplainableAI />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;