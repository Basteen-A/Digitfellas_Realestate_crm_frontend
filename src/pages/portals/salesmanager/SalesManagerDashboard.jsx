import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { getErrorMessage } from '../../../utils/helpers';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import {
  UsersIcon,
  MapPinIcon,
  HomeModernIcon,
  ArrowPathIcon,
  XCircleIcon,
  InboxArrowDownIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const ICON_SIZE = { width: 22, height: 22 };
const ICON_SM = { width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 };

const SalesManagerDashboard = ({ onNavigate }) => {
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



      // FALLBACK: If lists are empty or stats fetch failed, fetch lists explicitl
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--text-secondary)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'tc-spin 0.8s linear infinite', marginBottom: 12 }} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Active Site Visits', value: stats?.svScheduled ?? stats?.todaysVisits ?? 0, icon: <HomeModernIcon style={ICON_SIZE} />, iconBg: 'var(--accent-cyan-bg)', iconColor: 'var(--accent-cyan)', valueColor: 'var(--accent-cyan)', change: `${stats?.visitsDone ?? stats?.svCompleted ?? 0} completed`, changeType: 'neutral' },
    { label: 'Under Negotiations', value: stats?.negotiations ?? 0, icon: <ChartBarIcon style={ICON_SIZE} />, iconBg: 'var(--accent-purple-bg)', iconColor: 'var(--accent-purple)', valueColor: 'var(--accent-purple)', change: 'In negotiation stage', changeType: 'neutral' },
    { label: 'Awaiting Revisits', value: stats?.revisits ?? 0, icon: <ArrowPathIcon style={ICON_SIZE} />, iconBg: 'var(--accent-yellow-bg)', iconColor: 'var(--accent-yellow)', valueColor: 'var(--accent-yellow)', change: 'Pending revisit', changeType: 'neutral' },
    { label: 'Under Follow Up', value: stats?.todaysTasks ?? stats?.dueToday ?? 0, icon: <MapPinIcon style={ICON_SIZE} />, iconBg: 'var(--accent-blue-bg)', iconColor: 'var(--accent-blue)', valueColor: 'var(--accent-blue)', change: `${todayFollowUps.length} today`, changeType: 'neutral' },
    { label: "Today's Follow Up", value: todayFollowUps.length, icon: <UsersIcon style={ICON_SIZE} />, iconBg: 'var(--accent-green-bg)', iconColor: '#15803d', valueColor: '#15803d', change: 'Scheduled today', changeType: 'neutral' },
    { label: 'Missed Follow Up', value: missedFollowUps.length, icon: <XCircleIcon style={ICON_SIZE} />, iconBg: 'var(--accent-red-bg)', iconColor: 'var(--accent-red)', valueColor: 'var(--accent-red)', change: 'Overdue', changeType: 'down' },
  ];

  return (
    <div>
      {/* Handoff Banner */}
      {incomingPendingCount > 0 && (
        <div className="handoff-banner" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}>
          <div className="handoff-banner-icon" style={{ fontSize: 24 }}><InboxArrowDownIcon style={{ width: 28, height: 28 }} /></div>
          <div className="handoff-banner-text">
            <div className="handoff-banner-title" style={{ color: '#92400e', fontWeight: 700 }}>{incomingPendingCount} incoming lead{incomingPendingCount > 1 ? 's' : ''} awaiting your review</div>
            <div className="handoff-banner-desc" style={{ color: '#b45309' }}>Leads handed off from telecallers are ready for your action.</div>
          </div>
          <button className="crm-btn crm-btn-warning crm-btn-sm" style={{ fontWeight: 700 }} onClick={() => onNavigate?.('incoming')}>Review Now →</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {statCards.map((card) => (
          <div className="stat-card" key={card.label}>
            <div className="stat-card-header">
              <div className="stat-card-label">{card.label}</div>
              <div className="stat-card-icon" style={{ background: card.iconBg, color: card.iconColor }}>{card.icon}</div>
            </div>
            <div className="stat-card-value" style={card.valueColor ? { color: card.valueColor } : {}}>{card.value}</div>
            <div className={`stat-card-change change-${card.changeType}`}>{card.change}</div>
          </div>
        ))}
      </div>

      {/* Two Column Grid - Only show if there are follow-ups */}
      {(todayFollowUps.length > 0 || missedFollowUps.length > 0) && (
        <div className="crm-grid crm-grid-1 md:crm-grid-2 gap-4">
          {/* Today's Follow Up List */}
          {todayFollowUps.length > 0 && (
            <div className="crm-card">
              <div className="crm-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="crm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}><UsersIcon style={ICON_SM} /> Today's Follow Up ({todayFollowUps.length})</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)', cursor: 'pointer', opacity: 0.8 }} onClick={() => onNavigate?.('leads')}>View All →</span>
              </div>
              <div className="crm-card-body-flush">
                {todayFollowUps.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="followup-item" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #f1f5f9)' }}>
                    <div className="followup-content">
                      <div className="followup-name" style={{ fontWeight: 700, fontSize: 13 }}>
                        {lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim()}
                      </div>
                      <div className="followup-note" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{lead.phone || '-'} · {lead.projectName || lead.project || '-'}</span>
                        {lead.statusName && (
                          <span style={{ padding: '1px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: `${lead.statusColor || '#6B7280'}22`, color: lead.statusColor || '#6B7280' }}>{lead.statusName}</span>
                        )}
                      </div>
                    </div>
                    <button className="crm-btn crm-btn-sm crm-btn-ghost" onClick={() => navigate(`/portal/lead/${lead.id}`)}>View</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missed Follow Up List */}
          {missedFollowUps.length > 0 && (
            <div className="crm-card">
              <div className="crm-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="crm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}><XCircleIcon style={ICON_SM} /> Missed Follow Up ({missedFollowUps.length})</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)', cursor: 'pointer', opacity: 0.8 }} onClick={() => onNavigate?.('leads')}>View All →</span>
              </div>
              <div className="crm-card-body-flush">
                {missedFollowUps.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="followup-item" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #f1f5f9)' }}>
                    <div className="followup-content">
                      <div className="followup-name" style={{ fontWeight: 700, fontSize: 13 }}>
                        {lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim()}
                      </div>
                      <div className="followup-note" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{lead.phone || '-'} · {lead.projectName || lead.project || '-'}</span>
                        {lead.statusName && (
                          <span style={{ padding: '1px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: `${lead.statusColor || '#6B7280'}22`, color: lead.statusColor || '#6B7280' }}>{lead.statusName}</span>
                        )}
                      </div>
                    </div>
                    <button className="crm-btn crm-btn-sm crm-btn-ghost" onClick={() => navigate(`/portal/lead/${lead.id}`)}>View</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default SalesManagerDashboard;
