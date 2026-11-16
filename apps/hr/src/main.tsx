import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/hr/*" element={<App />} />
        <Route path="*" element={<Navigate to="/hr/employees" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
