import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDate } from '../../../utils/formatters';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import {
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  XCircleIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/24/outline';
import { Avatar, StatusChip, leadName } from '../common/dashWidgets';

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
    { label: 'Active Site Visits', value: stats?.svScheduled ?? stats?.todaysVisits ?? 0, valueColor: 'var(--accent-cyan)' },
    { label: 'Under Negotiations', value: stats?.negotiations ?? 0, valueColor: 'var(--accent-purple)' },
    { label: 'Awaiting Revisits', value: stats?.revisits ?? 0, valueColor: 'var(--accent-yellow)' },
    { label: 'Under Follow Up', value: stats?.todaysTasks ?? stats?.dueToday ?? 0, valueColor: 'var(--accent-blue)' },
    { label: "Today's Follow Up", value: todayFollowUps.length, valueColor: 'var(--accent-green)' },
    { label: 'Missed Follow Up', value: missedFollowUps.length, valueColor: 'var(--accent-red)' },
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
      <div className="stat-bar">
        {statCards.map((card) => (
          <div className="stat" key={card.label}>
            <div className="stat-label">{card.label}</div>
            <div className="stat-val" style={card.valueColor ? { color: card.valueColor } : {}}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Follow-up widgets */}
      <div className="dash-grid">
        {/* Today's Follow Up */}
        <div className="dash-widget">
          <div className="dash-widget-head">
            <div className="dash-widget-title"><PhoneIcon /> Today's Follow Up</div>
            <div className="dash-widget-actions">
              <span className="dash-count">{todayFollowUps.length}</span>
              <span className="dash-viewall" onClick={() => onNavigate?.('leads')}>View all →</span>
            </div>
          </div>
          <div className="dash-widget-body">
            {todayFollowUps.length === 0 ? (
              <div className="dash-empty">No follow-ups scheduled for today.</div>
            ) : (
              todayFollowUps.map((lead) => {
                const due = lead.next_follow_up_date || lead.scheduled_at;
                return (
                  <div key={lead.id} className="dash-row" onClick={() => navigate(`/portal/lead/${lead.id}`)}>
                    <Avatar name={leadName(lead)} color={lead.statusColor} />
                    <div className="dash-main">
                      <div className="dash-name">{leadName(lead)}</div>
                      <div className="dash-meta">
                        <span className="dash-meta-item"><PhoneIcon /> {lead.phone || 'N/A'}</span>
                        <span className="dash-meta-item"><MapPinIcon /> {lead.projectName || lead.project || '-'}</span>
                      </div>
                    </div>
                    <div className="dash-right">
                      <StatusChip name={lead.statusName} color={lead.statusColor} />
                      <div className="dash-due">
                        <span className="dash-due-label">Next follow-up</span>
                        <span className="dash-due-val"><CalendarIcon /> {due ? formatDate(due) : 'No date'}</span>
                      </div>
                      <button className="dash-call" title={`Call ${leadName(lead)}`} onClick={(e) => { e.stopPropagation(); navigate(`/portal/lead/${lead.id}`); }}><PhoneIcon /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Missed Follow Up */}
        <div className="dash-widget">
          <div className="dash-widget-head">
            <div className="dash-widget-title"><XCircleIcon /> Missed Follow Up</div>
            <div className="dash-widget-actions">
              <span className="dash-count dash-count--alert">{missedFollowUps.length}</span>
              <span className="dash-viewall" onClick={() => onNavigate?.('leads')}>View all →</span>
            </div>
          </div>
          <div className="dash-widget-body">
            {missedFollowUps.length === 0 ? (
              <div className="dash-empty">No missed follow-ups. Great work!</div>
            ) : (
              missedFollowUps.map((lead) => {
                const due = lead.next_follow_up_date || lead.scheduled_at || lead.updated_at;
                return (
                  <div key={lead.id} className="dash-row" onClick={() => navigate(`/portal/lead/${lead.id}`)}>
                    <Avatar name={leadName(lead)} color={lead.statusColor} />
                    <div className="dash-main">
                      <div className="dash-name">{leadName(lead)}</div>
                      <div className="dash-meta">
                        <span className="dash-meta-item"><PhoneIcon /> {lead.phone || 'N/A'}</span>
                        <span className="dash-meta-item"><MapPinIcon /> {lead.projectName || lead.project || '-'}</span>
                      </div>
                    </div>
                    <div className="dash-right">
                      <StatusChip name={lead.statusName} color={lead.statusColor} />
                      <div className="dash-due">
                        <span className="dash-due-label dash-due-label--over">Overdue since</span>
                        <span className="dash-due-val dash-due-val--over"><CalendarIcon /> {due ? formatDate(due) : 'No date'}</span>
                      </div>
                      <button className="dash-call" title={`Call ${leadName(lead)}`} onClick={(e) => { e.stopPropagation(); navigate(`/portal/lead/${lead.id}`); }}><PhoneIcon /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default SalesManagerDashboard;
