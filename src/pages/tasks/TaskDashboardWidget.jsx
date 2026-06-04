import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import taskApi from '../../api/taskApi';
import TaskModal from './TaskModal';
import './TaskManagement.css';

const STATUS_LABELS = {
  open: 'Open', pending: 'Pending', work_in_progress: 'Work in Progress',
  completed: 'Completed', closed: 'Closed', cancelled: 'Cancelled',
};
// Pending removed from the breakdown (point 9)
const BREAKDOWN_ORDER = ['open', 'work_in_progress', 'completed', 'closed', 'cancelled'];

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
      setRecent((list.data || []).slice(0, 6));
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

  const maxBar = stats ? Math.max(1, ...BREAKDOWN_ORDER.map((k) => stats[k] || 0)) : 1;

  return (
    <section className="tm-page" style={{ marginTop: 24 }}>
      <div className="tm-card">
        <div className="tm-card__head">
          <div className="tm-card__title" style={{ margin: 0 }}>Task Management</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="tm-link" onClick={goTasks}>View all</button>
            <button type="button" className="tm-btn" onClick={() => setCreateOpen(true)}>+ New Task</button>
          </div>
        </div>

        {stats && (
          <div className="tm-stats" style={{ marginTop: 12 }}>
            <div className="tm-stat"><div className="tm-stat__label">Total</div><div className="tm-stat__value">{stats.total}</div></div>
            <div className="tm-stat"><div className="tm-stat__label">Open</div><div className="tm-stat__value">{stats.open}</div></div>
            <div className="tm-stat"><div className="tm-stat__label">In Progress</div><div className="tm-stat__value">{stats.work_in_progress}</div></div>
            <div className="tm-stat"><div className="tm-stat__label">Completed</div><div className="tm-stat__value">{stats.completed}</div></div>
            <div className="tm-stat tm-stat--overdue"><div className="tm-stat__label">Overdue</div><div className="tm-stat__value">{stats.overdue}</div></div>
          </div>
        )}

        {/* Side-by-side: status breakdown | recent activity (point 10) */}
        <div className="tm-dash-split" style={{ marginTop: 16 }}>
          {/* Status breakdown */}
          <div className="tm-subcard">
            <div className="tm-card__title" style={{ marginBottom: 12 }}>STATUS BREAKDOWN</div>
            {stats ? (
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
            ) : <p className="tm-hint">Loading…</p>}
          </div>

          {/* Recent activity */}
          <div className="tm-subcard">
            <div className="tm-card__title" style={{ marginBottom: 12 }}>RECENT ACTIVITY</div>
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
