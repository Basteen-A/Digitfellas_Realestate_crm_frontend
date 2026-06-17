import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import reportApi from '../../../api/reportApi';
import projectApi from '../../../api/projectApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { BanknotesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import '../Reports/Reports.css';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'wtd', label: 'Week to Date' },
  { key: 'mtd', label: 'Month to Date' },
  { key: 'all', label: 'All Time' },
];

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)' };

const Metric = ({ label, value, color }) => (
  <div className="crm-card" style={{ padding: 16, minWidth: 140, flex: 1 }}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text-primary)', marginTop: 4 }}>{value}</div>
  </div>
);

const FinanceCollections = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    projectApi.getDropdown().then((r) => setProjects(r.data || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportApi.getInventory({ period, projectId });
      setData(res?.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load collections'));
    } finally {
      setLoading(false);
    }
  }, [period, projectId]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals || {};
  const rows = data?.byProject || [];
  const dueOf = (r) => Math.max(0, Number(r.total_value || 0) - Number(r.total_received || 0));

  return (
    <div className="reports-page">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><BanknotesIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Collections</h1>
          <p className="hidden sm:block">Project-wise collection progress</p>
        </div>
      </div>

      <div className="reports-filter-bar">
        <div className="reports-filter" style={{ flex: '0 1 200px' }}>
          <label className="reports-filter__label" htmlFor="col-period">Period</label>
          <select id="col-period" className="reports-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <div className="reports-filter" style={{ flex: '0 1 240px' }}>
          <label className="reports-filter__label" htmlFor="col-project">Project</label>
          <select id="col-project" className="reports-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name || p.name}</option>)}
          </select>
        </div>
        <div className="reports-filter-actions">
          <button className="crm-btn crm-btn-ghost" onClick={load}><ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <Metric label="Total Value" value={formatCurrency(t.totalValue || 0)} color="var(--accent-blue)" />
        <Metric label="Received" value={formatCurrency(t.totalReceived || 0)} color="var(--accent-green)" />
        <Metric label="Due" value={formatCurrency(t.totalDue || 0)} color="var(--accent-red)" />
        <Metric label="Refunds" value={formatCurrency(t.totalRefund || 0)} color="var(--accent-yellow)" />
        <Metric label="Received (period)" value={formatCurrency(t.receivedInPeriod || 0)} color="var(--accent-green)" />
      </div>

      <div className="crm-card" style={{ overflowX: 'auto' }}>
        <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border-primary)' }}>By Project</div>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Project</th>
                <th style={th}>Units (booked/total)</th>
                <th style={th}>Total Value</th>
                <th style={th}>Received</th>
                <th style={th}>Due</th>
                <th style={th}>Refund</th>
                <th style={th}>Collected %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const value = Number(r.total_value || 0);
                const pct = value > 0 ? Math.round((Number(r.total_received || 0) / value) * 100) : 0;
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.project_name || '—'}</td>
                    <td style={td}>{r.booked_units || 0}/{r.total_units || 0}</td>
                    <td style={td}>{formatCurrency(value)}</td>
                    <td style={{ ...td, color: 'var(--accent-green)', fontWeight: 600 }}>{formatCurrency(r.total_received || 0)}</td>
                    <td style={{ ...td, color: 'var(--accent-red)' }}>{formatCurrency(dueOf(r))}</td>
                    <td style={td}>{r.total_refund ? formatCurrency(r.total_refund) : '—'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{pct}%</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>No collection data.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FinanceCollections;
