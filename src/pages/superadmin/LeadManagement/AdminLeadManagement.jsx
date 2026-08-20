import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import userApi from '../../../api/userApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import leadStatusApi from '../../../api/leadStatusApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import paymentStatusApi from '../../../api/paymentStatusApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import { formatDateTime, cleanRepeatingLocation } from '../../../utils/formatters';
import {
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  UserIcon,
  FunnelIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  ArrowsRightLeftIcon,
  TrashIcon,
  XMarkIcon,
  ChevronDownIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import './AdminLeadManagement.css';

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDateRangeForFilter = (option) => {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();

  const formatLocalIso = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  switch (option) {
    case 'all':
      return { from: '', to: '' };
    case 'default':
    case 'today':
      return { from: today, to: today };
    case 'week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      return { from: formatLocalIso(monday), to: today };
    }
    case 'month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatLocalIso(firstOfMonth), to: today };
    }
    default:
      return null;
  }
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

// Typing fires the query on its own after this idle gap; Enter / Go skip the wait.
const SEARCH_DEBOUNCE_MS = 400;
// Below this a term matches too much of the table to be worth an all-dates query.
const SEARCH_MIN_CHARS = 2;

const uniq = (arr) => Array.from(new Set(arr));

// Filter chips name up to three picks, then trail off with a count.
const capNames = (names) => (
  names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ')
);

// ── Multi-select filter dropdown ──────────────────────────────────────────────
// Rolled by hand rather than pulled from a library: a native <select multiple>
// is unusable on a filter bar, and the app carries no combobox dependency.
// The panel stays open while options are toggled so several values can be
// picked in one pass; it closes on outside click and on Escape.
// `options` are { value, label, group? } - a group tag renders a header row
// (used by the user picker, which is grouped by role).
const AlmMultiSelect = ({
  icon: Icon,
  allLabel,
  options,
  value,
  onChange,
  disabled = false,
  title,
  searchable,
}) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // A stale search term would hide options the next time the panel opens.
  useEffect(() => { if (!open) setTerm(''); }, [open]);

  const showSearch = searchable ?? options.length > 8;

  const visible = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, term]);

  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach((o) => {
      const g = o.group || '';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(o);
    });
    return Array.from(map.entries());
  }, [visible]);

  const toggle = (v) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const selectedLabels = options.filter((o) => value.includes(o.value)).map((o) => o.label);
  // Ids can outlive their option list (e.g. a project dropped by a location
  // change) - keep the count honest by counting the raw selection.
  const summary = value.length === 0
    ? allLabel
    : (value.length === 1 && selectedLabels.length === 1 ? selectedLabels[0] : `${value.length} selected`);

  const allVisibleSelected = visible.length > 0 && visible.every((o) => value.includes(o.value));

  return (
    <div className="alm-multi" ref={wrapRef}>
      <button
        type="button"
        className={`alm-multi__btn${value.length ? ' alm-multi__btn--active' : ''}`}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        disabled={disabled}
        title={title || (selectedLabels.length ? selectedLabels.join(', ') : allLabel)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {Icon && <Icon className="alm-filter-icon" />}
        <span className="alm-multi__summary">{summary}</span>
        <ChevronDownIcon className="alm-multi__chevron" />
      </button>

      {open && !disabled && (
        <div className="alm-multi__panel" role="listbox" aria-multiselectable="true">
          {showSearch && (
            <input
              type="text"
              className="alm-multi__search"
              value={term}
              autoFocus
              placeholder="Type to filter…"
              onChange={(e) => setTerm(e.target.value)}
            />
          )}

          <div className="alm-multi__actions">
            <button
              type="button"
              className="alm-multi__link"
              disabled={visible.length === 0 || allVisibleSelected}
              onClick={() => onChange(uniq([...value, ...visible.map((o) => o.value)]))}
            >
              {term.trim() ? 'Select matches' : 'Select all'}
            </button>
            <button
              type="button"
              className="alm-multi__link"
              disabled={value.length === 0}
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>

          <div className="alm-multi__list">
            {visible.length === 0 && <div className="alm-multi__empty">No matches</div>}
            {groups.map(([groupLabel, list]) => (
              <React.Fragment key={groupLabel || '_ungrouped'}>
                {groupLabel && <div className="alm-multi__group">{groupLabel}</div>}
                {list.map((o) => {
                  const on = value.includes(o.value);
                  return (
                    <button
                      type="button"
                      key={o.value}
                      className="alm-multi__opt"
                      role="option"
                      aria-selected={on}
                      onClick={() => toggle(o.value)}
                    >
                      <span className={`alm-multi__box${on ? ' alm-multi__box--on' : ''}`}>
                        {on && <CheckIcon />}
                      </span>
                      <span className="alm-multi__opt-label">{o.label}</span>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminLeadManagement = () => {
  const navigate = useNavigate();
  const today = getTodayString();

  // ── Filters ──
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const range = getDateRangeForFilter(preset);
    if (range) {
      setDateFrom(range.from);
      setDateTo(range.to);
      setPage(1);
    }
  };
  const [filterMode, setFilterMode] = useState('created'); // 'created' | 'assigned' | 'handoff'
  // Every dropdown below is multi-select: empty array = no filter ("All ...").
  // They go to the API as comma-separated lists (userIds, statusCodes, ...).
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]); // also narrows the user dropdown
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]); // lead_statuses.status_code
  const [selectedBookingStatuses, setSelectedBookingStatuses] = useState([]); // booking_statuses.id
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState([]); // payment_statuses.id
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [selectedSubSourceIds, setSelectedSubSourceIds] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // ── Data ──
  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [leadStatuses, setLeadStatuses] = useState([]);
  const [bookingStatuses, setBookingStatuses] = useState([]);
  const [paymentStatuses, setPaymentStatuses] = useState([]);
  const [sources, setSources] = useState([]);
  const [subSources, setSubSources] = useState([]);

  // ── Bulk transfer (user → user) ──
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState([]); // target user ids (round-robin when >1)
  const [transferNote, setTransferNote] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(null); // { done, total } while a job runs
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

    leadStatusApi.getDropdown()
      .then((res) => setLeadStatuses(pick(res)))
      .catch((err) => { console.error('Load lead statuses failed:', err); setLeadStatuses([]); });

    bookingStatusApi.getDropdown()
      .then((res) => setBookingStatuses(pick(res)))
      .catch((err) => { console.error('Load booking statuses failed:', err); setBookingStatuses([]); });

    paymentStatusApi.getDropdown()
      .then((res) => setPaymentStatuses(pick(res)))
      .catch((err) => { console.error('Load payment statuses failed:', err); setPaymentStatuses([]); });

    leadSourceApi.getDropdown()
      .then((res) => setSources(pick(res)))
      .catch((err) => { console.error('Load sources failed:', err); setSources([]); });

    // Every sub-source at once (the dropdown payload carries lead_source_id), so
    // the list can be narrowed client-side against a multi-source selection
    // instead of re-fetching per source.
    leadSubSourceApi.getDropdown()
      .then((res) => setSubSources(pick(res)))
      .catch((err) => { console.error('Load sub-sources failed:', err); setSubSources([]); });
  }, [loadUsers]);

  // A search term is looked up across every date, so the date range is suppressed
  // while one is active - otherwise a search only ever matches today's leads.
  const searchTerm = search.trim();
  const isSearching = searchTerm.length > 0;

  // Guards against a slow all-dates search landing after a newer, narrower query.
  const requestIdRef = useRef(0);

  // ── Fetch leads ──
  const fetchLeads = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        // The server reads `sort` as "field:direction" (sortBy/sortOrder get
        // stripped by the validator and silently fell back to updated_at).
        sort: 'created_at:DESC',
      };

      if (isSearching) {
        params.search = searchTerm;
      } else {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }
      // Multi-selects go over as comma-separated lists; each is OR-ed inside its
      // own filter and AND-ed against the others. An empty array sends nothing.
      if (selectedStatuses.length) params.statusCodes = selectedStatuses.join(',');
      if (selectedBookingStatuses.length) params.bookingStatusIds = selectedBookingStatuses.join(',');
      if (selectedPaymentStatuses.length) params.paymentStatusIds = selectedPaymentStatuses.join(',');
      if (selectedProjectIds.length) params.projectIds = selectedProjectIds.join(',');
      if (selectedLocationIds.length) params.locationIds = selectedLocationIds.join(',');
      if (selectedSourceIds.length) params.sourceIds = selectedSourceIds.join(',');
      if (selectedSubSourceIds.length) params.subSourceIds = selectedSubSourceIds.join(',');

      // Picked users always win; with no user picked but ROLES selected, filter by
      // every user of those roles for the active mode (e.g. "Assigned To" + "Sales Head"
      // → leads assigned to any Sales Head). The role dropdown used to only narrow the
      // user list, so choosing a role without a user silently filtered nothing.
      const userCsv = selectedUserIds.join(',');
      const roleCsv = selectedRoles.join(',');
      if (filterMode === 'created') {
        if (userCsv) params.createdByIds = userCsv;
        else if (roleCsv) params.createdByRoles = roleCsv;
      } else if (filterMode === 'assigned') {
        if (userCsv) params.userIds = userCsv;
        else if (roleCsv) params.assignedRoles = roleCsv;
      } else if (filterMode === 'handoff') {
        // Picked users → leads they handed off; roles → leads handed off by any user
        // of those roles; neither → every handoff lead.
        if (userCsv) params.handoffByIds = userCsv;
        else if (roleCsv) params.handoffByRoles = roleCsv;
        else params.handoffOnly = 'true';
      }

      const res = await leadWorkflowApi.getAdminLeads(params);
      if (requestId !== requestIdRef.current) return; // superseded
      const rows = res?.data || [];
      setLeads(Array.isArray(rows) ? rows : []);
      setMeta(res?.meta || { total: rows.length, page: 1, totalPages: 1 });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Admin leads fetch error:', err);
      toast.error('Failed to load leads');
      setLeads([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [page, limit, dateFrom, dateTo, searchTerm, isSearching, selectedUserIds, selectedRoles, filterMode, selectedStatuses, selectedBookingStatuses, selectedPaymentStatuses, selectedProjectIds, selectedLocationIds, selectedSourceIds, selectedSubSourceIds]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // ── Auto-search: commit the typed term once typing pauses ──
  // Short terms are only committed when clearing back to empty, so a single
  // stray character never triggers a full all-dates scan.
  useEffect(() => {
    const term = searchInput.trim();
    if (term === search) return;
    if (term.length > 0 && term.length < SEARCH_MIN_CHARS) return;
    const t = setTimeout(() => {
      setSearch(term);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  // ── Handlers ──
  const handleSearch = () => {
    const term = searchInput.trim();
    if (term === search) { fetchLeads(); return; } // already applied → treat Go as refresh
    setSearch(term);
    setPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const handleClearFilters = () => {
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setSearchInput('');
    setSelectedUserIds([]);
    setSelectedRoles([]);
    setSelectedLocationIds([]);
    setSelectedProjectIds([]);
    setSelectedStatuses([]);
    setSelectedBookingStatuses([]);
    setSelectedPaymentStatuses([]);
    setSelectedSourceIds([]);
    setSelectedSubSourceIds([]);
    setFilterMode('created');
    setPage(1);
  };

  const handleViewLead = (leadId) => {
    navigate(`/lead/${leadId}`);
  };

  // ── Lead status options from the status master (full list, not just the
  // statuses present on the current page). Falls back to the loaded rows only
  // if the master fetch failed. ──
  const statusOptions = useMemo(() => {
    if (leadStatuses.length > 0) {
      return leadStatuses.map((s) => ({ value: s.status_code, label: s.status_name }));
    }
    const map = new Map();
    leads.forEach((l) => {
      if (l.statusCode && !map.has(l.statusCode)) {
        map.set(l.statusCode, l.statusLabel || l.statusName || l.statusCode);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [leadStatuses, leads]);

  const bookingStatusOptions = useMemo(
    () => bookingStatuses.map((b) => ({ value: b.id, label: b.status_name })),
    [bookingStatuses]
  );

  const paymentStatusOptions = useMemo(
    () => paymentStatuses.map((ps) => ({ value: ps.id, label: ps.status_name })),
    [paymentStatuses]
  );

  const sourceOptions = useMemo(
    () => sources.map((src) => ({ value: src.id, label: src.source_name })),
    [sources]
  );

  // Unnarrowed lists, so a chip can still name a pick whose parent filter moved on.
  const allProjectOptions = useMemo(
    () => projects.map((pr) => ({ value: pr.id, label: pr.project_name })),
    [projects]
  );

  const allSubSourceOptions = useMemo(
    () => subSources.map((ss) => ({ value: ss.id, label: ss.sub_source_name })),
    [subSources]
  );

  // Projects narrowed to the selected locations (project carries location_id).
  const projectOptions = useMemo(() => {
    return projects
      .filter((p) => selectedLocationIds.length === 0 || selectedLocationIds.includes(String(p.location_id)))
      .map((p) => ({ value: p.id, label: p.project_name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [projects, selectedLocationIds]);

  const locationOptions = useMemo(
    () => locations.map((l) => ({ value: l.id, label: l.location_name })),
    [locations]
  );

  // Sub-sources narrowed to the selected sources; the whole list when none is picked.
  const subSourceOptions = useMemo(() => {
    return subSources
      .filter((ss) => selectedSourceIds.length === 0 || selectedSourceIds.includes(String(ss.lead_source_id)))
      .map((ss) => ({ value: ss.id, label: ss.sub_source_name }));
  }, [subSources, selectedSourceIds]);

  // Roles present in the user list, for the role narrowing dropdown.
  const roleOptions = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      const code = (u.userType?.short_code || '').toUpperCase();
      if (code && !map.has(code)) map.set(code, u.userType?.type_name || code);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [users]);

  // Users narrowed by location mapping + role, tagged with their role so the
  // dropdown can print a header per role.
  const userMatchesFilters = useCallback((u) => {
    const maps = u.locationMappings || u.location_mappings || [];
    // Users with no location mapping (e.g. SM/SH/admins) aren't location-restricted.
    const okLocation = selectedLocationIds.length === 0
      || maps.length === 0
      || maps.some((m) => selectedLocationIds.includes(String(m.location_id)));
    const okRole = selectedRoles.length === 0
      || selectedRoles.includes((u.userType?.short_code || '').toUpperCase());
    return okLocation && okRole;
  }, [selectedLocationIds, selectedRoles]);

  const userOptions = useMemo(() => {
    return users
      .filter((u) => u.is_active !== false && userMatchesFilters(u))
      .map((u) => ({
        value: u.id,
        label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Unknown',
        group: u.userType?.type_name || u.userType?.short_code || 'Other',
      }))
      .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  }, [users, userMatchesFilters]);

  // Flat lookup for the stats bar.
  const selectedUserNames = useMemo(() => (
    selectedUserIds
      .map((id) => {
        const u = users.find((x) => x.id === id);
        return u ? (`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email) : null;
      })
      .filter(Boolean)
  ), [users, selectedUserIds]);

  // ── Cascading filter handlers ──
  // Narrowing a parent filter can strand a child selection (a project outside the
  // new locations, a sub-source outside the new sources). Prune it rather than
  // quietly querying on a value the user can no longer see.
  const handleLocationsChange = (ids) => {
    setSelectedLocationIds(ids);
    if (ids.length) {
      setSelectedProjectIds((prev) => prev.filter((pid) => {
        const proj = projects.find((p) => String(p.id) === String(pid));
        return proj ? ids.includes(String(proj.location_id)) : false;
      }));
      setSelectedUserIds((prev) => prev.filter((uid) => {
        const u = users.find((x) => String(x.id) === String(uid));
        if (!u) return false;
        const maps = u.locationMappings || u.location_mappings || [];
        return maps.length === 0 || maps.some((m) => ids.includes(String(m.location_id)));
      }));
    }
    setPage(1);
  };

  const handleRolesChange = (codes) => {
    setSelectedRoles(codes);
    if (codes.length) {
      setSelectedUserIds((prev) => prev.filter((uid) => {
        const u = users.find((x) => String(x.id) === String(uid));
        return u ? codes.includes((u.userType?.short_code || '').toUpperCase()) : false;
      }));
    }
    setPage(1);
  };

  const handleSourcesChange = (ids) => {
    setSelectedSourceIds(ids);
    if (ids.length) {
      setSelectedSubSourceIds((prev) => prev.filter((ssid) => {
        const ss = subSources.find((x) => String(x.id) === String(ssid));
        return ss ? ids.includes(String(ss.lead_source_id)) : false;
      }));
    }
    setPage(1);
  };

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
  const resetTransferModal = () => {
    setTransferOpen(false);
    setTransferFrom('');
    setTransferTo([]);
    setTransferNote('');
  };

  const closeTransfer = () => {
    if (transferring) return; // a transfer job is in flight - keep the modal up
    resetTransferModal();
  };

  const toggleTransferTo = (id) => {
    setTransferTo((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Poll the background transfer job (1s cadence) until it settles, feeding
  // the modal's progress bar along the way.
  const pollBulkTransfer = async (jobId, total) => {
    setTransferProgress({ done: 0, total });
    for (; ;) {
      await new Promise((resolve) => { setTimeout(resolve, 1000); });
      const res = await leadWorkflowApi.getBulkTransferStatus(jobId);
      const job = res?.data || {};
      setTransferProgress({ done: job.done ?? 0, total: job.total ?? total });
      if (job.status === 'done') return job.result || {};
      if (job.status === 'failed') throw new Error(job.message || 'Lead transfer failed - no leads were moved.');
    }
  };

  const handleBulkTransfer = async () => {
    if (!transferFrom || transferTo.length === 0) { toast.error('Pick a source user and at least one target user.'); return; }
    if (transferTo.includes(transferFrom)) { toast.error('Source and target must be different.'); return; }
    setTransferring(true);
    try {
      const res = await leadWorkflowApi.bulkTransferLeads(transferFrom, transferTo, transferNote.trim() || undefined);
      // New servers hand back a job to poll; legacy servers answer synchronously.
      let payload = res?.data || {};
      if (payload.jobId) payload = await pollBulkTransfer(payload.jobId, payload.total ?? 0);
      const count = payload.transferred ?? 0;
      const perUser = payload.perUser || [];
      if (count === 0) {
        toast.success(`${userName(transferFrom)} had no leads to transfer.`);
      } else if (transferTo.length > 1) {
        const detail = perUser.filter((p) => p.count > 0).map((p) => `${p.count} → ${p.name}`).join(', ');
        toast.success(`Transferred ${count} lead(s) round-robin (${detail}).`);
      } else {
        toast.success(`Transferred ${count} lead(s) to ${userName(transferTo[0])}.`);
      }
      resetTransferModal();
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Lead transfer failed.');
    } finally {
      setTransferring(false);
      setTransferProgress(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!transferFrom) { toast.error('Pick the source user to delete.'); return; }
    if (!window.confirm(
      `Delete user "${userName(transferFrom)}"?\n\nTransfer their leads first - any leads still owned by them will be left unassigned.`
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

  // Soft delete only - the server flags is_deleted; the lead disappears from
  // every portal but stays in the database.
  const handleDeleteLead = async (e, lead) => {
    e.stopPropagation();
    const label = `${lead.leadNumber || 'this lead'}${lead.fullName ? ` - ${lead.fullName}` : ''}`;
    const ok = window.confirm(`Delete lead ${label}?\n\nThe lead will be hidden from all portals. It is NOT permanently removed.`);
    if (!ok) return;
    try {
      await leadWorkflowApi.deleteLead(lead.id);
      toast.success(`Lead ${lead.leadNumber || ''} deleted.`);
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete lead.');
    }
  };

  // Chip text: names the picks, and once past three trails off with a count.
  const labelsFor = useCallback((options, values) => {
    const names = values
      .map((v) => options.find((o) => String(o.value) === String(v))?.label)
      .filter(Boolean);
    if (names.length === 0) return `${values.length} selected`;
    return capNames(names);
  }, []);

  const modeLabel = filterMode === 'created'
    ? 'Created by'
    : (filterMode === 'handoff' ? 'Handed off by' : 'Assigned to');

  const activeFilterCount = (
    selectedUserIds.length + selectedRoles.length + selectedLocationIds.length
    + selectedProjectIds.length + selectedStatuses.length + selectedBookingStatuses.length
    + selectedPaymentStatuses.length + selectedSourceIds.length + selectedSubSourceIds.length
  );

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
        {/* Search - searches every date, ignoring the range below */}
        <div className="alm-filter-group alm-filter-group--search">
          <MagnifyingGlassIcon className="alm-filter-icon" />
          <input
            type="text"
            className="alm-search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search all dates by name, phone, email, lead #..."
          />
          {searchInput && (
            <button
              type="button"
              className="alm-btn alm-btn--icon"
              onClick={handleClearSearch}
              title="Clear search"
              aria-label="Clear search"
            >
              <XMarkIcon style={{ width: 16, height: 16 }} />
            </button>
          )}
          <button type="button" className="alm-btn alm-btn--sm" onClick={handleSearch}>Go</button>
        </div>

        {/* Date Preset Filter */}
        <div className={`alm-filter-group${isSearching ? ' alm-filter-group--muted' : ''}`}>
          <CalendarDaysIcon className="alm-filter-icon" />
          <select
            className="alm-select"
            value={datePreset}
            disabled={isSearching}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            <option value="default">Default (Today)</option>
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">Week to Date</option>
            <option value="month">Month to Date</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Date Range - visible when custom range is selected, inert during search */}
        {datePreset === 'custom' && (
          <div className={`alm-filter-group${isSearching ? ' alm-filter-group--muted' : ''}`}>
            <CalendarDaysIcon className="alm-filter-icon" />
            <label className="alm-filter-label">From</label>
            <input
              type="date"
              className="alm-date-input"
              value={dateFrom}
              disabled={isSearching}
              title={isSearching ? 'Clear the search to filter by date' : undefined}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <label className="alm-filter-label">To</label>
            <input
              type="date"
              className="alm-date-input"
              value={dateTo}
              disabled={isSearching}
              title={isSearching ? 'Clear the search to filter by date' : undefined}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
        )}

        {/* Location Filter */}
        <div className="alm-filter-group">
          <AlmMultiSelect
            icon={MapPinIcon}
            allLabel="All Locations"
            options={locationOptions}
            value={selectedLocationIds}
            onChange={handleLocationsChange}
          />
        </div>

        {/* Project Filter */}
        <div className="alm-filter-group">
          <AlmMultiSelect
            icon={BuildingOffice2Icon}
            allLabel="All Projects"
            options={projectOptions}
            value={selectedProjectIds}
            onChange={(ids) => { setSelectedProjectIds(ids); setPage(1); }}
          />
        </div>

        {/* Role Filter (also narrows the user dropdown) */}
        <div className="alm-filter-group">
          <AlmMultiSelect
            icon={FunnelIcon}
            allLabel="All Roles"
            options={roleOptions}
            value={selectedRoles}
            onChange={handleRolesChange}
          />
        </div>

        {/* User Filter (location- & role-aware, grouped by role) */}
        <div className="alm-filter-group">
          <AlmMultiSelect
            icon={UserIcon}
            allLabel="All Users"
            options={userOptions}
            value={selectedUserIds}
            onChange={(ids) => { setSelectedUserIds(ids); setPage(1); }}
          />
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

        {/* Lead Status Filter */}
        <div className="alm-filter-group">
          <AlmMultiSelect
            allLabel="All Lead Statuses"
            title="Filter by lead status"
            options={statusOptions}
            value={selectedStatuses}
            onChange={(codes) => { setSelectedStatuses(codes); setPage(1); }}
          />
        </div>

        {/* Booking Status Filter */}
        <div className="alm-filter-group">
          <AlmMultiSelect
            allLabel="All Booking Statuses"
            title="Filter by the lead's booking status"
            options={bookingStatusOptions}
            value={selectedBookingStatuses}
            onChange={(ids) => { setSelectedBookingStatuses(ids); setPage(1); }}
          />
        </div>

        {/* Payment Status Filter */}
        <div className="alm-filter-group">
          <AlmMultiSelect
            allLabel="All Payment Statuses"
            title="Filter by the booking's payment status"
            options={paymentStatusOptions}
            value={selectedPaymentStatuses}
            onChange={(ids) => { setSelectedPaymentStatuses(ids); setPage(1); }}
          />
        </div>

        {/* Source Filter */}
        <div className="alm-filter-group">
          <AlmMultiSelect
            allLabel="All Sources"
            title="Filter by lead source"
            options={sourceOptions}
            value={selectedSourceIds}
            onChange={handleSourcesChange}
          />
        </div>

        {/* Sub Source Filter (narrowed by the picked sources, if any) */}
        <div className="alm-filter-group">
          <AlmMultiSelect
            allLabel="All Sub-Sources"
            title="Filter by lead sub-source"
            options={subSourceOptions}
            value={selectedSubSourceIds}
            onChange={(ids) => { setSelectedSubSourceIds(ids); setPage(1); }}
          />
        </div>

        {activeFilterCount > 0 && (
          <button type="button" className="alm-btn alm-btn--sm alm-clear-all" onClick={handleClearFilters}>
            <XMarkIcon style={{ width: 13, height: 13 }} />
            Clear {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Stats Bar */}
      <div className="admin-lead-mgmt__stats">
        <span className="alm-stat">
          <strong>{meta.total || leads.length}</strong> lead{(meta.total || leads.length) !== 1 ? 's' : ''} found
        </span>
        {isSearching && (
          <span className="alm-stat alm-stat--highlight">Searching all dates for “{searchTerm}”</span>
        )}
        {!isSearching && dateFrom === dateTo && dateFrom === today && (
          <span className="alm-stat alm-stat--highlight">Showing today's leads</span>
        )}
        {filterMode === 'handoff' && selectedUserIds.length === 0 && selectedRoles.length === 0 && (
          <span className="alm-stat alm-stat--filter">Showing all handoff leads</span>
        )}
        {selectedUserIds.length === 0 && selectedRoles.length > 0 && (
          <span className="alm-stat alm-stat--filter">
            {modeLabel}: {labelsFor(roleOptions, selectedRoles)}
          </span>
        )}
        {selectedUserIds.length > 0 && (
          <span className="alm-stat alm-stat--filter">
            {modeLabel}: {capNames(selectedUserNames) || 'Unknown'}
          </span>
        )}
        {selectedLocationIds.length > 0 && (
          <span className="alm-stat alm-stat--filter">
            Location: {labelsFor(locationOptions, selectedLocationIds)}
          </span>
        )}
        {selectedProjectIds.length > 0 && (
          <span className="alm-stat alm-stat--filter">
            Project: {labelsFor(allProjectOptions, selectedProjectIds)}
          </span>
        )}
        {selectedStatuses.length > 0 && (
          <span className="alm-stat alm-stat--filter">
            Lead status: {labelsFor(statusOptions, selectedStatuses)}
          </span>
        )}
        {selectedBookingStatuses.length > 0 && (
          <span className="alm-stat alm-stat--filter">
            Booking status: {labelsFor(bookingStatusOptions, selectedBookingStatuses)}
          </span>
        )}
        {selectedPaymentStatuses.length > 0 && (
          <span className="alm-stat alm-stat--filter">
            Payment status: {labelsFor(paymentStatusOptions, selectedPaymentStatuses)}
          </span>
        )}
        {selectedSourceIds.length > 0 && (
          <span className="alm-stat alm-stat--filter">
            Source: {labelsFor(sourceOptions, selectedSourceIds)}
          </span>
        )}
        {selectedSubSourceIds.length > 0 && (
          <span className="alm-stat alm-stat--filter">
            Sub-source: {labelsFor(allSubSourceOptions, selectedSubSourceIds)}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="admin-lead-mgmt__table-wrap">
        <table className="alm-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Contact</th>
              <th>Source/Medium</th>
              <th>Project/Location</th>
              <th>Created By</th>
              <th>Assigned</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="9" className="alm-table__empty">
                  <div className="alm-loading-spinner" />
                  Loading leads...
                </td>
              </tr>
            )}

            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan="9" className="alm-table__empty">
                  No leads found for the selected filters.
                </td>
              </tr>
            )}

            {!loading && leads.map((lead) => (
              <tr key={lead.id} className="alm-table__row" onClick={() => handleViewLead(lead.id)}>
                <td className="alm-table__cell-lead">
                  <div className="alm-lead-name">{lead.fullName || '-'}</div>
                  <a
                    href={`/lead/${lead.id}`}
                    className="alm-lead-link"
                    onClick={(e) => { e.stopPropagation(); handleViewLead(lead.id); }}
                  >
                    {lead.leadNumber || '-'}
                  </a>
                </td>
                <td>
                  <div className="alm-contact-cell">
                    <span className="alm-contact-phone">{lead.phone || '-'}</span>
                    {lead.email && <span className="alm-contact-email">{lead.email}</span>}
                  </div>
                </td>
                <td>
                  <div className="alm-source-cell">
                    <span>{lead.source || '-'}</span>
                    {lead.subSource && <span className="alm-sub-source">{lead.subSource}</span>}
                  </div>
                </td>
                <td>
                  <div className="alm-project-cell">
                    <span>{lead.project || '-'}</span>
                    {lead.location && <span className="alm-location">{cleanRepeatingLocation(lead.location)}</span>}
                  </div>
                </td>
                <td>
                  <span className="alm-user-chip">{lead.createdByUserName || '-'}</span>
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
                    {lead.statusLabel || lead.statusCode || '-'}
                  </span>
                </td>
                <td>
                  <span className="alm-date-cell">{formatDateTime(lead.createdAt)}</span>
                </td>
                <td>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      type="button"
                      className="view-link"
                      title="View Lead"
                      onClick={(e) => { e.stopPropagation(); handleViewLead(lead.id); }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="alm-btn alm-btn--icon"
                      title="Move lead to another user"
                      onClick={(e) => openMove(e, lead)}
                    >
                      <ArrowsRightLeftIcon style={{ width: 18, height: 18 }} />
                    </button>
                    <button
                      type="button"
                      className="alm-btn alm-btn--icon alm-btn--danger"
                      title="Delete lead (soft delete)"
                      onClick={(e) => handleDeleteLead(e, lead)}
                    >
                      <TrashIcon style={{ width: 18, height: 18 }} />
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
                  Move every lead from one user to another - status, site visits, telecaller history and timeline all carry over.
                </div>
              </div>
              <button className="alm-modal__close" onClick={closeTransfer} aria-label="Close"><XMarkIcon style={{ width: 18, height: 18 }} /></button>
            </header>

            <div className="alm-modal__body">
              <div className="alm-field">
                <label>From user (source)</label>
                <select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} disabled={transferring}>
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
                                disabled={transferring}
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
                  disabled={transferring}
                />
              </div>

              {transferring && transferProgress && (
                <div className="alm-transfer-progress">
                  <div className="alm-transfer-progress__track">
                    <div
                      className="alm-transfer-progress__fill"
                      style={{ width: `${transferProgress.total > 0 ? Math.round((transferProgress.done / transferProgress.total) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="alm-transfer-progress__label">
                    Moving leads… {transferProgress.done.toLocaleString('en-IN')} / {transferProgress.total.toLocaleString('en-IN')}
                    {' '}({transferProgress.total > 0 ? Math.round((transferProgress.done / transferProgress.total) * 100) : 0}%)
                    - keep this window open
                  </div>
                </div>
              )}
            </div>

            <div className="alm-modal__footer alm-modal__footer--split">
              <button
                type="button"
                className="alm-mbtn alm-mbtn--danger"
                onClick={handleDeleteUser}
                disabled={!transferFrom || deletingUser || transferring}
                title="Soft-delete the source user (transfer their leads first)"
              >
                <TrashIcon style={{ width: 16, height: 16 }} />
                {deletingUser ? 'Deleting…' : 'Delete source user'}
              </button>
              <div className="alm-modal__footer-group">
                <button type="button" className="alm-mbtn alm-mbtn--ghost" onClick={closeTransfer} disabled={transferring}>
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
