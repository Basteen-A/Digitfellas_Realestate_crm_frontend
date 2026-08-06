import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ArrowPathIcon, FunnelIcon } from '@heroicons/react/24/outline';
import reallotmentLogApi from '../../../api/reallotmentLogApi';
import userApi from '../../../api/userApi';
import leadStatusApi from '../../../api/leadStatusApi';
import Pagination from '../../../components/common/Pagination';
import { getErrorMessage } from '../../../utils/helpers';
import { badgeStyle } from '../../../utils/badgeColors';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'top' };

const TRIGGER_LABEL = {
  MISSED_FOLLOWUP: 'Missed Follow-up',
  LAST_SITE_VISIT: 'Last Site Visit',
  LAST_ACTIVITY: 'Last Activity',
  LAST_STATUS_UPDATE: 'Last Status Update',
};

const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '-');
const userName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || '-' : '-');

const OUTCOME_BADGE = {
  REALLOTTED: { bg: '#dbeafe', fg: '#1e40af', label: 'Reallotted' },
  MARKED_INACTIVE: { bg: '#fef3c7', fg: '#92400e', label: 'Marked Inactive' },
};

const EMPTY_FILTERS = { dateFrom: '', dateTo: '', userId: '', leadStatusId: '', outcome: '' };

// How often the live view polls the server (ms)
const LIVE_INTERVAL_MS = 15000;

const ReallotmentLogList = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [users, setUsers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [stats, setStats] = useState({ total: 0, reallotted: 0, markedInactive: 0 });
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [running, setRunning] = useState(false);

  // Load filter dropdown data once
  useEffect(() => {
    (async () => {
      try {
        const [uResp, sResp] = await Promise.all([
          userApi.getAll({ limit: 100, is_active: 'true' }),
          leadStatusApi.getDropdown(),
        ]);
        setUsers(uResp.data?.data || uResp.data || []);
        setStatuses(sResp.data || []);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load filter options'));
      }
    })();
  }, []);

  // `silent` skips the loading spinner - used by the live poll so the table
  // doesn't flicker on every background refresh.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: pageSize };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const [resp, statResp] = await Promise.all([
        reallotmentLogApi.getAll(params),
        reallotmentLogApi.getStats(params),
      ]);
      setRows(resp.data || []);
      setTotal(resp.meta?.total || 0);
      setStats(statResp.data || { total: 0, reallotted: 0, markedInactive: 0 });
      setLastUpdated(new Date());
    } catch (err) {
      // Stay quiet on background polls so live mode doesn't spam toasts.
      if (!silent) toast.error(getErrorMessage(err, 'Failed to load reallotment logs'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => { load(); }, [load]);

  // Live auto-refresh: poll silently while enabled. Re-created when filters /
  // page change (load identity changes) so polls always use current params.
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => { load(true); }, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [live, load]);

  const setFilter = (key, value) => { setPage(1); setFilters((f) => ({ ...f, [key]: value })); };
  const clearFilters = () => { setPage(1); setFilters(EMPTY_FILTERS); };

  const runNow = async () => {
    setRunning(true);
    try {
      const resp = await reallotmentLogApi.runNow();
      const r = resp.data || {};
      toast.success(`Run complete - ${r.reallotted || 0} reallotted, ${r.inactivated || 0} marked inactive`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to run reallotment'));
    } finally {
      setRunning(false);
    }
  };

  const selectStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 150 };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><ArrowPathIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Reallotment Logs</h1>
          <p className="hidden sm:block">Every automatic lead reallotment and max-occurrence inactivation, with filters</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            className={`crm-btn crm-btn-sm ${live ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
            onClick={() => setLive((v) => !v)}
            title={live ? `Live - auto-refreshing every ${LIVE_INTERVAL_MS / 1000}s. Click to stop.` : 'Click to start live auto-refresh'}
          >
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6,
              background: live ? '#22c55e' : '#9ca3af',
              boxShadow: live ? '0 0 0 0 rgba(34,197,94,0.7)' : 'none',
              animation: live ? 'rlPulse 1.5s infinite' : 'none',
            }} />
            {live ? 'Live' : 'Paused'}
          </button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => load()} disabled={loading}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="crm-btn crm-btn-primary crm-btn-sm"
            onClick={runNow}
            disabled={running}
            title="Trigger a reallotment pass now (same work the hourly job does). Only ACTIVE rules apply."
          >
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> {running ? 'Running…' : 'Run Now'}
          </button>
        </div>
      </div>
      <style>{`@keyframes rlPulse {0%{box-shadow:0 0 0 0 rgba(34,197,94,0.6)}70%{box-shadow:0 0 0 6px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Events</div><div style={{ fontSize: 20, fontWeight: 800 }}>{stats.total}</div></div>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Reallotted</div><div style={{ fontSize: 20, fontWeight: 800, color: '#1e40af' }}>{stats.reallotted}</div></div>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Marked Inactive</div><div style={{ fontSize: 20, fontWeight: 800, color: '#92400e' }}>{stats.markedInactive}</div></div>
      </div>

      {/* Filters */}
      <div className="crm-card" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>From Date</label>
          <input type="date" style={selectStyle} value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>To Date</label>
          <input type="date" style={selectStyle} value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>User (from or to)</label>
          <select style={selectStyle} value={filters.userId} onChange={(e) => setFilter('userId', e.target.value)}>
            <option value="">All Users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Status</label>
          <select style={selectStyle} value={filters.leadStatusId} onChange={(e) => setFilter('leadStatusId', e.target.value)}>
            <option value="">All Statuses</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.status_name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Outcome</label>
          <select style={selectStyle} value={filters.outcome} onChange={(e) => setFilter('outcome', e.target.value)}>
            <option value="">All</option>
            <option value="REALLOTTED">Reallotted</option>
            <option value="MARKED_INACTIVE">Marked Inactive</option>
          </select>
        </div>
        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={clearFilters}>
          <FunnelIcon style={{ width: 14, height: 14 }} /> Clear
        </button>
      </div>

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={th}>Date / Time</th>
                <th style={th}>Lead</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={th}>From → To</th>
                <th style={th}>Trigger</th>
                <th style={th}>Days</th>
                <th style={th}>Occ#</th>
                <th style={th}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={9}>Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={9}>No reallotment events match these filters</td></tr>
              )}
              {!loading && rows.map((r) => {
                const badge = OUTCOME_BADGE[r.outcome] || { bg: '#e5e7eb', fg: '#374151', label: r.outcome };
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</td>
                    <td style={td}>
                      {r.lead ? (`${r.lead.first_name || ''} ${r.lead.last_name || ''}`.trim() || r.lead.lead_number) : '-'}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.lead?.lead_number || ''}</div>
                    </td>
                    <td style={td}>{r.userType?.type_name || '-'}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, ...badgeStyle(r.leadStatus?.color_code) }}>
                        {r.leadStatus?.status_name || '-'}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{userName(r.fromUser)}</span>
                      <span style={{ color: 'var(--text-muted)' }}> → </span>
                      <span style={{ fontWeight: 600 }}>{r.toUser ? userName(r.toUser) : '-'}</span>
                    </td>
                    <td style={td}>{TRIGGER_LABEL[r.trigger_basis] || r.trigger_basis || '-'}</td>
                    <td style={td}>{r.threshold_days ?? '-'}</td>
                    <td style={td}>{r.occurrence_no ?? '-'}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.fg }}>
                        {badge.label}
                      </span>
                    </td>
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

export default ReallotmentLogList;
