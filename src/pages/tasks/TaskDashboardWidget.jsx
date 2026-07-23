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
import '../portals/collection/CollectionWorkspace.css';
import './TaskManagement.css';

const STATUS_LABELS = {
  open: 'Open', pending: 'Pending', work_in_progress: 'Work in Progress',
  completed: 'Completed', closed: 'Closed', cancelled: 'Cancelled',
};
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

        {/* Recent activity — full-width task list. (The Status Breakdown block was
            removed: it duplicated the stat cards directly above it.) */}
        <div style={{ marginTop: 16 }}>
          <div className="tm-card__title" style={{ marginBottom: 4 }}>RECENT ACTIVITY</div>
          {loading && <p className="tm-hint">Loading…</p>}
          {!loading && recent.length === 0 && <p className="tm-hint">No recent activity.</p>}
          {!loading && recent.map((t) => {
            const last = (t.remarks || [])[(t.remarks || []).length - 1];
            const note = last && last.content && last.content !== 'Task created.' ? `"${last.content}"` : '';
            return (
              <div className="tm-activity" key={t.id} onClick={() => setOpenTaskId(t.id)}>
                <div>
                  <div className="tm-activity__title">{t.title}</div>
                  <div className="tm-activity__sub">
                    {t.creator ? `${t.creator.first_name} ${t.creator.last_name || ''}` : '—'} · {timeAgo(t.created_at)}
                    {note && <> · {note}</>}
                  </div>
                </div>
                <div className="tm-activity__badges">
                  <span className={`tm-prio tm-prio--${t.priority}`}>{t.priority}</span>
                  <span className={`tm-badge tm-badge--${t.status}`}>{STATUS_LABELS[t.status]}</span>
                </div>
              </div>
            );
          })}
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
