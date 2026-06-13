import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDate } from '../../../utils/formatters';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import {
  HomeModernIcon,
  ChartBarIcon,
  ArrowPathIcon,
 
  PhoneIcon,
  XCircleIcon,
  InboxArrowDownIcon,
  UserGroupIcon,
  CubeIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { StatusChip, leadName, leadPhone, callLead, useIsMobile } from '../common/dashWidgets';
import { hasTaskPortalAccess } from '../../../utils/permissions';
import { TaskDashboardWidget } from '../../tasks';
import { SalesManagerLeaderboardCard } from '../common/LeaderboardCard';
import '../collection/CollectionWorkspace.css';

const DATE_FILTER_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
];

const SalesManagerDashboard = ({ user, onNavigate }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState(null);
  const [incomingPendingCount, setIncomingPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [missedFollowUps, setMissedFollowUps] = useState([]);

  // Date filter state
  const [dateFilter, setDateFilter] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const load = useCallback(async (filterOverride, startOverride, endOverride) => {
    setLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const f = filterOverride || dateFilter;
      const params = { dateFilter: f };
      const sDate = startOverride !== undefined ? startOverride : customStartDate;
      const eDate = endOverride !== undefined ? endOverride : customEndDate;

      if (f === 'custom') {
        if (!sDate || !eDate) {
          setLoading(false);
          return;
        }
        params.startDate = sDate;
        params.endDate = eDate;
      }

      const [statsResp, handoffsResp] = await Promise.all([
        dashboardApi.getSalesManagerStats(params).catch(() => ({ data: {} })),
        leadWorkflowApi.getHandoffs({
          type: 'incoming',
          stageCode: 'SITE_VISIT',
          statusCode: 'SV_DONE',
          currentOnly: true,
          pendingAcceptance: true,
          limit: 100,
        }).catch(() => ({ data: [], meta: { total: 0 } })),
      ]);

      const dashData = statsResp?.data || {};
      setStats(dashData);

      const incomingTotal = Number(dashData?.incomingLeads ?? 0);
      const resolvedPending = Number(
        handoffsResp?.meta?.total ?? (Array.isArray(handoffsResp?.data) ? handoffsResp.data.length : 0)
      );
      setIncomingPendingCount(Number.isFinite(resolvedPending) ? resolvedPending : incomingTotal);

      // Try dedicated follow-up arrays from dashboard stats first
      if (Array.isArray(dashData.todaysFollowUpLeads)) setTodayFollowUps(dashData.todaysFollowUpLeads);
      if (Array.isArray(dashData.missedFollowUpLeads)) setMissedFollowUps(dashData.missedFollowUpLeads);

      // FALLBACK: If lists are empty or stats fetch failed, fetch lists explicitly
      if (!dashData.todaysFollowUpLeads && !dashData.missedFollowUpLeads) {
        console.warn('[SM Dashboard] Backend lists missing, triggering fallback fetch...');
        const extractLeads = (resp) => {
          if (Array.isArray(resp?.data)) return resp.data;
          if (Array.isArray(resp?.data?.data)) return resp.data.data;
          if (Array.isArray(resp?.data?.rows)) return resp.data.rows;
          return [];
        };
        const [todayFuResp, missedFuResp] = await Promise.all([
          leadWorkflowApi.getLeads({
            roleCode: 'SM',
            assignedToMe: true,
            nextFollowUpFrom: startOfDay.toISOString(),
            nextFollowUpTo: endOfDay.toISOString(),
            includeClosed: false,
            limit: 50,
          }).catch(() => ({ data: [] })),
          leadWorkflowApi.getLeads({
            roleCode: 'SM',
            assignedToMe: true,
            nextFollowUpTo: new Date(startOfDay.getTime() - 1).toISOString(),
            includeClosed: false,
            limit: 50,
          }).catch(() => ({ data: [] })),
        ]);
        setTodayFollowUps(extractLeads(todayFuResp));
        setMissedFollowUps(extractLeads(missedFuResp));
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilterChange = (val) => {
    setDateFilter(val);
    if (val !== 'custom') {
      load(val);
    }
  };

  const handleApplyCustom = () => {
    if (customStartDate && customEndDate) {
      load('custom', customStartDate, customEndDate);
    }
  };

  if (loading) {
    return (
      <div className="simple-loader">
        <div className="simple-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  // On mobile, tapping a lead row dials the lead instead of opening the detail page.
  const handleLeadRowClick = (lead) => {
    const phone = leadPhone(lead);
    if (isMobile && phone) { callLead(phone); return; }
    if (lead?.id) navigate(`/portal/lead/${lead.id}`);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = user?.first_name || user?.firstName || '';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Format sqft nicely
  const formatSqft = (val) => {
    if (!val || val === 0) return '0';
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toFixed(0);
  };

  // Calculate follow-up counts from available data
  const followUpCounts = {
    today: todayFollowUps.length,
    missed: missedFollowUps.length,
    dueToday: stats?.dueToday ?? 0,
    overdue: stats?.overdueActions ?? 0,
    total: (todayFollowUps.length || 0) + (missedFollowUps.length || 0),
  };

  const kpiCards = [
    { label: 'Total Active Site Visits', value: stats?.svScheduled ?? stats?.todaysVisits ?? 0, sub: `${stats?.visitsDone ?? stats?.svCompleted ?? 0} completed`, icon: HomeModernIcon, variant: 'info' },
    { label: 'Booked Leads', value: stats?.bookedLeads ?? 0, sub: 'booked customers', icon: UserGroupIcon, variant: 'success' },
    { label: 'Under Negotiations', value: stats?.negotiations ?? 0, sub: 'in negotiation', icon: ChartBarIcon, variant: '' },
    { label: 'Awaiting Revisits', value: stats?.revisits ?? 0, sub: 'pending revisit', icon: ArrowPathIcon, variant: 'warning' },
    { label: 'Follow Up', value: followUpCounts.total, sub: `${followUpCounts.today} today · ${followUpCounts.missed} missed · ${followUpCounts.dueToday || followUpCounts.overdue} overdue`, icon: PhoneIcon, variant: 'success' },
    { label: 'Booking Sq Ft', value: formatSqft(stats?.bookingSqft ?? 0), sub: 'total booked area', icon: CubeIcon, variant: 'info' },
  ];

  const renderFollowUpTable = (rows, { dueLabel, overdue }) => (
    <div className="col-table-scroll-y"><table className="col-table-new">
      <thead>
        <tr>
          <th>Lead</th>
          <th>Project</th>
          <th>{dueLabel}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 10).map((lead) => {
          const due = lead.nextFollowUpDate || lead.nextFollowUpAt || lead.next_follow_up_date || lead.scheduled_at || lead.updated_at;
          return (
            <tr key={lead.id} className="col-clickable-row" onClick={() => handleLeadRowClick(lead)}>
              <td>
                <div className="col-cell-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {leadName(lead)} <StatusChip name={lead.statusName} color={lead.statusColor} />
                </div>
                <div className="col-cell-secondary">{lead.phone || '—'}</div>
              </td>
              <td>{lead.projectName || lead.project || '—'}</td>
              <td style={overdue ? { color: 'var(--accent-red)', fontWeight: 600 } : undefined}>{due ? formatDate(due) : '—'}</td>
              <td>
                <button className="col-btn col-btn-ghost col-btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/portal/lead/${lead.id}`); }}>
                  View
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );

  return (
    <div className="col-dashboard">
      {/* Page Header */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>{greeting}{firstName ? `, ${firstName}` : ''}</h1>
          <p>Here's your sales overview for today — {today}</p>
        </div>
        <div className="col-page-header-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={() => load()}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
          <button className="col-btn col-btn-primary" onClick={() => onNavigate?.('leads')}>
            My Leads →
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="col-date-filter-bar" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        background: 'var(--card-bg, #fff)',
        borderRadius: 12,
        border: '1px solid var(--border-light, #e5e7eb)',
        marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        <CalendarDaysIcon style={{ width: 20, height: 20, color: 'var(--accent-blue)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary, #64748b)', marginRight: 4 }}>Filter:</span>
        {DATE_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleFilterChange(opt.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: dateFilter === opt.value ? '1.5px solid var(--accent-blue, #3b82f6)' : '1px solid var(--border-light, #e5e7eb)',
              background: dateFilter === opt.value ? 'var(--accent-blue-light, #eff6ff)' : 'transparent',
              color: dateFilter === opt.value ? 'var(--accent-blue, #3b82f6)' : 'var(--text-primary, #1e293b)',
              fontWeight: dateFilter === opt.value ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        ))}
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              style={{
                padding: '5px 10px',
                border: '1px solid var(--border-light, #e5e7eb)',
                borderRadius: 8,
                fontSize: 13,
                background: 'var(--input-bg, #fff)',
                color: 'var(--text-primary)',
              }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              style={{
                padding: '5px 10px',
                border: '1px solid var(--border-light, #e5e7eb)',
                borderRadius: 8,
                fontSize: 13,
                background: 'var(--input-bg, #fff)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={handleApplyCustom}
              disabled={!customStartDate || !customEndDate}
              className="crm-btn crm-btn-primary crm-btn-sm"
              style={{ fontSize: 11, padding: '4px 12px', height: 'fit-content' }}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Handoff Banner */}
      {incomingPendingCount > 0 && (
        <div className="handoff-banner" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}>
          <div className="handoff-banner-icon" style={{ fontSize: 24 }}><InboxArrowDownIcon style={{ width: 28, height: 28 }} /></div>
          <div className="handoff-banner-text">
            <div className="handoff-banner-title" style={{ color: '#92400e', fontWeight: 700 }}>{incomingPendingCount} incoming lead{incomingPendingCount > 1 ? 's' : ''} awaiting your review</div>
            <div className="handoff-banner-desc" style={{ color: '#b45309' }}>Leads handed off from telecallers are ready for your action.</div>
          </div>
          <button className="col-btn col-btn-warning col-btn-sm" style={{ fontWeight: 700 }} onClick={() => onNavigate?.('incoming')}>Review Now →</button>
        </div>
      )}

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

      {/* Leaderboard Section */}
      <div className="col-two-col-new" style={{ marginTop: 16 }}>
        <SalesManagerLeaderboardCard user={user} />
      </div>

      {/* Two Column Layout */}
      <div className="col-two-col-new">

        {/* Today's Follow Up */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhoneIcon style={{ width: 20, height: 20, color: 'var(--accent-green)' }} />
              <div>
                <div className="col-card-title-new">Today's Follow Up</div>
                <div className="col-card-subtitle-new">Scheduled for today</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('leads')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {todayFollowUps.length === 0 ? (
              <div className="col-empty-mini">
                <PhoneIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No follow-ups scheduled for today</span>
              </div>
            ) : renderFollowUpTable(todayFollowUps, { dueLabel: 'Follow-up Date', overdue: false })}
          </div>
        </div>

        {/* Missed Follow Up */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircleIcon style={{ width: 20, height: 20, color: 'var(--accent-red)' }} />
              <div>
                <div className="col-card-title-new">Missed Follow Up</div>
                <div className="col-card-subtitle-new">Overdue — needs attention</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate?.('leads')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {missedFollowUps.length === 0 ? (
              <div className="col-empty-mini">
                <XCircleIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No missed follow-ups. Great work!</span>
              </div>
            ) : renderFollowUpTable(missedFollowUps, { dueLabel: 'Follow-up Date', overdue: true })}
          </div>
        </div>
      </div>

      {hasTaskPortalAccess(user) && (
        <TaskDashboardWidget onOpenTasks={() => onNavigate?.('tasks')} />
      )}
    </div>
  );
};

export default SalesManagerDashboard;
