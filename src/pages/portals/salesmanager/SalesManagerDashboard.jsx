import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDate } from '../../../utils/formatters';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import {
  HomeModernIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  PhoneIcon,
  XCircleIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/24/outline';
import { StatusChip, leadName } from '../common/dashWidgets';
import '../collection/CollectionWorkspace.css';

const SalesManagerDashboard = ({ user, onNavigate }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [incomingPendingCount, setIncomingPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [missedFollowUps, setMissedFollowUps] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const [statsResp, handoffsResp] = await Promise.all([
        dashboardApi.getSalesManagerStats().catch(() => ({ data: {} })),
        leadWorkflowApi.getHandoffs({
          type: 'incoming',
          stageCode: 'SITE_VISIT',
          statusCode: 'SV_DONE',
          currentOnly: true,
          pendingAcceptance: true,
          limit: 100,
        }).catch(() => ({ data: [], meta: { total: 0 } })),
      ]);

      const dashData = statsResp?.data || {};
      setStats(dashData);

      const incomingTotal = Number(dashData?.incomingLeads ?? 0);
      const resolvedPending = Number(
        handoffsResp?.meta?.total ?? (Array.isArray(handoffsResp?.data) ? handoffsResp.data.length : 0)
      );
      setIncomingPendingCount(Number.isFinite(resolvedPending) ? resolvedPending : incomingTotal);

      // Try dedicated follow-up arrays from dashboard stats first
      if (Array.isArray(dashData.todaysFollowUpLeads)) setTodayFollowUps(dashData.todaysFollowUpLeads);
      if (Array.isArray(dashData.missedFollowUpLeads)) setMissedFollowUps(dashData.missedFollowUpLeads);

      // FALLBACK: If lists are empty or stats fetch failed, fetch lists explicitly
      if (!dashData.todaysFollowUpLeads && !dashData.missedFollowUpLeads) {
        console.warn('[SM Dashboard] Backend lists missing, triggering fallback fetch...');
        const extractLeads = (resp) => {
          if (Array.isArray(resp?.data)) return resp.data;
          if (Array.isArray(resp?.data?.data)) return resp.data.data;
          if (Array.isArray(resp?.data?.rows)) return resp.data.rows;
          return [];
        };
        const [todayFuResp, missedFuResp] = await Promise.all([
          leadWorkflowApi.getLeads({
            roleCode: 'SM',
            assignedToMe: true,
            nextFollowUpFrom: startOfDay.toISOString(),
            nextFollowUpTo: endOfDay.toISOString(),
            includeClosed: false,
            limit: 50,
          }).catch(() => ({ data: [] })),
          leadWorkflowApi.getLeads({
            roleCode: 'SM',
            assignedToMe: true,
            nextFollowUpTo: new Date(startOfDay.getTime() - 1).toISOString(),
            includeClosed: false,
            limit: 50,
          }).catch(() => ({ data: [] })),
        ]);
        setTodayFollowUps(extractLeads(todayFuResp));
        setMissedFollowUps(extractLeads(missedFuResp));
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="simple-loader">
        <div className="simple-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = user?.first_name || user?.firstName || '';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const kpiCards = [
    { label: 'Active Site Visits', value: stats?.svScheduled ?? stats?.todaysVisits ?? 0, sub: `${stats?.visitsDone ?? stats?.svCompleted ?? 0} completed`, icon: HomeModernIcon, variant: 'info' },
    { label: 'Under Negotiations', value: stats?.negotiations ?? 0, sub: 'in negotiation', icon: ChartBarIcon, variant: '' },
    { label: 'Awaiting Revisits', value: stats?.revisits ?? 0, sub: 'pending revisit', icon: ArrowPathIcon, variant: 'warning' },
    { label: 'Under Follow Up', value: stats?.todaysTasks ?? stats?.dueToday ?? 0, sub: `${todayFollowUps.length} today`, icon: ClipboardDocumentListIcon, variant: '' },
    { label: "Today's Follow Up", value: todayFollowUps.length, sub: 'scheduled today', icon: PhoneIcon, variant: 'success' },
    { label: 'Missed Follow Up', value: missedFollowUps.length, sub: 'overdue', icon: XCircleIcon, variant: 'danger' },
  ];

  const renderFollowUpTable = (rows, { dueLabel, overdue }) => (
    <div className="col-table-scroll-y"><table className="col-table-new">
      <thead>
        <tr>
          <th>Lead</th>
          <th>Project</th>
          <th>{dueLabel}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 10).map((lead) => {
          const due = lead.next_follow_up_date || lead.scheduled_at || lead.updated_at;
          return (
            <tr key={lead.id} className="col-clickable-row" onClick={() => navigate(`/portal/lead/${lead.id}`)}>
              <td>
                <div className="col-cell-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {leadName(lead)} <StatusChip name={lead.statusName} color={lead.statusColor} />
                </div>
                <div className="col-cell-secondary">{lead.phone || '—'}</div>
              </td>
              <td>{lead.projectName || lead.project || '—'}</td>
              <td style={overdue ? { color: 'var(--accent-red)', fontWeight: 600 } : undefined}>{due ? formatDate(due) : '—'}</td>
              <td>
                <button className="col-btn col-btn-ghost col-btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/portal/lead/${lead.id}`); }}>
                  View
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );

  return (
    <div className="col-dashboard">
      {/* Page Header */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>{greeting}{firstName ? `, ${firstName}` : ''}</h1>
          <p>Here's your sales overview for today — {today}</p>
        </div>
        <div className="col-page-header-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={load}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
          <button className="col-btn col-btn-primary" onClick={() => onNavigate?.('leads')}>
            My Leads →
          </button>
        </div>
      </div>

      {/* Handoff Banner */}
      {incomingPendingCount > 0 && (
        <div className="handoff-banner" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}>
          <div className="handoff-banner-icon" style={{ fontSize: 24 }}><InboxArrowDownIcon style={{ width: 28, height: 28 }} /></div>
          <div className="handoff-banner-text">
            <div className="handoff-banner-title" style={{ color: '#92400e', fontWeight: 700 }}>{incomingPendingCount} incoming lead{incomingPendingCount > 1 ? 's' : ''} awaiting your review</div>
            <div className="handoff-banner-desc" style={{ color: '#b45309' }}>Leads handed off from telecallers are ready for your action.</div>
          </div>
          <button className="col-btn col-btn-warning col-btn-sm" style={{ fontWeight: 700 }} onClick={() => onNavigate?.('incoming')}>Review Now →</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="col-stat-grid-new">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className={`col-stat-card-new ${card.variant}`} key={card.label}>
              <div className="col-stat-label-new">{card.label}</div>
              <div className="col-stat-value-new">{card.value}</div>
              <div className="col-stat-sub-new">{card.sub}</div>
              <div className="col-stat-icon-new">
                {Icon ? <Icon style={{ width: 24, height: 24 }} /> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="col-two-col-new">
        {/* Today's Follow Up */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhoneIcon style={{ width: 20, height: 20, color: 'var(--accent-green)' }} />
              <div>
                <div className="col-card-title-new">Today's Follow Up</div>
                <div className="col-card-subtitle-new">Scheduled for today</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('leads')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {todayFollowUps.length === 0 ? (
              <div className="col-empty-mini">
                <PhoneIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No follow-ups scheduled for today</span>
              </div>
            ) : renderFollowUpTable(todayFollowUps, { dueLabel: 'Due', overdue: false })}
          </div>
        </div>

        {/* Missed Follow Up */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircleIcon style={{ width: 20, height: 20, color: 'var(--accent-red)' }} />
              <div>
                <div className="col-card-title-new">Missed Follow Up</div>
                <div className="col-card-subtitle-new">Overdue — needs attention</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('leads')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {missedFollowUps.length === 0 ? (
              <div className="col-empty-mini">
                <XCircleIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No missed follow-ups. Great work!</span>
              </div>
            ) : renderFollowUpTable(missedFollowUps, { dueLabel: 'Overdue Since', overdue: true })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesManagerDashboard;
