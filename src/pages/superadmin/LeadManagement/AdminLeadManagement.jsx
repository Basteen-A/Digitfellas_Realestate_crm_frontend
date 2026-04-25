import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import userApi from '../../../api/userApi';
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
  const [filterMode, setFilterMode] = useState('created'); // 'created' | 'assigned'
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // ── Data ──
  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  // ── Load users for dropdown ──
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await userApi.getAll({ limit: 500 });
        const list = res?.data?.data || res?.data || [];
        setUsers(Array.isArray(list) ? list : []);
      } catch {
        setUsers([]);
      }
    };
    loadUsers();
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

      if (selectedUserId) {
        if (filterMode === 'created') {
          params.createdBy = selectedUserId;
        } else {
          params.userId = selectedUserId;
        }
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
  }, [page, limit, dateFrom, dateTo, search, selectedUserId, filterMode, selectedStatus]);

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

  const userOptions = useMemo(() => {
    return users
      .filter((u) => u.is_active !== false)
      .map((u) => ({
        id: u.id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        role: u.userType?.type_name || u.userType?.short_code || '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

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

        {/* User Filter */}
        <div className="alm-filter-group">
          <UserIcon className="alm-filter-icon" />
          <select
            className="alm-select"
            value={selectedUserId}
            onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
          >
            <option value="">All Users</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
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
        {selectedUserId && (
          <span className="alm-stat alm-stat--filter">
            {filterMode === 'created' ? 'Created by' : 'Assigned to'}: {userOptions.find((u) => u.id === selectedUserId)?.name || 'Unknown'}
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
