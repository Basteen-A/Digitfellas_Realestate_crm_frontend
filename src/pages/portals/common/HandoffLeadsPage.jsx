import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { EyeIcon } from '@heroicons/react/24/outline';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDateTime } from '../../../utils/formatters';
import { ROLE_LABELS } from '../../../components/layout/Sidebar/menuConfig';
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

const isLostHandoffRow = (row) => {
  const statusCode = String(row?.statusCode || row?.status_code || '').trim().toUpperCase();
  const statusName = String(row?.statusName || row?.status_name || '').trim().toUpperCase();
  return statusCode === 'LOST' || statusCode === 'COLD_LOST' || statusName === 'LOST' || statusName === 'COLD LOST';
};

const HandoffLeadsPage = ({ workspaceRole, defaultType = 'all', showStage = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, incomingOnPage: 0, outgoingOnPage: 0, pendingOnPage: 0 });
  const [filters, setFilters] = useState({ type: defaultType, search: '' });

  const stats = useMemo(() => {
    const current = rows.filter((row) => row.isCurrent).length;
    const outgoing = meta.outgoingOnPage || 0;
    const pending = meta.pendingOnPage || 0;
    const svDone = workspaceRole === 'TC' ? outgoing - pending : outgoing;
    return {
      total: meta.total || 0,
      incoming: meta.incomingOnPage || 0,
      outgoing: svDone,
      pending: pending,
      current,
    };
  }, [meta, rows, workspaceRole]);

  const visibleRows = useMemo(() => rows.filter((row) => !isLostHandoffRow(row)), [rows]);

  const isTC = workspaceRole === 'TC';

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
      });

      setRows(response.data || []);
      setMeta(response.meta || { total: 0, incomingOnPage: 0, outgoingOnPage: 0, pendingOnPage: 0 });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load handoff leads'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, workspaceRole]);

  useEffect(() => {
    loadHandoffs();
  }, [loadHandoffs]);

  return (
    <div className="handoff-leads">
      <div className="page-header">
        <div className="page-header-left">
          <h1>{workspaceRole === 'TC' ? 'SV Leads' : (workspaceRole === 'SM' ? 'Negotiations' : 'My Bookings')}</h1>
          <p>{workspaceRole === 'TC' ? 'Leads you have handed off to Sales Managers.' : (workspaceRole === 'SM' ? 'Leads currently in negotiation phase.' : '')}</p>
        </div>
        <div className="page-header-right">
          <button
            type="button"
            className="crm-btn crm-btn-ghost"
            onClick={() => loadHandoffs({ silent: true })}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {workspaceRole !== 'SH' && (
        <div className="handoff-leads__stats">
          <article className="crm-card handoff-stat-card"><p>Total</p><strong>{stats.total}</strong></article>
          {workspaceRole !== 'TC' && defaultType !== 'outgoing' && <article className="crm-card handoff-stat-card"><p>Incoming (page)</p><strong>{stats.incoming}</strong></article>}
          {workspaceRole === 'TC' && <article className="crm-card handoff-stat-card handoff-stat-card--pending"><p>Pending</p><strong>{stats.pending}</strong></article>}
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
              {isTC ? (
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
              <th>To</th>
              {showStage && <th>Stage</th>}
              <th>Status</th>
              {!isTC && <th className="hide-tablet">Remarks</th>}
              <th className="hide-tablet">Assigned</th>
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
            {!loading && visibleRows.map((row) => (
              <tr key={row.id} className={row.pendingAcceptance ? 'handoff-row-pending' : ''}>
                {isTC ? (
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
                <td>
                  <div>{row.toUserName || '-'}</div>
                  <small>{ROLE_LABELS[row.toUserRole] || row.toUserRoleName || '-'}</small>
                </td>
                {showStage && (
                  <td>
                    <span className="handoff-chip" style={{ backgroundColor: `${row.stageColor || '#6B7280'}22`, color: 'var(--text-primary)', borderColor: `${row.stageColor || '#6B7280'}66` }}>
                      {row.stageName || row.stageLabel || row.stageCode || row.stage_code || '-'}
                    </span>
                  </td>
                )}
                <td>
                  <span className="handoff-chip" style={{ backgroundColor: `${row.statusColor}22`, color: row.statusColor, borderColor: `${row.statusColor}66` }}>
                    {row.statusName || '-'}
                  </span>
                </td>
                {!isTC && (
                  <td className="hide-tablet">
                    <small>{dedupePipeText(row.remarks) || '-'}</small>
                  </td>
                )}
                <td className="hide-tablet">
                  <div>{row.currentAssigneeName || '-'}</div>
                  <small>{ROLE_LABELS[row.currentAssigneeRole] || row.currentAssigneeRole || '-'}</small>
                </td>
                <td>
                  <button
                    className="crm-btn crm-btn-sm crm-btn-ghost"
                    onClick={() => navigate(`/portal/lead/${row.leadId}`)}
                    title="View Lead"
                  >
                    <EyeIcon style={{ width: 14, height: 14 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HandoffLeadsPage;
