import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import followUpApi from '../../../api/followUpApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDateTime } from '../../../utils/formatters';
import './TelecallerDashboard.css';

const TelecallerDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [unassignedLeads, setUnassignedLeads] = useState([]);
  const [missedFollowUps, setMissedFollowUps] = useState([]);
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [upcomingVisits, setUpcomingVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [resp, overdueResp] = await Promise.all([
        dashboardApi.getTelecallerDetailed(),
        followUpApi.getOverdue(),
      ]);

      const ensureArray = (value) => {
        if (Array.isArray(value)) return value;
        if (value && Array.isArray(value.data)) return value.data;
        if (value && Array.isArray(value.rows)) return value.rows;
        return [];
      };

      const dashboardData = resp?.data?.data || resp?.data || resp || {};
      const overdueData = overdueResp?.data?.data || overdueResp?.data || overdueResp || {};

      setStats(dashboardData.stats || null);
      setUnassignedLeads(ensureArray(dashboardData.unassignedLeads));
      setMissedFollowUps(ensureArray(overdueData));
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
    { label: 'New Leads', value: stats?.unassignedLeads ?? stats?.unassignedLeadCount ?? unassignedLeads.length, icon: '👥', color: 'var(--accent-purple)' },
    { label: 'My Leads', value: stats?.myLeads ?? 0, icon: '👤', color: 'var(--accent-blue)' },
    { label: "Today's FU", value: stats?.todaysFollowUps ?? 0, icon: '📞', color: 'var(--accent-green)' },
    { label: 'SV Scheduled', value: stats?.svScheduled ?? 0, icon: '🏠', color: 'var(--accent-cyan)' },
    { label: 'SV Completed', value: stats?.svCompleted ?? 0, icon: '✅', color: '#10b981' },
    { label: 'Missed FU', value: stats?.overdueFollowUps ?? 0, icon: '⚠️', color: 'var(--accent-red)' },
  ];

  const handleLeadClick = (leadId) => {
    if (!leadId) return;
    onNavigate?.('leads', { leadId });
  };

  return (
    <div className="td-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{greeting}, {user?.first_name || 'Telecaller'}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Let's close some deals today!</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="crm-btn crm-btn-ghost" onClick={loadDashboardData}>↻ Refresh</button>
          <button className="crm-btn crm-btn-primary" onClick={() => onNavigate?.('leads-addnew')}>＋ Add Lead</button>
        </div>
      </div>

      {/* Row 1: Stats */}
      <div className="td-stats-grid">
        {statCardsData.map((card) => (
          <div className="td-stat-card" key={card.label}>
            <div className="td-stat-label">{card.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="td-stat-value" style={{ color: card.color }}>{card.value}</span>
              <span style={{ fontSize: 16 }}>{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Leads Containers */}
      <div className="td-row">
        {/* Unassigned Leads */}
        <div className="td-card">
          <div className="td-card-header">
            <div className="td-card-title">🆕 New Leads (Unassigned)</div>
            <span className="view-all-link" onClick={() => onNavigate?.('leads')}>View All →</span>
          </div>
          <div className="td-card-body">
            {unassignedLeads.length === 0 ? (
              <div className="empty-msg">No unassigned leads in the pool.</div>
            ) : (
              unassignedLeads.map(lead => (
                <div key={lead.id} className="td-list-item" onClick={() => handleLeadClick(lead.id)}>
                  <div className="td-item-info">
                    <div className="td-item-name">{lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`}</div>
                    <div className="td-item-meta">
                      <span>{lead.phone}</span>
                      {lead.source && <span> · {lead.source}</span>}
                    </div>
                  </div>
                  <button className="crm-btn crm-btn-sm crm-btn-outline" onClick={(e) => { e.stopPropagation(); handleLeadClick(lead.id); }}>Claim</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Missed Follow-ups */}
        <div className="td-card">
          <div className="td-card-header">
            <div className="td-card-title">⚠️ Missed Follow-ups</div>
            <span className="view-all-link" onClick={() => onNavigate?.('followups')}>View All →</span>
          </div>
          <div className="td-card-body">
            {missedFollowUps.length === 0 ? (
              <div className="empty-msg">No missed follow-ups. Great work!</div>
            ) : (
              missedFollowUps.map((fu) => (
                <div key={fu.id} className="td-list-item" onClick={() => handleLeadClick(fu.lead_id || fu.lead?.id)}>
                  <div className="td-item-info">
                    <div className="td-item-name">
                      {fu.lead?.fullName || fu.fullName || (fu.lead?.first_name ? `${fu.lead.first_name} ${fu.lead.last_name || ''}`.trim() : 'Unknown Lead')}
                    </div>
                    <div className="td-item-meta">
                      <span className="td-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>Overdue</span>
                      <span>{fu.lead?.phone || fu.phone || 'N/A'}</span>
                    </div>
                  </div>
                  <span className="td-item-date">{formatDateTime(fu.scheduled_at || fu.updated_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Actions Containers */}
      <div className="td-row">
        {/* Today's Follow-ups */}
        <div className="td-card">
          <div className="td-card-header">
            <div className="td-card-title">📞 Today's Follow-ups</div>
            <span className="view-all-link" onClick={() => onNavigate?.('followups')}>Schedule →</span>
          </div>
          <div className="td-card-body">
            {todayFollowUps.length === 0 ? (
              <div className="empty-msg">No follow-ups scheduled for today.</div>
            ) : (
              todayFollowUps.map(fu => (
                <div key={fu.id} className="td-list-item" onClick={() => handleLeadClick(fu.lead_id)}>
                  <div className="td-item-info">
                    <div className="td-item-name">{fu.lead?.fullName || fu.fullName || (fu.lead?.first_name ? `${fu.lead.first_name} ${fu.lead.last_name || ''}`.trim() : 'Unknown Lead')}</div>
                    <div className="td-item-meta">
                      <span className="td-item-date" style={{ background: 'var(--accent-green-bg)', color: 'var(--accent-green)' }}>
                        {fu.scheduled_at ? new Date(fu.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Time'}
                      </span>
                      <span>{fu.lead?.phone || fu.phone || 'N/A'}</span>
                    </div>
                  </div>
                  <button className="crm-btn crm-btn-sm crm-btn-success" onClick={(e) => { e.stopPropagation(); handleLeadClick(fu.lead_id); }}>Call</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Site Visits */}
        <div className="td-card">
          <div className="td-card-header">
            <div className="td-card-title">🏠 SV Scheduled</div>
            <span className="view-all-link" onClick={() => onNavigate?.('sitevisits')}>Track →</span>
          </div>
          <div className="td-card-body">
            {upcomingVisits.length === 0 ? (
              <div className="empty-msg">No site visits scheduled for your leads.</div>
            ) : (
              upcomingVisits.map(lead => (
                <div key={lead.id} className="td-list-item" onClick={() => handleLeadClick(lead.id)}>
                  <div className="td-item-info">
                    <div className="td-item-name">{lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`}</div>
                    <div className="td-item-meta">
                      <span className="td-item-date">{formatDateTime(lead.nextFollowUpAt || lead.updatedAt)}</span>
                      <span>📍 {lead.project || 'Project'}</span>
                      <span>📞 {lead.phone}</span>
                    </div>
                  </div>
                  <span className={`td-badge td-badge-sitevisit`}>Scheduled</span>
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
