import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  HandRaisedIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { StatusChip, leadName } from '../common/dashWidgets';
import '../collection/CollectionWorkspace.css';

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
      <div className="simple-loader">
        <div className="simple-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = user?.first_name || user?.firstName || '';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const kpiCards = [
    { label: 'Under Negotiation', value: stats?.inNegotiation ?? 0, sub: 'in negotiation stage', icon: HandRaisedIcon, variant: '' },
    { label: 'Hot Negotiations', value: stats?.hotNegotiations ?? 0, sub: 'high priority', icon: ExclamationTriangleIcon, variant: 'danger' },
    { label: 'Warm Negotiations', value: stats?.warmNegotiations ?? 0, sub: 'medium priority', icon: ArrowPathIcon, variant: 'warning' },
    { label: 'Follow Up', value: stats?.followUpCount ?? 0, sub: 'today follow-ups', icon: ClipboardDocumentListIcon, variant: 'info' },
  ];

  const negotiationLeads = stats?.negotiationLeads || [];
  const latestBookings = stats?.latestBookings || [];

  return (
    <div className="col-dashboard">
      {/* Page Header */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>{greeting}{firstName ? `, ${firstName}` : ''}</h1>
          <p>Sales overview for today — {today}</p>
        </div>
        <div className="col-page-header-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={load}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="col-stat-grid-new">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className={`col-stat-card-new ${card.variant}`} key={card.label}>
              <div className="col-stat-label-new">{card.label}</div>
              <div className="col-stat-value-new">{card.value}</div>
              <div className="col-stat-sub-new">{card.sub}</div>
              <div className="col-stat-icon-new">
                {Icon ? <Icon style={{ width: 24, height: 24 }} /> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="col-two-col-new">
        {/* Negotiation Leads */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HandRaisedIcon style={{ width: 20, height: 20, color: 'var(--accent-purple)' }} />
              <div>
                <div className="col-card-title-new">Negotiation Leads Today</div>
                <div className="col-card-subtitle-new">Latest leads in negotiation</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('negotiations')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {negotiationLeads.length === 0 ? (
              <div className="col-empty-mini">
                <HandRaisedIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No leads in negotiation today</span>
              </div>
            ) : (
              <div className="col-table-scroll-y"><table className="col-table-new">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {negotiationLeads.slice(0, 10).map((lead) => (
                    <tr key={lead.id} className="col-clickable-row" onClick={() => lead?.id && navigate(`/portal/lead/${lead.id}`)}>
                      <td>
                        <div className="col-cell-primary">{leadName(lead)}</div>
                        {lead.lead_number && <div className="col-cell-secondary col-cell-mono">{lead.lead_number}</div>}
                      </td>
                      <td>{lead.projectName || '—'}</td>
                      <td><StatusChip name={lead.statusName} color={lead.statusColor} /></td>
                      <td>
                        <button className="col-btn col-btn-ghost col-btn-sm" onClick={(e) => { e.stopPropagation(); lead?.id && navigate(`/portal/lead/${lead.id}`); }}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>

        {/* Latest Bookings */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DocumentTextIcon style={{ width: 20, height: 20, color: 'var(--accent-blue)' }} />
              <div>
                <div className="col-card-title-new">Latest Bookings</div>
                <div className="col-card-subtitle-new">Most recent bookings</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('bookings')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {latestBookings.length === 0 ? (
              <div className="col-empty-mini">
                <DocumentTextIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No recent bookings found</span>
              </div>
            ) : (
              <div className="col-table-scroll-y"><table className="col-table-new">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Project</th>
                    <th>Net Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {latestBookings.slice(0, 10).map((booking) => (
                    <tr key={booking.id} className="col-clickable-row" onClick={() => onNavigate('BOOKINGS', { selectedId: booking.id })}>
                      <td>
                        <div className="col-cell-primary">{booking.customer_name}</div>
                        {booking.booking_number && <div className="col-cell-secondary col-cell-mono">{booking.booking_number}</div>}
                      </td>
                      <td>{booking.project_name || '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(booking.net_amount)}</td>
                      <td>
                        <button className="col-btn col-btn-ghost col-btn-sm" onClick={(e) => { e.stopPropagation(); onNavigate('BOOKINGS', { selectedId: booking.id }); }}>
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesHeadDashboard;
