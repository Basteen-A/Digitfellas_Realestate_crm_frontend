import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import dashboardApi from '../../api/dashboardApi';
import { getRoleCode } from '../../utils/permissions';
import { formatCurrency } from '../../utils/formatters';
import {
  UsersIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  ComputerDesktopIcon,
  ChartBarIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  CurrencyRupeeIcon,
  MapPinIcon,
  SignalIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import './Dashboard.css';

const ICON_SIZE = { width: 22, height: 22 };
const ICON_SM = { width: 18, height: 18 };

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(user);

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
    { label: 'Total Leads', value: adminStats?.totalLeads ?? 0, icon: <UsersIcon style={ICON_SIZE} />, iconBg: 'var(--accent-blue-bg)', iconColor: 'var(--accent-blue)', change: `↑ ${adminStats?.thisMonthLeads ?? 0} this month`, changeType: 'up' },
    { label: 'Total Bookings', value: adminStats?.totalBookings ?? 0, icon: <ClipboardDocumentListIcon style={ICON_SIZE} />, iconBg: 'var(--accent-green-bg)', iconColor: 'var(--accent-green)', valueColor: 'var(--accent-green)', change: 'Active bookings', changeType: 'up' },
    { label: 'Total Revenue', value: formatCurrency(adminStats?.totalRevenue ?? 0), icon: <BanknotesIcon style={ICON_SIZE} />, iconBg: 'var(--accent-yellow-bg)', iconColor: 'var(--accent-yellow)', valueColor: 'var(--accent-yellow)', change: 'Collected payments', changeType: 'up' },
    { label: 'Active Users', value: adminStats?.activeUsers ?? stats?.masters?.activeUsers ?? 0, icon: <ComputerDesktopIcon style={ICON_SIZE} />, iconBg: 'var(--accent-purple-bg)', iconColor: 'var(--accent-purple)', change: (stats?.userDistribution || []).map(u => `${u.count} ${u.short_code}`).join(', ') || 'Team members', changeType: 'neutral' },
    { label: 'Conversion Rate', value: `${adminStats?.conversionRate ?? 0}%`, icon: <ChartBarIcon style={ICON_SIZE} />, iconBg: 'var(--accent-cyan-bg)', iconColor: 'var(--accent-cyan)', valueColor: 'var(--accent-cyan)', change: 'Lead to booking', changeType: 'up' },
  ];

  const sourceColors = ['#ea580c', '#2563eb', '#d97706', '#16a34a', '#7c3aed', '#0891b2', '#db2777'];

  const workspaceLinks = [
    { label: 'Telecaller Workspace', path: '/telecaller/leads', icon: <PhoneIcon style={ICON_SM} />, desc: 'Manage telecaller leads', allowed: ['TC', 'SA', 'ADM'] },
    { label: 'Sales Manager Workspace', path: '/sales-manager/leads', icon: <BuildingOfficeIcon style={ICON_SM} />, desc: 'Site visits & leads', allowed: ['SM', 'SH', 'SA', 'ADM'] },
    { label: 'Sales Head Workspace', path: '/sales-head/leads', icon: <BriefcaseIcon style={ICON_SM} />, desc: 'Negotiations & bookings', allowed: ['SH', 'SA', 'ADM'] },
    { label: 'Collection Workspace', path: '/collection/leads', icon: <CurrencyRupeeIcon style={ICON_SM} />, desc: 'Payment tracking', allowed: ['COL', 'SA', 'ADM'] },
  ].filter((item) => item.allowed.includes(roleCode));

  const quickLinks = [
    { label: 'Users', path: '/super-admin/users', icon: <UsersIcon style={ICON_SM} /> },
    { label: 'Projects', path: '/super-admin/projects', icon: <BuildingStorefrontIcon style={ICON_SM} /> },
    { label: 'Locations', path: '/super-admin/locations', icon: <MapPinIcon style={ICON_SM} /> },
    { label: 'Lead Sources', path: '/super-admin/lead-sources', icon: <SignalIcon style={ICON_SM} /> },
    { label: 'Inventory', path: '/super-admin/inventory', icon: <BuildingOfficeIcon style={ICON_SM} /> },
    { label: 'Workflow', path: '/super-admin/workflow-actions', icon: <AdjustmentsHorizontalIcon style={ICON_SM} /> },
  ];

  const sourceStats = adminStats?.sourceStats || [];
  const maxSourceLeads = Math.max(...sourceStats.map(s => parseInt(s.total_leads) || 0), 1);

  return (
    <section>
      {/* Greeting Banner */}
      <div className="dash-greeting">
        <div className="dash-greeting__title">
          {getGreeting()}, {user?.first_name || 'Admin'} 👋
        </div>
        <div className="dash-greeting__sub">
          Here's your organization overview for today. Stay on top of your metrics.
        </div>
      </div>

      {/* Header Actions */}
      <div className="page-header">
        <div className="page-header-left">
          <h1><Cog6ToothIcon style={{ width: 24, height: 24 }} /> Organization Overview</h1>
          <p>Complete business metrics across all teams</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={refresh}><ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh</button>
          <button className="crm-btn crm-btn-primary"><ArrowDownTrayIcon style={{ width: 16, height: 16 }} /> Export</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
      <div className="crm-grid crm-grid-1 md:crm-grid-2 gap-4 mb-5">
        {/* Leads by Source */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title"><SignalIcon style={ICON_SM} /> Leads by Source</div>
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
            <div className="crm-card-title"><BuildingOfficeIcon style={ICON_SM} /> Project Inventory</div>
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
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><BriefcaseIcon style={ICON_SM} /> Role Workspaces</h2>
          <div className="crm-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><Cog6ToothIcon style={ICON_SM} /> Quick Access</h2>
          <div className="crm-grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
      <div className="crm-grid crm-grid-1 md:crm-grid-2 gap-4 mt-4">
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title"><UserGroupIcon style={ICON_SM} /> User Distribution</div>
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
            <div className="crm-card-title"><DocumentTextIcon style={ICON_SM} /> Recent Activity</div>
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
