import { lazy, Suspense } from 'react';

const AttendanceApp = lazy(() => import('attendance/App'));

export default function App() {
  return (
      <div style={{ padding: '24px' }}>
        <h1>IT Faculty Management System</h1>

        <h2>Attendance System</h2>

        <Suspense fallback={<p>Loading Attendance...</p>}>
          <AttendanceApp />
        </Suspense>
      </div>
  );
}