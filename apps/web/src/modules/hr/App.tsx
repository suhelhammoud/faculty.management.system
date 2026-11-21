import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { DirectionProvider } from '@radix-ui/react-direction';
import { NavLink, Navigate, Route, Routes } from 'react-router';
import { createHrClient } from './lib/api';
import { i18n } from './lib/i18n';
import { useUi } from './lib/store';
import { AuthGate } from './components/auth';
import { EmployeesPage } from './pages/employees';
import { EmployeePage } from './pages/employee';
import { SettingsPage } from './pages/settings';
import { Button } from './components/ui/button';
import './index.css';

function HrApp() {
  const language = useUi((s) => s.language);
  const setLanguage = useUi((s) => s.setLanguage);
  const { t } = useTranslation();
  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);
  return (
    <DirectionProvider dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <section className="faculty-hr" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <header className="hr-header">
          <div>
            <p className="hr-eyebrow">{t('Employee records')}</p>
            <h1>{t('Human resources')}</h1>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            aria-label={language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
          >
            {language === 'en' ? 'العربية' : 'English'}
          </Button>
        </header>
        <AuthGate>
          <nav className="hr-nav" aria-label={t('Human resources')}>
            <NavLink to="/hr/employees">{t('Employees')}</NavLink>
            <NavLink to="/hr/settings">{t('Settings')}</NavLink>
          </nav>
          <Routes>
            <Route index element={<Navigate to="employees" replace />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="employees/new" element={<EmployeePage />} />
            <Route path="employees/:employeeId" element={<EmployeePage />} />
            <Route path="employees/:employeeId/edit" element={<EmployeePage edit />} />
            <Route path="settings" element={<Navigate to="staff-categories" replace />} />
            <Route path="settings/:kind" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <div className="hr-stack">
                  <h2>{t('Page not found')}</h2>
                  <NavLink to="/hr/employees">{t('Go to employees')}</NavLink>
                </div>
              }
            />
          </Routes>
        </AuthGate>
      </section>
    </DirectionProvider>
  );
}
export default function App() {
  const [client] = useState(createHrClient);
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <HrApp />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
