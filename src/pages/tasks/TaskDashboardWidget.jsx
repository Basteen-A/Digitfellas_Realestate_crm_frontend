import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ClipboardDocumentListIcon,
  InboxStackIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import taskApi from '../../api/taskApi';
import TaskModal from './TaskModal';
import { badgeStyle, TASK_STATUS_TEXT, TASK_PRIORITY_TEXT } from '../../utils/badgeColors';
import '../portals/collection/CollectionWorkspace.css';
// .status-chip - the same chip the task list renders status/priority with.
import '../portals/common/LeadWorkspacePage.css';
import './TaskManagement.css';

const STATUS_LABELS = {
  open: 'Open', pending: 'Pending', work_in_progress: 'Work in Progress',
  completed: 'Completed', closed: 'Closed', cancelled: 'Cancelled',
};

// Status / priority chips render exactly as they do on the task list screen:
// the canonical badge-system text colour, with badgeStyle deriving bg + border.
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

/**
 * Compact Task Management panel embedded inside a portal/admin dashboard.
 * Shows stat cards + side-by-side Status Breakdown and Recent Activity.
 * Clicking a task opens its detail popup; "View all" routes to the tasks page.
 */
const TaskDashboardWidget = ({ onOpenTasks }) => {
  const navigate = useNavigate();
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
      setRecent((list.data || []).slice(0, 5));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const goTasks = () => {
    if (onOpenTasks) onOpenTasks();
    else navigate('/task-portal/tasks');
  };

  return (
    <section className="tm-page" style={{ marginTop: 24 }}>
      <div className="tm-card">
        <div className="tm-card__head">
          <div className="tm-card__title" style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500, textTransform: 'none', fontSize: 15, letterSpacing: 0 }}>Task Management</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="tm-link" onClick={goTasks}>View all</button>
            <button type="button" className="tm-btn" onClick={() => setCreateOpen(true)}>+ New Task</button>
          </div>
        </div>

        {stats && (
          <div className="col-stat-grid-new" style={{ marginTop: 14, marginBottom: 0 }}>
            {[
              { label: 'Total', value: stats.total, sub: 'all tasks', icon: ClipboardDocumentListIcon, variant: 'info' },
              { label: 'Open', value: stats.open, sub: 'awaiting action', icon: InboxStackIcon, variant: 'purple' },
              { label: 'In Progress', value: stats.work_in_progress, sub: 'being worked on', icon: ClockIcon, variant: 'warning' },
              { label: 'Completed', value: stats.completed, sub: 'finished', icon: CheckCircleIcon, variant: 'success' },
              { label: 'Overdue', value: stats.overdue, sub: 'past due date', icon: ExclamationTriangleIcon, variant: 'danger' },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div className={`col-stat-card-new ${card.variant}`} key={card.label}>
                  <div className="col-stat-label-new">{card.label}</div>
                  <div className="col-stat-value-new">{card.value ?? 0}</div>
                  <div className="col-stat-sub-new">{card.sub}</div>
                  <div className="col-stat-icon-new">
                    <Icon style={{ width: 24, height: 24 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent activity - one full-width block, same table + chips as the
            Task Dashboard. (The Status Breakdown block was removed: it
            duplicated the stat cards directly above it.) */}
        <div className="col-card-new" style={{ marginTop: 16, marginBottom: 0 }}>
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockIcon style={{ width: 20, height: 20, color: 'var(--accent-blue)' }} />
              <div>
                <div className="col-card-title-new">Recent Activity</div>
                <div className="col-card-subtitle-new">Latest updates across tasks</div>
              </div>
            </div>
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
              <div className="col-table-scroll">
                <table className="col-table-new">
                  {/* Rows mirror the Task List screen exactly: title in .lead-title with
                      priority · creator · last remark inline underneath, and the status
                      chip carrying the Overdue flag. Priority is therefore NOT its own
                      column here - same as the Task List. */}
                  <thead>
                    <tr><th>Task</th><th>Status</th><th>Updated</th></tr>
                  </thead>
                  <tbody>
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
      </div>

      {createOpen && (
        <TaskModal mode="create" onClose={() => setCreateOpen(false)} onSaved={load} />
      )}
      {openTaskId && (
        <TaskModal mode="view" taskId={openTaskId} onClose={() => setOpenTaskId(null)} onSaved={load} />
      )}
    </section>
  );
};

export default TaskDashboardWidget;
