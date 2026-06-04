import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EyeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import taskApi from '../../api/taskApi';
import TaskModal from './TaskModal';
import './TaskManagement.css';

const STATUS_LABELS = {
  open: 'Open', pending: 'Pending', work_in_progress: 'Work in Progress',
  completed: 'Completed', closed: 'Closed', cancelled: 'Cancelled',
};

const initials = (u) =>
  `${(u?.first_name || '?')[0] || ''}${(u?.last_name || '')[0] || ''}`.toUpperCase();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const TaskListPage = () => {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [modal, setModal] = useState({ open: false, mode: 'view', taskId: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (includeClosed) params.include_closed = true;
      const [list, st] = await Promise.all([taskApi.getAll(params), taskApi.getStats()]);
      setRows(list.data || []);
      setStats(st.data || null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load tasks');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, includeClosed]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, includeClosed]);

  const openView = (id) => setModal({ open: true, mode: 'view', taskId: id });
  const openCreate = () => setModal({ open: true, mode: 'create', taskId: null });
  const closeModal = () => setModal({ open: false, mode: 'view', taskId: null });

  // Show the most recent remark a user actually wrote on their last update —
  // skip status-only updates with no text and the auto "Task created." note,
  // and pick by timestamp so it's correct regardless of array order.
  const latestRemark = (task) => {
    const withText = (task.remarks || []).filter((r) => {
      const c = (r.content || '').trim();
      return c && c !== 'Task created.';
    });
    if (!withText.length) return '—';
    const last = withText.reduce((a, b) =>
      (new Date(b.created_at) >= new Date(a.created_at) ? b : a));
    const content = last.content.trim();
    return content.length > 40 ? `${content.slice(0, 40)}…` : content;
  };

  return (
    <section className="tm-page">
      <header className="tm-header">
        <div>
          <h1>Task Management</h1>
          <p>Your tasks — created by you or assigned to you.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="tm-btn tm-btn--ghost" onClick={load} disabled={loading} title="Refresh">
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
          <button type="button" className="tm-btn" onClick={openCreate}>+ New Task</button>
        </div>
      </header>

      {stats && (
        <div className="tm-stats">
          <div className="tm-stat"><div className="tm-stat__label">Total</div><div className="tm-stat__value">{stats.total}</div></div>
          <div className="tm-stat"><div className="tm-stat__label">Open</div><div className="tm-stat__value">{stats.open}</div></div>
          <div className="tm-stat"><div className="tm-stat__label">In Progress</div><div className="tm-stat__value">{stats.work_in_progress}</div></div>
          <div className="tm-stat"><div className="tm-stat__label">Completed</div><div className="tm-stat__value">{stats.completed}</div></div>
          <div className="tm-stat tm-stat--overdue"><div className="tm-stat__label">Overdue</div><div className="tm-stat__value">{stats.overdue}</div></div>
        </div>
      )}

      <div className="tm-toolbar">
        <input
          className="tm-search"
          value={search}
          placeholder="Search tasks…"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select className="tm-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).filter(([v]) => v !== 'pending').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="tm-check">
          <input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} />
          Include Closed Tasks
        </label>
      </div>

      <div className="tm-table-wrap">
        <table className="tm-table">
          <thead>
            <tr>
              <th>Task</th><th>Status</th><th>Assignees</th><th>Department</th><th>Remarks</th><th>Expected Date</th><th>Follow-up</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="tm-table__empty">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="tm-table__empty">No tasks found</td></tr>}
            {!loading && rows.map((task) => (
              <tr key={task.id} onClick={() => openView(task.id)}>
                <td>
                  <div className="tm-task-title">{task.title}</div>
                  <div className="tm-task-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`tm-prio-badge tm-prio-badge--${task.priority}`}>{task.priority}</span>
                    {task.creator && <span>· {task.creator.first_name} {task.creator.last_name || ''}</span>}
                  </div>
                </td>
                <td>
                  <span className={`tm-badge tm-badge--${task.status}`}>{STATUS_LABELS[task.status]}</span>
                  {task.is_overdue && <span className="tm-badge tm-badge--overdue">Overdue</span>}
                </td>
                <td>
                  <span className="tm-avatars">
                    {(task.assignees || []).slice(0, 4).map((a) => (
                      <span className="tm-avatar" key={a.id} title={`${a.first_name} ${a.last_name || ''}`}>{initials(a)}</span>
                    ))}
                  </span>
                </td>
                <td>
                  <div>{task.department?.name || '—'}</div>
                  {task.subDepartment?.name && <span className="tm-subtag">{task.subDepartment.name}</span>}
                </td>
                <td>{latestRemark(task)}</td>
                <td>{fmtDate(task.end_date)}</td>
                <td>{fmtDate(task.follow_up_date)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="tm-icon-btn" title="View / Update" onClick={() => openView(task.id)}>
                    <EyeIcon style={{ width: 16, height: 16 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
