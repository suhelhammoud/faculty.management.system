import { lazy, Suspense, useState } from 'react';

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

type ModuleName = keyof typeof modules;

export default function App() {
    const [activeModule, setActiveModule] =
        useState<ModuleName>('attendance');

    const ActiveComponent = modules[activeModule].Component;

    return (
        <div style={{ padding: '24px' }}>
            <h1>IT Faculty Management System</h1>

            <nav
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '24px',
                }}
            >
                {(
                    Object.keys(modules) as ModuleName[]
                ).map((moduleName) => (
                    <button
                        key={moduleName}
                        onClick={() => setActiveModule(moduleName)}
                        aria-pressed={activeModule === moduleName}
                    >
                        {modules[moduleName].title}
                    </button>
                ))}
            </nav>

            <main>
                <h2>{modules[activeModule].title}</h2>

                <Suspense fallback={<p>Loading module...</p>}>
                    <ActiveComponent />
                </Suspense>
            </main>
        </div>
    );
}