import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { getErrorMessage } from '../../../utils/helpers';
import siteVisitApi from '../../../api/siteVisitApi';

const SalesManagerDashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [upcomingVisits, setUpcomingVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, visitsResp] = await Promise.all([
        dashboardApi.getSalesManagerStats().catch(() => ({ data: {} })),
        siteVisitApi.getUpcoming().catch(() => ({ data: { data: [] } })),
      ]);

      setStats(statsResp?.data || {});
      const svData = visitsResp?.data?.data || visitsResp?.data || [];
      const sortedVisits = Array.isArray(svData)
        ? [...svData].sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0))
        : [];
      setUpcomingVisits(sortedVisits);

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
    { label: 'Active Leads', value: stats?.activeLeads ?? stats?.totalLeads ?? 0, icon: '👥', iconBg: 'var(--accent-green-bg)', iconColor: 'var(--accent-green)', change: `↑ ${stats?.incomingLeads ?? 0} incoming`, changeType: 'up' },
    { label: 'Due Today', value: stats?.todaysTasks ?? stats?.dueToday ?? 0, icon: '📌', iconBg: 'var(--accent-blue-bg)', iconColor: 'var(--accent-blue)', valueColor: 'var(--accent-blue)', change: `${stats?.overdueActions ?? stats?.missedActions ?? 0} overdue`, changeType: (stats?.overdueActions ?? stats?.missedActions ?? 0) > 0 ? 'down' : 'neutral' },
    { label: 'Upcoming Visits', value: stats?.svScheduled ?? stats?.todaysVisits ?? 0, icon: '🏠', iconBg: 'var(--accent-cyan-bg)', iconColor: 'var(--accent-cyan)', valueColor: 'var(--accent-cyan)', change: `${stats?.visitsDone ?? stats?.svCompleted ?? 0} completed`, changeType: 'neutral' },
    { label: 'Revisits', value: stats?.revisits ?? 0, icon: '🔄', iconBg: 'var(--accent-purple-bg)', iconColor: 'var(--accent-purple)', valueColor: 'var(--accent-purple)', change: 'In revisit stage', changeType: 'neutral' },
    { label: 'Pushed to SH', value: stats?.pushedToSH ?? 0, icon: '🚀', iconBg: 'var(--accent-yellow-bg)', iconColor: 'var(--accent-yellow)', change: 'This month', changeType: 'up' },
    { label: 'Dropped', value: stats?.dropped ?? 0, icon: '✗', iconBg: 'var(--accent-red-bg)', iconColor: 'var(--accent-red)', valueColor: 'var(--accent-red)', change: 'This month', changeType: 'neutral' },
  ];

  const pipelineData = (Array.isArray(stats?.stageBreakdown) ? stats.stageBreakdown : [])
    .map((item) => ({
      label: item.stage_name || item.stage_code,
      value: Number(item.count) || 0,
      color: item.color_code || 'var(--accent-blue)',
    }))
    .filter((item) => item.value > 0)
    .slice(0, 6);

  const fallbackPipelineData = [
    { label: 'Incoming', value: stats?.incomingLeads ?? 0, color: 'var(--accent-yellow)' },
    { label: 'Visits', value: stats?.svScheduled ?? 0, color: 'var(--accent-cyan)' },
    { label: 'Revisits', value: stats?.revisits ?? 0, color: '#6366f1' },
    { label: 'Pushed', value: stats?.pushedToSH ?? 0, color: 'var(--accent-green)' },
    { label: 'Dropped', value: stats?.dropped ?? 0, color: 'var(--accent-red)' },
  ];

  const chartData = pipelineData.length ? pipelineData : fallbackPipelineData;
  const maxPipeline = Math.max(...chartData.map(d => d.value), 1);

  const svList = Array.isArray(upcomingVisits) ? upcomingVisits : [];

  return (
    <div>
      {/* Handoff Banner */}
      {(stats?.incomingLeads ?? 0) > 0 && (
        <div className="handoff-banner" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}>
          <div className="handoff-banner-icon" style={{ fontSize: 24 }}>📥</div>
          <div className="handoff-banner-text">
            <div className="handoff-banner-title" style={{ color: '#92400e', fontWeight: 700 }}>{stats.incomingLeads} incoming lead{stats.incomingLeads > 1 ? 's' : ''} awaiting your review</div>
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

      {/* Two Column Grid */}
      <div className="crm-grid crm-grid-1 md:crm-grid-2 gap-4">
        {/* Today's Meetings */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">🏠 Upcoming Site Visits ({svList.length})</div>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate?.('visits')}>View All →</button>
          </div>
          <div className="crm-card-body-flush" style={{ minHeight: 180 }}>
            {svList.length === 0 && (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-icon">🏠</div>
                <div className="empty-title">No upcoming site visits</div>
                <div className="empty-desc">Scheduled site visits will appear here automatically.</div>
              </div>
            )}
            {svList.slice(0, 5).map((sv) => {
              const isToday = sv.scheduled_date && new Date(sv.scheduled_date).toDateString() === new Date().toDateString();
              const leadName = sv.lead ? `${sv.lead.first_name} ${sv.lead.last_name || ''}` : 'Unknown Lead';
              const isHot = sv.lead?.status?.status_code === 'HOT';
              
              return (
                <div className="followup-item" key={sv.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #f1f5f9)' }}>
                  <div className="followup-time-block">
                    <div className="followup-time" style={{ color: isToday ? 'var(--accent-blue)' : 'inherit' }}>
                      {sv.scheduled_time_slot || 'TBD'}
                    </div>
                    <div className="followup-period">
                      {sv.scheduled_date ? new Date(sv.scheduled_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                    </div>
                  </div>
                  <div className="followup-content">
                    <div className="followup-name" style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {leadName} 
                      {isHot && <span className="crm-badge badge-hot" style={{ fontSize: 9, padding: '1px 4px' }}>🔥 Hot</span>}
                    </div>
                    <div className="followup-note" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      📍 {sv.project?.project_name || 'N/A'} {sv.pickup_required && '· 🚗 Pickup Needed'}
                    </div>
                  </div>
                  <button className="crm-btn crm-btn-ghost-primary crm-btn-sm" onClick={() => onNavigate?.('visits')}>Open</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* My Pipeline Summary */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">📊 Activity Summary</div>
          </div>
          <div className="crm-card-body">
            <div className="mini-bars" style={{ height: 160 }}>
              {chartData.map((d) => (
                <div className="mini-bar-item" key={d.label}>
                  <div className="mini-bar-val">{d.value}</div>
                  <div className="mini-bar" style={{ height: `${Math.max(Math.round((d.value / maxPipeline) * 100), 8)}%`, background: d.color }}></div>
                  <div className="mini-bar-lbl">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesManagerDashboard;
