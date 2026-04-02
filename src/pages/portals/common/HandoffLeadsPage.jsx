import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDateTime } from '../../../utils/formatters';
import { ROLE_LABELS } from '../../../components/layout/Sidebar/menuConfig';
import './HandoffLeadsPage.css';

const HandoffLeadsPage = ({ workspaceRole }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, incomingOnPage: 0, outgoingOnPage: 0 });
  const [filters, setFilters] = useState({ type: 'all', search: '' });

  const stats = useMemo(() => {
    const current = rows.filter((row) => row.isCurrent).length;
    return {
      total: meta.total || 0,
      incoming: meta.incomingOnPage || 0,
      outgoing: meta.outgoingOnPage || 0,
      current,
    };
  }, [meta, rows]);

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
      setMeta(response.meta || { total: 0, incomingOnPage: 0, outgoingOnPage: 0 });
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
          <h1>Handoff Leads</h1>
          <p>Track who handed off leads, to whom, and current stage/status.</p>
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

      <div className="handoff-leads__stats">
        <article className="crm-card handoff-stat-card"><p>Total</p><strong>{stats.total}</strong></article>
        <article className="crm-card handoff-stat-card"><p>Incoming (page)</p><strong>{stats.incoming}</strong></article>
        <article className="crm-card handoff-stat-card"><p>Outgoing (page)</p><strong>{stats.outgoing}</strong></article>
        <article className="crm-card handoff-stat-card"><p>Current Ownership</p><strong>{stats.current}</strong></article>
      </div>

      <div className="crm-card handoff-leads__filters">
        <input
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          placeholder="Search by lead number, name, phone, email"
        />
        <select
          value={filters.type}
          onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
        >
          <option value="all">All Handoffs</option>
          <option value="incoming">Incoming to Me</option>
          <option value="outgoing">Outgoing from Me</option>
        </select>
      </div>

      <div className="crm-card handoff-leads__table-wrap">
        <table className="handoff-leads__table">
          <thead>
            <tr>
              <th>When</th>
              <th>Lead</th>
              <th>From</th>
              <th>To</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Reason / Remarks</th>
              <th>Direction</th>
              <th>Current Owner</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="handoff-leads__empty">Loading handoff leads...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="handoff-leads__empty">No handoff leads found</td>
              </tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDateTime(row.handedOffAt)}</td>
                <td>
                  <div className="handoff-lead-name">{row.leadName || '-'}</div>
                  <small>{row.leadNumber || '-'} • {row.leadPhone || '-'}</small>
                </td>
                <td>
                  <div>{row.fromUserName || '-'}</div>
                  <small>{ROLE_LABELS[row.fromUserRole] || row.fromUserRoleName || '-'}</small>
                </td>
                <td>
                  <div>{row.toUserName || '-'}</div>
                  <small>{ROLE_LABELS[row.toUserRole] || row.toUserRoleName || '-'}</small>
                </td>
                <td>
                  <span className="handoff-chip" style={{ backgroundColor: `${row.stageColor}22`, color: row.stageColor, borderColor: `${row.stageColor}66` }}>
                    {row.stageName || '-'}
                  </span>
                </td>
                <td>
                  <span className="handoff-chip" style={{ backgroundColor: `${row.statusColor}22`, color: row.statusColor, borderColor: `${row.statusColor}66` }}>
                    {row.statusName || '-'}
                  </span>
                </td>
                <td>
                  <div>{row.assignmentReason || '-'}</div>
                  <small>{row.remarks || '-'}</small>
                </td>
                <td>
                  <span className={`handoff-direction handoff-direction--${row.direction || 'internal'}`}>
                    {row.direction || 'internal'}
                  </span>
                </td>
                <td>
                  <div>{row.currentAssigneeName || '-'}</div>
                  <small>{ROLE_LABELS[row.currentAssigneeRole] || row.currentAssigneeRole || '-'}</small>
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
