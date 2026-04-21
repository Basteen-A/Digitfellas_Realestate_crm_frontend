import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  HandRaisedIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  UsersIcon,
  ClockIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const ICON_SIZE = { width: 22, height: 22 };

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
    { label: 'In Negotiation', value: stats?.inNegotiation ?? 0, icon: <HandRaisedIcon style={ICON_SIZE} />, iconBg: 'var(--accent-purple-bg)', iconColor: 'var(--accent-purple)', valueColor: 'var(--accent-purple)', change: `₹${((stats?.pipelineValue || 0) / 10000000).toFixed(1)} Cr pipeline`, changeType: 'neutral' },
    { label: 'Bookings', value: stats?.totalBookings ?? 0, icon: <ClipboardDocumentListIcon style={ICON_SIZE} />, iconBg: 'var(--accent-green-bg)', iconColor: 'var(--accent-green)', valueColor: 'var(--accent-green)', change: `₹${((stats?.bookedValue || 0) / 10000000).toFixed(1)} Cr booked`, changeType: 'up' },
    { label: 'All Leads', value: stats?.allLeads ?? 0, icon: <UsersIcon style={ICON_SIZE} />, iconBg: 'var(--accent-blue-bg)', iconColor: 'var(--accent-blue)', change: 'Across pipeline', changeType: 'neutral' },
  ];

  return (
    <div className="crm-dashboard">
      <div className="page-header flex items-center justify-between">
        <div className="page-header-left">
          <h1>Sales Overview</h1>
          <p>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Performance</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-primary" onClick={load}><ArrowPathIcon style={{ width: 16, height: 16, marginRight: 6 }} /> Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Negotiation Leads Today */}
        <div className="col-container">
          <div className="col-header">
            <h3><HandRaisedIcon style={{ width: 18, height: 18, marginRight: 8 }} /> Negotiation Leads Today (Latest 10)</h3>
          </div>
          <div className="col-card" style={{ padding: 0 }}>
            {(!stats?.negotiationLeads || stats.negotiationLeads.length === 0) ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No leads in negotiation today.</div>
            ) : (
              <table className="col-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.negotiationLeads.map(lead => (
                    <tr key={lead.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{lead.fullName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.lead_number}</div>
                      </td>
                      <td>{lead.projectName}</td>
                      <td>
                        <span className="col-badge" style={{ background: `${lead.statusColor}22`, color: lead.statusColor }}>
                          {lead.statusName}
                        </span>
                      </td>
                      <td>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate('LEAD_DETAILS', { leadId: lead.id })}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Latest Bookings */}
        <div className="col-container">
          <div className="col-header">
            <h3><DocumentTextIcon style={{ width: 18, height: 18, marginRight: 8 }} /> Latest 10 Bookings</h3>
          </div>
          <div className="col-card" style={{ padding: 0 }}>
            {(!stats?.latestBookings || stats.latestBookings.length === 0) ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No recent bookings found.</div>
            ) : (
              <table className="col-table">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Project</th>
                    <th>Net Value</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.latestBookings.map(booking => (
                    <tr key={booking.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{booking.customer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{booking.booking_number}</div>
                      </td>
                      <td>{booking.project_name}</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{formatCurrency(booking.net_amount)}</td>
                      <td>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate('BOOKINGS', { selectedId: booking.id })}>Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesHeadDashboard;
