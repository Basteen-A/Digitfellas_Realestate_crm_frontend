import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import userApi from '../../../api/userApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import { formatDateTime, cleanRepeatingLocation } from '../../../utils/formatters';
import {
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  UserIcon,
  FunnelIcon,
  ArrowPathIcon,
  EyeIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  ArrowsRightLeftIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import './AdminLeadManagement.css';

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Canonical badge-system triples (badge-system.html / utils/badgeColors.js).
const STATUS_COLORS = {
  NEW: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  RNR: { bg: '#FAF5FF', text: '#6B21A8', border: '#E9D5FF' },
  FOLLOW_UP: { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
  SV_SCHEDULED: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  SV_DONE: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  REVISIT: { bg: '#EEF2FF', text: '#3730A3', border: '#C7D2FE' },
  NEGOTIATION_HOT: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  NEGOTIATION_WARM: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  NEGOTIATION_COLD: { bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
  BOOKED: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  JUNK: { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB' },
  SPAM: { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' },
  LOST: { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3' },
  INACTIVE: { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
  REALLOT: { bg: '#ECFEFF', text: '#155E75', border: '#A5F3FC' },
};

const getStatusStyle = (statusCode) => {
  const c = STATUS_COLORS[statusCode] || { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' };
  return { background: c.bg, color: c.text, border: `1px solid ${c.border}` };
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
  const [limit, setLimit] = useState(25);

  // ── Data ──
  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);

  // ── Bulk transfer (user → user) ──
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState([]); // target user ids (round-robin when >1)
  const [transferNote, setTransferNote] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  // ── Single-lead move ──
  const [moveLead, setMoveLead] = useState(null); // the lead row being moved
  const [moveTo, setMoveTo] = useState('');
  const [moveNote, setMoveNote] = useState('');
  const [moving, setMoving] = useState(false);

  const pickList = (res) => {
    const list = res?.data?.data || res?.data || [];
    return Array.isArray(list) ? list : [];
  };

  // Reusable so we can refresh after a transfer / delete.
  const loadUsers = useCallback(() => {
    userApi.getAll({ limit: 100 }) // 100 = server max; raising it 422s the request
      .then((res) => setUsers(pickList(res)))
      .catch((err) => { console.error('Load users failed:', err); setUsers([]); });
  }, []);

  // ── Load users / projects / locations for dropdowns ──
  // Each loads independently so one failing request can't blank the others.
  useEffect(() => {
    const pick = pickList;

    loadUsers();

    projectApi.getDropdown()
      .then((res) => setProjects(pick(res)))
      .catch((err) => { console.error('Load projects failed:', err); setProjects([]); });

    locationApi.getDropdown()
      .then((res) => setLocations(pick(res)))
      .catch((err) => { console.error('Load locations failed:', err); setLocations([]); });
  }, [loadUsers]);

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

  // All users grouped by role for the transfer / move dropdowns.
  // `activeOnly` excludes deactivated users (used for transfer/move targets).
  const buildUserGroups = useCallback((activeOnly) => {
    const groups = new Map();
    users
      .filter((u) => (activeOnly ? u.is_active !== false : true))
      .map((u) => ({
        id: u.id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Unknown',
        active: u.is_active !== false,
        roleLabel: u.userType?.type_name || u.userType?.short_code || 'Other',
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((u) => {
        if (!groups.has(u.roleLabel)) groups.set(u.roleLabel, []);
        groups.get(u.roleLabel).push(u);
      });
    return Array.from(groups.entries()).map(([label, list]) => ({ label, users: list }));
  }, [users]);

  const allUserGroups = useMemo(() => buildUserGroups(false), [buildUserGroups]);
  const activeUserGroups = useMemo(() => buildUserGroups(true), [buildUserGroups]);

  const userName = useCallback((id) => {
    const u = users.find((x) => x.id === id);
    return u ? (`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email) : '';
  }, [users]);

  // ── Bulk transfer handlers ──
  const closeTransfer = () => {
    setTransferOpen(false);
    setTransferFrom('');
    setTransferTo([]);
    setTransferNote('');
  };

  const toggleTransferTo = (id) => {
    setTransferTo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkTransfer = async () => {
    if (!transferFrom || transferTo.length === 0) { toast.error('Pick a source user and at least one target user.'); return; }
    if (transferTo.includes(transferFrom)) { toast.error('Source and target must be different.'); return; }
    setTransferring(true);
    try {
      const res = await leadWorkflowApi.bulkTransferLeads(transferFrom, transferTo, transferNote.trim() || undefined);
      const count = res?.data?.transferred ?? 0;
      const perUser = res?.data?.perUser || [];
      if (count === 0) {
        toast.success(`${userName(transferFrom)} had no leads to transfer.`);
      } else if (transferTo.length > 1) {
        const detail = perUser.filter((p) => p.count > 0).map((p) => `${p.count} → ${p.name}`).join(', ');
        toast.success(`Transferred ${count} lead(s) round-robin (${detail}).`);
      } else {
        toast.success(`Transferred ${count} lead(s) to ${userName(transferTo[0])}.`);
      }
      closeTransfer();
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lead transfer failed.');
    } finally {
      setTransferring(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!transferFrom) { toast.error('Pick the source user to delete.'); return; }
    if (!window.confirm(
      `Delete user "${userName(transferFrom)}"?\n\nTransfer their leads first — any leads still owned by them will be left unassigned.`
    )) return;
    setDeletingUser(true);
    try {
      await userApi.delete(transferFrom);
      toast.success(`User "${userName(transferFrom)}" deleted.`);
      setTransferFrom('');
      loadUsers();
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete user.');
    } finally {
      setDeletingUser(false);
    }
  };

  // ── Single-lead move handlers ──
  const openMove = (e, lead) => {
    e.stopPropagation();
    setMoveLead(lead);
    setMoveTo('');
    setMoveNote('');
  };
  const closeMove = () => { setMoveLead(null); setMoveTo(''); setMoveNote(''); };

  const handleMoveLead = async () => {
    if (!moveTo) { toast.error('Pick a user to move this lead to.'); return; }
    setMoving(true);
    try {
      await leadWorkflowApi.transferLead(moveLead.id, moveTo, moveNote.trim() || undefined);
      toast.success(`Lead moved to ${userName(moveTo)}.`);
      closeMove();
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not move lead.');
    } finally {
      setMoving(false);
    }
  };

  return (
    <section className="admin-lead-mgmt">
      {/* Header */}
      <header className="admin-lead-mgmt__header">
        <div>
          <h1>Lead Management</h1>
          <p>View and manage all leads across the CRM. Default: today's leads.</p>
        </div>
        <div className="admin-lead-mgmt__header-actions">
          <button type="button" className="alm-btn alm-btn--secondary" onClick={() => setTransferOpen(true)}>
            <ArrowsRightLeftIcon style={{ width: 16, height: 16 }} />
            Transfer Leads
          </button>
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
              <option key={l.id} value={l.id}>{l.location_name}</option>
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
                    {lead.location && <span className="alm-location">{cleanRepeatingLocation(lead.location)}</span>}
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
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      type="button"
                      className="alm-btn alm-btn--icon"
                      title="View Lead"
                      onClick={(e) => { e.stopPropagation(); handleViewLead(lead.id); }}
                    >
                      <EyeIcon style={{ width: 18, height: 18 }} />
                    </button>
                    <button
                      type="button"
                      className="alm-btn alm-btn--icon"
                      title="Move lead to another user"
                      onClick={(e) => openMove(e, lead)}
                    >
                      <ArrowsRightLeftIcon style={{ width: 18, height: 18 }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && (
        <Pagination
          page={meta.page || page}
          pageSize={limit}
          total={meta.total || leads.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
        />
      )}

      {/* ── Bulk Transfer Modal ── */}
      {transferOpen && (
        <div className="alm-modal" onClick={closeTransfer}>
          <div className="alm-modal__panel alm-modal__panel--wide" onClick={(e) => e.stopPropagation()}>
            <header className="alm-modal__header">
              <div>
                <div className="alm-modal__title">Transfer Leads</div>
                <div className="alm-modal__sub">
                  Move every lead from one user to another — status, site visits, telecaller history and timeline all carry over.
                </div>
              </div>
              <button className="alm-modal__close" onClick={closeTransfer} aria-label="Close"><XMarkIcon style={{ width: 18, height: 18 }} /></button>
            </header>

            <div className="alm-modal__body">
              <div className="alm-field">
                <label>From user (source)</label>
                <select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)}>
                  <option value="">Select source user…</option>
                  {allUserGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}{u.active ? '' : ' (inactive)'}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="alm-field">
                <label>
                  <span>To user(s){transferTo.length > 0 ? ` · ${transferTo.length} selected` : ''}</span>
                  {transferTo.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTransferTo([])}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                    >
                      Clear
                    </button>
                  )}
                </label>
                <div className="alm-userpick">
                  {activeUserGroups.map((g) => {
                    const selectable = g.users.filter((u) => u.id !== transferFrom);
                    if (selectable.length === 0) return null;
                    return (
                      <div key={g.label} style={{ marginBottom: 6 }}>
                        <div className="alm-userpick__group-label">{g.label}</div>
                        {selectable.map((u) => {
                          const checked = transferTo.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`alm-userpick__row${checked ? ' alm-userpick__row--checked' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTransferTo(u.id)}
                              />
                              <span>{u.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                {transferTo.length > 1 && (
                  <div className="alm-hint">
                    Leads will be split evenly across the {transferTo.length} selected users in round-robin order.
                  </div>
                )}
              </div>

              <div className="alm-field">
                <label>Note (optional)</label>
                <input
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Reason for transfer"
                />
              </div>
            </div>

            <div className="alm-modal__footer alm-modal__footer--split">
              <button
                type="button"
                className="alm-mbtn alm-mbtn--danger"
                onClick={handleDeleteUser}
                disabled={!transferFrom || deletingUser}
                title="Soft-delete the source user (transfer their leads first)"
              >
                <TrashIcon style={{ width: 16, height: 16 }} />
                {deletingUser ? 'Deleting…' : 'Delete source user'}
              </button>
              <div className="alm-modal__footer-group">
                <button type="button" className="alm-mbtn alm-mbtn--ghost" onClick={closeTransfer}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="alm-mbtn alm-mbtn--primary"
                  onClick={handleBulkTransfer}
                  disabled={transferring}
                >
                  {transferring ? 'Transferring…' : 'Transfer all leads'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Single-Lead Move Modal ── */}
      {moveLead && (
        <div className="alm-modal" onClick={closeMove}>
          <div className="alm-modal__panel" onClick={(e) => e.stopPropagation()}>
            <header className="alm-modal__header">
              <div>
                <div className="alm-modal__title">Move Lead</div>
                <div className="alm-modal__sub">
                  {moveLead.leadNumber || moveLead.fullName || 'Lead'} · currently {moveLead.assignedToUserName || 'Unassigned'}
                </div>
              </div>
              <button className="alm-modal__close" onClick={closeMove} aria-label="Close"><XMarkIcon style={{ width: 18, height: 18 }} /></button>
            </header>

            <div className="alm-modal__body">
              <div className="alm-field">
                <label>Move to user</label>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  <option value="">Select user…</option>
                  {activeUserGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="alm-field">
                <label>Note (optional)</label>
                <input
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                  placeholder="Reason for move"
                />
              </div>
            </div>

            <div className="alm-modal__footer alm-modal__footer--end">
              <button type="button" className="alm-mbtn alm-mbtn--ghost" onClick={closeMove}>
                Cancel
              </button>
              <button
                type="button"
                className="alm-mbtn alm-mbtn--primary"
                onClick={handleMoveLead}
                disabled={moving}
              >
                {moving ? 'Moving…' : 'Move lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminLeadManagement;
