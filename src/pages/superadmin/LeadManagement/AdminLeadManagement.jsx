import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import userApi from '../../../api/userApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import { formatDateTime } from '../../../utils/formatters';
import {
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  UserIcon,
  FunnelIcon,
  ArrowPathIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BuildingOffice2Icon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import './AdminLeadManagement.css';

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STATUS_COLORS = {
  NEW: { bg: '#dbeafe', text: '#1e40af' },
  RNR: { bg: '#fef3c7', text: '#92400e' },
  FOLLOW_UP: { bg: '#e0e7ff', text: '#3730a3' },
  SV_SCHEDULED: { bg: '#d1fae5', text: '#065f46' },
  SV_DONE: { bg: '#a7f3d0', text: '#047857' },
  REVISIT: { bg: '#e0e7ff', text: '#4338ca' },
  NEGOTIATION_HOT: { bg: '#fee2e2', text: '#991b1b' },
  NEGOTIATION_WARM: { bg: '#fef3c7', text: '#92400e' },
  NEGOTIATION_COLD: { bg: '#e0e7ff', text: '#3730a3' },
  BOOKED: { bg: '#d1fae5', text: '#047857' },
  JUNK: { bg: '#fecaca', text: '#991b1b' },
  SPAM: { bg: '#fecaca', text: '#7f1d1d' },
  LOST: { bg: '#fee2e2', text: '#991b1b' },
  INACTIVE: { bg: '#f3f4f6', text: '#4b5563' },
  REALLOT: { bg: '#fef3c7', text: '#78350f' },
};

const getStatusStyle = (statusCode) => {
  const c = STATUS_COLORS[statusCode] || { bg: '#f3f4f6', text: '#374151' };
  return { background: c.bg, color: c.text };
};

const AdminLeadManagement = () => {
  const navigate = useNavigate();
  const today = getTodayString();

  // ── Filters ──
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterMode, setFilterMode] = useState('created'); // 'created' | 'assigned' | 'handoff'
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState(''); // narrows the user dropdown
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // ── Data ──
  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);

  // ── Load users / projects / locations for dropdowns ──
  // Each loads independently so one failing request can't blank the others.
  useEffect(() => {
    const pick = (res) => {
      const list = res?.data?.data || res?.data || [];
      return Array.isArray(list) ? list : [];
    };

    userApi.getAll({ limit: 100 }) // 100 = server max; raising it 422s the request
      .then((res) => setUsers(pick(res)))
      .catch((err) => { console.error('Load users failed:', err); setUsers([]); });

    projectApi.getDropdown()
      .then((res) => setProjects(pick(res)))
      .catch((err) => { console.error('Load projects failed:', err); setProjects([]); });

    locationApi.getDropdown()
      .then((res) => setLocations(pick(res)))
      .catch((err) => { console.error('Load locations failed:', err); setLocations([]); });
  }, []);

  // ── Fetch leads ──
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        sortBy: 'created_at',
        sortOrder: 'DESC',
      };

      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (search.trim()) params.search = search.trim();
      if (selectedStatus) params.statusCode = selectedStatus;
      if (selectedProjectId) params.project_id = selectedProjectId;
      if (selectedLocationId) params.location_id = selectedLocationId;

      if (filterMode === 'created') {
        if (selectedUserId) params.createdBy = selectedUserId;
      } else if (filterMode === 'assigned') {
        if (selectedUserId) params.userId = selectedUserId;
      } else if (filterMode === 'handoff') {
        // A specific user → leads they handed off; no user → every handoff lead
        if (selectedUserId) params.handoffBy = selectedUserId;
        else params.handoffOnly = 'true';
      }

      const res = await leadWorkflowApi.getAdminLeads(params);
      const rows = res?.data || [];
      setLeads(Array.isArray(rows) ? rows : []);
      setMeta(res?.meta || { total: rows.length, page: 1, totalPages: 1 });
    } catch (err) {
      console.error('Admin leads fetch error:', err);
      toast.error('Failed to load leads');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, dateFrom, dateTo, search, selectedUserId, filterMode, selectedStatus, selectedProjectId, selectedLocationId]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // ── Handlers ──
  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClearFilters = () => {
    setDateFrom(today);
    setDateTo(today);
    setSearch('');
    setSearchInput('');
    setSelectedUserId('');
    setSelectedRole('');
    setSelectedLocationId('');
    setSelectedProjectId('');
    setSelectedStatus('');
    setFilterMode('created');
    setPage(1);
  };

  const handleViewLead = (leadId) => {
    navigate(`/lead/${leadId}`);
  };

  // ── Unique status list from loaded leads ──
  const statusOptions = useMemo(() => {
    const map = new Map();
    leads.forEach((l) => {
      if (l.statusCode && !map.has(l.statusCode)) {
        map.set(l.statusCode, l.statusLabel || l.statusName || l.statusCode);
      }
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [leads]);

  // Projects filtered by the selected location (project carries location_id).
  const projectOptions = useMemo(() => {
    return projects
      .filter((p) => !selectedLocationId || String(p.location_id) === String(selectedLocationId))
      .map((p) => ({ id: p.id, name: p.project_name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, selectedLocationId]);

  // Roles present in the user list, for the role narrowing dropdown.
  const roleOptions = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      const code = (u.userType?.short_code || '').toUpperCase();
      if (code && !map.has(code)) map.set(code, u.userType?.type_name || code);
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [users]);

  // Users narrowed by location mapping + role, grouped by role for the dropdown.
  const userGroups = useMemo(() => {
    const matchesLocation = (u) => {
      if (!selectedLocationId) return true;
      const maps = u.locationMappings || u.location_mappings || [];
      // Users with no location mapping (e.g. SM/SH/admins) aren't location-restricted.
      if (maps.length === 0) return true;
      return maps.some((m) => String(m.location_id) === String(selectedLocationId));
    };
    const matchesRole = (u) => {
      if (!selectedRole) return true;
      return (u.userType?.short_code || '').toUpperCase() === selectedRole;
    };

    const groups = new Map();
    users
      .filter((u) => u.is_active !== false && matchesLocation(u) && matchesRole(u))
      .map((u) => ({
        id: u.id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Unknown',
        roleCode: (u.userType?.short_code || '').toUpperCase() || 'OTHER',
        roleLabel: u.userType?.type_name || u.userType?.short_code || 'Other',
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((u) => {
        if (!groups.has(u.roleLabel)) groups.set(u.roleLabel, []);
        groups.get(u.roleLabel).push(u);
      });
    return Array.from(groups.entries()).map(([label, list]) => ({ label, users: list }));
  }, [users, selectedLocationId, selectedRole]);

  // Flat lookup for the stats bar.
  const selectedUserName = useMemo(() => {
    const u = users.find((x) => x.id === selectedUserId);
    return u ? (`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email) : '';
  }, [users, selectedUserId]);

  return (
    <section className="admin-lead-mgmt">
      {/* Header */}
      <header className="admin-lead-mgmt__header">
        <div>
          <h1>Lead Management</h1>
          <p>View and manage all leads across the CRM. Default: today's leads.</p>
        </div>
        <div className="admin-lead-mgmt__header-actions">
          <button type="button" className="alm-btn alm-btn--secondary" onClick={handleClearFilters}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} />
            Reset
          </button>
          <button type="button" className="alm-btn alm-btn--primary" onClick={fetchLeads}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} />
            Refresh
          </button>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="admin-lead-mgmt__filters">
        {/* Search */}
        <div className="alm-filter-group alm-filter-group--search">
          <MagnifyingGlassIcon className="alm-filter-icon" />
          <input
            type="text"
            className="alm-search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search name, phone, email, lead #..."
          />
          <button type="button" className="alm-btn alm-btn--sm" onClick={handleSearch}>Go</button>
        </div>

        {/* Date Range */}
        <div className="alm-filter-group">
          <CalendarDaysIcon className="alm-filter-icon" />
          <label className="alm-filter-label">From</label>
          <input
            type="date"
            className="alm-date-input"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          />
          <label className="alm-filter-label">To</label>
          <input
            type="date"
            className="alm-date-input"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          />
        </div>

        {/* Location Filter */}
        <div className="alm-filter-group">
          <MapPinIcon className="alm-filter-icon" />
          <select
            className="alm-select"
            value={selectedLocationId}
            onChange={(e) => {
              setSelectedLocationId(e.target.value);
              setSelectedProjectId(''); // project list depends on location
              setSelectedUserId('');    // user list is narrowed by location
              setPage(1);
            }}
          >
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.location_name || l.city}</option>
            ))}
          </select>
        </div>

        {/* Project Filter */}
        <div className="alm-filter-group">
          <BuildingOffice2Icon className="alm-filter-icon" />
          <select
            className="alm-select"
            value={selectedProjectId}
            onChange={(e) => { setSelectedProjectId(e.target.value); setPage(1); }}
          >
            <option value="">All Projects</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Role Filter (narrows the user dropdown) */}
        <div className="alm-filter-group">
          <FunnelIcon className="alm-filter-icon" />
          <select
            className="alm-select"
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value); setSelectedUserId(''); setPage(1); }}
          >
            <option value="">All Roles</option>
            {roleOptions.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* User Filter (location- & role-aware, grouped by role) */}
        <div className="alm-filter-group">
          <UserIcon className="alm-filter-icon" />
          <select
            className="alm-select"
            value={selectedUserId}
            onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
          >
            <option value="">All Users</option>
            {userGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Filter Mode Toggle */}
        <div className="alm-filter-group alm-filter-group--toggle">
          <FunnelIcon className="alm-filter-icon" />
          <button
            type="button"
            className={`alm-toggle-btn ${filterMode === 'created' ? 'alm-toggle-btn--active' : ''}`}
            onClick={() => { setFilterMode('created'); setPage(1); }}
          >
            Created By
          </button>
          <button
            type="button"
            className={`alm-toggle-btn ${filterMode === 'assigned' ? 'alm-toggle-btn--active' : ''}`}
            onClick={() => { setFilterMode('assigned'); setPage(1); }}
          >
            Assigned To
          </button>
          <button
            type="button"
            className={`alm-toggle-btn ${filterMode === 'handoff' ? 'alm-toggle-btn--active' : ''}`}
            onClick={() => { setFilterMode('handoff'); setPage(1); }}
            title="Leads handed off by the selected user (or all handoffs if none selected)"
          >
            Handed Off By
          </button>
        </div>

        {/* Status Filter */}
        <div className="alm-filter-group">
          <select
            className="alm-select"
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="admin-lead-mgmt__stats">
        <span className="alm-stat">
          <strong>{meta.total || leads.length}</strong> lead{(meta.total || leads.length) !== 1 ? 's' : ''} found
        </span>
        {dateFrom === dateTo && dateFrom === today && (
          <span className="alm-stat alm-stat--highlight">Showing today's leads</span>
        )}
        {filterMode === 'handoff' && !selectedUserId && (
          <span className="alm-stat alm-stat--filter">Showing all handoff leads</span>
        )}
        {selectedUserId && (
          <span className="alm-stat alm-stat--filter">
            {filterMode === 'created' ? 'Created by' : filterMode === 'handoff' ? 'Handed off by' : 'Assigned to'}: {selectedUserName || 'Unknown'}
          </span>
        )}
        {selectedLocationId && (
          <span className="alm-stat alm-stat--filter">
            Location: {locations.find((l) => l.id === selectedLocationId)?.location_name || locations.find((l) => l.id === selectedLocationId)?.city || '—'}
          </span>
        )}
        {selectedProjectId && (
          <span className="alm-stat alm-stat--filter">
            Project: {projects.find((p) => p.id === selectedProjectId)?.project_name || '—'}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="admin-lead-mgmt__table-wrap">
        <table className="alm-table">
          <thead>
            <tr>
              <th>Lead #</th>
              <th>Lead Name</th>
              <th>Contact</th>
              <th>Source / Medium</th>
              <th>Project / Location</th>
              <th>Created By</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="10" className="alm-table__empty">
                  <div className="alm-loading-spinner" />
                  Loading leads...
                </td>
              </tr>
            )}

            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan="10" className="alm-table__empty">
                  No leads found for the selected filters.
                </td>
              </tr>
            )}

            {!loading && leads.map((lead) => (
              <tr key={lead.id} className="alm-table__row" onClick={() => handleViewLead(lead.id)}>
                <td className="alm-table__cell-lead-num">
                  <span className="alm-lead-number">{lead.leadNumber || '—'}</span>
                </td>
                <td>
                  <div className="alm-lead-name">{lead.fullName || '—'}</div>
                </td>
                <td>
                  <div className="alm-contact-cell">
                    <span className="alm-contact-phone">{lead.phone || '—'}</span>
                    {lead.email && <span className="alm-contact-email">{lead.email}</span>}
                  </div>
                </td>
                <td>
                  <div className="alm-source-cell">
                    <span>{lead.source || '—'}</span>
                    {lead.subSource && <span className="alm-sub-source">{lead.subSource}</span>}
                  </div>
                </td>
                <td>
                  <div className="alm-project-cell">
                    <span>{lead.project || '—'}</span>
                    {lead.location && <span className="alm-location">{lead.location}</span>}
                  </div>
                </td>
                <td>
                  <span className="alm-user-chip">{lead.createdByUserName || '—'}</span>
                </td>
                <td>
                  <span className={`alm-user-chip ${!lead.assignedToUserName ? 'alm-user-chip--unassigned' : ''}`}>
                    {lead.assignedToUserName || 'Unassigned'}
                  </span>
                  {lead.assignedRoleLabel && lead.assignedToUserName && (
                    <span className="alm-role-tag">{lead.assignedRoleLabel}</span>
                  )}
                </td>
                <td>
                  <span className="alm-status-badge" style={getStatusStyle(lead.statusCode)}>
                    {lead.statusLabel || lead.statusCode || '—'}
                  </span>
                </td>
                <td>
                  <span className="alm-date-cell">{formatDateTime(lead.createdAt)}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="alm-btn alm-btn--icon"
                    title="View Lead"
                    onClick={(e) => { e.stopPropagation(); handleViewLead(lead.id); }}
                  >
                    <EyeIcon style={{ width: 18, height: 18 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && leads.length > 0 && (
        <div className="admin-lead-mgmt__pagination">
          <span className="alm-pagination-info">
            Page {meta.page || page} of {meta.totalPages || 1} &middot; {meta.total || leads.length} total
          </span>
          <div className="alm-pagination-btns">
            <button
              type="button"
              className="alm-btn alm-btn--sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon style={{ width: 16, height: 16 }} /> Prev
            </button>
            <button
              type="button"
              className="alm-btn alm-btn--sm"
              disabled={page >= (meta.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRightIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminLeadManagement;
