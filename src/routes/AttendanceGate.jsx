import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import attendanceApi from '../api/attendanceApi';

// Attendance gate: enforced-role users (telecallers by default) must check in
// once per day before entering any private page. Positive results are cached
// for the session-day so the gate costs one request per login; "not checked
// in" is never cached, so the state flips immediately after check-in.
let passCache = { userId: null, date: null };

const todayKey = () => new Date().toDateString();

export const clearAttendancePassCache = () => { passCache = { userId: null, date: null }; };

const AttendanceGate = () => {
  const user = useSelector((state) => state.auth.user);
  const cached = user?.id && passCache.userId === user.id && passCache.date === todayKey();
  const [state, setState] = useState(cached ? 'pass' : 'loading');

  useEffect(() => {
    if (cached) return;
    let alive = true;
    (async () => {
      try {
        const resp = await attendanceApi.getStatus();
        const s = resp.data || {};
        if (!alive) return;
        if (s.enforced && !s.checkedIn) {
          setState('blocked');
        } else {
          passCache = { userId: user?.id || null, date: todayKey() };
          setState('pass');
        }
      } catch {
        // Fail open — attendance must never lock the whole app out on an API error.
        if (alive) setState('pass');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (state === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 14 }}>
        Checking attendance…
      </div>
    );
  }
  if (state === 'blocked') return <Navigate to="/check-in" replace />;
  return <Outlet />;
};

export default AttendanceGate;
