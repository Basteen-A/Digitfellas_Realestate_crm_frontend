import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon, PlusIcon, Squares2X2Icon, ClipboardDocumentListIcon,
  CheckCircleIcon, ExclamationTriangleIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import taskApi from '../../api/taskApi';
import TaskModal from './TaskModal';
import { getRoleCode } from '../../utils/permissions';
import { badgeStyle, TASK_STATUS_TEXT, TASK_PRIORITY_TEXT } from '../../utils/badgeColors';
// Dashboard design system (stat cards, page header, cards, tables) shared with
// the portal dashboards so this widget is visually consistent.
import '../portals/collection/CollectionWorkspace.css';
// .status-chip — the same chip the task list renders status/priority with.
import '../portals/common/LeadWorkspacePage.css';
import './TaskManagement.css';

const STATUS_LABELS = {
  open: 'Open', pending: 'Pending', work_in_progress: 'Work in Progress',
  completed: 'Completed', closed: 'Closed', cancelled: 'Cancelled',
};
const BREAKDOWN_ORDER = ['open', 'work_in_progress', 'completed', 'closed', 'cancelled'];

// KPI cards mirror the portal dashboards: colored top accent (variant), faint
// icon, value + sub-label.
const KPI_CARDS = [
  { key: 'total', label: 'Total Tasks', sub: 'all tasks', icon: Squares2X2Icon, variant: '' },
  { key: 'open', label: 'Open', sub: 'to start', icon: ClipboardDocumentListIcon, variant: 'info' },
  { key: 'work_in_progress', label: 'In Progress', sub: 'being worked on', icon: ArrowPathIcon, variant: 'warning' },
  { key: 'completed', label: 'Completed', sub: 'done', icon: CheckCircleIcon, variant: 'success' },
  { key: 'overdue', label: 'Overdue', sub: 'past due', icon: ExclamationTriangleIcon, variant: 'danger' },
];

// Status renders exactly as it does on the task list screen: the canonical
// badge-system text colour, with badgeStyle deriving bg + border. Priority is
// deliberately NOT a chip — it sits as coloured text under the task title so a
// row never shows two competing badge styles side by side.
const Chip = ({ hex, children }) => (
  <span className="status-chip" style={{ ...badgeStyle(hex), textTransform: 'capitalize' }}>{children}</span>
);

const timeAgo = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `about ${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const TaskDashboard = ({ onOpenTasks }) => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const isAdmin = ['SA', 'ADM'].includes(getRoleCode(user));
  const goTasks = () => (onOpenTasks ? onOpenTasks() : navigate('/task-portal/tasks'));

  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, list] = await Promise.all([taskApi.getStats(), taskApi.getAll({ include_closed: true })]);
      setStats(st.data || null);
      setRecent((list.data || []).slice(0, 8));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxBar = stats ? Math.max(1, ...BREAKDOWN_ORDER.map((k) => stats[k] || 0)) : 1;

  return (
    <div className="col-dashboard">
      {/* ── Page header ── */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>Dashboard</h1>
          <p>All tasks — {isAdmin ? 'Super Admin' : 'Standard Executive'} view</p>
        </div>
        <div className="col-page-header-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={load} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="col-btn col-btn-primary" onClick={() => setCreateOpen(true)}>
            <PlusIcon style={{ width: 16, height: 16 }} /> New Task
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      {stats && (
        <div className="col-stat-grid-new">
          {KPI_CARDS.map(({ key, label, sub, icon: Icon, variant }) => (
            <div className={`col-stat-card-new ${variant}`} key={key}>
              <div className="col-stat-label-new">{label}</div>
              <div className="col-stat-value-new">{stats[key] ?? 0}</div>
              <div className="col-stat-sub-new">{sub}</div>
              <div className="col-stat-icon-new"><Icon style={{ width: 24, height: 24 }} /></div>
            </div>
          ))}
        </div>
      )}

      {/* ── Status breakdown, then recent activity — each its own full-width
             block (they used to share a 50/50 row, which squeezed the activity
             list into a column too narrow for its status/priority chips). ── */}
      <div className="col-card-new">
        <div className="col-card-header-new">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Squares2X2Icon style={{ width: 20, height: 20, color: 'var(--accent-blue)' }} />
            <div>
              <div className="col-card-title-new">Status Breakdown</div>
              <div className="col-card-subtitle-new">Tasks by current status</div>
            </div>
          </div>
        </div>
        <div className="col-card-body-new">
          {!stats ? (
            <p className="col-empty-mini">No data yet.</p>
          ) : (
            <div className="tm-breakdown">
              {BREAKDOWN_ORDER.map((k) => (
                <div className="tm-breakdown__row" key={k}>
                  <span className="tm-breakdown__label">{STATUS_LABELS[k]}</span>
                  <span className="tm-breakdown__track">
                    <span className={`tm-breakdown__fill s-${k}`} style={{ width: `${((stats[k] || 0) / maxBar) * 100}%` }} />
                  </span>
                  <span className="tm-breakdown__count">{stats[k] || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="col-card-new">
        <div className="col-card-header-new">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockIcon style={{ width: 20, height: 20, color: 'var(--accent-blue)' }} />
            <div>
              <div className="col-card-title-new">Recent Activity</div>
              <div className="col-card-subtitle-new">Latest updates across tasks</div>
            </div>
          </div>
          <button type="button" className="col-btn col-btn-ghost col-btn-sm" onClick={goTasks}>View All →</button>
        </div>
        <div className="col-card-body-flush-new">
          {loading ? (
            <div className="col-empty-mini">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="col-empty-mini">
              <ClockIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <span>No recent activity.</span>
            </div>
          ) : (
            <div className="col-table-scroll-y">
              <table className="col-table-new">
                <thead>
                  <tr><th>Task</th><th>Status</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {/* Same row shape as the Task List screen — see TaskDashboardWidget. */}
                  {recent.map((t) => {
                    const last = (t.remarks || [])[(t.remarks || []).length - 1];
                    const note = last && last.content && last.content !== 'Task created.' ? last.content : '';
                    return (
                      <tr key={t.id} className="col-clickable-row" onClick={() => setOpenTaskId(t.id)}>
                        <td>
                          <p className="lead-title">{t.title}</p>
                          <small style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                            <span style={{ color: TASK_PRIORITY_TEXT[t.priority] || '#64748b', fontWeight: 500, textTransform: 'capitalize' }}>{t.priority}</span>
                            {t.creator && <span>· {`${t.creator.first_name || ''} ${t.creator.last_name || ''}`.trim()}</span>}
                            {note && <span style={{ opacity: 0.85 }}>· “{note.length > 28 ? `${note.slice(0, 28)}…` : note}”</span>}
                          </small>
                        </td>
                        <td className="lead-col-status">
                          <Chip hex={TASK_STATUS_TEXT[t.status] || '#64748b'}>{STATUS_LABELS[t.status] || t.status}</Chip>
                          {t.is_overdue && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, fontWeight: 600, color: '#dc2626' }}>Overdue</div>
                          )}
                        </td>
                        <td className="col-cell-secondary" style={{ whiteSpace: 'nowrap' }}>{timeAgo(t.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <TaskModal mode="create" onClose={() => setCreateOpen(false)} onSaved={load} />
      )}
      {openTaskId && (
        <TaskModal mode="view" taskId={openTaskId} onClose={() => setOpenTaskId(null)} onSaved={load} />
      )}
    </div>
  );
};

export default TaskDashboard;
