import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDate } from '../../../utils/formatters';
import {
  PhoneIcon,
  HomeModernIcon,
  ExclamationTriangleIcon,
  UserPlusIcon,
  CalendarIcon,
  ArrowPathIcon,
  PlusIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { Avatar, StatusChip, leadName } from '../common/dashWidgets';
import './TelecallerDashboard.css';

const TelecallerDashboard = ({ user, onNavigate }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [unassignedLeads, setUnassignedLeads] = useState([]);
  const [missedFollowUps, setMissedFollowUps] = useState([]);
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [upcomingVisits, setUpcomingVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Single source of truth: the detailed dashboard endpoint already scopes every
      // list to the logged-in telecaller (assigned_to = req.user.id), so no client-side
      // re-filtering is needed. missedFollowUps shares the exact lead-date definition as
      // the overdueFollowUps stat, so the card count and this list always agree.
      const timezoneOffset = new Date().getTimezoneOffset();
      const resp = await dashboardApi.getTelecallerDetailed({ timezoneOffset });

      const ensureArray = (value) => {
        if (Array.isArray(value)) return value;
        if (value && Array.isArray(value.data)) return value.data;
        if (value && Array.isArray(value.rows)) return value.rows;
        return [];
      };

      const dashboardData = resp?.data?.data || resp?.data || resp || {};

      setStats(dashboardData.stats || null);
      setUnassignedLeads(ensureArray(dashboardData.unassignedLeads));
      setMissedFollowUps(ensureArray(dashboardData.missedFollowUps));
      setTodayFollowUps(ensureArray(dashboardData.todaysFollowUps));
      setUpcomingVisits(ensureArray(dashboardData.upcomingVisits));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update dashboard'));
      // Ensure we have empty arrays on error to avoid map crashes
      setUnassignedLeads([]);
      setMissedFollowUps([]);
      setTodayFollowUps([]);
      setUpcomingVisits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="td-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="crm-spinner" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const statCardsData = [
    { label: 'New Leads', value: stats?.newLeadsToday ?? 0, color: 'var(--accent-green)' },
    { label: 'All Active Leads', value: stats?.activeLeads ?? 0, color: 'var(--text-primary)' },
    { label: "Today's Follow Ups", value: stats?.todaysPendingFollowUps ?? 0, color: 'var(--accent-yellow)' },
    { label: 'Missed Follow Ups', value: stats?.overdueFollowUps ?? 0, color: 'var(--accent-red)' },
    { label: 'Total Answered Today', value: stats?.answeredToday ?? 0, color: 'var(--accent-green)' },
    { label: 'SV Scheduled', value: stats?.svScheduled ?? 0, color: 'var(--accent-yellow)' },
    { label: 'SV Done', value: stats?.svCompleted ?? 0, color: 'var(--accent-green)' },
  ];

  const handleLeadClick = (leadId) => {
    if (!leadId) return;
    navigate(`/portal/lead/${leadId}`);
  };

  return (
    <div className="td-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{greeting}, {user?.first_name || user?.firstName}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Let's close some deals today!</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="crm-btn crm-btn-ghost" onClick={loadDashboardData} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh</button>
          <button className="crm-btn crm-btn-primary" onClick={() => onNavigate?.('leads-addnew')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PlusIcon style={{ width: 16, height: 16 }} /> Add Lead</button>
        </div>
      </div>

      {/* Row 1: Stats */}
      <div className="stat-bar">
        {statCardsData.map((card) => (
          <div className="stat" key={card.label}>
            <div className="stat-label">{card.label}</div>
            <div className="stat-val" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Lead widgets */}
      <div className="dash-grid">
        {/* New Leads (Unassigned) */}
        <div className="dash-widget">
          <div className="dash-widget-head">
            <div className="dash-widget-title"><UserPlusIcon /> New Leads (Unassigned)</div>
            <div className="dash-widget-actions">
              <span className="dash-count">{unassignedLeads.length}</span>
              <span className="dash-viewall" onClick={() => onNavigate?.('leads')}>View all →</span>
            </div>
          </div>
          <div className="dash-widget-body">
            {unassignedLeads.length === 0 ? (
              <div className="dash-empty">No unassigned leads in the pool.</div>
            ) : (
              unassignedLeads.map((lead) => (
                <div key={lead.id} className="dash-row" onClick={() => handleLeadClick(lead.id)}>
                  <Avatar name={leadName(lead)} color={lead.statusColor} />
                  <div className="dash-main">
                    <div className="dash-name">{leadName(lead)}</div>
                    <div className="dash-meta">
                      <span className="dash-meta-item"><PhoneIcon /> {lead.phone || 'N/A'}</span>
                      {lead.source && <span className="dash-meta-item">· {lead.source}</span>}
                    </div>
                  </div>
                  <div className="dash-right">
                    <StatusChip name={lead.statusName} color={lead.statusColor} />
                    <button className="crm-btn crm-btn-sm crm-btn-outline" onClick={(e) => { e.stopPropagation(); handleLeadClick(lead.id); }}>Claim</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Follow-ups */}
        <div className="dash-widget">
          <div className="dash-widget-head">
            <div className="dash-widget-title"><PhoneIcon /> Today's Follow-ups</div>
            <div className="dash-widget-actions">
              <span className="dash-count">{todayFollowUps.length}</span>
              <span className="dash-viewall" onClick={() => onNavigate?.('leads', { tab: 'today' })}>Open my leads →</span>
            </div>
          </div>
          <div className="dash-widget-body">
            {todayFollowUps.length === 0 ? (
              <div className="dash-empty">No follow-ups scheduled for today.</div>
            ) : (
              todayFollowUps.map((fu) => {
                const due = fu.next_follow_up_date || fu.scheduled_at;
                return (
                  <div key={fu.id} className="dash-row" onClick={() => handleLeadClick(fu.id)}>
                    <Avatar name={leadName(fu)} color={fu.statusColor} />
                    <div className="dash-main">
                      <div className="dash-name">{leadName(fu)}</div>
                      <div className="dash-meta">
                        <span className="dash-meta-item"><PhoneIcon /> {fu.phone || fu.lead?.phone || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="dash-right">
                      <StatusChip name={fu.statusName} color={fu.statusColor} />
                      <div className="dash-due">
                        <span className="dash-due-label">Next follow-up</span>
                        <span className="dash-due-val"><CalendarIcon /> {due ? formatDate(due) : 'No date'}</span>
                      </div>
                      <button className="dash-call" title={`Call ${leadName(fu)}`} onClick={(e) => { e.stopPropagation(); handleLeadClick(fu.id); }}><PhoneIcon /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Missed Follow-ups */}
        <div className="dash-widget">
          <div className="dash-widget-head">
            <div className="dash-widget-title"><ExclamationTriangleIcon /> Missed Follow-ups</div>
            <div className="dash-widget-actions">
              <span className="dash-count dash-count--alert">{missedFollowUps.length}</span>
              <span className="dash-viewall" onClick={() => onNavigate?.('leads', { tab: 'missed' })}>View my leads →</span>
            </div>
          </div>
          <div className="dash-widget-body">
            {missedFollowUps.length === 0 ? (
              <div className="dash-empty">No missed follow-ups. Great work!</div>
            ) : (
              missedFollowUps.map((fu) => {
                const due = fu.next_follow_up_date || fu.scheduled_at || fu.updated_at;
                return (
                  <div key={fu.id} className="dash-row" onClick={() => handleLeadClick(fu.id)}>
                    <Avatar name={leadName(fu)} color={fu.statusColor} />
                    <div className="dash-main">
                      <div className="dash-name">{leadName(fu)}</div>
                      <div className="dash-meta">
                        <span className="dash-meta-item"><PhoneIcon /> {fu.phone || fu.lead?.phone || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="dash-right">
                      <StatusChip name={fu.statusName} color={fu.statusColor} />
                      <div className="dash-due">
                        <span className="dash-due-label dash-due-label--over">Overdue since</span>
                        <span className="dash-due-val dash-due-val--over"><CalendarIcon /> {due ? formatDate(due) : 'No date'}</span>
                      </div>
                      <button className="dash-call" title={`Call ${leadName(fu)}`} onClick={(e) => { e.stopPropagation(); handleLeadClick(fu.id); }}><PhoneIcon /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SV Scheduled */}
        <div className="dash-widget">
          <div className="dash-widget-head">
            <div className="dash-widget-title"><HomeModernIcon /> SV Scheduled</div>
            <div className="dash-widget-actions">
              <span className="dash-count">{upcomingVisits.length}</span>
              <span className="dash-viewall" onClick={() => onNavigate?.('handoffs')}>Track →</span>
            </div>
          </div>
          <div className="dash-widget-body">
            {upcomingVisits.length === 0 ? (
              <div className="dash-empty">No site visits scheduled for your leads.</div>
            ) : (
              upcomingVisits.map((lead) => (
                <div key={lead.id} className="dash-row" onClick={() => handleLeadClick(lead.id)}>
                  <Avatar name={leadName(lead)} color={lead.statusColor} />
                  <div className="dash-main">
                    <div className="dash-name">{leadName(lead)}</div>
                    <div className="dash-meta">
                      <span className="dash-meta-item"><MapPinIcon /> {lead.project || 'Project'}</span>
                      <span className="dash-meta-item"><PhoneIcon /> {lead.phone || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="dash-right">
                    <StatusChip name={lead.statusName || 'Scheduled'} color={lead.statusColor || '#7B5800'} />
                    <div className="dash-due">
                      <span className="dash-due-label">Site visit</span>
                      <span className="dash-due-val"><CalendarIcon /> {formatDate(lead.scheduled_at || lead.next_follow_up_date )}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelecallerDashboard;
