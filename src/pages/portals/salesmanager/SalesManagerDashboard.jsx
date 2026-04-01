import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { getErrorMessage } from '../../../utils/helpers';

const SalesManagerDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await dashboardApi.getSalesManagerStats().catch(() => ({ data: null }));
      setStats(resp.data || null);
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
    { label: 'Active Leads', value: stats?.activeLeads ?? 0, icon: '👥', iconBg: 'var(--accent-green-bg)', iconColor: 'var(--accent-green)', change: `↑ ${stats?.incomingLeads ?? 0} new handoffs`, changeType: 'up' },
    { label: 'Visits Done', value: stats?.visitsDone ?? 0, icon: '🏠', iconBg: 'var(--accent-cyan-bg)', iconColor: 'var(--accent-cyan)', valueColor: 'var(--accent-cyan)', change: 'This month', changeType: 'neutral' },
    { label: 'Revisits', value: stats?.revisits ?? 0, icon: '🔄', iconBg: 'var(--accent-purple-bg)', iconColor: 'var(--accent-purple)', valueColor: 'var(--accent-purple)', change: 'Active', changeType: 'neutral' },
    { label: 'Pushed to SH', value: stats?.pushedToSH ?? 0, icon: '🚀', iconBg: 'var(--accent-yellow-bg)', iconColor: 'var(--accent-yellow)', change: 'This month', changeType: 'up' },
    { label: 'Dropped', value: stats?.dropped ?? 0, icon: '✗', iconBg: 'var(--accent-red-bg)', iconColor: 'var(--accent-red)', valueColor: 'var(--accent-red)', change: 'This month', changeType: 'neutral' },
  ];

  const pipelineData = [
    { label: 'Visit', value: stats?.visitsDone ?? 0, color: 'var(--accent-cyan)' },
    { label: 'Revisit', value: stats?.revisits ?? 0, color: '#6366f1' },
    { label: 'Pushed', value: stats?.pushedToSH ?? 0, color: 'var(--accent-yellow)' },
    { label: 'Dropped', value: stats?.dropped ?? 0, color: 'var(--accent-red)' },
    { label: 'Won', value: stats?.won ?? 0, color: 'var(--accent-green)' },
  ];
  const maxPipeline = Math.max(...pipelineData.map(d => d.value), 1);

  return (
    <div>
      {/* Handoff Banner */}
      {(stats?.incomingLeads ?? 0) > 0 && (
        <div className="handoff-banner">
          <div className="handoff-banner-icon">⚡</div>
          <div className="handoff-banner-text">
            <div className="handoff-banner-title">{stats.incomingLeads} new leads from telecallers awaiting your acceptance</div>
            <div className="handoff-banner-desc">Site visits completed — these buyers are ready for your attention.</div>
          </div>
          <button className="crm-btn crm-btn-warning crm-btn-sm" onClick={() => onNavigate?.('incoming')}>Review Now →</button>
        </div>
      )}

      {/* Stats */}
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
      <div className="crm-grid crm-grid-2">
        {/* Today's Meetings */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">📅 Today's Meetings</div>
          </div>
          <div className="crm-card-body-flush">
            <div className="followup-item">
              <div className="followup-time-block"><div className="followup-time">11:00</div><div className="followup-period">AM</div></div>
              <div className="followup-content">
                <div className="followup-name">New Lead Meeting <span className="crm-badge badge-visit"><span className="crm-badge-dot"></span>Visit</span></div>
                <div className="followup-note">First meeting with buyer. Show available options.</div>
              </div>
              <button className="crm-btn crm-btn-ghost crm-btn-sm">📝 Note</button>
            </div>
            <div className="followup-item">
              <div className="followup-time-block"><div className="followup-time">2:30</div><div className="followup-period">PM</div></div>
              <div className="followup-content">
                <div className="followup-name">Revisit Meeting <span className="crm-badge badge-revisit"><span className="crm-badge-dot"></span>Revisit</span></div>
                <div className="followup-note">2nd meeting. Updated floorplan discussion.</div>
              </div>
              <button className="crm-btn crm-btn-ghost crm-btn-sm">📝 Note</button>
            </div>
            <div className="followup-item">
              <div className="followup-time-block"><div className="followup-time">4:00</div><div className="followup-period">PM</div></div>
              <div className="followup-content">
                <div className="followup-name">Hot Lead <span className="crm-badge badge-hot">🔥 Hot</span></div>
                <div className="followup-note">Ready for negotiation. Push to Sales Head today.</div>
              </div>
              <button className="crm-btn crm-btn-ghost-primary crm-btn-sm">🚀 Push to SH</button>
            </div>
          </div>
        </div>

        {/* My Pipeline */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">📊 My Pipeline</div>
          </div>
          <div className="crm-card-body">
            <div className="mini-bars" style={{ height: 140 }}>
              {pipelineData.map((d) => (
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
