import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import dashboardApi from '../../api/dashboardApi';
import TaskDashboardWidget from '../tasks/TaskDashboardWidget';
import { getRoleCode, hasTaskPortalAccess } from '../../utils/permissions';
import ViewAsPicker from '../../components/common/ViewAsPicker';
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
  CalculatorIcon,
  ArchiveBoxIcon,
  ShieldCheckIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import '../portals/collection/CollectionWorkspace.css';
import './Dashboard.css';

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
  // Which Role Workspaces card was clicked - drives the "view as" picker.
  // Declared with the other hooks: the loading guard below is an early return.
  const [viewAsTarget, setViewAsTarget] = useState(null);
  const user = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(user);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, adminResp] = await Promise.all([
        dashboardApi.getStats().catch(() => null),
        dashboardApi.getAdminStats().catch(() => null),
      ]);
      // Both endpoints return successResponse: { success, message, data }.
      // Be tolerant of either the wrapped body or a bare object.
      setStats(statsResp?.data ?? statsResp ?? null);
      setAdminStats(adminResp?.data ?? adminResp ?? null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="simple-loader">
        <div className="simple-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const userDistribution = stats?.userDistribution || [];
  const recentActivity = stats?.recentActivity || [];
  const sourceStats = adminStats?.sourceStats || [];
  const maxSourceLeads = Math.max(...sourceStats.map((s) => parseInt(s.total_leads, 10) || 0), 1);
  const sourceColors = ['#ea580c', '#2563eb', '#d97706', '#16a34a', '#7c3aed', '#0891b2', '#db2777'];

  const statCards = [
    {
      label: 'Total Leads',
      value: adminStats?.totalLeads ?? 0,
      sub: `+${adminStats?.thisMonthLeads ?? 0} this month`,
      icon: UsersIcon,
      variant: 'info',
    },
    {
      label: 'Total Bookings',
      value: adminStats?.totalBookings ?? 0,
      sub: 'active bookings',
      icon: ClipboardDocumentListIcon,
      variant: 'success',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(adminStats?.totalRevenue ?? 0),
      sub: 'collected payments',
      icon: BanknotesIcon,
      variant: 'warning',
    },
    {
      label: 'Active Users',
      value: adminStats?.activeUsers ?? stats?.masters?.activeUsers ?? 0,
      sub: userDistribution.map((u) => `${u.count} ${u.short_code}`).join(' · ') || 'team members',
      icon: ComputerDesktopIcon,
      variant: 'purple',
    },
    {
      label: 'Conversion Rate',
      value: `${adminStats?.conversionRate ?? 0}%`,
      sub: 'lead to booking',
      icon: ChartBarIcon,
      variant: 'info',
    },
  ];

  // `role` is what a Super Admin / Admin opens a person's portal AS. Every entry
  // here has a matching RoleRoute in AppRoutes that already admits SA/ADM.
  const workspaceLinks = [
    { label: 'Telecaller Workspace', role: 'TC', roleName: 'Telecaller', path: '/telecaller/leads', icon: <PhoneIcon style={ICON_SM} />, desc: 'Manage telecaller leads', allowed: ['TC', 'SA', 'ADM'] },
    { label: 'Sales Manager Workspace', role: 'SM', roleName: 'Sales Manager', path: '/sales-manager/leads', icon: <BuildingOfficeIcon style={ICON_SM} />, desc: 'Site visits & leads', allowed: ['SM', 'SH', 'SA', 'ADM'] },
    { label: 'Sales Head Workspace', role: 'SH', roleName: 'Sales Head', path: '/sales-head/leads', icon: <BriefcaseIcon style={ICON_SM} />, desc: 'Negotiations & bookings', allowed: ['SH', 'SA', 'ADM'] },
    { label: 'Collection Workspace', role: 'COL', roleName: 'Collection', path: '/collection/leads', icon: <CurrencyRupeeIcon style={ICON_SM} />, desc: 'Payment tracking', allowed: ['COL', 'SA', 'ADM'] },
    { label: 'Accounts Workspace', role: 'ACCT', roleName: 'Accounts Executive', path: '/accounts/dashboard', icon: <CalculatorIcon style={ICON_SM} />, desc: 'Payment verification', allowed: ['ACCT', 'SA', 'ADM'] },
    { label: 'Accounts Manager Workspace', role: 'AM', roleName: 'Accounts Manager', path: '/accounts-manager/verify', icon: <ShieldCheckIcon style={ICON_SM} />, desc: 'Cash verification', allowed: ['AM', 'SA', 'ADM'] },
    { label: 'Collection Exec Workspace', role: 'CE', roleName: 'Collection Executive', path: '/collection-exec/bookings', icon: <CreditCardIcon style={ICON_SM} />, desc: 'Assigned bookings', allowed: ['CE', 'SA', 'ADM'] },
    { label: 'Record Manager Workspace', role: 'RM', roleName: 'Record Manager', path: '/record-manager/bookings', icon: <ArchiveBoxIcon style={ICON_SM} />, desc: 'Registered bookings', allowed: ['RM', 'SA', 'ADM'] },
  ].filter((item) => item.allowed.includes(roleCode));

  // SA/ADM pick a person first and land in that person's portal read-only.
  // Everyone else keeps the plain link straight into their own workspace.
  const canViewAs = ['SA', 'ADM'].includes(roleCode);

  const quickLinks = [
    { label: 'Users', path: '/super-admin/users', icon: <UsersIcon style={ICON_SM} /> },
    { label: 'Projects', path: '/super-admin/projects', icon: <BuildingStorefrontIcon style={ICON_SM} /> },
    { label: 'Locations', path: '/super-admin/locations', icon: <MapPinIcon style={ICON_SM} /> },
    { label: 'Lead Sources', path: '/super-admin/lead-sources', icon: <SignalIcon style={ICON_SM} /> },
    { label: 'Inventory', path: '/super-admin/inventory', icon: <BuildingOfficeIcon style={ICON_SM} /> },
    { label: 'Workflow', path: '/super-admin/workflow-actions', icon: <AdjustmentsHorizontalIcon style={ICON_SM} /> },
  ];

  return (
    <div className="col-dashboard">
      {/* ── Page Header ── */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>{getGreeting()}, {user?.first_name || 'Admin'}</h1>
          <p>Here's your organization overview for today. Stay on top of your metrics.</p>
        </div>
        <div className="col-page-header-actions">
          <button type="button" className="col-btn col-btn-ghost" onClick={load}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
          <button type="button" className="col-btn col-btn-primary">
            <ArrowDownTrayIcon style={{ width: 16, height: 16 }} /> Export
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="col-stat-grid-new">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className={`col-stat-card-new ${card.variant}`} key={card.label}>
              <div className="col-stat-label-new">{card.label}</div>
              <div className="col-stat-value-new">{card.value}</div>
              <div className="col-stat-sub-new">{card.sub}</div>
              <div className="col-stat-icon-new">
                <Icon style={{ width: 24, height: 24 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Leads by Source (full-width row) ── */}
      <div className="col-card-new">
        <div className="col-card-header-new">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SignalIcon style={{ width: 20, height: 20, color: 'var(--accent-blue)' }} />
            <div>
              <div className="col-card-title-new">Leads by Source</div>
              <div className="col-card-subtitle-new">Where your leads come from</div>
            </div>
          </div>
        </div>
        <div className="col-card-body-new">
          {sourceStats.length === 0 ? (
            <div className="col-empty-mini">
              <SignalIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <span>No source data available</span>
            </div>
          ) : (
            <div className="src-bars">
              {sourceStats.map((source, idx) => {
                const val = parseInt(source.total_leads, 10) || 0;
                const pct = Math.round((val / maxSourceLeads) * 100);
                const color = source.color_code || sourceColors[idx % sourceColors.length];
                return (
                  <div className="src-bar-row" key={source.source_name}>
                    <div className="src-bar-name" title={source.source_name}>{source.source_name}</div>
                    <div className="src-bar-track">
                      <div className="src-bar-fill" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
                    </div>
                    <div className="src-bar-val">{val.toLocaleString('en-IN')}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Role Workspaces ── */}
      {workspaceLinks.length > 0 && (
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BriefcaseIcon style={{ width: 20, height: 20, color: 'var(--accent-blue)' }} />
              <div>
                <div className="col-card-title-new">Role Workspaces</div>
                <div className="col-card-subtitle-new">
                  {canViewAs ? "Open a team member's portal, read-only" : "Jump into a team's pipeline"}
                </div>
              </div>
            </div>
          </div>
          <div className="col-card-body-new">
            <div className="crm-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {workspaceLinks.map((link) => (canViewAs ? (
                <button
                  key={link.path}
                  type="button"
                  className="admin-workspace-card"
                  onClick={() => setViewAsTarget(link)}
                >
                  <span className="admin-workspace-card__icon">{link.icon}</span>
                  <div>
                    <div className="admin-workspace-card__name">{link.label}</div>
                    <div className="admin-workspace-card__desc">{link.desc}</div>
                  </div>
                  <span className="admin-workspace-card__arrow">→</span>
                </button>
              ) : (
                <Link key={link.path} to={link.path} className="admin-workspace-card">
                  <span className="admin-workspace-card__icon">{link.icon}</span>
                  <div>
                    <div className="admin-workspace-card__name">{link.label}</div>
                    <div className="admin-workspace-card__desc">{link.desc}</div>
                  </div>
                  <span className="admin-workspace-card__arrow">→</span>
                </Link>
              )))}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Access ── */}
      {['SA', 'ADM'].includes(roleCode) && (
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cog6ToothIcon style={{ width: 20, height: 20, color: 'var(--accent-purple)' }} />
              <div>
                <div className="col-card-title-new">Quick Access</div>
                <div className="col-card-subtitle-new">Manage master configuration</div>
              </div>
            </div>
          </div>
          <div className="col-card-body-new">
            <div className="crm-grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.path} to={link.path} className="admin-config-card">
                  <span className="admin-config-card__icon">{link.icon}</span>
                  <span className="admin-config-card__label">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── User Distribution + Recent Activity ── */}
      <div className="col-two-col-new">
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserGroupIcon style={{ width: 20, height: 20, color: 'var(--accent-purple)' }} />
              <div>
                <div className="col-card-title-new">User Distribution</div>
                <div className="col-card-subtitle-new">Team members by role</div>
              </div>
            </div>
          </div>
          <div className="col-card-body-flush-new">
            {userDistribution.length === 0 ? (
              <div className="col-empty-mini">
                <UserGroupIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No users found</span>
              </div>
            ) : (
              <table className="col-table-new">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Users</th>
                  </tr>
                </thead>
                <tbody>
                  {userDistribution.map((item) => (
                    <tr key={item.short_code}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="crm-avatar crm-avatar-sm crm-avatar-blue">{item.short_code}</div>
                          <span className="col-cell-primary">{item.type_name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="col-badge-new col-badge-pending">{item.count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DocumentTextIcon style={{ width: 20, height: 20, color: 'var(--accent-green)' }} />
              <div>
                <div className="col-card-title-new">Recent Activity</div>
                <div className="col-card-subtitle-new">Latest system events</div>
              </div>
            </div>
          </div>
          <div className="col-card-body-flush-new">
            {recentActivity.length === 0 ? (
              <div className="col-empty-mini">
                <DocumentTextIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No recent activity</span>
              </div>
            ) : (
              <div className="col-table-scroll-y">
                <table className="col-table-new">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Module</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="crm-avatar crm-avatar-sm crm-avatar-purple">
                              {(item.action || '').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="col-cell-primary">{item.action}</span>
                          </div>
                        </td>
                        <td><span className="col-cell-secondary">{item.table_name || '-'}</span></td>
                        <td>{item.user?.first_name || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tasks (task-portal users) ── */}
      {hasTaskPortalAccess(user) && (
        <TaskDashboardWidget onOpenTasks={() => navigate('/super-admin/tasks')} />
      )}

      <ViewAsPicker
        open={Boolean(viewAsTarget)}
        roleCode={viewAsTarget?.role}
        roleName={viewAsTarget?.roleName}
        landingPath={viewAsTarget?.path}
        onClose={() => setViewAsTarget(null)}
      />
    </div>
  );
};

export default Dashboard;
