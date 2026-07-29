import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDateTime } from '../../../utils/formatters';
import { ROLE_LABELS } from '../../../components/layout/Sidebar/menuConfig';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import { badgeStyle } from '../../../utils/badgeColors';
import './HandoffLeadsPage.css';

const dedupePipeText = (value) => {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';

  const parts = raw.split('|').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return raw;

  const seen = new Set();
  const unique = parts.filter((part) => {
    const normalized = part.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return unique.join(' | ');
};

// Badge-system triple (bg/text/border) derived from the DB status color.
const statusChipStyle = (statusColor) => badgeStyle(statusColor);

const HandoffLeadsPage = ({ workspaceRole, defaultType = 'all', showStage = false, stageCode = null, currentOnly = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ type: defaultType, search: '' });

  // One row per lead (rows arrive newest-first, so the first occurrence is the
  // latest handoff). The metric is "leads this user shared to the next role", so a
  // lead is kept even if it was later marked LOST or re-handed-off — the share
  // still happened and must keep counting. Every stat below is derived from THIS
  // list, so the count cards always equal the rows actually shown.
  const visibleRows = useMemo(() => {
    const seen = new Set();
    const deduped = [];
    for (const row of rows) {
      const key = row.leadId || row.lead_id || row.id;
      if (key == null || seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }
    return deduped;
  }, [rows]);

  const stats = useMemo(() => {
    const pending = visibleRows.filter((row) => row.pendingAcceptance).length;
    const total = visibleRows.length;
    return {
      total,
      incoming: visibleRows.filter((row) => row.direction === 'incoming').length,
      // TC "SV Done (Accepted)" = leads shared minus those still awaiting SM acceptance.
      outgoing: workspaceRole === 'TC' ? Math.max(0, total - pending) : visibleRows.filter((row) => row.direction === 'outgoing').length,
      pending,
      current: visibleRows.filter((row) => row.isCurrent).length,
    };
  }, [visibleRows, workspaceRole]);

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(visibleRows, 25);

  const isTC = workspaceRole === 'TC';
  const isSH = workspaceRole === 'SH';

  const loadHandoffs = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await leadWorkflowApi.getHandoffs({
        roleCode: workspaceRole,
        type: filters.type,
        search: filters.search,
        page: 1,
        limit: 100,
        stageCode,
        currentOnly,
      });

      setRows(response.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load handoff leads'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, workspaceRole, stageCode, currentOnly]);

  useEffect(() => {
    loadHandoffs();
  }, [loadHandoffs]);

  return (
    <div className="handoff-leads">
      <div className="page-header">
        <div className="page-header-left">
          <h1>{workspaceRole === 'TC' ? 'SV Leads' : (workspaceRole === 'SM' ? 'Negotiations' : 'Bookings')}</h1>
          <p>{workspaceRole === 'TC' ? 'Leads you moved to SV Done and handed to Sales. They stay listed here even after the status moves on.' : (workspaceRole === 'SM' ? 'Leads currently in negotiation phase.' : '')}</p>
        </div>
        <div className="page-header-right">
          <button
            type="button"
            className="crm-btn crm-btn-ghost"
            onClick={() => loadHandoffs({ silent: true })}
            disabled={refreshing}
          >
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {workspaceRole !== 'SH' && (
        <div className="handoff-leads__stats">
          <article className="crm-card handoff-stat-card"><p>Total</p><strong>{stats.total}</strong></article>
          {workspaceRole !== 'TC' && defaultType !== 'outgoing' && <article className="crm-card handoff-stat-card"><p>Incoming (page)</p><strong>{stats.incoming}</strong></article>}
          {workspaceRole === 'TC' && <article className="crm-card handoff-stat-card handoff-stat-card--pending"><p>Pending Acceptance</p><strong>{stats.pending}</strong></article>}
          <article className="crm-card handoff-stat-card"><p>{workspaceRole === 'TC' ? 'SV Done (Accepted)' : 'Outgoing (page)'}</p><strong>{stats.outgoing}</strong></article>
          {workspaceRole !== 'TC' && <article className="crm-card handoff-stat-card"><p>Current Ownership</p><strong>{stats.current}</strong></article>}
        </div>
      )}

      <div className="crm-card handoff-leads__filters">
        <input
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          placeholder="Search by lead number, name, phone, email"
        />
      </div>

      <div className="crm-card handoff-leads__table-wrap">
        <table className="handoff-leads__table">
          <thead>
            <tr>
              {(isTC || isSH) ? (
                <>
                  <th>Lead</th>
                  <th>When</th>
                </>
              ) : (
                <>
                  <th>When</th>
                  <th>Lead</th>
                  <th className="hide-tablet">From</th>
                </>
              )}
              {!isSH && <th>To</th>}
              {showStage && <th>Stage</th>}
              {isTC ? (
                <>
                <th>Acceptance</th>
                  <th className="hide-tablet">Assigned</th>
                  
                  <th>Status</th>
                </>
              ) : (
                <>
                  <th>Status</th>
                  <th className="hide-tablet">Remarks</th>
                  <th className="hide-tablet">Assigned</th>
                </>
              )}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={showStage ? 10 : 9} className="handoff-leads__empty">Loading handoff leads...</td>
              </tr>
            )}
            {!loading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={showStage ? 10 : 9} className="handoff-leads__empty">No handoff leads found</td>
              </tr>
            )}
            {!loading && pageItems.map((row) => (
              <tr key={row.id} className={row.pendingAcceptance ? 'handoff-row-pending' : ''}>
                {(isTC || isSH) ? (
                  <>
                    <td>
                      <div className="handoff-lead-name">{row.leadName || '-'}</div>
                      <small>{row.leadNumber || '-'}</small>
                    </td>
                    <td>{formatDateTime(row.handedOffAt)}</td>
                  </>
                ) : (
                  <>
                    <td>{formatDateTime(row.handedOffAt)}</td>
                    <td>
                      <div className="handoff-lead-name">{row.leadName || '-'}</div>
                      <small>{row.leadNumber || '-'}</small>
                    </td>
                    <td className="hide-tablet">
                      <div>{row.fromUserName || '-'}</div>
                      <small>{ROLE_LABELS[row.fromUserRole] || row.fromUserRoleName || '-'}</small>
                    </td>
                  </>
                )}
                {!isSH && (
                  <td>
                    <div>{row.toUserName || '-'}</div>
                    <small>{ROLE_LABELS[row.toUserRole] || row.toUserRoleName || '-'}</small>
                  </td>
                )}
                {showStage && (
                  <td>
                    <span className="handoff-chip" style={badgeStyle(row.stageColor)}>
                      {row.stageName || row.stageLabel || row.stageCode || row.stage_code || '-'}
                    </span>
                  </td>
                )}
                {isTC ? (
                  <>
                   <td>
                      <span className={`handoff-chip ${row.pendingAcceptance ? 'handoff-accept--pending' : 'handoff-accept--accepted'}`}>
                        {row.pendingAcceptance ? 'Pending' : 'Accepted'}
                      </span>
                    </td>
                    <td className="hide-tablet">
                      <div>{row.currentAssigneeName || '-'}</div>
                      <small>{ROLE_LABELS[row.currentAssigneeRole] || row.currentAssigneeRole || '-'}</small>
                    </td>
                   
                    <td>
                      <span className="handoff-chip" style={statusChipStyle(row.statusColor)}>
                        {row.statusName || '-'}
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td>
                      <span className="handoff-chip" style={statusChipStyle(row.statusColor)}>
                        {row.statusName || '-'}
                      </span>
                    </td>
                    <td className="hide-tablet">
                      <small>{dedupePipeText(row.remarks) || '-'}</small>
                    </td>
                    <td className="hide-tablet">
                      <div>{row.currentAssigneeName || '-'}</div>
                      <small>{ROLE_LABELS[row.currentAssigneeRole] || row.currentAssigneeRole || '-'}</small>
                    </td>
                  </>
                )}
                <td>
                  <button
                    type="button"
                    className="view-link"
                    onClick={() => navigate(`/portal/lead/${row.leadId}`)}
                    title="View Lead"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
};

export default HandoffLeadsPage;
