import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FunnelIcon, ArrowPathIcon, MagnifyingGlassIcon, PhoneArrowDownLeftIcon } from '@heroicons/react/24/outline';
import telephonyApi from '../../../api/telephonyApi';
import marketingAllocationRuleApi from '../../../api/marketingAllocationRuleApi';
import leadSourceApi from '../../../api/leadSourceApi';
import Pagination from '../../../components/common/Pagination';
import { getErrorMessage } from '../../../utils/helpers';
import { badgeStyle } from '../../../utils/badgeColors';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'top' };
const selectStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 150 };

const OUTCOME_BADGE = {
  ASSIGNED: { bg: '#dbeafe', fg: '#1e40af', label: 'New · Assigned' },
  UNASSIGNED: { bg: '#fef3c7', fg: '#92400e', label: 'Unassigned' },
  REACTIVATED: { bg: '#f3e8ff', fg: '#6b21a8', label: 'Reactivated' },
  REFRESHED: { bg: '#dcfce7', fg: '#166534', label: 'FU Refreshed' },
  FAILED: { bg: '#fee2e2', fg: '#991b1b', label: 'Failed' },
};

const CALL_STATUS_BADGE = {
  ANSWERED: { bg: '#dcfce7', fg: '#166534', label: 'Answered' },
  MISSED: { bg: '#fee2e2', fg: '#991b1b', label: 'Missed' },
};

const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');
const userName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—' : '—');

const EMPTY_FILTERS = { dateFrom: '', dateTo: '', leadSourceId: '', userId: '', outcome: '', search: '' };
const LIVE_INTERVAL_MS = 15000;

const CallAllocationHistory = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sources, setSources] = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [stats, setStats] = useState({ total: 0, assigned: 0, unassigned: 0, reactivated: 0, refreshed: 0, failed: 0 });
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [srcResp, tcResp] = await Promise.all([
          leadSourceApi.getDropdown(),
          marketingAllocationRuleApi.getTelecallers(),
        ]);
        setSources(srcResp.data || []);
        setTelecallers(tcResp.data || []);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load filter options'));
      }
    })();
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: pageSize };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const [resp, statResp] = await Promise.all([
        telephonyApi.getAllocations(params),
        telephonyApi.getAllocationStats(params),
      ]);
      setRows(resp.data || []);
      setTotal(resp.meta?.total || 0);
      setStats(statResp.data || { total: 0, assigned: 0, unassigned: 0, reactivated: 0, refreshed: 0, failed: 0 });
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err, 'Failed to load call allocation history'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => { load(true); }, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [live, load]);

  const setFilter = (key, value) => { setPage(1); setFilters((f) => ({ ...f, [key]: value })); };
  const clearFilters = () => { setPage(1); setFilters(EMPTY_FILTERS); };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><PhoneArrowDownLeftIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Call Allocation History</h1>
          <p className="hidden sm:block">Every inbound call that created, reactivated or refreshed a lead, and the telecaller it went to</p>
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
            title={live ? `Live — auto-refreshing every ${LIVE_INTERVAL_MS / 1000}s. Click to stop.` : 'Click to start live auto-refresh'}
          >
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6,
              background: live ? '#22c55e' : '#9ca3af',
              animation: live ? 'cahPulse 1.5s infinite' : 'none',
            }} />
            {live ? 'Live' : 'Paused'}
          </button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => load()} disabled={loading}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      <style>{`@keyframes cahPulse {0%{box-shadow:0 0 0 0 rgba(34,197,94,0.6)}70%{box-shadow:0 0 0 6px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total</div><div style={{ fontSize: 20, fontWeight: 800 }}>{stats.total}</div></div>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>New · Assigned</div><div style={{ fontSize: 20, fontWeight: 800, color: '#1e40af' }}>{stats.assigned}</div></div>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Unassigned</div><div style={{ fontSize: 20, fontWeight: 800, color: '#92400e' }}>{stats.unassigned}</div></div>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Reactivated</div><div style={{ fontSize: 20, fontWeight: 800, color: '#6b21a8' }}>{stats.reactivated}</div></div>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>FU Refreshed</div><div style={{ fontSize: 20, fontWeight: 800, color: '#166534' }}>{stats.refreshed}</div></div>
        <div className="crm-card" style={{ padding: '10px 16px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Failed</div><div style={{ fontSize: 20, fontWeight: 800, color: '#991b1b' }}>{stats.failed}</div></div>
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
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Source</label>
          <select style={selectStyle} value={filters.leadSourceId} onChange={(e) => setFilter('leadSourceId', e.target.value)}>
            <option value="">All Sources</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.source_name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Telecaller</label>
          <select style={selectStyle} value={filters.userId} onChange={(e) => setFilter('userId', e.target.value)}>
            <option value="">All Telecallers</option>
            {telecallers.map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Outcome</label>
          <select style={selectStyle} value={filters.outcome} onChange={(e) => setFilter('outcome', e.target.value)}>
            <option value="">All</option>
            <option value="ASSIGNED">New · Assigned</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="REACTIVATED">Reactivated</option>
            <option value="REFRESHED">FU Refreshed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Search</label>
          <div style={{ position: 'relative' }}>
            <MagnifyingGlassIcon style={{ width: 15, height: 15, position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
            <input style={{ ...selectStyle, width: '100%', paddingLeft: 32 }} placeholder="Name / phone / DID / campaign" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
          </div>
        </div>
        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={clearFilters}>
          <FunnelIcon style={{ width: 14, height: 14 }} /> Clear
        </button>
      </div>

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
            <thead>
              <tr>
                <th style={th}>Date / Time</th>
                <th style={th}>Lead</th>
                <th style={th}>Call</th>
                <th style={th}>Source</th>
                <th style={th}>Telecaller</th>
                <th style={th}>Campaign</th>
                <th style={th}>Outcome</th>
                <th style={th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={8}>Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={8}>No call allocation events match these filters</td></tr>
              )}
              {!loading && rows.map((r) => {
                const badge = OUTCOME_BADGE[r.outcome] || { bg: '#e5e7eb', fg: '#374151', label: r.outcome };
                const callBadge = CALL_STATUS_BADGE[r.call_status] || null;
                const src = r.leadSource;
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>
                        {r.lead ? (`${r.lead.first_name || ''} ${r.lead.last_name || ''}`.trim() || r.lead.lead_number) : (r.lead_name || '—')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {r.lead?.lead_number || ''}{r.phone ? ` · ${r.phone}` : ''}
                      </div>
                    </td>
                    <td style={td}>
                      {callBadge && (
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: callBadge.bg, color: callBadge.fg }}>
                          {callBadge.label}
                        </span>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {r.did_number ? `to ${r.did_number}` : ''}
                        {r.didRule ? ` · ${r.didRule.rule_name}` : ''}
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, ...badgeStyle(src?.color_code) }}>
                        {src?.source_name || r.source_label || '—'}
                      </span>
                      {r.leadSubSource && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>› {r.leadSubSource.sub_source_name}</div>
                      )}
                    </td>
                    <td style={td}>
                      {r.toUser ? userName(r.toUser) : '—'}
                      {r.fromUser && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>from {userName(r.fromUser)}</div>
                      )}
                    </td>
                    <td style={td}>{r.campaign_name || '—'}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.fg }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ ...td, maxWidth: 280, color: 'var(--text-muted)', fontSize: 12 }}>{r.reason || '—'}</td>
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

export default CallAllocationHistory;
