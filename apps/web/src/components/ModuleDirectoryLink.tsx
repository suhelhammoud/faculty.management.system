import type { FacultyLanguage } from './language-preference';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export type RenderModuleHeader = (sessionControls: ReactNode) => ReactNode;

export function ModuleDirectoryLink({ language = 'en' }: { language?: FacultyLanguage }) {
  return (
    <Link
      to="/"
      className="module-page-directory-link"
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {language === 'ar' ? 'جميع الوحدات' : 'All modules'}
    </Link>
  );
}

export function ModuleHeaderActions({
  children,
  sessionControls,
  language,
}: {
  children: ReactNode;
  language?: FacultyLanguage;
  sessionControls: ReactNode;
}) {
  return (
    <div className="module-header-actions">
      <div className="module-header-navigation">
        <ModuleDirectoryLink language={language} />
        {children}
      </div>
      {sessionControls}
    </div>
  );
}

export function ModuleSessionControls({
  username,
  children,
}: {
  username: string;
  children: ReactNode;
}) {
  return (
    <div className="module-session-controls">
      <bdi className="module-session-username">{username}</bdi>
      {children}
    </div>
  );
}
