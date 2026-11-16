import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router';

const AdminApp = lazy(() => import('admin/App'));

const AttendanceApp = lazy(() => import('attendance/App'));
const MaintenanceApp = lazy(() => import('maintenance/App'));
const SupervisionApp = lazy(() => import('supervision/App'));
const MeetingsApp = lazy(() => import('meetings/App'));
const HrApp = lazy(() => import('hr/App'));
const ExamsApp = lazy(() => import('exams/App'));
const CorrespondenceApp = lazy(() => import('correspondence/App'));
const InventoryApp = lazy(() => import('inventory/App'));
const StudentAffairsApp = lazy(() => import('student-affairs/App'));
const FacilitiesApp = lazy(() => import('facilities/App'));

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

class RemoteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
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
      </nav>
      <main>
        <RemoteBoundary key={location.pathname.split('/')[1]}>
          <Suspense fallback={<p role="status">Loading module...</p>}>
            <Routes>
              <Route path="/" element={<Navigate to="/attendance" replace />} />
              {Object.entries(modules).map(([name, { Component: Module }]) => (
                <Route key={name} path={`/${name}/*`} element={<Module />} />
              ))}
              <Route path="*" element={<p role="alert">Page not found.</p>} />
            </Routes>
          </Suspense>
        </RemoteBoundary>
      </main>
    </div>
  );
}
