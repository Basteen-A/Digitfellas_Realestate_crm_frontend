import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import reportApi from '../../../api/reportApi';
import {
  ReportBrowser, SELF_REPORT_GROUPS, selfFirstKey,
} from '../../superadmin/Reports/analytics/AnalyticsDashboard';

import '../../superadmin/Reports/Reports.css';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'wtd', label: 'Week' },
  { key: 'mtd', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

// Self-service reports for a TC / SM / SH user. The backend locks the payload to
// the logged-in user's own data (selfOnly), so there is no role picker, no user
// drill-down and no export — just this user's performance for the chosen period.
const PortalReports = ({ role }) => {
  const [period, setPeriod] = useState('mtd');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(() => selfFirstKey(role));

  useEffect(() => { setSelected(selfFirstKey(role)); }, [role]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reportApi.getRoleAnalytics({ role, period })
      .then((res) => { if (active) setData(res?.data || null); })
      .catch((err) => { if (active) { setData(null); toast.error(err?.response?.data?.message || 'Failed to load reports'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, period]);

  const chipBase = 'reports-chip';

  return (
    <div className="reports-page">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><ChartBarIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />My Reports</h1>
          <p className="hidden sm:block">Your own performance — site visits, calls &amp; conversions</p>
        </div>
      </div>

      <div className="reports-filter-bar reports-filter-bar--card">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide mr-1" style={{ color: 'var(--text-muted)' }}>Period</span>
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
              className={`${chipBase} ${period === p.key ? 'reports-chip--active' : ''}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ReportBrowser
        role={role}
        d={data}
        loading={loading}
        hasData={!!data}
        selected={selected}
        setSelected={setSelected}
        groups={SELF_REPORT_GROUPS[role]}
        selfView
        loadingLabel="Loading your reports…"
        emptyLabel="No report data for this period yet."
      />
    </div>
  );
};

export default PortalReports;
