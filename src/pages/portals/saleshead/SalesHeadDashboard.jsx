import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  HandRaisedIcon,
  UsersIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const ICON_SIZE = { width: 22, height: 22 };

const SalesHeadDashboard = ({ user, onNavigate }) => {
  const navigate = useNavigate();
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
    { label: 'Under Negotiation', value: stats?.inNegotiation ?? 0, icon: <HandRaisedIcon style={ICON_SIZE} />, iconBg: 'var(--accent-purple-bg)', iconColor: 'var(--accent-purple)', valueColor: 'var(--accent-purple)', change: 'In negotiation stage', changeType: 'neutral' },
    { label: 'Hot Negotiations', value: stats?.hotNegotiations ?? 0, icon: <UsersIcon style={ICON_SIZE} />, iconBg: 'var(--accent-red-bg)', iconColor: 'var(--accent-red)', valueColor: 'var(--accent-red)', change: 'High priority leads', changeType: 'up' },
    { label: 'Warm Negotiations', value: stats?.warmNegotiations ?? 0, icon: <ArrowPathIcon style={ICON_SIZE} />, iconBg: 'var(--accent-yellow-bg)', iconColor: 'var(--accent-yellow)', valueColor: 'var(--accent-yellow)', change: 'Medium priority leads', changeType: 'neutral' },
    { label: 'Follow Up', value: stats?.followUpCount ?? 0, icon: <DocumentTextIcon style={ICON_SIZE} />, iconBg: 'var(--accent-blue-bg)', iconColor: 'var(--accent-blue)', valueColor: 'var(--accent-blue)', change: 'Pending follow-ups', changeType: 'neutral' },
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
      <div className="stats-grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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

      <div className="crm-grid crm-grid-1 md:crm-grid-2 gap-4">
        {/* Negotiation Leads Today */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><HandRaisedIcon style={{ width: 18, height: 18 }} /> Negotiation Leads Today (Latest 10)</div>
          </div>
          <div className="crm-card-body-flush" style={{ padding: 0 }}>
            {(!stats?.negotiationLeads || stats.negotiationLeads.length === 0) ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No leads in negotiation today.</div>
            ) : (
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Project</th>
                    <th className="hide-tablet">Customer Type</th>
                    <th className="hide-tablet">Motivation</th>
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
                      <td className="hide-tablet">
                        {lead.customerType ? (
                          <span className="col-badge" style={{ background: 'var(--accent-green-bg)', color: 'var(--accent-green)', fontSize: 11 }}>
                            {lead.customerType}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="hide-tablet">
                        {lead.motivationType ? (
                          <span className="col-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontSize: 11 }}>
                            {lead.motivationType}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className="col-badge" style={{ background: `${lead.statusColor}22`, color: lead.statusColor }}>
                          {lead.statusName}
                        </span>
                      </td>
                      <td>
                        <button
                          className="crm-btn crm-btn-ghost crm-btn-sm"
                          onClick={() => {
                            if (!lead?.id) return;
                            navigate(`/portal/lead/${lead.id}`);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Latest Bookings */}
        <div className="crm-card">
          <div className="crm-card-header">
            <div className="crm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><DocumentTextIcon style={{ width: 18, height: 18 }} /> Latest 10 Bookings</div>
          </div>
          <div className="crm-card-body-flush" style={{ padding: 0 }}>
            {(!stats?.latestBookings || stats.latestBookings.length === 0) ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No recent bookings found.</div>
            ) : (
              <table className="crm-table">
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
