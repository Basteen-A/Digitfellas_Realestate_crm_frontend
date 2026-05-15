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

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

const toValidDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
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

const getLeadDateForFilter = (lead) => toValidDate(lead?.nextFollowUpAt || lead?.updatedAt || lead?.createdAt);

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
  const [dateFilter, setDateFilter] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const leadParams = { roleCode: 'TC', assignedToMe: true, includeClosed: true, limit: 100, page: 1 };
      const firstLeadsResp = await leadWorkflowApi.getLeads(leadParams);

      // Handle leads data
      let leadRows = extractLeadRows(firstLeadsResp);
      const totalPages = Math.max(1, Number(firstLeadsResp?.meta?.totalPages) || 1);

      if (totalPages > 1) {
        const pagedResponses = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            leadWorkflowApi.getLeads({ ...leadParams, page: index + 2 })
          )
        );
        pagedResponses.forEach((resp) => {
          leadRows = leadRows.concat(extractLeadRows(resp));
        });
      }

      const uniqueRows = Array.from(new Map(leadRows.map((lead) => [lead.id, lead])).values());
      setLeads(uniqueRows);

    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load pipeline'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const matchesDateFilter = useCallback((lead) => {
    if (dateFilter === 'all') return true;

    const leadDate = getLeadDateForFilter(lead);
    if (!leadDate) return false;

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(todayStart);

    if (dateFilter === 'today') {
      return leadDate >= todayStart && leadDate <= todayEnd;
    }

    if (dateFilter === 'tomorrow') {
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const tomorrowEnd = endOfDay(tomorrowStart);
      return leadDate >= tomorrowStart && leadDate <= tomorrowEnd;
    }

    if (dateFilter === 'yesterday') {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = endOfDay(yesterdayStart);
      return leadDate >= yesterdayStart && leadDate <= yesterdayEnd;
    }

    if (dateFilter === 'this_week') {
      const weekStart = new Date(todayStart);
      const day = weekStart.getDay();
      const diffFromMonday = day === 0 ? 6 : day - 1;
      weekStart.setDate(weekStart.getDate() - diffFromMonday);
      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      return leadDate >= weekStart && leadDate < nextWeekStart;
    }

    if (dateFilter === 'custom') {
      const fromDate = customFromDate ? startOfDay(new Date(customFromDate)) : null;
      const toDate = customToDate ? endOfDay(new Date(customToDate)) : null;
      if (fromDate && Number.isNaN(fromDate.getTime())) return false;
      if (toDate && Number.isNaN(toDate.getTime())) return false;
      if (fromDate && leadDate < fromDate) return false;
      if (toDate && leadDate > toDate) return false;
      return true;
    }

    return true;
  }, [dateFilter, customFromDate, customToDate]);

  const filteredLeads = useMemo(() => leads.filter(matchesDateFilter), [leads, matchesDateFilter]);

  // Calculate totals
  const totalLeads = filteredLeads.length;
  const qualifiedLeads = filteredLeads.filter((lead) => !isDisqualifiedLead(lead)).length;

  const getLeadsByColumn = useCallback((column) => {
    if (column.key === 'DISQUALIFIED') {
      return filteredLeads.filter(isDisqualifiedLead);
    }
    return filteredLeads.filter((lead) => {
      const leadStatus = (lead.statusCode || '').toUpperCase();
      return leadStatus === column.statusCode;
    });
  }, [filteredLeads]);

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
            onClick={load}
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
