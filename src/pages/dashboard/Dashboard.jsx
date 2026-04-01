import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import dashboardApi from '../../api/dashboardApi';
import { getRoleCode } from '../../utils/permissions';
import { formatCurrency } from '../../utils/formatters';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const roleCode = useSelector((state) => getRoleCode(state.auth.user));
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsResp, adminResp] = await Promise.all([
          dashboardApi.getStats().catch(() => ({ data: null })),
          dashboardApi.getAdminStats().catch(() => ({ data: null })),
        ]);
        setStats(statsResp.data || null);
        setAdminStats(adminResp.data || null);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Unable to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const [statsResp, adminResp] = await Promise.all([
        dashboardApi.getStats().catch(() => ({ data: null })),
        dashboardApi.getAdminStats().catch(() => ({ data: null })),
      ]);
      setStats(statsResp.data || null);
      setAdminStats(adminResp.data || null);
    } catch (error) {
      toast.error('Unable to refresh');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: 'var(--text-secondary)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'tc-spin 0.8s linear infinite', marginBottom: 16 }} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Leads', value: adminStats?.totalLeads ?? 0, icon: '👥', iconBg: 'var(--accent-blue-bg)', iconColor: 'var(--accent-blue)', change: `↑ ${adminStats?.thisMonthLeads ?? 0} this month`, changeType: 'up' },
    { label: 'Total Bookings', value: adminStats?.totalBookings ?? 0, icon: '📋', iconBg: 'var(--accent-green-bg)', iconColor: 'var(--accent-green)', valueColor: 'var(--accent-green)', change: 'Active bookings', changeType: 'up' },
    { label: 'Total Revenue', value: formatCurrency(adminStats?.totalRevenue ?? 0), icon: '💰', iconBg: 'var(--accent-yellow-bg)', iconColor: 'var(--accent-yellow)', valueColor: 'var(--accent-yellow)', change: 'Collected payments', changeType: 'up' },
    { label: 'Active Users', value: adminStats?.activeUsers ?? stats?.masters?.activeUsers ?? 0, icon: '🧑‍💻', iconBg: 'var(--accent-purple-bg)', iconColor: 'var(--accent-purple)', change: (stats?.userDistribution || []).map(u => `${u.count} ${u.short_code}`).join(', ') || 'Team members', changeType: 'neutral' },
    { label: 'Conversion Rate', value: `${adminStats?.conversionRate ?? 0}%`, icon: '📈', iconBg: 'var(--accent-cyan-bg)', iconColor: 'var(--accent-cyan)', valueColor: 'var(--accent-cyan)', change: 'Lead to booking', changeType: 'up' },
  ];

  const sourceColors = ['#ea580c', '#2563eb', '#d97706', '#16a34a', '#7c3aed', '#0891b2', '#db2777'];

  const workspaceLinks = [
    { label: 'Telecaller Workspace', path: '/telecaller/leads', icon: '📞', desc: 'Manage telecaller leads', allowed: ['TC', 'SA', 'ADM'] },
    { label: 'Sales Manager Workspace', path: '/sales-manager/leads', icon: '🏢', desc: 'Site visits & leads', allowed: ['SM', 'SH', 'SA', 'ADM'] },
    { label: 'Sales Head Workspace', path: '/sales-head/leads', icon: '👔', desc: 'Negotiations & bookings', allowed: ['SH', 'SA', 'ADM'] },
    { label: 'Collection Workspace', path: '/collection/leads', icon: '💰', desc: 'Payment tracking', allowed: ['COL', 'SA', 'ADM'] },
  ].filter((item) => item.allowed.includes(roleCode));

  const quickLinks = [
    { label: 'Users', path: '/super-admin/users', icon: '👥' },
    { label: 'Projects', path: '/super-admin/projects', icon: '🏗️' },
    { label: 'Locations', path: '/super-admin/locations', icon: '📍' },
    { label: 'Lead Sources', path: '/super-admin/lead-sources', icon: '📡' },
    { label: 'Lead Stages', path: '/super-admin/lead-stages', icon: '📋' },
    { label: 'Settings', path: '/super-admin/lead-statuses', icon: '⚙️' },
  ];

  const sourceStats = adminStats?.sourceStats || [];
  const maxSourceLeads = Math.max(...sourceStats.map(s => parseInt(s.total_leads) || 0), 1);

  return (
    <section>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Organization Overview ⚙️</h1>
          <p>Complete business metrics across all teams</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={refresh}>↻ Refresh</button>
          <button className="crm-btn crm-btn-primary">📥 Export Report</button>
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

      {/* Two Column: Sources + Project Inventory */}
      <div className="crm-grid crm-grid-2" style={{ marginBottom: 20 }}>
        {/* Leads by Source */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">📡 Leads by Source</div>
          </div>
          <div className="crm-card-body">
            {sourceStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No source data available</div>
            ) : (
              <div className="mini-bars" style={{ height: 150 }}>
                {sourceStats.map((source, idx) => {
                  const height = Math.round(((parseInt(source.total_leads) || 0) / maxSourceLeads) * 100);
                  return (
                    <div className="mini-bar-item" key={source.source_name}>
                      <div className="mini-bar-val">{source.total_leads}</div>
                      <div className="mini-bar" style={{ height: `${Math.max(height, 8)}%`, background: source.color_code || sourceColors[idx % sourceColors.length] }}></div>
                      <div className="mini-bar-lbl">{source.source_name}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Project Inventory */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">🏗️ Project Inventory</div>
          </div>
          <div className="crm-card-body">
            {(adminStats?.projectInventory || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No project data available</div>
            ) : (
              (adminStats?.projectInventory || []).map((project) => {
                const total = parseInt(project.total_units) || 0;
                const available = parseInt(project.available_units) || 0;
                const sold = total - available;
                const pct = total > 0 ? Math.round((sold / total) * 100) : 0;
                const progressClass = pct >= 60 ? 'progress-green' : pct >= 30 ? 'progress-blue' : 'progress-yellow';

                return (
                  <div className="project-row" key={project.id}>
                    <div className="project-info">
                      <span className="project-name">{project.project_name}</span>
                      <span className="project-stat">{sold}/{total} sold · {formatCurrency(project.revenue || 0)}</span>
                    </div>
                    <div className={`crm-progress ${progressClass}`}>
                      <div className="crm-progress-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Workspace Links */}
      {workspaceLinks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>🎯 Role Workspaces</h2>
          <div className="crm-grid" style={{ gridTemplateColumns: `repeat(${Math.min(workspaceLinks.length, 4)}, 1fr)` }}>
            {workspaceLinks.map((link) => (
              <Link key={link.path} to={link.path} className="admin-workspace-card">
                <span className="admin-workspace-card__icon">{link.icon}</span>
                <div>
                  <div className="admin-workspace-card__name">{link.label}</div>
                  <div className="admin-workspace-card__desc">{link.desc}</div>
                </div>
                <span className="admin-workspace-card__arrow">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Admin Links */}
      {['SA', 'ADM'].includes(roleCode) && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>⚙️ Configuration</h2>
          <div className="crm-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {quickLinks.map((link) => (
              <Link key={link.path} to={link.path} className="admin-config-card">
                <span className="admin-config-card__icon">{link.icon}</span>
                <span className="admin-config-card__label">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Two Column: User Distribution + Activity */}
      <div className="crm-grid crm-grid-2">
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">👥 User Distribution</div>
          </div>
          <div className="crm-card-body">
            {(stats?.userDistribution || []).map((item) => (
              <div key={item.short_code} className="admin-dist-row">
                <div className="admin-dist-row__info">
                  <div className="crm-avatar crm-avatar-sm crm-avatar-blue">{item.short_code}</div>
                  <span>{item.type_name}</span>
                </div>
                <span className="crm-badge badge-contacted">{item.count}</span>
              </div>
            ))}
            {(!stats?.userDistribution || stats.userDistribution.length === 0) && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No data</div>
            )}
          </div>
        </div>

        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">📜 Recent Activity</div>
          </div>
          <div className="crm-card-body-flush">
            {(stats?.recentActivity || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No recent activity</div>
            )}
            {(stats?.recentActivity || []).map((item) => (
              <div className="followup-item" key={item.id}>
                <div className="crm-avatar crm-avatar-sm crm-avatar-purple">
                  {(item.action || '').substring(0, 2).toUpperCase()}
                </div>
                <div className="followup-content">
                  <div className="followup-name">{item.action}</div>
                  <div className="followup-meta">
                    <span>{item.table_name}</span>
                    <span>{item.user?.first_name || 'System'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
