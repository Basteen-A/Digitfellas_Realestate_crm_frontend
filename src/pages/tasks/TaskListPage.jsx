import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon, PlusCircleIcon, MagnifyingGlassIcon, ChevronRightIcon,
  PencilSquareIcon, BoltIcon, CalendarDaysIcon, PaperClipIcon, FunnelIcon,
} from '@heroicons/react/24/outline';
import taskApi from '../../api/taskApi';
import departmentApi from '../../api/departmentApi';
import TaskModal from './TaskModal';
import Pagination from '../../components/common/Pagination';
// Reuse the lead workspace design system so this page is visually consistent
// (fonts, weights, sizes, buttons, tabs, table, background) with My Leads.
import '../portals/common/LeadWorkspacePage.css';
import './TaskManagement.css';

const STATUS_LABELS = {
  open: 'Open', pending: 'Pending', work_in_progress: 'In Progress',
  completed: 'Completed', closed: 'Closed', cancelled: 'Cancelled',
};

// Status / priority chip colours (rendered as .status-chip like the leads table).
const STATUS_HEX = {
  open: '#2563eb', pending: '#d97706', work_in_progress: '#7c3aed',
  completed: '#16a34a', closed: '#64748b', cancelled: '#dc2626',
};
const PRIORITY_HEX = {
  low: '#16a34a', medium: '#d97706', high: '#ea580c', urgent: '#dc2626',
};

const GROUP_BY = [
  { value: 'none', label: 'None' },
  { value: 'project', label: 'Project' },
  { value: 'department', label: 'Department' },
  { value: 'status', label: 'Status' },
];

// Toolbar pill options (single-select unless noted).
const ASSIGN_OPTIONS = [
  { value: 'by_me', label: 'Assigned by me' },
  { value: 'to_me', label: 'Assigned to me' },
];
const STATUS_FILTER_OPTIONS = Object.entries(STATUS_LABELS)
  .filter(([v]) => v !== 'pending')
  .map(([v, l]) => ({ value: v, label: l }));
const OPTION_TOGGLES = [
  { value: 'include_closed', label: 'Include Closed / Cancelled' },
  { value: 'updated_today', label: 'Updated Today' },
];

// Uploaded files are served by the backend at :5000/uploads (file_url is relative).
const FILE_BASE = `http://${window.location.hostname}:5000`;
const fileHref = (att) => (att?.file_url?.startsWith('http') ? att.file_url : `${FILE_BASE}${att?.file_url || ''}`);

// Deterministic avatar colour from a user id so each person keeps one colour.
const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];
const colorFor = (id) => {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const initials = (u) =>
  `${(u?.first_name || '?')[0] || ''}${(u?.last_name || '')[0] || ''}`.toUpperCase();
const fullName = (u) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Follow-up urgency for active tasks: 'missed' (past), 'today', or '' (future/none).
const fuState = (task) => {
  const active = task.status === 'open' || task.status === 'work_in_progress';
  if (!task.follow_up_date || !active) return '';
  const today = startOfDay(new Date());
  const fu = startOfDay(task.follow_up_date);
  if (fu < today) return 'missed';
  if (fu.getTime() === today.getTime()) return 'today';
  return '';
};

const groupKeyOf = (task, by) => {
  if (by === 'project') return task.project?.project_name || 'No project';
  if (by === 'department') return task.department?.name || 'No department';
  if (by === 'status') return STATUS_LABELS[task.status] || task.status;
  return '';
};

// A soft-tinted chip identical to the leads status-chip.
const Chip = ({ hex, children }) => (
  <span
    className="status-chip"
    style={{ backgroundColor: `${hex}22`, color: hex, borderColor: hex }}
  >
    {children}
  </span>
);

// ── Toolbar filter pill — same markup/classes as the My Leads workspace so the
// look is identical. Supports single-select (radio) and multi-select (checkbox).
const FilterDropdown = ({
  label, mobileLabel, options, single = false, selectedValues,
  onToggle, onClear, isOpen, onToggleOpen, onClose,
}) => {
  const isSel = (v) => (single ? selectedValues === v : selectedValues.includes(v));
  const count = single
    ? (selectedValues ? '1' : 'All')
    : (selectedValues.length ? selectedValues.length : 'All');
  return (
    <details className="lead-filter-dropdown" open={isOpen}>
      <summary
        className="lead-filter-dropdown__summary"
        aria-expanded={isOpen}
        onClick={(e) => { e.preventDefault(); onToggleOpen(); }}
      >
        <span className="hide-mobile">{label}</span>
        <span className="show-mobile">{mobileLabel || label}</span>
        <span className="lead-filter-dropdown__count">{count}</span>
      </summary>
      <div className="lead-filter-dropdown__menu">
        <div className="lead-filter-dropdown__menu-head">
          <strong>{label}</strong>
          <button type="button" onClick={(e) => { e.preventDefault(); onClear(); onClose(); }}>Clear</button>
        </div>
        {!options.length ? (
          <p className="lead-filter-dropdown__empty">No options</p>
        ) : (
          options.map((opt) => (
            <label key={opt.value} className="lead-filter-dropdown__item">
              <input
                type={single ? 'radio' : 'checkbox'}
                checked={isSel(opt.value)}
                onChange={() => { onToggle(opt.value); if (single) onClose(); }}
              />
              <span>{opt.label}</span>
            </label>
          ))
        )}
      </div>
    </details>
  );
};

// ── Mobile filter drawer — the "Filters" pill that opens a sectioned sheet,
// identical to the My Leads mobile experience.
const MobileFilters = ({ sections, totalSelected, isOpen, onToggleOpen, onClearAll }) => (
  <details className="lead-mobile-filters show-mobile" open={isOpen}>
    <summary
      className="lead-mobile-filters__summary"
      aria-expanded={isOpen}
      onClick={(e) => { e.preventDefault(); onToggleOpen(); }}
    >
      <FunnelIcon style={{ width: 14, height: 14 }} />
      <span>Filters</span>
      <span className="lead-mobile-filters__count">{totalSelected || 'All'}</span>
    </summary>
    <div className="lead-mobile-filters__menu">
      {sections.map((sec) => (
        <div className="lead-mobile-filters__section" key={sec.key}>
          <div className="lead-mobile-filters__head">
            <strong>{sec.label}</strong>
            <button type="button" onClick={sec.onClear}>Clear</button>
          </div>
          {!sec.options.length ? (
            <p className="lead-mobile-filters__empty">No options</p>
          ) : (
            sec.options.map((opt) => (
              <label key={opt.value} className="lead-mobile-filters__item">
                <input
                  type={sec.single ? 'radio' : 'checkbox'}
                  checked={sec.single ? sec.selectedValues === opt.value : sec.selectedValues.includes(opt.value)}
                  onChange={() => sec.onToggle(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))
          )}
        </div>
      ))}
      <button type="button" className="lead-mobile-filters__clear-all" onClick={onClearAll}>Clear All</button>
    </div>
  </details>
);

const TaskListPage = () => {
  const currentUser = useSelector((state) => state.auth.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [followUpFilter, setFollowUpFilter] = useState(''); // '' | 'today' | 'missed'
  const [projectFilter, setProjectFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [assignFilter, setAssignFilter] = useState(''); // '' | 'by_me' | 'to_me'
  const [assigneeFilter, setAssigneeFilter] = useState(''); // '' | <user id> — a specific assignee
  const [updatedToday, setUpdatedToday] = useState(false);
  const [groupBy, setGroupBy] = useState('none');
  const [openFilterKey, setOpenFilterKey] = useState(null); // which toolbar/mobile filter pill is open
  const [departments, setDepartments] = useState([]); // full list for the filter
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({}); // id -> full task detail (lazy)
  const [detailLoading, setDetailLoading] = useState(null);
  const [modal, setModal] = useState({ open: false, mode: 'view', taskId: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (includeClosed) params.include_closed = true;
      if (followUpFilter) params.followUpFilter = followUpFilter;
      // The list filters, groups and paginates client-side over the full set, so
      // page through the server (capped at 100/page) until every task is loaded.
      const fetchAllTasks = async () => {
        const acc = [];
        let pg = 1;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const resp = await taskApi.getAll({ ...params, page: pg, limit: 100 });
          acc.push(...(resp.data || []));
          if (!resp.meta?.hasNextPage) break;
          pg += 1;
        }
        return acc;
      };
      const allRows = await fetchAllTasks();
      setRows(allRows);
      setDetails({}); // drawer caches may be stale after a reload
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load tasks');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, includeClosed, followUpFilter]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, includeClosed, followUpFilter]);

  // The department filter lists every department (not only those present in the
  // currently loaded tasks), so it stays complete regardless of the result set.
  useEffect(() => {
    (async () => {
      try {
        const res = await departmentApi.getDropdown();
        setDepartments(res.data || []);
      } catch {
        /* filter falls back to departments seen in the loaded tasks */
      }
    })();
  }, []);

  const FOLLOW_UP_TABS = [
    { value: '', label: 'All Tasks', short: 'All' },
    { value: 'today', label: "Today's Follow-up", short: 'Today' },
    { value: 'missed', label: 'Missed Follow-up', short: 'Missed' },
  ];

  const openView = (id) => setModal({ open: true, mode: 'view', taskId: id });
  const openCreate = () => setModal({ open: true, mode: 'create', taskId: null });
  const closeModal = () => setModal({ open: false, mode: 'view', taskId: null });

  // Expand a row's inline drawer and lazily fetch its full detail (description,
  // attachments, full activity with status + author) the first time it opens.
  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!details[id]) {
      setDetailLoading(id);
      try {
        const res = await taskApi.getById(id);
        setDetails((p) => ({ ...p, [id]: res.data }));
      } catch {
        /* drawer falls back to the list-row data */
      } finally {
        setDetailLoading(null);
      }
    }
  };

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Project / department options come from the loaded set (server-filtered by
  // search / status / follow-up); project + department then filter client-side.
  const projectOptions = useMemo(
    () => [...new Set(rows.map((t) => t.project?.project_name).filter(Boolean))].sort(),
    [rows]
  );
  const deptOptions = useMemo(() => {
    // Prefer the full department list; fall back to whatever the loaded tasks show.
    const fromApi = departments.map((d) => d.name).filter(Boolean);
    const fromRows = rows.map((t) => t.department?.name).filter(Boolean);
    return [...new Set([...fromApi, ...fromRows])].sort();
  }, [departments, rows]);

  // Assignee options are the distinct people assigned across the loaded tasks.
  const assigneeOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((t) => (t.assignees || []).forEach((a) => {
      if (a && a.id != null && !map.has(String(a.id))) {
        map.set(String(a.id), fullName(a) || `User ${a.id}`);
      }
    }));
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const myId = currentUser?.id;
  const visibleRows = useMemo(
    () => rows.filter((t) => {
      if (projectFilter && (t.project?.project_name || '') !== projectFilter) return false;
      if (deptFilter && (t.department?.name || '') !== deptFilter) return false;
      // "Assigned by me" = I created it; "Assigned to me" = I'm an assignee.
      if (assignFilter === 'by_me' && String(t.creator_id) !== String(myId)) return false;
      if (assignFilter === 'to_me' && !(t.assignees || []).some((a) => String(a.id) === String(myId))) return false;
      // Specific assignee filter — task must include the chosen user as an assignee.
      if (assigneeFilter && !(t.assignees || []).some((a) => String(a.id) === assigneeFilter)) return false;

      if (updatedToday) {
        const todayStr = new Date().toDateString();
        const updateVal = t.updated_at || t.updatedAt || t.created_at || t.createdAt;
        if (!updateVal || new Date(updateVal).toDateString() !== todayStr) return false;
      }
      
      return true;
    }),
    [rows, projectFilter, deptFilter, assignFilter, assigneeFilter, myId, updatedToday]
  );

  const groups = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map();
    visibleRows.forEach((t) => {
      const k = groupKeyOf(t, groupBy);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleRows, groupBy]);

  // Reset to the first page whenever the filtered set changes (new search,
  // filter, grouping, or a reload) so we never sit on an empty trailing page.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, projectFilter, deptFilter, assignFilter, assigneeFilter, includeClosed, followUpFilter, groupBy, updatedToday]);

  // Pagination applies to the flat (ungrouped) list.
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => visibleRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visibleRows, safePage, pageSize]
  );

  const clearAll = () => {
    setSearch(''); setStatusFilter(''); setProjectFilter(''); setDeptFilter('');
    setAssignFilter(''); setAssigneeFilter(''); setIncludeClosed(false); setFollowUpFilter('');
    setUpdatedToday(false);
  };

  // Most recent user-written remark (skips status-only + auto "Task created.").
  const latestRemark = (task) => {
    const withText = (task.remarks || []).filter((r) => {
      const c = (r.content || '').trim();
      return c && c !== 'Task created.';
    });
    if (!withText.length) return null;
    return withText.reduce((a, b) => (new Date(b.created_at) >= new Date(a.created_at) ? b : a));
  };

  const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-secondary)', marginBottom: 6 };

  // ── Inline drawer (description / attachments / recent activity) ──
  const renderDrawer = (task) => {
    const detail = details[task.id];
    const loadingDetail = detailLoading === task.id && !detail;
    const description = (detail || task).description;
    const attachments = Array.isArray((detail || task).attachments) ? (detail || task).attachments : [];
    const remarks = (detail?.remarks || task.remarks || []);
    const recent = [...remarks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
    return (
      <tr>
        <td colSpan={6} style={{ padding: 0, maxWidth: 'none', whiteSpace: 'normal', background: 'var(--bg-primary, #f1f5f9)' }}>
          <div className="task-drawer-grid">
            <div>
              <div style={labelStyle}>Description</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {description || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No description.</span>}
              </div>

              <div style={{ ...labelStyle, marginTop: 16 }}>Attachments</div>
              {loadingDetail ? (
                <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>Loading…</span>
              ) : attachments.length === 0 ? (
                <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>No attachments.</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {attachments.map((att, i) => (
                    <a
                      key={att.id || i}
                      href={fileHref(att)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-primary, #e2e8f0)', background: 'var(--bg-card, #fff)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}
                    >
                      <PaperClipIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
                      {att.file_name || 'File'}
                    </a>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="crm-btn crm-btn-primary crm-btn-sm"
                  onClick={(e) => { e.stopPropagation(); openView(task.id); }}
                >
                  <BoltIcon style={{ width: 14, height: 14, marginRight: 4 }} /> Open &amp; update
                </button>
              </div>
            </div>

            <div>
              <div style={labelStyle}>Recent activity</div>
              {loadingDetail ? (
                <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>Loading…</span>
              ) : recent.length === 0 ? (
                <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>No activity.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recent.map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                      {r.status_at_time && <Chip hex={STATUS_HEX[r.status_at_time] || '#64748b'}>{STATUS_LABELS[r.status_at_time] || 'Update'}</Chip>}
                      <span style={{ minWidth: 0 }}>
                        {r.content || 'Status update'}
                        {r.user && <span> — {fullName(r.user)}</span>}
                        {r.created_at && <span style={{ opacity: 0.7 }}> · {fmtDateTime(r.created_at)}</span>}
                        {r.voice?.file_url && (
                          <audio
                            src={r.voice.file_url}
                            controls
                            preload="none"
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'block', height: 30, marginTop: 6, maxWidth: 220 }}
                          />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  // ── A single task row (+ its drawer when expanded) ──
  const renderRow = (task, grouped = false, groupedClass = '') => {
    const fu = fuState(task);
    const assignees = task.assignees || [];
    const isOpen = expandedId === task.id;
    const note = latestRemark(task);
    return (
      <React.Fragment key={task.id}>
        <tr
          className={`${isOpen ? 'is-selected' : ''}${grouped ? ` task-row--grouped ${groupedClass}` : ''}`.trim()}
          onClick={() => toggleExpand(task.id)}
        >
          {/* Task */}
          <td className="task-col-task" style={{ maxWidth: 320 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: grouped ? 0 : 8 }}>
              <ChevronRightIcon style={{ width: 14, height: 14, marginTop: 3, flexShrink: 0, color: isOpen ? 'var(--accent-blue, #2563eb)' : 'var(--text-secondary)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
              <div style={{ minWidth: 0 }}>
                <p className="lead-title">{task.title}</p>
                <small style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                  <span style={{ color: PRIORITY_HEX[task.priority] || '#64748b', fontWeight: 700, textTransform: 'capitalize' }}>{task.priority}</span>
                  {task.creator && <span>· {fullName(task.creator)}</span>}
                  {note && <span style={{ opacity: 0.85 }}>· “{note.content.length > 28 ? `${note.content.slice(0, 28)}…` : note.content}”</span>}
                </small>
              </div>
            </div>
          </td>

          {/* Status */}
          <td className="lead-col-status">
            <Chip hex={STATUS_HEX[task.status] || '#64748b'}>{STATUS_LABELS[task.status] || task.status}</Chip>
            {task.is_overdue && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, fontWeight: 600, color: '#dc2626' }}>Overdue</div>
            )}
          </td>

          {/* Assignees */}
          <td className="hide-mobile">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {assignees.slice(0, 4).map((a, i) => (
                <span
                  key={a.id}
                  className="cell-lead-avatar"
                  title={fullName(a)}
                  style={{ background: colorFor(a.id), color: '#fff', border: '2px solid var(--bg-card, #fff)', marginLeft: i === 0 ? 0 : -8 }}
                >
                  {initials(a)}
                </span>
              ))}
              {assignees.length > 4 && (
                <span className="cell-lead-avatar" style={{ background: '#e2e8f0', color: '#64748b', border: '2px solid var(--bg-card, #fff)', marginLeft: -8 }}>
                  +{assignees.length - 4}
                </span>
              )}
              {assignees.length === 0 && <small>—</small>}
            </div>
          </td>

          {/* Project / Phase */}
          <td className="hide-mobile">
            {task.project?.project_name ? (
              <>
                <p className="lead-title">{task.project.project_name}</p>
                {task.phase?.phase_name && (
                  <small style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {task.phase.phase_name}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '0 6px', borderRadius: 6, color: task.phase.is_approved === false ? '#b91c1c' : '#15803d', background: task.phase.is_approved === false ? '#fef2f2' : '#f0fdf4', border: `1px solid ${task.phase.is_approved === false ? '#fecaca' : '#bbf7d0'}` }}>
                      {task.phase.is_approved === false ? 'Unapproved' : 'Approved'}
                    </span>
                  </small>
                )}
              </>
            ) : <small>—</small>}
            {task.department?.name && (
              <small style={{ display: 'block', marginTop: 2 }}>{task.department.name}{task.subDepartment?.name ? ` · ${task.subDepartment.name}` : ''}</small>
            )}
          </td>

          {/* Follow-up */}
          <td className="task-col-followup">
            {task.follow_up_date ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: fu === 'missed' ? '#dc2626' : fu === 'today' ? '#d97706' : 'var(--text-secondary)' }}>
                <CalendarDaysIcon style={{ width: 12, height: 12 }} />
                <span>{fmtDate(task.follow_up_date)}</span>
                {fu === 'missed' && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>· Missed</span>}
                {fu === 'today' && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>· Today</span>}
              </div>
            ) : <small>—</small>}
          </td>

          {/* Action */}
          <td className="task-col-action" style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
            <div className="lead-workspace__actions-cell">
              <button
                type="button"
                className="crm-btn crm-btn-sm"
                title="Open / Update"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '7px 9px' }}
                onClick={() => openView(task.id)}
              >
                <PencilSquareIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </td>
        </tr>
        {isOpen && renderDrawer(task)}
      </React.Fragment>
    );
  };

  // ── A single task as a mobile card (clean, tap to open) ──
  const renderTaskCard = (task) => {
    const fu = fuState(task);
    const note = latestRemark(task);
    const assignees = task.assignees || [];
    return (
      <div key={task.id} className="task-card" role="button" tabIndex={0} onClick={() => openView(task.id)}>
        <div className="task-card__row1">
          <p className="task-card__title">{task.title}</p>
          <Chip hex={STATUS_HEX[task.status] || '#64748b'}>{STATUS_LABELS[task.status] || task.status}</Chip>
        </div>
        <div className="task-card__meta">
          <span className="task-card__prio" style={{ color: PRIORITY_HEX[task.priority] || '#64748b' }}>{task.priority}</span>
          {task.creator && <span>· {fullName(task.creator)}</span>}
          {task.department?.name && <span>· {task.department.name}</span>}
          {task.project?.project_name && <span>· {task.project.project_name}</span>}
        </div>
        {note && (
          <div className="task-card__note">“{note.content.length > 70 ? `${note.content.slice(0, 70)}…` : note.content}”</div>
        )}
        <div className="task-card__row2">
          <span className={`task-card__fu task-card__fu--${fu || 'none'}`}>
            {task.follow_up_date ? (
              <>
                <CalendarDaysIcon style={{ width: 13, height: 13 }} />
                {fmtDate(task.follow_up_date)}
                {fu === 'missed' && ' · Missed'}
                {fu === 'today' && ' · Today'}
              </>
            ) : 'No follow-up'}
          </span>
          <div className="task-card__right">
            {assignees.length > 0 && (
              <div className="task-card__avatars">
                {assignees.slice(0, 3).map((a, i) => (
                  <span key={a.id} className="cell-lead-avatar" title={fullName(a)}
                    style={{ background: colorFor(a.id), color: '#fff', border: '2px solid var(--bg-card, #fff)', marginLeft: i === 0 ? 0 : -8 }}>
                    {initials(a)}
                  </span>
                ))}
                {assignees.length > 3 && (
                  <span className="cell-lead-avatar" style={{ background: '#e2e8f0', color: '#64748b', border: '2px solid var(--bg-card, #fff)', marginLeft: -8 }}>
                    +{assignees.length - 3}
                  </span>
                )}
              </div>
            )}
            <button type="button" className="crm-btn crm-btn-sm task-card__action" title="Open / Update"
              onClick={(e) => { e.stopPropagation(); openView(task.id); }}>
              <PencilSquareIcon style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const records = visibleRows.length;

  return (
    <section className="lead-workspace task-workspace" style={{ height: 'auto', overflow: 'visible' }}>
      {/* ── Header ── */}
      <header className="lead-workspace__header">
        <div>
          <h1>Task Management</h1>
          <p>Your tasks — created by you or assigned to you.</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={load} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="workspace-btn workspace-btn--primary" onClick={openCreate}>
            <PlusCircleIcon style={{ width: 16, height: 16 }} /> New Task
          </button>
        </div>
      </header>

      {/* ── Toolbar (filters + search) — same pill layout as My Leads ── */}
      <div className="lead-workspace__toolbar">
        <div className="lead-workspace__toolbar-filters">
          <FilterDropdown
            label="Assignment" mobileLabel="Assign" single options={ASSIGN_OPTIONS}
            selectedValues={assignFilter}
            onToggle={(v) => setAssignFilter((p) => (p === v ? '' : v))}
            onClear={() => setAssignFilter('')}
            isOpen={openFilterKey === 'assign'}
            onToggleOpen={() => setOpenFilterKey((p) => (p === 'assign' ? null : 'assign'))}
            onClose={() => setOpenFilterKey(null)}
          />
          <FilterDropdown
            label="Status" single options={STATUS_FILTER_OPTIONS}
            selectedValues={statusFilter}
            onToggle={(v) => setStatusFilter((p) => (p === v ? '' : v))}
            onClear={() => setStatusFilter('')}
            isOpen={openFilterKey === 'status'}
            onToggleOpen={() => setOpenFilterKey((p) => (p === 'status' ? null : 'status'))}
            onClose={() => setOpenFilterKey(null)}
          />
          <FilterDropdown
            label="Project" single options={projectOptions.map((p) => ({ value: p, label: p }))}
            selectedValues={projectFilter}
            onToggle={(v) => setProjectFilter((p) => (p === v ? '' : v))}
            onClear={() => setProjectFilter('')}
            isOpen={openFilterKey === 'project'}
            onToggleOpen={() => setOpenFilterKey((p) => (p === 'project' ? null : 'project'))}
            onClose={() => setOpenFilterKey(null)}
          />
          <FilterDropdown
            label="Department" mobileLabel="Dept" single options={deptOptions.map((d) => ({ value: d, label: d }))}
            selectedValues={deptFilter}
            onToggle={(v) => setDeptFilter((p) => (p === v ? '' : v))}
            onClear={() => setDeptFilter('')}
            isOpen={openFilterKey === 'dept'}
            onToggleOpen={() => setOpenFilterKey((p) => (p === 'dept' ? null : 'dept'))}
            onClose={() => setOpenFilterKey(null)}
          />
          <FilterDropdown
            label="Assignee" mobileLabel="User" single options={assigneeOptions}
            selectedValues={assigneeFilter}
            onToggle={(v) => setAssigneeFilter((p) => (p === v ? '' : v))}
            onClear={() => setAssigneeFilter('')}
            isOpen={openFilterKey === 'assignee'}
            onToggleOpen={() => setOpenFilterKey((p) => (p === 'assignee' ? null : 'assignee'))}
            onClose={() => setOpenFilterKey(null)}
          />
          <FilterDropdown
            label="Options" options={OPTION_TOGGLES}
            selectedValues={[includeClosed && 'include_closed', updatedToday && 'updated_today'].filter(Boolean)}
            onToggle={(v) => { if (v === 'include_closed') setIncludeClosed((b) => !b); else setUpdatedToday((b) => !b); }}
            onClear={() => { setIncludeClosed(false); setUpdatedToday(false); }}
            isOpen={openFilterKey === 'options'}
            onToggleOpen={() => setOpenFilterKey((p) => (p === 'options' ? null : 'options'))}
            onClose={() => setOpenFilterKey(null)}
          />
          <button type="button" className="lead-workspace__clear-filters" onClick={clearAll}>
            <span className="hide-mobile">Clear All</span>
            <span className="show-mobile">Clear</span>
          </button>
        </div>

        <div className="lead-workspace__toolbar-search">
          <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Search tasks by title or description"
          />
          <MobileFilters
            totalSelected={
              (assignFilter ? 1 : 0) + (statusFilter ? 1 : 0) + (projectFilter ? 1 : 0)
              + (deptFilter ? 1 : 0) + (assigneeFilter ? 1 : 0) + (includeClosed ? 1 : 0) + (updatedToday ? 1 : 0)
            }
            isOpen={openFilterKey === 'mobile_filters'}
            onToggleOpen={() => setOpenFilterKey((p) => (p === 'mobile_filters' ? null : 'mobile_filters'))}
            onClearAll={() => { clearAll(); setOpenFilterKey(null); }}
            sections={[
              { key: 'assign', label: 'Assignment', single: true, options: ASSIGN_OPTIONS, selectedValues: assignFilter, onToggle: (v) => setAssignFilter((p) => (p === v ? '' : v)), onClear: () => setAssignFilter('') },
              { key: 'status', label: 'Status', single: true, options: STATUS_FILTER_OPTIONS, selectedValues: statusFilter, onToggle: (v) => setStatusFilter((p) => (p === v ? '' : v)), onClear: () => setStatusFilter('') },
              { key: 'project', label: 'Project', single: true, options: projectOptions.map((p) => ({ value: p, label: p })), selectedValues: projectFilter, onToggle: (v) => setProjectFilter((p) => (p === v ? '' : v)), onClear: () => setProjectFilter('') },
              { key: 'dept', label: 'Department', single: true, options: deptOptions.map((d) => ({ value: d, label: d })), selectedValues: deptFilter, onToggle: (v) => setDeptFilter((p) => (p === v ? '' : v)), onClear: () => setDeptFilter('') },
              { key: 'assignee', label: 'Assignee', single: true, options: assigneeOptions, selectedValues: assigneeFilter, onToggle: (v) => setAssigneeFilter((p) => (p === v ? '' : v)), onClear: () => setAssigneeFilter('') },
              { key: 'options', label: 'Options', single: false, options: OPTION_TOGGLES, selectedValues: [includeClosed && 'include_closed', updatedToday && 'updated_today'].filter(Boolean), onToggle: (v) => { if (v === 'include_closed') setIncludeClosed((b) => !b); else setUpdatedToday((b) => !b); }, onClear: () => { setIncludeClosed(false); setUpdatedToday(false); } },
            ]}
          />
        </div>
      </div>

      {/* ── List card ── */}
      <div className="lead-workspace__grid">
        <div className="lead-workspace__list-card">
          {/* Tabs + group-by + record count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
            <div className="filter-tabs mobile-compact-tabs">
              {FOLLOW_UP_TABS.map((t) => (
                <button
                  key={t.value || 'all'}
                  type="button"
                  className={`filter-tab ${followUpFilter === t.value ? 'active' : ''}`}
                  onClick={() => setFollowUpFilter(t.value)}
                >
                  <span className="hide-mobile">{t.label}</span>
                  <span className="show-mobile">{t.short}</span>
                </button>
              ))}
              <small className="filter-tabs__records">{records} record{records === 1 ? '' : 's'}</small>
            </div>
            <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="filter-tabs__records" style={{ margin: 0, padding: 0 }}>Group by</span>
              <div className="filter-tabs">
                {GROUP_BY.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`filter-tab ${groupBy === g.value ? 'active' : ''}`}
                    onClick={() => setGroupBy(g.value)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lead-workspace__table-wrap">
            <table className="lead-workspace__table">
              <thead>
                <tr>
                  <th className="task-col-task" style={{ width: 'auto' }}>Task</th>
                  <th className="lead-col-status">Status</th>
                  <th className="hide-mobile" style={{ width: 130 }}>Assignees</th>
                  <th className="hide-mobile" style={{ width: 170 }}>Project / Department</th>
                  <th className="task-col-followup" style={{ width: 140 }}>Follow-up</th>
                  <th className="task-col-action" style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="lead-workspace__empty">Loading tasks…</td></tr>
                )}
                {!loading && records === 0 && (
                  <tr><td colSpan={6} className="lead-workspace__empty">No tasks found for current filters</td></tr>
                )}

                {/* Ungrouped */}
                {!loading && groupBy === 'none' && pagedRows.map(renderRow)}

                {/* Grouped */}
                {!loading && groupBy !== 'none' && groups.map(([key, tasks]) => {
                  const collapsed = collapsedGroups.has(`${groupBy}:${key}`);
                  const done = tasks.filter((t) => t.status === 'completed' || t.status === 'closed').length;
                  const over = tasks.filter((t) => t.is_overdue).length;
                  return (
                    <React.Fragment key={key}>
                      <tr onClick={() => toggleGroup(`${groupBy}:${key}`)} style={{ background: 'var(--bg-primary, #f1f5f9)', cursor: 'pointer' }}>
                        <td colSpan={6} style={{ maxWidth: 'none', whiteSpace: 'normal' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ChevronRightIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)', transform: collapsed ? 'none' : 'rotate(90deg)', transition: 'transform .15s' }} />
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{key}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue, #2563eb)', background: 'rgba(37,99,235,0.1)', borderRadius: 999, padding: '1px 8px' }}>{tasks.length}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {done}/{tasks.length} done{over > 0 && <span style={{ color: '#dc2626' }}> · {over} overdue</span>}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {!collapsed && tasks.map((t) => {
                        const groupedClass = groupBy === 'department' ? 'task-row--grouped-department' : 
                                           groupBy === 'project' ? 'task-row--grouped-project' : 'task-row--grouped';
                        return renderRow(t, true, groupedClass);
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile card list (shown ≤640px; the table is hidden there) ── */}
          <div className="task-cards-mobile">
            {loading && <div className="task-cards-msg">Loading tasks…</div>}
            {!loading && records === 0 && <div className="task-cards-msg">No tasks found for current filters</div>}
            {!loading && groupBy === 'none' && pagedRows.map(renderTaskCard)}
            {!loading && groupBy !== 'none' && groups.map(([key, tasks]) => {
              const done = tasks.filter((t) => t.status === 'completed' || t.status === 'closed').length;
              const over = tasks.filter((t) => t.is_overdue).length;
              return (
                <div key={key} className="task-cards-group">
                  <div className="task-cards-group__head">
                    <span className="task-cards-group__name">{key}</span>
                    <span className="task-cards-group__count">{tasks.length}</span>
                    <span className="task-cards-group__stat">{done}/{tasks.length} done{over > 0 && <span style={{ color: '#dc2626' }}> · {over} overdue</span>}</span>
                  </div>
                  {tasks.map(renderTaskCard)}
                </div>
              );
            })}
          </div>

          {/* Pagination — only for the flat (ungrouped) list */}
          {!loading && groupBy === 'none' && (
            <Pagination
              page={safePage}
              pageSize={pageSize}
              total={records}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </div>
      </div>

      {modal.open && (
        <TaskModal
          mode={modal.mode}
          taskId={modal.taskId}
          onClose={closeModal}
          onSaved={load}
        />
      )}
    </section>
  );
};

export default TaskListPage;
