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
        dashboardApi.getTelecallerStats().catch(() => null),
        followUpApi.getTodays().catch(() => ({ data: { data: [] } })),
        siteVisitApi.getUpcoming().catch(() => ({ data: { data: [] } })),
      ]);
      // dashboardApi unwraps axios .data → statsResp = { success, data: {...stats} }
      setStats(statsResp?.data || null);
      // followUpApi returns raw axios response → fuResp.data = { success, data: [...] }
      const fuData = fuResp?.data?.data || fuResp?.data || [];
      setTodaysFollowUps(Array.isArray(fuData) ? fuData : []);
      const svData = svResp?.data?.data || svResp?.data || [];
      setUpcomingVisits(Array.isArray(svData) ? svData : []);
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

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const statCards = [
    { label: 'Total Leads', value: stats?.totalLeads ?? 0, icon: '👥', iconBg: 'var(--accent-blue-bg)', iconColor: 'var(--accent-blue)', change: `↑ ${stats?.newToday ?? 0} new today`, changeType: stats?.newToday > 0 ? 'up' : 'neutral' },
    { label: "Today's Follow Ups", value: stats?.todaysFollowUps ?? 0, icon: '📞', iconBg: 'var(--accent-yellow-bg)', iconColor: 'var(--accent-yellow)', valueColor: 'var(--accent-yellow)', change: `${stats?.overdueFollowUps ?? 0} overdue`, changeType: stats?.overdueFollowUps > 0 ? 'down' : 'neutral' },
    { label: 'SV Scheduled', value: stats?.svScheduled ?? 0, icon: '🏠', iconBg: 'var(--accent-cyan-bg)', iconColor: 'var(--accent-cyan)', valueColor: 'var(--accent-cyan)', change: 'This week', changeType: 'neutral' },
    { label: 'SV Completed', value: stats?.svCompleted ?? 0, icon: '✅', iconBg: 'var(--accent-green-bg)', iconColor: 'var(--accent-green)', valueColor: 'var(--accent-green)', change: 'This month', changeType: 'neutral' },
    { label: 'Missed Follow-ups', value: stats?.overdueFollowUps ?? 0, icon: '📵', iconBg: 'var(--accent-red-bg)', iconColor: 'var(--accent-red)', valueColor: 'var(--accent-red)', change: 'Needs attention', changeType: stats?.overdueFollowUps > 0 ? 'down' : 'neutral' },
  ];

  const stageData = stats?.stageBreakdown || [];
  const stageColors = { NEW: '#94a3b8', NEW_LEAD: '#94a3b8', CONTACTED: 'var(--accent-blue)', FOLLOW_UP: '#6366f1', SV_SCHEDULED: 'var(--accent-yellow)', SV_COMPLETED: 'var(--accent-green)' };
  const maxStage = Math.max(...stageData.map(s => parseInt(s.count) || 0), 1);

  const fuList = Array.isArray(todaysFollowUps) ? todaysFollowUps : [];
  const svList = Array.isArray(upcomingVisits) ? upcomingVisits : [];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>{greeting}, {user?.first_name || 'Telecaller'} 👋</h1>
          <p className="hidden sm:block">Here's what's happening with your leads today.</p>
        </div>
        <div className="page-header-actions flex-wrap">
          <button className="crm-btn crm-btn-ghost" onClick={loadDashboard}>↻ Refresh</button>
          <button className="crm-btn crm-btn-primary" onClick={() => onNavigate?.('leads-addnew')}>➕ Add Lead</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <div className="crm-card-title">📞 Today's Follow Ups ({fuList.length})</div>
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
            {fuList.slice(0, 5).map((fu) => {
              const time = fu.scheduled_at ? new Date(fu.scheduled_at) : null;
              const isOverdue = time && time.getTime() < Date.now();
              const leadName = [fu.lead?.first_name, fu.lead?.last_name].filter(Boolean).join(' ') || 'Unknown';
              const stageName = fu.lead?.stage?.stage_name || '';
              const stageColor = fu.lead?.stage?.color_code || '#94a3b8';
              return (
                <div key={fu.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #f1f5f9)', background: isOverdue ? 'var(--accent-red-bg)' : 'transparent' }}>
                  <div style={{ minWidth: 54, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isOverdue ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                      {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}
                    </div>
                    {isOverdue && <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: '#dc2626', borderRadius: 3, padding: '1px 4px', marginTop: 2 }}>LATE</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{leadName}</span>
                      {stageName && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: stageColor + '18', color: stageColor, fontWeight: 600 }}>{stageName}</span>}
                    </div>
                    {fu.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fu.notes}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 10 }}>
                      {fu.lead?.phone && <span>📱 {fu.lead.phone}</span>}
                      {fu.lead?.project?.project_name && <span>📍 {fu.lead.project.project_name}</span>}
                    </div>
                  </div>
                  <button className="crm-btn crm-btn-success crm-btn-sm" onClick={() => onNavigate?.('leads')}>📞 Call</button>
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
                  const color = stage.color_code || stageColors[stage.stage_code] || '#94a3b8';
                  return (
                    <div className="mini-bar-item" key={stage.stage_code}>
                      <div className="mini-bar-val">{stage.count}</div>
                      <div className="mini-bar" style={{ height: `${Math.max(pct, 8)}%`, background: color }}></div>
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
