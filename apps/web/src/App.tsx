import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router';
import {
  WorkflowHistory,
  WorkflowInbox,
  WorkflowMonitor,
  WorkflowTask,
} from './modules/workflows/WorkflowPages';

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

const modules = {
  admin: { title: 'Administration', Component: AdminApp },
  attendance: { title: 'Attendance', Component: AttendanceApp },
  maintenance: { title: 'Maintenance', Component: MaintenanceApp },
  supervision: { title: 'Supervision', Component: SupervisionApp },
  meetings: { title: 'Meetings', Component: MeetingsApp },
  hr: { title: 'HR', Component: HrApp },
  exams: { title: 'Exams', Component: ExamsApp },
  correspondence: {
    title: 'Correspondence',
    Component: CorrespondenceApp,
  },
  inventory: { title: 'Inventory', Component: InventoryApp },
  'student-affairs': {
    title: 'Student Affairs',
    Component: StudentAffairsApp,
  },
  facilities: { title: 'Facilities', Component: FacilitiesApp },
};

class ModuleBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        <p>Unable to load this module.</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const location = useLocation();
  return (
    <div className="faculty-shell" style={{ padding: '24px', textAlign: 'start' }}>
      <h1 style={{ fontSize: '24px', margin: '0 0 16px' }}>IT Faculty Management System</h1>
      <nav
        aria-label="Faculty modules"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}
      >
        {Object.entries(modules).map(([name, module]) => (
          <NavLink
            key={name}
            to={`/${name}`}
            style={({ isActive }) => ({ fontWeight: isActive ? 700 : 400 })}
          >
            {module.title}
          </NavLink>
        ))}
        <NavLink
          to="/workflow/tasks"
          style={({ isActive }) => ({ fontWeight: isActive ? 700 : 400 })}
        >
          Workflows
        </NavLink>
      </nav>
      <main>
        <ModuleBoundary key={location.pathname.split('/')[1]}>
          <Suspense fallback={<p role="status">Loading module...</p>}>
            <Routes>
              <Route path="/" element={<Navigate to="/attendance" replace />} />
              <Route path="/workflow/tasks" element={<WorkflowInbox />} />
              <Route path="/workflow/tasks/:id" element={<WorkflowTask />} />
              <Route path="/workflow/monitor" element={<WorkflowMonitor />} />
              <Route path="/workflow/instances/:id" element={<WorkflowHistory />} />
              {Object.entries(modules).map(([name, { Component: Module }]) => (
                <Route key={name} path={`/${name}/*`} element={<Module />} />
              ))}
              <Route path="*" element={<p role="alert">Page not found.</p>} />
            </Routes>
          </Suspense>
        </ModuleBoundary>
      </main>
    </div>
  );
}
