import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import projectApi from '../../../api/projectApi';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  UserGroupIcon,
  UserIcon,
  BuildingOffice2Icon,
  ClipboardDocumentListIcon,
  HomeModernIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  FunnelIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

/* ─── Filter Presets ─────────────────────────────────────────── */
const DATE_PRESETS = [
  { key: 'all',   label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'wtd',   label: 'Week to Date' },
  { key: 'mtd',   label: 'Month to Date' },
  { key: 'custom', label: 'Custom Range' },
];

/* ─── Unified Filter Bar ────────────────────────────────────────── */
const FilterBar = ({
  activeFilter, onFilterChange,
  customStart, customEnd, onCustomStartChange, onCustomEndChange, onApplyCustom,
  projects, selectedProjectId, onProjectChange
}) => (
  <div style={{
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '12px 16px', background: 'var(--bg-secondary)',
    borderRadius: 12, marginBottom: 20,
    border: '1px solid var(--border-primary)',
  }}>
    {/* Left: Date Presets */}
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <FunnelIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>
        Period:
      </span>
      {DATE_PRESETS.map(p => (
        <button
          key={p.key}
          onClick={() => p.key !== 'custom' ? onFilterChange(p.key) : onFilterChange('custom')}
          style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: activeFilter === p.key ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-primary)',
            background: activeFilter === p.key ? 'var(--accent-blue-bg)' : 'transparent',
            color: activeFilter === p.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
            cursor: 'pointer', transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {p.label}
        </button>
      ))}

      {/* Custom date inputs */}
      {activeFilter === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
          <input
            type="date"
            value={customStart}
            onChange={e => onCustomStartChange(e.target.value)}
            style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 12,
              border: '1px solid var(--border-primary)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => onCustomEndChange(e.target.value)}
            style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 12,
              border: '1px solid var(--border-primary)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <button
            onClick={onApplyCustom}
            disabled={!customStart || !customEnd}
            className="crm-btn crm-btn-primary crm-btn-sm"
            style={{ fontSize: 11, padding: '4px 12px' }}
          >
            Apply
          </button>
        </div>
      )}
    </div>

    {/* Right: Project Dropdown Selector */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <BuildingOffice2Icon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Project:
      </span>
      <select
        value={selectedProjectId}
        onChange={onProjectChange}
        style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: '1px solid var(--border-primary)', background: 'var(--bg-primary)',
          color: 'var(--text-primary)', outline: 'none', cursor: 'pointer',
          minWidth: 160,
        }}
      >
        <option value="">All Projects</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>
            {p.project_name} {p.project_code ? `(${p.project_code})` : ''}
          </option>
        ))}
      </select>
    </div>
  </div>
);

/* ─── Aggregate Card ─────────────────────────────────────────── */
const AggCard = ({ icon, label, value, gradient, shadow }) => (
  <div style={{
    background: gradient, borderRadius: 16, padding: '22px 26px',
    color: '#fff', position: 'relative', overflow: 'hidden',
    boxShadow: `0 10px 20px -4px ${shadow}`,
    transition: 'transform 0.18s ease', cursor: 'default',
    minWidth: 0,
  }}
    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
  >
    {React.cloneElement(icon, {
      style: { position: 'absolute', right: -12, top: -12, width: 85, height: 85, opacity: 0.12 },
    })}
    <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.9, marginBottom: 4, letterSpacing: 0.3 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
  </div>
);

/* ─── Site Row (project-level) ───────────────────────────────── */
const SiteRow = ({ site }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '1fr repeat(3, 100px)',
    alignItems: 'center',
    padding: '10px 16px 10px 56px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
    fontSize: 13,
    transition: 'background 0.15s',
  }}
    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
    onMouseOut={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <BuildingOffice2Icon style={{ width: 15, height: 15, color: 'var(--accent-purple)', flexShrink: 0 }} />
      <span style={{ fontWeight: 600 }}>{site.projectName}</span>
    </div>
    <div style={{ textAlign: 'center' }}>
      <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 12,
        background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 12,
      }}>{site.svDone}</span>
    </div>
    <div style={{ textAlign: 'center' }}>
      <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 12,
        background: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 12,
      }}>{site.bookings}</span>
    </div>
    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>
      {site.totalSqft > 0 ? `${site.totalSqft.toLocaleString()} sq.ft.` : '—'}
    </div>
  </div>
);

/* ─── SM Accordion Row ───────────────────────────────────────── */
const SMRow = ({ sm, isOpen, onToggle }) => {
  const initials = (sm.fullName || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{ borderBottom: '1px solid var(--border-primary)' }}>
      {/* SM Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr repeat(3, 100px)',
          alignItems: 'center',
          padding: '14px 16px',
          cursor: 'pointer',
          background: isOpen ? 'var(--accent-blue-bg)' : 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseOver={e => !isOpen && (e.currentTarget.style.background = 'var(--bg-tertiary)')}
        onMouseOut={e => !isOpen && (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isOpen
            ? <ChevronDownIcon style={{ width: 16, height: 16, color: 'var(--accent-blue)', flexShrink: 0, transition: 'transform 0.2s' }} />
            : <ChevronRightIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0, transition: 'transform 0.2s' }} />
          }
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: sm.roleCode === 'SH'
              ? 'var(--accent-green)'
              : (isOpen ? 'var(--accent-blue)' : 'var(--bg-tertiary)'),
            color: (sm.roleCode === 'SH' || isOpen) ? '#fff' : 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12, flexShrink: 0,
            transition: 'all 0.2s',
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: isOpen ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
              {sm.fullName} {sm.roleCode === 'SH' && <span style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 600 }}>(Self)</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 10 }}>
              <span>{sm.sites.length} site{sm.sites.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{sm.email}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{
            display: 'inline-block', minWidth: 28, padding: '3px 10px', borderRadius: 12,
            background: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 13,
          }}>{sm.svDone}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{
            display: 'inline-block', minWidth: 28, padding: '3px 10px', borderRadius: 12,
            background: '#ede9fe', color: '#7c3aed', fontWeight: 800, fontSize: 13,
          }}>{sm.totalBookings}</span>
        </div>
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, color: 'var(--accent-blue)' }}>
          {sm.totalSqft > 0 ? `${sm.totalSqft.toLocaleString()} sq.ft.` : '—'}
        </div>
      </div>

      {/* Expanded Sites */}
      {isOpen && (
        <div style={{ animation: 'bkSlideDown 0.25s ease-out' }}>
          {sm.sites.length === 0 ? (
            <div style={{ padding: '16px 56px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No site visits or bookings recorded.
            </div>
          ) : (
            sm.sites.map(site => (
              <SiteRow key={site.projectId} site={site} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Helper: format today's date as YYYY-MM-DD ──────────────── */
const toDateStr = (d) => d.toISOString().slice(0, 10);

/* ─── Main Component ─────────────────────────────────────────── */
const SalesHeadBookingSummary = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSMs, setExpandedSMs] = useState(new Set());

  // Date and project filter state
  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(toDateStr(new Date()));
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Fetch projects dropdown options on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const resp = await projectApi.getDropdown();
        setProjects(resp.data || resp || []);
      } catch (err) {
        console.error('Failed to load projects filter dropdown options:', err);
      }
    };
    fetchProjects();
  }, []);

  const load = useCallback(async (filterOverride, projectIdOverride) => {
    setLoading(true);
    const filter = filterOverride || dateFilter;
    const projId = projectIdOverride !== undefined ? projectIdOverride : selectedProjectId;
    try {
      const params = { dateFilter: filter };
      if (filter === 'custom' && customStart && customEnd) {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      if (projId) {
        params.projectId = projId;
      }
      const resp = await dashboardApi.getBookingSummary(params);
      setData(resp.data || resp);
      // Auto-expand all SMs by default if <= 5
      const managers = resp.data?.managers || resp?.managers || [];
      if (managers.length <= 5) {
        setExpandedSMs(new Set(managers.map(m => m.id)));
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load booking summary'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customStart, customEnd, selectedProjectId]);

  useEffect(() => { load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (key) => {
    setDateFilter(key);
    if (key !== 'custom') {
      load(key, selectedProjectId);
    }
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) load('custom', selectedProjectId);
  };

  const handleProjectChange = (e) => {
    const val = e.target.value;
    setSelectedProjectId(val);
    load(dateFilter, val);
  };

  const toggleSM = (smId) => {
    setExpandedSMs(prev => {
      const next = new Set(prev);
      if (next.has(smId)) next.delete(smId);
      else next.add(smId);
      return next;
    });
  };

  const expandAll = () => setExpandedSMs(new Set((data?.managers || []).map(m => m.id)));
  const collapseAll = () => setExpandedSMs(new Set());

  const activeLabel = DATE_PRESETS.find(p => p.key === dateFilter)?.label || 'All Time';

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--text-secondary)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'tc-spin 0.8s linear infinite', marginBottom: 12 }} />
        <p>Loading booking summary...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="crm-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <ClipboardDocumentListIcon style={{ width: 36, height: 36, margin: '0 auto 12px' }} />
        <div style={{ fontWeight: 700, marginBottom: 4 }}>No data available</div>
        <div style={{ fontSize: 13 }}>Could not load booking summary. Please try again.</div>
        <button className="crm-btn crm-btn-primary" onClick={() => load()} style={{ marginTop: 16 }}>Retry</button>
      </div>
    );
  }

  const managers = data.managers || [];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Page Header */}
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Bookings — SM Wise Summary</h1>
          <p className="hidden sm:block">
            SV counts and square feet booking breakdown by Sales Manager and Site
            {dateFilter !== 'all' && (
              <span style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 12, background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontWeight: 600, fontSize: 11 }}>
                {activeLabel}
              </span>
            )}
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={expandAll}>Expand All</button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={collapseAll}>Collapse All</button>
          <button type="button" className="crm-btn crm-btn-ghost" onClick={() => load()} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Unified Filter Bar */}
      <FilterBar
        activeFilter={dateFilter}
        onFilterChange={handleFilterChange}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        onApplyCustom={handleApplyCustom}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={handleProjectChange}
      />

      {/* Aggregate Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16, marginBottom: 24,
      }}>
        <AggCard
          icon={<ChartBarIcon />}
          label="Sq. Ft. Booked"
          value={`${(data.totalSqft || 0).toLocaleString()} sq.ft.`}
          gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
          shadow="rgba(59, 130, 246, 0.28)"
        />
        <AggCard
          icon={<CheckCircleIcon />}
          label="SV Done (w/ Time Spent)"
          value={data.totalSVDone}
          gradient="linear-gradient(135deg, #10b981 0%, #047857 100%)"
          shadow="rgba(16, 185, 129, 0.28)"
        />
        <AggCard
          icon={<CalendarDaysIcon />}
          label="SV Scheduled"
          value={data.totalSVScheduled}
          gradient="linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
          shadow="rgba(109, 40, 217, 0.28)"
        />
        <AggCard
          icon={<ClipboardDocumentListIcon />}
          label="Total Bookings"
          value={data.totalBookings}
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          shadow="rgba(217, 119, 6, 0.28)"
        />
      </div>

      {/* Hierarchy Table */}
      <div className="crm-card" style={{ overflow: 'hidden' }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr repeat(3, 100px)',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'var(--bg-tertiary)',
          borderBottom: '2px solid var(--border-primary)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          color: 'var(--text-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserIcon style={{ width: 14, height: 14 }} />
            Sales Manager / Site
          </div>
          <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <CheckCircleIcon style={{ width: 13, height: 13, color: '#15803d' }} />
            SV Done
          </div>
          <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <ClipboardDocumentListIcon style={{ width: 13, height: 13, color: '#7c3aed' }} />
            Bookings
          </div>
          <div style={{ textAlign: 'center' }}>Sq. Ft. Booked</div>
        </div>

        {/* SM Rows */}
        {managers.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <UserGroupIcon style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No Team Members Found</div>
            <div style={{ fontSize: 13 }}>No SMs or active bookings reported under you.</div>
          </div>
        ) : (
          managers.map(sm => (
            <SMRow
              key={sm.id}
              sm={sm}
              isOpen={expandedSMs.has(sm.id)}
              onToggle={() => toggleSM(sm.id)}
            />
          ))
        )}

        {/* Totals Footer */}
        {managers.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr repeat(3, 100px)',
            alignItems: 'center',
            padding: '14px 16px',
            background: 'var(--bg-tertiary)',
            borderTop: '2px solid var(--border-primary)',
            fontWeight: 800,
            fontSize: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
              <HomeModernIcon style={{ width: 18, height: 18, color: 'var(--accent-blue)' }} />
              Grand Total ({managers.length} User{managers.length !== 1 ? 's' : ''})
            </div>
            <div style={{ textAlign: 'center', color: '#15803d' }}>{data.totalSVDone}</div>
            <div style={{ textAlign: 'center', color: '#7c3aed' }}>{data.totalBookings}</div>
            <div style={{ textAlign: 'center', color: 'var(--accent-blue)' }}>
              {(data.totalSqft || 0).toLocaleString()} sq.ft.
            </div>
          </div>
        )}
      </div>

      {/* Inline Styles */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tc-spin { to { transform: rotate(360deg); } }
        @keyframes bkSlideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 1000px; } }
      `}</style>
    </div>
  );
};

export default SalesHeadBookingSummary;
