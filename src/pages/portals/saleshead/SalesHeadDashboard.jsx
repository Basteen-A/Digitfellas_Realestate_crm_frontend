import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';

const SalesHeadDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await dashboardApi.getSalesHeadStats().catch(() => ({ data: null }));
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
    { label: 'In Negotiation', value: stats?.inNegotiation ?? 0, icon: '🤝', iconBg: 'var(--accent-purple-bg)', iconColor: 'var(--accent-purple)', valueColor: 'var(--accent-purple)', change: `₹${((stats?.pipelineValue || 0) / 10000000).toFixed(1)} Cr pipeline`, changeType: 'neutral' },
    { label: 'Bookings', value: stats?.totalBookings ?? 0, icon: '📋', iconBg: 'var(--accent-green-bg)', iconColor: 'var(--accent-green)', valueColor: 'var(--accent-green)', change: `₹${((stats?.bookedValue || 0) / 10000000).toFixed(1)} Cr booked`, changeType: 'up' },
    { label: 'Revenue Collected', value: formatCurrency(stats?.revenueCollected ?? 0), icon: '💰', iconBg: 'var(--accent-yellow-bg)', iconColor: 'var(--accent-yellow)', valueColor: 'var(--accent-yellow)', change: 'This month', changeType: 'up' },
    { label: 'All Leads', value: stats?.allLeads ?? 0, icon: '👥', iconBg: 'var(--accent-blue-bg)', iconColor: 'var(--accent-blue)', change: 'Across pipeline', changeType: 'neutral' },
    { label: 'Pending Approvals', value: stats?.pendingApprovals ?? 0, icon: '⏳', iconBg: 'var(--accent-red-bg)', iconColor: 'var(--accent-red)', valueColor: 'var(--accent-red)', change: 'Discount requests', changeType: 'neutral' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Sales Overview</h1>
          <p>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Performance</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={load}>📥 Export Report</button>
        </div>
      </div>

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

      {/* Two Column: Negotiations + Bookings */}
      <div className="crm-grid crm-grid-2" style={{ marginBottom: 20 }}>
        {/* Active Negotiations */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">🤝 Active Negotiations</div>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate?.('negotiations')}>View All →</button>
          </div>
          <div className="crm-card-body-flush">
            <div className="followup-item">
              <div className="crm-avatar crm-avatar-sm crm-avatar-orange">VP</div>
              <div className="followup-content">
                <div className="followup-name">Lead in Negotiation <span className="crm-badge badge-hot">🔥 Hot</span></div>
                <div className="followup-note">Discussing pricing and terms</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <button className="crm-btn crm-btn-success crm-btn-xs" style={{ marginTop: 4 }}>📋 Book</button>
              </div>
            </div>
            {(!stats?.inNegotiation || stats.inNegotiation === 0) && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No active negotiations</div>
            )}
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title">📋 Recent Bookings</div>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate?.('bookings')}>View All →</button>
          </div>
          <div className="crm-card-body-flush">
            {(!stats?.totalBookings || stats.totalBookings === 0) && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No bookings yet</div>
            )}
            <div className="followup-item">
              <div className="crm-avatar crm-avatar-sm crm-avatar-blue">BK</div>
              <div className="followup-content">
                <div className="followup-name">Booking Example</div>
                <div className="followup-note">Unit details · Configuration</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="crm-badge badge-won"><span className="crm-badge-dot"></span>Booked</span>
                <div style={{ marginTop: 6, width: 100 }}>
                  <div className="crm-progress progress-green"><div className="crm-progress-fill" style={{ width: '45%' }}></div></div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>45% paid</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Performance Table */}
      <div className="crm-card">
        <div className="crm-card-header">
          <div className="crm-card-title">👔 Team Performance</div>
        </div>
        <div className="crm-card-body-flush">
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Team Member</th><th>Role</th><th>Leads</th><th>Calls</th><th>SV Done</th><th>Visits</th><th>Conversions</th><th>Revenue</th><th>Conv %</th>
                </tr>
              </thead>
              <tbody>
                {(!stats?.teamPerformance || stats.teamPerformance.length === 0) ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No team data available</td></tr>
                ) : (
                  stats.teamPerformance.map((member) => (
                    <tr key={member.user_id}>
                      <td>
                        <div className="cell-lead">
                          <div className="crm-avatar crm-avatar-sm crm-avatar-blue">
                            {(member.full_name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="cell-lead-info"><div className="lead-name">{member.full_name}</div></div>
                        </div>
                      </td>
                      <td>{member.role || member.role_code}</td>
                      <td>{member.total_leads}</td>
                      <td className={member.calls > 200 ? 'text-success fw-700' : ''}>{member.calls || '—'}</td>
                      <td>{member.sv_done || '—'}</td>
                      <td>{member.visits_done || '—'}</td>
                      <td>{member.bookings || '—'}</td>
                      <td className="text-warning fw-700">{formatCurrency(member.revenue || 0)}</td>
                      <td>{member.conv_rate ? `${member.conv_rate}%` : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesHeadDashboard;
