import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Link, Outlet, Route, Routes, useLocation } from 'react-router';
import { ModuleDirectoryLink } from './components/ModuleDirectoryLink';
import {
  WorkflowHistory,
  WorkflowInbox,
  WorkflowMonitor,
  WorkflowTask,
} from './modules/workflows/WorkflowPages';

const Designer = lazy(() => import('./modules/workflows/Designer'));
const AdminApp = lazy(() => import('./modules/admin/App'));
const AttendanceApp = lazy(() => import('./modules/attendance/App'));
const MaintenanceApp = lazy(() => import('./modules/maintenance/App'));
const SupervisionApp = lazy(() => import('./modules/supervision/App'));
const MeetingsApp = lazy(() => import('./modules/meetings/App'));
const HrApp = lazy(() => import('./modules/hr/App'));
const ExamsApp = lazy(() => import('./modules/exams/App'));
const CorrespondenceApp = lazy(() => import('./modules/correspondence/App'));
const InventoryApp = lazy(() => import('./modules/inventory/App'));
const StudentAffairsApp = lazy(() => import('./modules/student-affairs/App'));
const FacilitiesApp = lazy(() => import('./modules/facilities/App'));

const modules: Record<
  string,
  { title: string; Component: ComponentType; directoryLinkInHeader?: boolean }
> = {
  admin: { title: 'Administration', Component: AdminApp },
  attendance: { title: 'Attendance', Component: AttendanceApp },
  maintenance: { title: 'Maintenance', Component: MaintenanceApp },
  supervision: { title: 'Supervision', Component: SupervisionApp },
  meetings: { title: 'Meetings', Component: MeetingsApp },
  hr: { title: 'HR', Component: HrApp, directoryLinkInHeader: true },
  exams: { title: 'Exams', Component: ExamsApp },
  correspondence: {
    title: 'Correspondence',
    Component: CorrespondenceApp,
  },
  inventory: { title: 'Inventory', Component: InventoryApp, directoryLinkInHeader: true },
  'student-affairs': {
    title: 'Student Affairs',
    Component: StudentAffairsApp,
    directoryLinkInHeader: true,
  },
  facilities: { title: 'Facilities', Component: FacilitiesApp, directoryLinkInHeader: true },
};

function DirectoryHeader() {
  return (
    <header className="module-header">
      <ModuleDirectoryLink />
    </header>
  );
}

class ModuleBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="module-surface">
        <DirectoryHeader />
        <div className="module-state" role="alert">
          <p>Unable to load this module.</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}

function ModuleDirectory() {
  return (
    <main className="module-directory">
      <h1>IT Faculty Management System</h1>
      <nav aria-label="Faculty modules">
        {Object.entries(modules).map(([name, module]) => (
          <Link key={name} className="module-directory-card" to={`/${name}`}>
            {module.title}
            <span aria-hidden="true">→</span>
          </Link>
        ))}
        <Link className="module-directory-card" to="/workflow/tasks">
          Workflows
          <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </main>
  );
}

function ModulePage() {
  const { pathname } = useLocation();
  return (
    <main className="module-page">
      <ModuleBoundary key={pathname.split('/')[1]}>
        <Suspense
          fallback={
            <div className="module-surface">
              <DirectoryHeader />
              <p role="status">Loading module...</p>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </ModuleBoundary>
    </main>
  );
}

function DefaultHeaderLayout() {
  return (
    <div className="module-surface">
      <DirectoryHeader />
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ModuleDirectory />} />
      <Route element={<ModulePage />}>
        {Object.entries(modules).map(([name, { Component: Module, directoryLinkInHeader }]) => (
          <Route
            key={name}
            path={`/${name}/*`}
            element={
              directoryLinkInHeader ? (
                <Module />
              ) : (
                <div className="module-surface">
                  <DirectoryHeader />
                  <Module />
                </div>
              )
            }
          />
        ))}
        <Route element={<DefaultHeaderLayout />}>
          <Route path="/workflow/designer/:id?" element={<Designer />} />
          <Route path="/workflow/tasks" element={<WorkflowInbox />} />
          <Route path="/workflow/tasks/:id" element={<WorkflowTask />} />
          <Route path="/workflow/monitor" element={<WorkflowMonitor />} />
          <Route path="/workflow/instances/:id" element={<WorkflowHistory />} />
          <Route path="*" element={<p role="alert">Page not found.</p>} />
        </Route>
      </Route>
    </Routes>
  );
}
