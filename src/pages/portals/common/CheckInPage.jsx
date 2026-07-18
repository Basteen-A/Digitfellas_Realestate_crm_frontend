import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MapPinIcon, ClockIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import attendanceApi from '../../../api/attendanceApi';
import { useAuthContext } from '../../../contexts/AuthContext';
import { getErrorMessage } from '../../../utils/helpers';

// Daily check-in gate. Enforced-role users land here after login and cannot
// enter their portal until they check in from inside their office geofence
// (before the admin-configured deadline). Cancel logs them out.
const CheckInPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuthContext();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await attendanceApi.getStatus();
      setStatus(resp.data || null);
      // Already checked in (or not required at all) → straight to the portal.
      if (!resp.data?.enforced || resp.data?.checkedIn) {
        navigate('/', { replace: true });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load attendance status'));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const handleCheckIn = () => {
    if (checking) return;
    setChecking(true);

    const submit = async (coords) => {
      try {
        const resp = await attendanceApi.checkIn(coords);
        const d = resp.data || {};
        toast.success(d.geofenceValidated
          ? `Checked in — ${Math.round(d.distanceM || 0)}m from office`
          : 'Checked in successfully');
        navigate('/', { replace: true });
      } catch (err) {
        toast.error(getErrorMessage(err, 'Check-in failed'));
      } finally {
        setChecking(false);
      }
    };

    if (status?.hasGeofence && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => submit({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
        (err) => {
          setChecking(false);
          toast.error(err.code === 1
            ? 'Location permission denied — allow location access to check in.'
            : 'Could not get your location. Move to an open area and try again.');
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    } else {
      submit({});
    }
  };

  const handleCancel = async () => {
    try { await logout(); } catch { /* proceed regardless */ }
    navigate('/login', { replace: true });
  };

  const deadlinePassed = status && !status.canCheckInNow;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-secondary, #f3f4f6)', padding: 16,
    }}>
      <div className="crm-card" style={{ maxWidth: 440, width: '100%', padding: 28, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, margin: '0 auto 14px', borderRadius: '50%',
          background: deadlinePassed ? '#fee2e2' : '#dbeafe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {deadlinePassed
            ? <ClockIcon style={{ width: 32, height: 32, color: '#b91c1c' }} />
            : <MapPinIcon style={{ width: 32, height: 32, color: '#1d4ed8' }} />}
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Daily Check-In</h1>
        <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: 13, marginBottom: 14 }}>
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
          {' · '}
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>

        {loading && <p style={{ color: 'var(--text-muted, #6b7280)' }}>Loading…</p>}

        {!loading && status && (
          <>
            {deadlinePassed ? (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <p style={{ fontWeight: 700, color: '#b91c1c', marginBottom: 4 }}>Check-in time is over</p>
                <p style={{ fontSize: 13, color: '#7f1d1d' }}>
                  Check-in was allowed until {status.checkinDeadline}. Please contact your admin to be checked in manually.
                </p>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-primary, #fff)', border: '1px solid var(--border-primary, #e5e7eb)', borderRadius: 10, padding: 14, marginBottom: 16, textAlign: 'left' }}>
                <p style={{ fontSize: 13, marginBottom: 6 }}>
                  <strong>Check-in closes at {status.checkinDeadline}.</strong>
                </p>
                {status.hasGeofence ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
                    You must be at {status.geofences.map((g) => `${g.name} (within ${g.radiusM}m)`).join(' or ')}.
                    Your location is verified when you press Check In.
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
                    No office geofence is configured for you yet — your check-in is recorded without location verification.
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {!deadlinePassed && (
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  style={{ minWidth: 140 }}
                  disabled={checking}
                  onClick={handleCheckIn}
                >
                  <MapPinIcon style={{ width: 16, height: 16 }} /> {checking ? 'Checking in…' : 'Check In'}
                </button>
              )}
              <button type="button" className="crm-btn crm-btn-ghost" style={{ minWidth: 120 }} onClick={handleCancel}>
                <ArrowRightOnRectangleIcon style={{ width: 16, height: 16 }} /> Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckInPage;
