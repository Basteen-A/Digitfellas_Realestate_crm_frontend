import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const DATE_FILTERS = [
  { value: 'all_time', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'WTD' },
  { value: 'this_month', label: 'MTD' },
  { value: 'custom', label: 'Custom' },
];

const SalesHeadTeamPerformance = () => {
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState([]);
  const [dateFilter, setDateFilter] = useState('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    // For custom, wait until both ends are picked before querying.
    if (dateFilter === 'custom' && (!customStart || !customEnd)) return;
    loadTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, customStart, customEnd]);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      const params = { dateFilter };
      if (dateFilter === 'custom') {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const resp = await leadWorkflowApi.getMySMTeam(params);
      setTeamData(resp.data || []);
    } catch (err) {
      toast.error('Failed to load team performance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Team Performance</h1>
          <p className="hidden sm:block">SMs who have shared leads with you - Visits Done reflects the selected date range</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, minWidth: 120,
              border: '1px solid var(--border-primary)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', outline: 'none', cursor: 'pointer',
            }}
          >
            {DATE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          {dateFilter === 'custom' && (
            <>
              <input
                type="date" value={customStart} max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
              <input
                type="date" value={customEnd} min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
              />
            </>
          )}
          <button type="button" className="crm-btn crm-btn-ghost" onClick={loadTeamData}><ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh</button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          Loading team performance...
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="crm-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Active Leads</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed' }}>{teamData.reduce((sum, sm) => sum + sm.activeLeads, 0)}</div>
        </div>
        <div className="crm-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Visits Done</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-green)' }}>{teamData.reduce((sum, sm) => sum + (sm.svDone || 0), 0)}</div>
        </div>
      </div>

      {/* Team Performance Table */}
      <div className="crm-card">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', fontWeight: 700, fontSize: 14 }}>
          SM Performance (Shared Leads)
        </div>
        {teamData.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>No SMs found</div>
            <div>No Sales Managers have shared leads with you yet</div>
          </div>
        ) : (
          <div className="crm-card-body-flush">
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Sales Manager</th>
                    <th>Email</th>
                    <th style={{ textAlign: 'right' }}>Active Leads</th>
                    <th style={{ textAlign: 'right' }}>Total Leads</th>
                    <th style={{ textAlign: 'right' }}>Visits Done</th>
                  </tr>
                </thead>
                <tbody>
                  {teamData.map((sm) => (
                    <tr key={sm.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{sm.fullName}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sm.email}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#7c3aed' }}>{sm.activeLeads}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{sm.totalLeads}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent-green)' }}>{sm.svDone ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default SalesHeadTeamPerformance;
