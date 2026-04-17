import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'custom', label: 'Custom Date' },
];

const PIPELINE_COLUMNS = [
  { key: 'RNR', title: 'RNR LEADS', statusCode: 'RNR' },
  { key: 'FOLLOW_UP', title: 'FOLLOW UP LEADS', statusCode: 'FOLLOW_UP' },
  { key: 'SV_SCHEDULED', title: 'SV SCHEDULED', statusCode: 'SV_SCHEDULED' },
  { key: 'SV_DONE', title: 'SV DONE', statusCode: 'SV_DONE' },
  { key: 'DISQUALIFIED', title: 'DISQUALIFIED' },
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
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [statusMetaByCode, setStatusMetaByCode] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const leadParams = { roleCode: 'TC', includeClosed: true, limit: 100, page: 1 };
      const [firstLeadsResp, configResp] = await Promise.all([
        leadWorkflowApi.getLeads(leadParams),
        leadWorkflowApi.getWorkflowConfig(),
      ]);

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

      // Handle status config data for colors/labels
      const allStatuses = configResp?.data?.statuses || [];
      const statusMap = allStatuses.reduce((acc, status) => {
        acc[status.status_code] = status;
        return acc;
      }, {});
      setStatusMetaByCode(statusMap);

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

  const getLeadsByColumn = useCallback((column) => {
    if (column.key === 'DISQUALIFIED') {
      return filteredLeads.filter(isDisqualifiedLead);
    }
    return filteredLeads.filter((lead) => {
      const leadStatus = (lead.statusCode || '').toUpperCase();
      if (column.key === 'SV_DONE') {
        // Include explicit SV_DONE status or any lead in SITE_VISIT stage that isn't just scheduled
        return leadStatus === 'SV_DONE' || (lead.stageCode === 'SITE_VISIT' && leadStatus !== 'SV_SCHEDULED');
      }
      return leadStatus === column.statusCode;
    });
  }, [filteredLeads]);

  const getColumnColor = useCallback((column) => {
    if (column.key === 'DISQUALIFIED') {
      return statusMetaByCode.JUNK?.color_code || statusMetaByCode.SPAM?.color_code || statusMetaByCode.LOST?.color_code || '#dc2626';
    }
    return statusMetaByCode[column.statusCode]?.color_code || '#94a3b8';
  }, [statusMetaByCode]);

  const getLeadFooterText = (lead) => {
    const followUpDate = toValidDate(lead.nextFollowUpAt);
    if (followUpDate) {
      return `Follow-up: ${followUpDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }
    const updatedDate = toValidDate(lead.updatedAt || lead.createdAt);
    if (!updatedDate) return 'No date available';
    return `Updated: ${updatedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };

  const activeFilterLabel = DATE_FILTER_OPTIONS.find((item) => item.value === dateFilter)?.label || 'All Dates';

  return (
    <div className="telecaller-pipeline">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Pipeline Board</h1>
          <p className="hidden sm:block">Showing {filteredLeads.length} of {leads.length} leads ({activeFilterLabel})</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="crm-form-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ minWidth: 150, height: 36 }}
          >
            {DATE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {dateFilter === 'custom' && (
            <>
              <input
                type="date"
                className="crm-form-input"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                style={{ height: 36 }}
              />
              <input
                type="date"
                className="crm-form-input"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                style={{ height: 36 }}
              />
            </>
          )}
          <button className="crm-btn crm-btn-ghost" onClick={load}> Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'tc-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading your pipeline...</p>
        </div>
      ) : (
        <div className="kanban" style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 12, minHeight: 'calc(100vh - 220px)' }}>
          {PIPELINE_COLUMNS.map((column) => {
            const stageLeads = getLeadsByColumn(column);
            const columnColor = getColumnColor(column);
            return (
              <div className="kanban-col" key={column.key} style={{ minWidth: 280, maxWidth: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary, #f8fafc)', borderRadius: 12, border: '1px solid var(--border-primary, #e2e8f0)' }}>
                <div className="kanban-col-header" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card, #fff)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="kanban-col-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span className="col-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: columnColor }}></span>
                    {column.title}
                  </div>
                  <div className="kanban-col-count" style={{ fontSize: 11, fontWeight: 700, background: 'var(--bg-primary, #f1f5f9)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 10 }}>
                    {stageLeads.length}
                  </div>
                </div>

                <div className="kanban-col-body" style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="kanban-card" style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 10, padding: 12, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `3px solid ${columnColor}` }}>
                      <div className="kanban-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="kanban-card-name" style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.fullName}</div>
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: (lead.statusColor || '#64748b') + '15', color: lead.statusColor || '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {lead.statusLabel}
                        </span>
                      </div>

                      <div className="kanban-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                        <span className="kanban-card-project" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>📍 {lead.project || 'No Project'}</span>
                        <span className="kanban-card-time" style={{ fontWeight: 600, color: lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date() ? 'var(--accent-red)' : 'inherit' }}>
                          {getLeadFooterText(lead)}
                        </span>
                      </div>

                      {column.key !== 'SV_DONE' && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                          <button
                            className="crm-btn crm-btn-primary crm-btn-sm"
                            style={{ flex: 1, fontSize: 11, padding: '4px 0' }}
                            onClick={() => navigate(`/portal/lead/${lead.id}`)}
                          >
                            View Details
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                      No leads in this column
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes tc-spin { to { transform: rotate(360deg); } }
        .kanban::-webkit-scrollbar { height: 8px; }
        .kanban::-webkit-scrollbar-track { background: transparent; }
        .kanban::-webkit-scrollbar-thumb { background: var(--border-primary, #e2e8f0); borderRadius: 10px; }
      `}</style>
    </div>
  );
};

export default TelecallerPipeline;
