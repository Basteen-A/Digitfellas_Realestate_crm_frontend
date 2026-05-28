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
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import '../collection/CollectionWorkspace.css';

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'custom', label: 'Custom Date' },
];

const PIPELINE_COLUMNS = [
  { key: 'RNR', title: 'RNR', statusCode: 'RNR', icon: <NoSymbolIcon />, variant: 'warning', sub: 'no response' },
  { key: 'FOLLOW_UP', title: 'Follow Up', statusCode: 'FOLLOW_UP', icon: <PhoneIcon />, variant: 'info', sub: 'to follow up' },
  { key: 'SV_SCHEDULED', title: 'Scheduled', statusCode: 'SV_SCHEDULED', icon: <CalendarDaysIcon />, variant: 'purple', sub: 'site visits' },
  { key: 'DISQUALIFIED', title: 'Unqualified', icon: <NoSymbolIcon />, variant: 'danger', sub: 'lost / junk' },
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

      // Apply date filter server-side — count leads worked (last_contacted_at) in the period
      const dateRange = getDateRange(dateFilter, customFromDate, customToDate);
      if (dateRange.from) leadParams.contactedFrom = dateRange.from;
      if (dateRange.to) leadParams.contactedTo = dateRange.to;

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
      { key: 'TOTAL', label: 'Total Leads', value: totalLeads, icon: <UsersIcon />, variant: '', sub: 'assigned to you' },
      { key: 'QUALIFIED', label: 'Qualified Leads', value: qualifiedLeads, icon: <CheckCircleIcon />, variant: 'success', sub: 'still active' },
    ];

    const statusCards = PIPELINE_COLUMNS.map((column) => ({
      key: column.key,
      label: column.title,
      value: getLeadsByColumn(column).length,
      icon: column.icon,
      variant: column.variant,
      sub: column.sub,
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
          <button
            type="button"
            className="crm-btn crm-btn-ghost"
            onClick={() => load()}
          >
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
        </div>
      </div>

      <div className="pipeline-date-filter">
        {DATE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`pipeline-date-chip ${dateFilter === option.value ? 'active' : ''}`}
            onClick={() => setDateFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
            <input
              type="date"
              className="crm-form-input"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              style={{ height: 36, borderRadius: 999, padding: '0 12px', border: '1.5px solid var(--border-primary)', width: 140 }}
            />
            <input
              type="date"
              className="crm-form-input"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              style={{ height: 36, borderRadius: 999, padding: '0 12px', border: '1.5px solid var(--border-primary)', width: 140 }}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'tc-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading your pipeline...</p>
        </div>
      ) : (
        <div className="col-stat-grid-new">
          {statCards.map((card) => (
            <div className={`col-stat-card-new ${card.variant || ''}`} key={card.key}>
              <div className="col-stat-label-new">{card.label}</div>
              <div className="col-stat-value-new">{card.value}</div>
              {card.sub && <div className="col-stat-sub-new">{card.sub}</div>}
              <div className="col-stat-icon-new">
                {card.icon ? React.cloneElement(card.icon, { style: { width: 24, height: 24 } }) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes tc-spin { to { transform: rotate(360deg); } }
        .pipeline-date-filter { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 20px; }
        .pipeline-date-chip {
          padding: 7px 14px;
          border-radius: 999px;
          border: 1.5px solid var(--border-primary);
          background: var(--bg-card, #fff);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pipeline-date-chip:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
        .pipeline-date-chip.active {
          background: var(--accent-blue, #5b4fcf);
          border-color: var(--accent-blue, #5b4fcf);
          color: #fff;
        }
      `}</style>
    </div>
  );
};

export default TelecallerPipeline;
