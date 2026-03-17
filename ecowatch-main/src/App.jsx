import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DemandPage from './pages/DemandPage';
import AreaUsagePage from './pages/AreaUsagePage';
import EnergyFlowPage from './pages/EnergyFlowPage';
import ItemSummary from './pages/ItemSummary'; 
import EnergyRanking from './pages/EnergyRanking';
import TOUPeriod from './pages/TOUPeriod';
import AnnualReport from './pages/AnnualReport';
import Login from './pages/Login';
import Portal from './pages/Portal';
import ProtectedRoute from './ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route 
          path="/portal" 
          element={
            <ProtectedRoute>
              <Portal />
            </ProtectedRoute>
          } 
        /> 

        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/portal" replace />} />
          
          <Route path="demand" element={<DemandPage />} />
          <Route path="area-usage" element={<AreaUsagePage />} />
          <Route path="energy-flow" element={<EnergyFlowPage />} />
          <Route path="item-summary" element={<ItemSummary />} />
          <Route path="energy-ranking" element={<EnergyRanking />} />
          <Route path="tou-period" element={<TOUPeriod />} />
          <Route path="annual-report" element={<AnnualReport />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;