import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import followUpApi from '../../../api/followUpApi';
import siteVisitApi from '../../../api/siteVisitApi';
import { getErrorMessage } from '../../../utils/helpers';

const TelecallerDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [todaysFollowUps, setTodaysFollowUps] = useState([]);
  const [upcomingVisits, setUpcomingVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, fuResp, svResp] = await Promise.all([
        dashboardApi.getTelecallerStats().catch(() => ({ data: null })),
        followUpApi.getTodays().then(r => r.data).catch(() => ({ data: [] })),
        siteVisitApi.getUpcoming().then(r => r.data).catch(() => ({ data: [] })),
      ]);
      setStats(statsResp.data || null);
      setTodaysFollowUps(fuResp.data || fuResp || []);
      setUpcomingVisits(svResp.data || svResp || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--text-secondary)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'tc-spin 0.8s linear infinite', marginBottom: 12 }} />
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Leads', value: stats?.totalLeads ?? 0, icon: '👥', iconBg: 'var(--accent-blue-bg)', iconColor: 'var(--accent-blue)', change: `↑ ${stats?.newToday ?? 0} new today`, changeType: stats?.newToday > 0 ? 'up' : 'neutral' },
    { label: "Today's Follow Ups", value: stats?.todaysFollowUps ?? 0, icon: '📞', iconBg: 'var(--accent-yellow-bg)', iconColor: 'var(--accent-yellow)', valueColor: 'var(--accent-yellow)', change: `${stats?.overdueFollowUps ?? 0} overdue`, changeType: stats?.overdueFollowUps > 0 ? 'down' : 'neutral' },
    { label: 'SV Scheduled', value: stats?.svScheduled ?? 0, icon: '🏠', iconBg: 'var(--accent-cyan-bg)', iconColor: 'var(--accent-cyan)', valueColor: 'var(--accent-cyan)', change: 'This week', changeType: 'neutral' },
    { label: 'SV Completed', value: stats?.svCompleted ?? 0, icon: '✅', iconBg: 'var(--accent-green-bg)', iconColor: 'var(--accent-green)', valueColor: 'var(--accent-green)', change: 'This month', changeType: 'neutral' },
    { label: 'Not Reachable', value: stats?.notReachable ?? 0, icon: '📵', iconBg: 'var(--accent-red-bg)', iconColor: 'var(--accent-red)', valueColor: 'var(--accent-red)', change: 'Retry needed', changeType: 'neutral' },
  ];

  const stageData = stats?.stageBreakdown || [];
  const stageColors = { NEW: '#94a3b8', CONTACTED: 'var(--accent-blue)', FOLLOW_UP: '#6366f1', SV_SCHEDULED: 'var(--accent-yellow)', SV_COMPLETED: 'var(--accent-green)' };
  const maxStage = Math.max(...stageData.map(s => parseInt(s.count) || 0), 1);

  const fuList = Array.isArray(todaysFollowUps) ? todaysFollowUps : [];
  const svList = Array.isArray(upcomingVisits) ? upcomingVisits : [];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Good Morning, {user?.first_name || 'Telecaller'} 👋</h1>
          <p>Here's what's happening with your leads today.</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={loadDashboard}>↻ Refresh</button>
          <button className="crm-btn crm-btn-primary" onClick={() => onNavigate?.('addlead')}>➕ Add Lead</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
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

      {/* Two Column Grid */}
      <div className="crm-grid crm-grid-2" style={{ marginBottom: 20 }}>
        {/* Today's Follow Ups */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">📞 Today's Follow Ups</div>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate?.('followups')}>View All →</button>
          </div>
          <div className="crm-card-body-flush">
            {fuList.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📞</div>
                <div className="empty-title">No follow-ups for today</div>
                <div className="empty-desc">You're all caught up!</div>
              </div>
            )}
            {fuList.slice(0, 4).map((fu) => {
              const time = fu.scheduled_at ? new Date(fu.scheduled_at) : null;
              const isOverdue = time && time.getTime() < Date.now();
              return (
                <div key={fu.id} className="followup-item" style={isOverdue ? { background: 'var(--accent-red-bg)' } : {}}>
                  <div className="followup-time-block">
                    <div className="followup-time" style={isOverdue ? { color: 'var(--accent-red)' } : {}}>
                      {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                    </div>
                    <div className="followup-period">
                      {time ? (time.getHours() >= 12 ? 'PM' : 'AM') : ''}
                    </div>
                    {isOverdue && <div className="followup-overdue-tag">OVERDUE</div>}
                  </div>
                  <div className="followup-content">
                    <div className="followup-name">
                      {fu.lead?.first_name || ''} {fu.lead?.last_name || ''}
                      {fu.lead?.status_label && (
                        <span className={`crm-badge badge-${(fu.lead.status_label || '').toLowerCase().replace(/\s/g, '')}`}>
                          {fu.lead.status_label}
                        </span>
                      )}
                    </div>
                    {fu.notes && <div className="followup-note">{fu.notes}</div>}
                    <div className="followup-meta">
                      {fu.lead?.project && <span>📍 {fu.lead.project.project_name || fu.lead.project}</span>}
                      {fu.lead?.phone && <span>📱 {fu.lead.phone}</span>}
                    </div>
                  </div>
                  <div className="followup-actions">
                    <button className="crm-btn crm-btn-success crm-btn-sm">📞 Call</button>
                    <button className="crm-btn crm-btn-ghost crm-btn-sm">💬</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Stage Summary + Site Visits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Lead Stage Summary */}
          <div className="crm-card">
            <div className="crm-card-header">
              <div className="crm-card-title">📊 Lead Stage Summary</div>
            </div>
            <div className="crm-card-body">
              <div className="mini-bars">
                {stageData.map((stage) => {
                  const pct = Math.round(((parseInt(stage.count) || 0) / maxStage) * 100);
                  return (
                    <div className="mini-bar-item" key={stage.stage_code}>
                      <div className="mini-bar-val">{stage.count}</div>
                      <div className="mini-bar" style={{ height: `${Math.max(pct, 8)}%`, background: stageColors[stage.stage_code] || stage.color_code || '#94a3b8' }}></div>
                      <div className="mini-bar-lbl">{stage.stage_name || stage.stage_code}</div>
                    </div>
                  );
                })}
                {stageData.length === 0 && (
                  <>
                    <div className="mini-bar-item"><div className="mini-bar-val">0</div><div className="mini-bar" style={{ height: '8%', background: '#94a3b8' }}></div><div className="mini-bar-lbl">New</div></div>
                    <div className="mini-bar-item"><div className="mini-bar-val">0</div><div className="mini-bar" style={{ height: '8%', background: 'var(--accent-blue)' }}></div><div className="mini-bar-lbl">Contacted</div></div>
                    <div className="mini-bar-item"><div className="mini-bar-val">0</div><div className="mini-bar" style={{ height: '8%', background: '#6366f1' }}></div><div className="mini-bar-lbl">Follow Up</div></div>
                    <div className="mini-bar-item"><div className="mini-bar-val">0</div><div className="mini-bar" style={{ height: '8%', background: 'var(--accent-yellow)' }}></div><div className="mini-bar-lbl">SV Sched</div></div>
                    <div className="mini-bar-item"><div className="mini-bar-val">0</div><div className="mini-bar" style={{ height: '8%', background: 'var(--accent-green)' }}></div><div className="mini-bar-lbl">SV Done</div></div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming Site Visits */}
          <div className="crm-card">
            <div className="crm-card-header">
              <div className="crm-card-title">🏠 Upcoming Site Visits</div>
              {svList.length > 0 && (
                <span className="crm-badge badge-sv-sch">{svList.length} upcoming</span>
              )}
            </div>
            <div className="crm-card-body-flush">
              {svList.length === 0 && (
                <div className="empty-state" style={{ padding: '30px 20px' }}>
                  <div className="empty-title">No upcoming site visits</div>
                </div>
              )}
              {svList.slice(0, 3).map((sv) => (
                <div className="followup-item" key={sv.id}>
                  <div className="followup-content">
                    <div className="followup-name">{sv.lead?.first_name || ''} {sv.lead?.last_name || ''}</div>
                    <div className="followup-note">{sv.project?.project_name || 'N/A'}</div>
                    <div className="followup-meta">
                      <span style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}>
                        {sv.scheduled_date ? new Date(sv.scheduled_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}
                        {sv.scheduled_time ? `, ${sv.scheduled_time}` : ''}
                      </span>
                    </div>
                  </div>
                  <button className="crm-btn crm-btn-success crm-btn-sm">✓ Complete</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelecallerDashboard;
