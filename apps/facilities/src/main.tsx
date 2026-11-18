import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/facilities/*" element={<App />} />
        <Route path="*" element={<Navigate to="/facilities/rooms" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
