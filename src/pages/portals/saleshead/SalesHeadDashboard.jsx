import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  HandRaisedIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { Avatar, StatusChip, leadName } from '../common/dashWidgets';

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
    { label: 'Under Negotiation', value: stats?.inNegotiation ?? 0, valueColor: 'var(--accent-purple)' },
    { label: 'Hot Negotiations', value: stats?.hotNegotiations ?? 0, valueColor: 'var(--accent-red)' },
    { label: 'Warm Negotiations', value: stats?.warmNegotiations ?? 0, valueColor: 'var(--accent-yellow)' },
    { label: 'Follow Up', value: stats?.followUpCount ?? 0, valueColor: 'var(--accent-blue)' },
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
      <div className="stat-bar">
        {statCards.map((card) => (
          <div className="stat" key={card.label}>
            <div className="stat-label">{card.label}</div>
            <div className="stat-val" style={card.valueColor ? { color: card.valueColor } : {}}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        {/* Negotiation Leads Today */}
        <div className="dash-widget">
          <div className="dash-widget-head">
            <div className="dash-widget-title"><HandRaisedIcon /> Negotiation Leads Today</div>
            <div className="dash-widget-actions">
              <span className="dash-count">{stats?.negotiationLeads?.length ?? 0}</span>
            </div>
          </div>
          <div className="dash-widget-body">
            {(!stats?.negotiationLeads || stats.negotiationLeads.length === 0) ? (
              <div className="dash-empty">No leads in negotiation today.</div>
            ) : (
              stats.negotiationLeads.map((lead) => (
                <div key={lead.id} className="dash-row" onClick={() => lead?.id && navigate(`/portal/lead/${lead.id}`)}>
                  <Avatar name={leadName(lead)} color={lead.statusColor} />
                  <div className="dash-main">
                    <div className="dash-name">{leadName(lead)}</div>
                    <div className="dash-meta">
                      {lead.lead_number && <span className="dash-meta-item">{lead.lead_number}</span>}
                      <span className="dash-meta-item"><MapPinIcon /> {lead.projectName || '-'}</span>
                      {lead.customerType && <span className="dash-chip" style={{ background: 'var(--accent-green-bg)', color: 'var(--accent-green)' }}>{lead.customerType}</span>}
                      {lead.motivationType && <span className="dash-chip" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>{lead.motivationType}</span>}
                    </div>
                  </div>
                  <div className="dash-right">
                    <StatusChip name={lead.statusName} color={lead.statusColor} />
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={(e) => { e.stopPropagation(); lead?.id && navigate(`/portal/lead/${lead.id}`); }}>View</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Latest Bookings */}
        <div className="dash-widget">
          <div className="dash-widget-head">
            <div className="dash-widget-title"><DocumentTextIcon /> Latest Bookings</div>
            <div className="dash-widget-actions">
              <span className="dash-count">{stats?.latestBookings?.length ?? 0}</span>
            </div>
          </div>
          <div className="dash-widget-body">
            {(!stats?.latestBookings || stats.latestBookings.length === 0) ? (
              <div className="dash-empty">No recent bookings found.</div>
            ) : (
              stats.latestBookings.map((booking) => (
                <div key={booking.id} className="dash-row" onClick={() => onNavigate('BOOKINGS', { selectedId: booking.id })}>
                  <Avatar name={booking.customer_name} color="#22c55e" />
                  <div className="dash-main">
                    <div className="dash-name">{booking.customer_name}</div>
                    <div className="dash-meta">
                      {booking.booking_number && <span className="dash-meta-item">{booking.booking_number}</span>}
                      <span className="dash-meta-item"><MapPinIcon /> {booking.project_name || '-'}</span>
                    </div>
                  </div>
                  <div className="dash-right">
                    <div className="dash-due">
                      <span className="dash-due-label">Net value</span>
                      <span className="dash-due-val" style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent-green)' }}>{formatCurrency(booking.net_amount)}</span>
                    </div>
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={(e) => { e.stopPropagation(); onNavigate('BOOKINGS', { selectedId: booking.id }); }}>Details</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesHeadDashboard;
