import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PhoneArrowUpRightIcon, PhoneXMarkIcon, FunnelIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import telephonyApi from '../../../api/telephonyApi';
import userApi from '../../../api/userApi';
import Pagination from '../../../components/common/Pagination';
import RecordingCell from '../../../components/telephony/RecordingCell';
import CallDirectionIcon from '../../../components/telephony/CallDirectionIcon';
import { getErrorMessage } from '../../../utils/helpers';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'middle' };
const selectStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 150 };

const AGENT_ROLES = ['TC', 'SM', 'SH'];
const STATUS_BADGE = {
  ANSWERED: { bg: '#dcfce7', fg: '#166534', label: 'Answered' },
  MISSED: { bg: '#fee2e2', fg: '#991b1b', label: 'Missed' },
};

const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '-');
const fmtDuration = (secs) => {
  if (!secs && secs !== 0) return '-';
  const m = Math.floor(secs / 60);
  return m ? `${m}m ${secs % 60}s` : `${secs % 60}s`;
};
const userName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '');
const leadName = (l) => (l ? `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.lead_number : null);

const EMPTY_FILTERS = { date_from: '', date_to: '', status: '', agent_user_id: '', search: '' };
const LIVE_INTERVAL_MS = 20000;

// Telephony → Call Logs. Every call captured from Tata Smartflo, matched to a
// telecaller + lead, with recording playback and filters. Rendered both under
// Super Admin and inside the Collection Manager portal; the server scopes the
// rows (org-wide for SA / ADM / COL, own-or-team for everyone else).
const CallLogs = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [agents, setAgents] = useState([]);
  const [live, setLive] = useState(true);

  // Name/role-only picker list - the Collection Manager renders this same screen
  // and is not allowed the full admin user list.
  useEffect(() => {
    userApi.getDropdown()
      .then((resp) => setAgents((resp.data || []).filter((u) => AGENT_ROLES.includes(u.userType?.short_code))))
      .catch(() => { });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: pageSize };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const resp = await telephonyApi.getCallLogs(params);
      setRows(resp.data || []);
      setTotal(resp.meta?.total || 0);
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err, 'Failed to load call logs'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => load(true), LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [live, load]);

  const setFilter = (key, value) => { setPage(1); setFilters((f) => ({ ...f, [key]: value })); };
  const clearFilters = () => { setPage(1); setFilters(EMPTY_FILTERS); };

  const answeredCount = rows.filter((r) => r.call_status === 'ANSWERED').length;
  const missedCount = rows.filter((r) => r.call_status === 'MISSED').length;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><PhoneArrowUpRightIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Call Logs</h1>
          <p className="hidden sm:block">Every Tata Smartflo call - answered &amp; missed - matched to a telecaller and lead</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`crm-btn crm-btn-sm ${live ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
            onClick={() => setLive((v) => !v)}
            title={live ? `Live - auto-refreshing every ${LIVE_INTERVAL_MS / 1000}s.` : 'Click to enable live refresh'}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6, background: live ? '#22c55e' : '#9ca3af' }} />
            {live ? 'Live' : 'Paused'}
          </button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => load()} disabled={loading}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary chips (current page) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total</div><div style={{ fontSize: 20, fontWeight: 800 }}>{total}</div></div>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Answered (page)</div><div style={{ fontSize: 20, fontWeight: 800, color: '#166534' }}>{answeredCount}</div></div>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Missed (page)</div><div style={{ fontSize: 20, fontWeight: 800, color: '#991b1b' }}>{missedCount}</div></div>
      </div>

      {/* Filters */}
      <div className="crm-card" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>From Date</label>
          <input type="date" style={selectStyle} value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>To Date</label>
          <input type="date" style={selectStyle} value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Status</label>
          <select style={selectStyle} value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All</option>
            <option value="ANSWERED">Answered</option>
            <option value="MISSED">Missed</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Telecaller</label>
          <select style={selectStyle} value={filters.agent_user_id} onChange={(e) => setFilter('agent_user_id', e.target.value)}>
            <option value="">All Telecallers</option>
            {agents.map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Search</label>
          <div style={{ position: 'relative' }}>
            <MagnifyingGlassIcon style={{ width: 15, height: 15, position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
            <input style={{ ...selectStyle, width: '100%', paddingLeft: 32 }} placeholder="Customer / agent number" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
          </div>
        </div>
        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={clearFilters}>
          <FunnelIcon style={{ width: 14, height: 14 }} /> Clear
        </button>
      </div>

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={th}>Date / Time</th>
                <th style={th}>Direction</th>
                <th style={th}>Telecaller</th>
                <th style={th}>Lead</th>
                <th style={th}>Customer No.</th>
                <th style={th}>Status</th>
                <th style={th}>Duration</th>
                <th style={th}>Recording</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={8}>Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={8}>No calls match these filters</td></tr>
              )}
              {!loading && rows.map((r) => {
                const badge = STATUS_BADGE[r.call_status] || { bg: '#e5e7eb', fg: '#374151', label: r.call_status || 'Unknown' };
                const answered = r.call_status === 'ANSWERED';
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <CallDirectionIcon direction={r.direction} status={r.call_status} />
                        {fmtDateTime(r.start_stamp || r.received_at)}
                      </span>
                    </td>
                    <td style={{ ...td, textTransform: 'capitalize' }}>{r.direction || '-'}</td>
                    <td style={td}>
                      {r.agent ? userName(r.agent) : <span style={{ color: 'var(--text-muted)' }}>Unmatched</span>}
                      {r.agent_number && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.agent_number}</div>}
                    </td>
                    <td style={td}>
                      {r.lead ? (
                        <>
                          <div style={{ fontWeight: 600 }}>{leadName(r.lead)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.lead.lead_number || ''}</div>
                        </>
                      ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.customer_number || '-'}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.fg }}>
                        {answered ? <PhoneArrowUpRightIcon style={{ width: 12, height: 12 }} /> : <PhoneXMarkIcon style={{ width: 12, height: 12 }} />}
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDuration(r.duration)}</td>
                    <td style={td}><RecordingCell callId={r.id} hasRecording={Boolean(r.recording_url)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPage(1); setPageSize(s); }}
          />
        )}
      </div>
    </div>
  );
};

export default CallLogs;
