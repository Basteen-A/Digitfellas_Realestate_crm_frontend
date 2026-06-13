import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDate } from '../../../utils/formatters';
import {
  UserPlusIcon,
  UsersIcon,
  PhoneIcon,
  HomeModernIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  PhoneXMarkIcon,
  SignalSlashIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { StatusChip, leadName, leadPhone, callLead, useIsMobile } from '../common/dashWidgets';
import { hasTaskPortalAccess } from '../../../utils/permissions';
import { TaskDashboardWidget } from '../../tasks';
import { TelecallerLeaderboardCard } from '../common/LeaderboardCard';
import '../collection/CollectionWorkspace.css';

const TelecallerDashboard = ({ user, onNavigate }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [unassignedLeads, setUnassignedLeads] = useState([]);
  const [missedFollowUps, setMissedFollowUps] = useState([]);
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [upcomingVisits, setUpcomingVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Single source of truth: the detailed dashboard endpoint already scopes every
      // list to the logged-in telecaller (assigned_to = req.user.id), so no client-side
      // re-filtering is needed. missedFollowUps shares the exact lead-date definition as
      // the overdueFollowUps stat, so the card count and this list always agree.
      const timezoneOffset = new Date().getTimezoneOffset();
      const resp = await dashboardApi.getTelecallerDetailed({ timezoneOffset });

      const ensureArray = (value) => {
        if (Array.isArray(value)) return value;
        if (value && Array.isArray(value.data)) return value.data;
        if (value && Array.isArray(value.rows)) return value.rows;
        return [];
      };

      const dashboardData = resp?.data?.data || resp?.data || resp || {};

      setStats(dashboardData.stats || null);
      setUnassignedLeads(ensureArray(dashboardData.unassignedLeads));
      setMissedFollowUps(ensureArray(dashboardData.missedFollowUps));
      setTodayFollowUps(ensureArray(dashboardData.todaysFollowUps));
      setUpcomingVisits(ensureArray(dashboardData.upcomingVisits));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update dashboard'));
      // Ensure we have empty arrays on error to avoid map crashes
      setUnassignedLeads([]);
      setMissedFollowUps([]);
      setTodayFollowUps([]);
      setUpcomingVisits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const isMobile = useIsMobile();

  const handleLeadClick = (leadId) => {
    if (!leadId) return;
    navigate(`/portal/lead/${leadId}`);
  };

  // On mobile, tapping a lead row dials the lead instead of opening the detail page.
  const handleLeadRowClick = (lead) => {
    const phone = leadPhone(lead);
    if (isMobile && phone) { callLead(phone); return; }
    handleLeadClick(lead?.id);
  };

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
  const firstName = user?.first_name || user?.firstName || 'User';

  // ── Row 1: Today's Activity KPIs ──
  const primaryCards = [
    { label: "Today's Scheduled", value: stats?.todaysScheduled ?? 0, sub: 'tasks for today', icon: CalendarDaysIcon, variant: 'info' },
    { label: "Today's Follow Ups", value: stats?.todaysPendingFollowUps ?? 0, sub: 'due today', icon: PhoneIcon, variant: 'warning' },
    { label: 'Missed Follow Ups', value: stats?.overdueFollowUps ?? 0, sub: 'overdue', icon: ExclamationTriangleIcon, variant: 'danger' },
    { label: 'Answered Today', value: stats?.answeredToday ?? 0, sub: 'calls answered', icon: CheckCircleIcon, variant: 'success' },
    { label: 'Unanswered Today', value: stats?.unansweredToday ?? 0, sub: 'not reached', icon: PhoneXMarkIcon, variant: 'danger' },
  ];

  // ── Row 2: Pipeline Overview ──
  const secondaryCards = [
    { label: 'Site Visits - Last 7 Days', value: stats?.siteVisitsLast7Days ?? 0, sub: 'recent visits', icon: MapPinIcon, variant: 'info' },
    { label: 'Current Active Leads', value: stats?.activeLeads ?? 0, sub: 'in your pipeline', icon: UsersIcon, variant: '' },
    { label: 'RNR Leads', value: stats?.rnrLeads ?? 0, sub: 'ringing no response', icon: SignalSlashIcon, variant: 'warning' },
    { label: 'Total SV Scheduled', value: stats?.svScheduled ?? 0, sub: 'site visits lined up', icon: HomeModernIcon, variant: 'success' },
  ];

  return (
    <div className="col-dashboard">
      {/* Page Header */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>{greeting}, {firstName}</h1>
          <p>Let's convert some leads today!</p>
        </div>
        <div className="col-page-header-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={loadDashboardData}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
          <button className="col-btn col-btn-primary" onClick={() => onNavigate?.('leads-addnew')}>
            + Add Lead
          </button>
        </div>
      </div>

      {/* Row 1: Today's Activity KPIs */}
      <div className="col-stat-grid-new">
        {primaryCards.map((card) => {
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

      {/* Row 2: Pipeline Overview */}
      <div className="col-stat-grid-new" style={{ marginTop: 0 }}>
        {secondaryCards.map((card) => {
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

      {/* Leaderboard Section */}
      <div className="col-two-col-new" style={{ marginTop: 16 }}>
        <TelecallerLeaderboardCard user={user} />
      </div>

      {/* Two Column Layout */}
      <div className="col-two-col-new">
        {/* New Leads (Unassigned) */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlusIcon style={{ width: 20, height: 20, color: 'var(--accent-blue)' }} />
              <div>
                <div className="col-card-title-new">New Leads (Unassigned)</div>
                <div className="col-card-subtitle-new">Leads waiting in the pool</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('leads')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {unassignedLeads.length === 0 ? (
              <div className="col-empty-mini">
                <UserPlusIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No unassigned leads in the pool</span>
              </div>
            ) : (
              <div className="col-table-scroll-y"><table className="col-table-new">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Phone</th>
                    <th>Follow-up Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedLeads.slice(0, 10).map((lead) => {
                    const due = lead.next_follow_up_date || lead.scheduled_at;
                    return (
                    <tr key={lead.id} className="col-clickable-row" onClick={() => handleLeadRowClick(lead)}>
                      <td>
                        <div className="col-cell-primary">{leadName(lead)}</div>
                        <StatusChip name={lead.statusName} color={lead.statusColor} />
                      </td>
                      <td className="col-cell-mono">{lead.phone || '—'}</td>
                      <td>{due ? formatDate(due) : '—'}</td>
                      <td>
                        <button className="col-btn col-btn-primary col-btn-sm" onClick={(e) => { e.stopPropagation(); handleLeadClick(lead.id); }}>
                          Claim
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
         {/* Missed Follow-ups */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ExclamationTriangleIcon style={{ width: 20, height: 20, color: 'var(--accent-red)' }} />
              <div>
                <div className="col-card-title-new">Missed Follow-ups</div>
                <div className="col-card-subtitle-new">Overdue — needs attention</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('leads', { tab: 'missed' })}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {missedFollowUps.length === 0 ? (
              <div className="col-empty-mini">
                <CheckCircleIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No missed follow-ups. Great work!</span>
              </div>
            ) : (
              <div className="col-table-scroll-y"><table className="col-table-new">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Phone</th>
                    <th>Follow-Up Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {missedFollowUps.slice(0, 10).map((fu) => {
                    const due = fu.next_follow_up_date || fu.scheduled_at || fu.updated_at;
                    return (
                      <tr key={fu.id} className="col-clickable-row" onClick={() => handleLeadRowClick(fu)}>
                        <td>
                          <div className="col-cell-primary">{leadName(fu)}</div>
                          {fu.statusName && <div className="col-cell-secondary"><StatusChip name={fu.statusName} color={fu.statusColor} /></div>}
                        </td>
                        <td className="col-cell-mono">{fu.phone || fu.lead?.phone || '—'}</td>
                        <td>{due ? formatDate(due) : '—'}</td>
                        <td>
                          <button className="col-btn col-btn-success-soft col-btn-sm" disabled={!leadPhone(fu)} onClick={(e) => { e.stopPropagation(); callLead(leadPhone(fu)); }}>
                            <PhoneIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 2 }}/> Call
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        </div>

        {/* Today's Follow-ups */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhoneIcon style={{ width: 20, height: 20, color: 'var(--accent-green)' }} />
              <div>
                <div className="col-card-title-new">Today's Follow-ups</div>
                <div className="col-card-subtitle-new">Scheduled for today</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('leads', { tab: 'today' })}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {todayFollowUps.length === 0 ? (
              <div className="col-empty-mini">
                <PhoneIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No follow-ups scheduled for today</span>
              </div>
            ) : (
              <div className="col-table-scroll-y"><table className="col-table-new">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Phone</th>
                    <th>Follow-Up Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {todayFollowUps.slice(0, 10).map((fu) => {
                    const due = fu.next_follow_up_date || fu.scheduled_at;
                    return (
                      <tr key={fu.id} className="col-clickable-row" onClick={() => handleLeadRowClick(fu)}>
                        <td>
                          <div className="col-cell-primary">{leadName(fu)}</div>
                          {fu.statusName && <div className="col-cell-secondary"><StatusChip name={fu.statusName} color={fu.statusColor} /></div>}
                        </td>
                        <td className="col-cell-mono">{fu.phone || fu.lead?.phone || '—'}</td>
                        <td>{due ? formatDate(due) : '—'}</td>
                        <td>
                          <button className="col-btn col-btn-success-soft col-btn-sm" disabled={!leadPhone(fu)} onClick={(e) => { e.stopPropagation(); callLead(leadPhone(fu)); }}>
                          <PhoneIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }}/>  Call
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        </div>

       

        {/* SV Scheduled */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HomeModernIcon style={{ width: 20, height: 20, color: 'var(--accent-yellow)' }} />
              <div>
                <div className="col-card-title-new">SV Scheduled</div>
                <div className="col-card-subtitle-new">Upcoming site visits</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('handoffs')}>
              Track →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {upcomingVisits.length === 0 ? (
              <div className="col-empty-mini">
                <HomeModernIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No site visits scheduled</span>
              </div>
            ) : (
              <div className="col-table-scroll-y"><table className="col-table-new">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Project</th>
                    <th>Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingVisits.slice(0, 10).map((lead) => (
                    <tr key={lead.id} className="col-clickable-row" onClick={() => handleLeadRowClick(lead)}>
                      <td>
                        <div className="col-cell-primary">{leadName(lead)}</div>
                        <div className="col-cell-secondary">{lead.phone || '—'}</div>
                      </td>
                      <td>{lead.project || '—'}</td>
                      <td>{formatDate(lead.scheduled_at || lead.next_follow_up_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      </div>

      {hasTaskPortalAccess(user) && (
        <TaskDashboardWidget onOpenTasks={() => onNavigate?.('tasks')} />
      )}
    </div>
  );
};

export default TelecallerDashboard;
