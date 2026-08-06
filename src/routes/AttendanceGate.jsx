import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import attendanceApi from '../api/attendanceApi';

// Attendance gate: enforced-role users (telecallers by default) must check in
// once per day before entering any private page. Positive results are cached
// for the session-day so the gate costs one request per login; "not checked
// in" is never cached, so the state flips immediately after check-in.
let passCache = { userId: null, date: null };

// "Skip check-in" - the user chose to enter WITHOUT checking in. They can work
// their existing leads but stay "not checked in" server-side, so lead allocation
// keeps excluding them from NEW leads (and the absent-reallocation job still
// moves their fresh overnight leads to present teammates). Session-scoped (in
// memory): a hard refresh brings the gate back so they can still check in later.
let skipCache = { userId: null, date: null };

const todayKey = () => new Date().toDateString();

export const clearAttendancePassCache = () => { passCache = { userId: null, date: null }; };
export const markAttendanceSkipped = (userId) => { skipCache = { userId: userId || null, date: todayKey() }; };
export const clearAttendanceSkip = () => { skipCache = { userId: null, date: null }; };
const isSkipped = (userId) => Boolean(userId) && skipCache.userId === userId && skipCache.date === todayKey();

// Floating reminder shown while the user is in the app on a skipped check-in.
const SkipBanner = () => {
  const navigate = useNavigate();
  const checkInNow = () => { clearAttendanceSkip(); navigate('/check-in'); };
  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 4000,
      display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 24px)',
      background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e',
      borderRadius: 999, padding: '8px 10px 8px 16px', fontSize: 13, fontWeight: 600,
      boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
    }}>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        Not checked in - you won't receive new leads today.
      </span>
      <button
        type="button"
        onClick={checkInNow}
        style={{ flexShrink: 0, background: '#92400e', color: '#fff', border: 'none', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >
        Check in now
      </button>
    </div>
  );
};

const AttendanceGate = () => {
  const user = useSelector((state) => state.auth.user);
  const cached = user?.id && passCache.userId === user.id && passCache.date === todayKey();
  const [state, setState] = useState(cached ? 'pass' : (isSkipped(user?.id) ? 'skipped' : 'loading'));

  useEffect(() => {
    if (cached) return;
    let alive = true;
    (async () => {
      try {
        const resp = await attendanceApi.getStatus();
        const s = resp.data || {};
        if (!alive) return;
        if (s.enforced && !s.checkedIn) {
          // Blocked - unless the user explicitly skipped check-in this session.
          setState(isSkipped(user?.id) ? 'skipped' : 'blocked');
        } else {
          // Properly in (checked in, or attendance not enforced) - drop any skip.
          if (isSkipped(user?.id)) clearAttendanceSkip();
          passCache = { userId: user?.id || null, date: todayKey() };
          setState('pass');
        }
      } catch {
        // Fail open - attendance must never lock the whole app out on an API error.
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
  if (state === 'skipped') {
    return (
      <>
        <Outlet />
        <SkipBanner />
      </>
    );
  }
  return <Outlet />;
};

export default AttendanceGate;
