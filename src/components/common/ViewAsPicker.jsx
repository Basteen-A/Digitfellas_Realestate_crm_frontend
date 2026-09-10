// ============================================================
// ROLE WORKSPACES - pick whose portal to open
// Super Admin / Admin only. Selecting a person opens their portal
// read-only; the server enforces that (server/src/middleware/auth.js).
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { XMarkIcon, MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline';
import userApi from '../../api/userApi';
import userTypeApi from '../../api/userTypeApi';
import { setViewAs } from '../../utils/viewAs';
import { loadUser } from '../../redux/slices/authSlice';

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
};
const panel = {
  background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460,
  maxHeight: '80vh', display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
};
const header = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 18px', borderBottom: '1px solid #E5E7EB',
};
const closeBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: '#6B7280', padding: 4, display: 'flex',
};
const searchWrap = { position: 'relative', padding: '12px 18px 8px' };
const input = {
  width: '100%', padding: '8px 12px 8px 34px', border: '1px solid #D1D5DB',
  borderRadius: 8, fontSize: 13, outline: 'none',
};
const row = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '10px 18px', border: 'none', background: 'transparent',
  cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#111',
};
const avatar = {
  width: 30, height: 30, borderRadius: '50%', background: '#EEF2FF', color: '#4338CA',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12, flexShrink: 0,
};

const initials = (u) =>
  `${(u.first_name || '')[0] || ''}${(u.last_name || '')[0] || ''}`.toUpperCase() || '?';
const nameOf = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Unnamed';

const ViewAsPicker = ({ open, roleCode, roleName, landingPath, onClose }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open || !roleCode) return;
    let cancelled = false;
    setQuery('');
    setEntering(null);
    setLoading(true);
    (async () => {
      try {
        const typesResp = await userTypeApi.getAll({ limit: 100 });
        const types = typesResp.data?.data || typesResp.data || [];
        const match = types.find((t) => t.short_code === roleCode);
        if (!match) throw new Error(`Role ${roleCode} not found`);

        const resp = await userApi.getAll({ user_type_id: match.id, is_active: 'true', limit: 100 });
        if (cancelled) return;
        setUsers(resp.data?.data || resp.data || []);
      } catch (err) {
        if (!cancelled) toast.error(err?.response?.data?.message || err?.message || 'Unable to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    setTimeout(() => searchRef.current?.focus(), 60);
    return () => { cancelled = true; };
  }, [open, roleCode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${nameOf(u)} ${u.email || ''}`.toLowerCase().includes(q));
  }, [users, query]);

  if (!open) return null;

  const choose = async (user) => {
    if (entering) return;
    setEntering(user.id);
    setViewAs({ id: user.id, name: nameOf(user), roleCode, roleName });
    try {
      // Re-read the profile with the header attached: /auth/me now answers as the
      // target, so redux - and with it the sidebar, guards and every page - turns
      // into that person's portal.
      await dispatch(loadUser()).unwrap();
      onClose?.();
      navigate(landingPath, { replace: true });
    } catch (err) {
      toast.error('Could not open that workspace');
      setEntering(null);
    }
  };

  return (
    <div style={overlay} onClick={() => !entering && onClose?.()}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <EyeIcon style={{ width: 18, height: 18, color: '#4338CA' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Open a {roleName} workspace</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>You will see their pages and data, read-only</div>
            </div>
          </div>
          <button type="button" onClick={() => !entering && onClose?.()} style={closeBtn} aria-label="Close">
            <XMarkIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={searchWrap}>
          <MagnifyingGlassIcon style={{ width: 15, height: 15, position: 'absolute', left: 30, top: 20, color: '#9CA3AF' }} />
          <input
            ref={searchRef}
            style={input}
            value={query}
            placeholder="Search by name or email"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div style={{ overflowY: 'auto', paddingBottom: 10 }}>
          {loading ? (
            <div style={{ padding: '24px 18px', fontSize: 13, color: '#6B7280' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '24px 18px', fontSize: 13, color: '#6B7280' }}>
              {users.length === 0 ? `No active ${roleName} users.` : 'No match.'}
            </div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                style={{ ...row, opacity: entering && entering !== u.id ? 0.5 : 1 }}
                onClick={() => choose(u)}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={avatar}>{initials(u)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block' }}>{nameOf(u)}</span>
                  {u.email ? (
                    <span style={{ display: 'block', fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.email}
                    </span>
                  ) : null}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280' }}>
                  {entering === u.id ? 'Opening…' : 'View →'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewAsPicker;
