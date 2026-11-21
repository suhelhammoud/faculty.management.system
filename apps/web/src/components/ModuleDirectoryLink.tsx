import type { ReactNode } from 'react';
import { Link } from 'react-router';

export type RenderModuleHeader = (sessionControls: ReactNode) => ReactNode;

export function ModuleDirectoryLink() {
  return (
    <Link to="/" className="module-page-directory-link" lang="en" dir="ltr">
      All modules
    </Link>
  );
}

export function ModuleHeaderActions({
  children,
  sessionControls,
}: {
  children: ReactNode;
  sessionControls: ReactNode;
}) {
  return (
    <div className="module-header-actions">
      <div className="module-header-navigation">
        <ModuleDirectoryLink />
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
