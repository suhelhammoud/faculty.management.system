import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import { ModuleHeaderActions } from '../../components/ModuleDirectoryLink';
import { AuthGate } from './components/auth';
import { LanguageProvider } from './lib/language';
import { useLanguage } from './lib/language-context';
import { createFacilitiesClient } from './lib/api';
import { RoomsPage } from './pages/rooms';
import { SettingsPage } from './pages/settings';
import './App.css';
import './index.css';

function FacilitiesShell() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <section
      className="faculty-facilities module-surface"
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <AuthGate
        renderHeader={(sessionControls) => (
          <header className="module-header">
            <div className="fac-brand">
              <span className="fac-brand-mark">
                <Building2 size={21} />
              </span>
              <div>
                <p className="fac-eyebrow">{t('Physical spaces')}</p>
                <h1>{t('Facilities')}</h1>
              </div>
            </div>
            <ModuleHeaderActions sessionControls={sessionControls}>
              <button
                type="button"
                className="fac-button fac-button--secondary fac-language-button"
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                aria-label={language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
              >
                {language === 'en' ? 'العربية' : 'English'}
              </button>
            </ModuleHeaderActions>
          </header>
        )}
      >
        <nav className="module-navigation" aria-label={t('Facilities')}>
          <NavLink to="/facilities/rooms">{t('Rooms')}</NavLink>
          <NavLink to="/facilities/settings">{t('Settings')}</NavLink>
        </nav>
        <Routes>
          <Route index element={<Navigate to="rooms" replace />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="*"
            element={
              <div className="fac-card">
                <h2>{t('Page not found')}</h2>
              </div>
            }
          />
        </Routes>
      </AuthGate>
    </section>
  );
}

export default function App() {
  const [client] = useState(createFacilitiesClient);
  return (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <FacilitiesShell />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
