import React, { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';
import {
  UsersIcon,
  CheckCircleIcon,
  PhoneIcon,
  CalendarDaysIcon,
  NoSymbolIcon,
  ArrowPathRoundedSquareIcon,
} from '@heroicons/react/24/outline';

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'custom', label: 'Custom Date' },
];

const PIPELINE_COLUMNS = [
  {
    key: 'RNR',
    title: 'RNR',
    statusCode: 'RNR',
    icon: <NoSymbolIcon />,
    cardGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    shadow: 'rgba(217, 119, 6, 0.28)',
  },
  {
    key: 'FOLLOW_UP',
    title: 'Follow Up',
    statusCode: 'FOLLOW_UP',
    icon: <PhoneIcon />,
    cardGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    shadow: 'rgba(59, 130, 246, 0.28)',
  },
  {
    key: 'SV_SCHEDULED',
    title: 'Scheduled',
    statusCode: 'SV_SCHEDULED',
    icon: <CalendarDaysIcon />,
    cardGradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    shadow: 'rgba(109, 40, 217, 0.28)',
  },
  {
    key: 'DISQUALIFIED',
    title: 'Unqualified',
    icon: <NoSymbolIcon />,
    cardGradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    shadow: 'rgba(185, 28, 28, 0.28)',
  },
];

/** Compute date-only boundaries for a date filter value */
const getDateRange = (filterValue, customFrom, customTo) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filterValue) {
    case 'today': {
      const todayEnd = new Date(todayStart);
      todayEnd.setHours(23, 59, 59, 999);
      return { from: todayStart.toISOString(), to: todayEnd.toISOString() };
    }
    case 'tomorrow': {
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setHours(23, 59, 59, 999);
      return { from: tomorrowStart.toISOString(), to: tomorrowEnd.toISOString() };
    }
    case 'yesterday': {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(yesterdayStart);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return { from: yesterdayStart.toISOString(), to: yesterdayEnd.toISOString() };
    }
    case 'this_week': {
      const weekStart = new Date(todayStart);
      const day = weekStart.getDay();
      const diffFromMonday = day === 0 ? 6 : day - 1;
      weekStart.setDate(weekStart.getDate() - diffFromMonday);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return { from: weekStart.toISOString(), to: weekEnd.toISOString() };
    }
    case 'custom': {
      const result = {};
      if (customFrom) {
        const fromDate = new Date(customFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (!Number.isNaN(fromDate.getTime())) result.from = fromDate.toISOString();
      }
      if (customTo) {
        const toDate = new Date(customTo);
        toDate.setHours(23, 59, 59, 999);
        if (!Number.isNaN(toDate.getTime())) result.to = toDate.toISOString();
      }
      return result;
    }
    default:
      return {};
  }
};

const isDisqualifiedLead = (lead) => {
  const statusCode = (lead?.statusCode || '').toUpperCase();
  const stageCode = (lead?.stageCode || '').toUpperCase();
  const statusCategory = (lead?.statusCategory || '').toUpperCase();
  return (
    statusCategory === 'DISQUALIFIED'
    || ['JUNK', 'SPAM', 'LOST', 'DISQUALIFIED'].includes(statusCode)
    || ['DISQUALIFIED', 'CLOSED_LOST'].includes(stageCode)
  );
};

const extractLeadRows = (response) => {
  const payload = response?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(response?.rows)) return response.rows;
  return [];
};

const TelecallerPipeline = ({ onNavigate }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [dateFilter, setDateFilter] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const leadParams = { roleCode: 'TC', assignedToMe: true, includeClosed: true, limit: 100, page };

      // Apply date filter server-side
      const dateRange = getDateRange(dateFilter, customFromDate, customToDate);
      if (dateRange.from) leadParams.nextFollowUpFrom = dateRange.from;
      if (dateRange.to) leadParams.nextFollowUpTo = dateRange.to;

      const resp = await leadWorkflowApi.getLeads(leadParams);
      const leadRows = extractLeadRows(resp);

      // Deduplicate by id
      const uniqueRows = Array.from(new Map(leadRows.map((lead) => [lead.id, lead])).values());
      setLeads(uniqueRows);
      setMeta(resp.meta || { total: uniqueRows.length, page, totalPages: 1 });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load pipeline'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customFromDate, customToDate]);

  useEffect(() => { load(); }, [load]);

  // Calculate totals
  const totalLeads = meta.total || leads.length;
  const qualifiedLeads = leads.filter((lead) => !isDisqualifiedLead(lead)).length;

  const getLeadsByColumn = useCallback((column) => {
    if (column.key === 'DISQUALIFIED') {
      return leads.filter(isDisqualifiedLead);
    }
    return leads.filter((lead) => {
      const leadStatus = (lead.statusCode || '').toUpperCase();
      return leadStatus === column.statusCode;
    });
  }, [leads]);

  const statCards = useMemo(() => {
    const baseCards = [
      {
        key: 'TOTAL',
        label: 'Total Leads',
        value: totalLeads,
        icon: <UsersIcon />,
        cardGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        shadow: 'rgba(59, 130, 246, 0.30)',
      },
      {
        key: 'QUALIFIED',
        label: 'Qualified Leads',
        value: qualifiedLeads,
        icon: <CheckCircleIcon />,
        cardGradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
        shadow: 'rgba(16, 185, 129, 0.30)',
      },
    ];

    const statusCards = PIPELINE_COLUMNS.map((column) => ({
      key: column.key,
      label: column.title,
      value: getLeadsByColumn(column).length,
      icon: column.icon,
      cardGradient: column.cardGradient,
      shadow: column.shadow,
    }));

    return [...baseCards, ...statusCards];
  }, [getLeadsByColumn, qualifiedLeads, totalLeads]);

  return (
    <div className="telecaller-pipeline">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Performance Tracker</h1>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="crm-form-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ minWidth: 150, height: 38, borderRadius: 10, border: '1.5px solid var(--border-primary)' }}
          >
            {DATE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {dateFilter === 'custom' && (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="date"
                className="crm-form-input"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                style={{ height: 38, borderRadius: 10, width: 130 }}
              />
              <input
                type="date"
                className="crm-form-input"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                style={{ height: 38, borderRadius: 10, width: 130 }}
              />
            </div>
          )}
          <button
            className="crm-btn crm-btn-ghost"
            style={{ height: 38, borderRadius: 10, border: '1.5px solid var(--border-primary)', background: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => load()}
          >
            <ArrowPathRoundedSquareIcon style={{ width: 18, height: 18 }} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'tc-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading your pipeline...</p>
        </div>
      ) : (
        <>
          <div className="pipeline-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {statCards.map((card) => (
              <div
                key={card.key}
                className="pipeline-stat-card"
                style={{
                  background: card.cardGradient,
                  borderRadius: 16,
                  padding: '20px 24px',
                  color: '#fff',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: `0 10px 15px -3px ${card.shadow}`,
                }}
              >
                {React.cloneElement(card.icon, {
                  style: {
                    position: 'absolute',
                    right: -10,
                    top: -10,
                    width: 80,
                    height: 80,
                    opacity: 0.15,
                  },
                })}
                <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.9, marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* ── Pagination ── */}
          {meta.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '14px 0', marginBottom: 16 }}>
              <button
                type="button"
                className="crm-btn crm-btn-ghost"
                onClick={() => load(meta.page - 1)}
                disabled={meta.page <= 1}
                style={{ minWidth: 36, padding: '6px 10px', fontSize: 13, height: 34, borderRadius: 8 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Page {meta.page} of {meta.totalPages} · {meta.total} total
              </span>
              <button
                type="button"
                className="crm-btn crm-btn-ghost"
                onClick={() => load(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                style={{ minWidth: 36, padding: '6px 10px', fontSize: 13, height: 34, borderRadius: 8 }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes tc-spin { to { transform: rotate(360deg); } }
        .pipeline-stat-card:hover { transform: translateY(-2px); }
      `}</style>
    </div>
  );
};

export default TelecallerPipeline;
