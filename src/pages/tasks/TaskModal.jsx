import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import taskApi from '../../api/taskApi';
import departmentApi from '../../api/departmentApi';
import subDepartmentApi from '../../api/subDepartmentApi';
import { getRoleCode } from '../../utils/permissions';

const MAIN_STATUSES = ['open', 'work_in_progress', 'completed', 'closed', 'cancelled'];
const STATUS_LABELS = {
  open: 'Open',
  pending: 'Pending',
  work_in_progress: 'Work in Progress',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
};
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const initials = (u) =>
  `${(u?.first_name || u?.firstName || '?')[0] || ''}${(u?.last_name || u?.lastName || '')[0] || ''}`.toUpperCase();
const fullName = (u) => `${u?.first_name || u?.firstName || ''} ${u?.last_name || u?.lastName || ''}`.trim();
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '—');

const emptyForm = {
  title: '', description: '', priority: 'medium',
  department_id: '', sub_department_id: '', location_id: '', project_id: '',
  start_date: '', end_date: '', follow_up_date: '',
  assignee_ids: [],
};

const TaskModal = ({ mode = 'view', taskId = null, onClose, onSaved }) => {
  const currentUser = useSelector((state) => state.auth.user);
  const isAdmin = ['SA', 'ADM'].includes(getRoleCode(currentUser));

  const [tab, setTab] = useState('details');
  const [task, setTask] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Status / remark form
  const [statusForm, setStatusForm] = useState({ new_status: '', content: '', follow_up_date: '', cancellation_reason: '' });

  const isCreate = mode === 'create';

  const loadOptions = async () => {
    try {
      const [u, d, s, loc, proj] = await Promise.all([
        taskApi.getAssignableUsers(),
        departmentApi.getDropdown(),
        subDepartmentApi.getDropdown(),
        taskApi.getLocations(),
        taskApi.getProjects(),
      ]);
      setUsers(u.data || []);
      setDepartments(d.data || []);
      setSubDepartments(s.data || []);
      setLocations(loc.data || []);
      setProjects(proj.data || []);
    } catch {
      /* non-fatal */
    }
  };

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await taskApi.getById(taskId);
      const t = res.data;
      setTask(t);
      setForm({
        title: t.title || '',
        description: t.description || '',
        priority: t.priority || 'medium',
        department_id: t.department_id || '',
        sub_department_id: t.sub_department_id || '',
        location_id: t.location_id || '',
        project_id: t.project_id || '',
        start_date: t.start_date || '',
        end_date: t.end_date || '',
        follow_up_date: t.follow_up_date || '',
        assignee_ids: (t.assignees || []).map((a) => a.id),
      });
      setStatusForm((p) => ({ ...p, new_status: t.status }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load task');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
    if (!isCreate) loadTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const isCreator = task && currentUser && task.creator_id === currentUser.id;

  const filteredSubDepts = useMemo(
    () => subDepartments.filter((s) => !form.department_id || String(s.department_id) === String(form.department_id)),
    [subDepartments, form.department_id]
  );

  const filteredProjects = useMemo(
    () => (form.location_id ? projects.filter((p) => String(p.location_id) === String(form.location_id)) : []),
    [projects, form.location_id]
  );

  // Resolved display names for the read-only summary shown when updating a task.
  const deptName = departments.find((d) => String(d.id) === String(form.department_id))?.name;
  const subName = subDepartments.find((s) => String(s.id) === String(form.sub_department_id))?.name;
  const locEntry = locations.find((l) => String(l.id) === String(form.location_id));
  const locName = locEntry ? `${locEntry.location_name}${locEntry.city ? `, ${locEntry.city}` : ''}` : '';
  const projName = projects.find((p) => String(p.id) === String(form.project_id))?.project_name;

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const toggleAssignee = (id) => {
    setForm((p) => {
      const has = p.assignee_ids.map(String).includes(String(id));
      return { ...p, assignee_ids: has ? p.assignee_ids.filter((x) => String(x) !== String(id)) : [...p.assignee_ids, id] };
    });
  };

  // ── Save core (create / edit) ──
  const handleSaveCore = async () => {
    if (!form.title.trim()) {
      toast.error('Task title is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        priority: form.priority,
        department_id: form.department_id || null,
        sub_department_id: form.sub_department_id || null,
        location_id: form.location_id || null,
        project_id: form.project_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        follow_up_date: form.follow_up_date || null,
        assignee_ids: form.assignee_ids,
      };
      if (isCreate) {
        await taskApi.create(payload);
        toast.success('Task created');
      } else {
        await taskApi.update(taskId, payload);
        toast.success('Task updated');
      }
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Apply status change / add remark ──
  const handleApplyStatus = async () => {
    const target = statusForm.new_status || task.status;
    const completing = target === 'completed';

    if (target === 'cancelled' && !statusForm.cancellation_reason.trim()) {
      toast.error('A cancellation reason is required to cancel a task.');
      return;
    }
    if (target === 'closed') {
      if (!isCreator && !isAdmin) { toast.error('Only the task creator can close the task.'); return; }
      if (task.status !== 'completed' && !isAdmin) { toast.error('Task must be Completed before it can be Closed.'); return; }
    }
    if (!completing) {
      if (!statusForm.content.trim()) { toast.error('A remark is required.'); return; }
      if (!statusForm.follow_up_date) { toast.error('A follow-up date is required.'); return; }
    }

    setSaving(true);
    try {
      await taskApi.addRemark(taskId, {
        content: statusForm.content || null,
        new_status: target,
        follow_up_date: statusForm.follow_up_date || null,
        cancellation_reason: statusForm.cancellation_reason || null,
      });
      toast.success('Task updated');
      setStatusForm((p) => ({ ...p, content: '', cancellation_reason: '' }));
      await loadTask();
      onSaved?.();
      setTab('activity');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await taskApi.delete(taskId);
      toast.success('Task deleted');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const statusOptions = useMemo(() => {
    const list = [...MAIN_STATUSES];
    if (task?.status === 'pending' && !list.includes('pending')) list.splice(1, 0, 'pending');
    return list;
  }, [task]);

  return (
    <div className="tm-modal-overlay" onClick={onClose}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tm-modal__header">
          <div className="tm-modal__title-row">
            <h2 className="tm-modal__title">{isCreate ? 'Create Task' : task?.title || 'Task'}</h2>
            <button type="button" className="tm-modal__close" onClick={onClose}>✕</button>
          </div>
          {!isCreate && task && (
            <div className="tm-modal__meta">
              <span className={`tm-badge tm-badge--${task.status}`}>{STATUS_LABELS[task.status]}</span>
              {task.is_overdue && <span className="tm-badge tm-badge--overdue">Overdue</span>}
              <span>·</span>
              <span>{STATUS_LABELS[task.status] && `Priority: ${task.priority}`}</span>
              {task.creator && <><span>·</span><span>Created by {fullName(task.creator)}</span></>}
            </div>
          )}
          {isCreate && (
            <div className="tm-modal__meta">Creating as {fullName(currentUser)} (you)</div>
          )}

          {!isCreate && (
            <div className="tm-tabs">
              <button className={`tm-tab ${tab === 'details' ? 'is-active' : ''}`} onClick={() => setTab('details')}>Details</button>
              <button className={`tm-tab ${tab === 'activity' ? 'is-active' : ''}`} onClick={() => setTab('activity')}>
                Activity {task?.remarks ? `(${task.remarks.length})` : ''}
              </button>
            </div>
          )}
        </div>

        <div className="tm-modal__body">
          {loading && <p>Loading…</p>}

          {/* ── DETAILS / EDIT ── */}
          {!loading && tab === 'details' && (
            <>
              {/* Status update (view mode only) */}
              {!isCreate && (
                <div className="tm-field" style={{ marginBottom: 20 }}>
                  <label>Update Status</label>
                  <div className="tm-status-chips">
                    {statusOptions.map((s) => (
                      <button
                        type="button"
                        key={s}
                        className={`tm-chip s-${s} ${statusForm.new_status === s ? 'is-active' : ''}`}
                        onClick={() => setStatusForm((p) => ({ ...p, new_status: s }))}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>

                  {statusForm.new_status === 'cancelled' && (
                    <div className="tm-field" style={{ marginTop: 12 }}>
                      <label>Cancellation Reason <span className="req">*</span></label>
                      <textarea
                        className="tm-textarea"
                        value={statusForm.cancellation_reason}
                        onChange={(e) => setStatusForm((p) => ({ ...p, cancellation_reason: e.target.value }))}
                        placeholder="Why is this task being cancelled?"
                      />
                    </div>
                  )}

                  <div className="tm-grid" style={{ marginTop: 12 }}>
                    <div className="tm-field" style={{ margin: 0 }}>
                      <label>
                        Remark {statusForm.new_status !== 'completed' && <span className="req">*</span>}
                      </label>
                      <textarea
                        className="tm-textarea"
                        value={statusForm.content}
                        onChange={(e) => setStatusForm((p) => ({ ...p, content: e.target.value }))}
                        placeholder="Add a remark…"
                      />
                    </div>
                    <div className="tm-field" style={{ margin: 0 }}>
                      <label>
                        Follow-up Date {statusForm.new_status !== 'completed' && <span className="req">*</span>}
                      </label>
                      <input
                        type="date"
                        className="tm-input"
                        value={statusForm.follow_up_date || ''}
                        onChange={(e) => setStatusForm((p) => ({ ...p, follow_up_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <p className="tm-hint">
                    Follow-up date &amp; remark are required on every update — except when marking Completed.
                    Completed tasks go to the creator for closure.
                  </p>
                  <div style={{ marginTop: 10 }}>
                    <button type="button" className="tm-btn" disabled={saving} onClick={handleApplyStatus}>
                      {saving ? 'Saving…' : 'Apply Update'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── CREATE: editable core form ── */}
              {isCreate && (
                <>
                  <div className="tm-field">
                    <label>Title <span className="req">*</span></label>
                    <input className="tm-input" value={form.title}
                      onChange={(e) => setField('title', e.target.value)} placeholder="Task title…" />
                  </div>
                  <div className="tm-field">
                    <label>Description</label>
                    <textarea className="tm-textarea" value={form.description}
                      onChange={(e) => setField('description', e.target.value)} placeholder="Add details…" />
                  </div>

                  <div className="tm-grid tm-grid--3">
                    <div className="tm-field">
                      <label>Priority</label>
                      <select value={form.priority} onChange={(e) => setField('priority', e.target.value)}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                      </select>
                    </div>
                    <div className="tm-field">
                      <label>Department</label>
                      <select value={form.department_id}
                        onChange={(e) => { setField('department_id', e.target.value); setField('sub_department_id', ''); }}>
                        <option value="">—</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="tm-field">
                      <label>Sub-Department</label>
                      <select value={form.sub_department_id} disabled={!form.department_id}
                        onChange={(e) => setField('sub_department_id', e.target.value)}>
                        <option value="">—</option>
                        {filteredSubDepts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="tm-grid">
                    <div className="tm-field">
                      <label>Location</label>
                      <select value={form.location_id}
                        onChange={(e) => { setField('location_id', e.target.value); setField('project_id', ''); }}>
                        <option value="">—</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>{l.location_name}{l.city ? `, ${l.city}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="tm-field">
                      <label>Project</label>
                      <select value={form.project_id} disabled={!form.location_id}
                        onChange={(e) => setField('project_id', e.target.value)}>
                        <option value="">{form.location_id ? '—' : 'Select location first'}</option>
                        {filteredProjects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="tm-grid tm-grid--3">
                    <div className="tm-field">
                      <label>Start Date</label>
                      <input type="date" className="tm-input" value={form.start_date || ''}
                        onChange={(e) => setField('start_date', e.target.value)} />
                    </div>
                    <div className="tm-field">
                      <label>Expected Date</label>
                      <input type="date" className="tm-input" value={form.end_date || ''}
                        onChange={(e) => setField('end_date', e.target.value)} />
                    </div>
                  </div>

                  <div className="tm-field">
                    <label>Assignees</label>
                    <div className="tm-assignees">
                      {users.map((u) => {
                        const checked = form.assignee_ids.map(String).includes(String(u.id));
                        return (
                          <label className="tm-assignee-row" key={u.id}>
                            <input type="checkbox" checked={checked}
                              onChange={() => toggleAssignee(u.id)} />
                            <span className="tm-avatar" style={{ margin: 0 }}>{initials(u)}</span>
                            <span>{fullName(u)}{String(u.id) === String(currentUser?.id) ? ' (you)' : ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ── UPDATE: read-only task details (no re-editing of the create form) ── */}
              {!isCreate && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid #eef2f7', margin: '8px 0 18px' }} />
                  <div className="tm-details">
                    {form.description && (
                      <div className="tm-field">
                        <label>Description</label>
                        <div className="tm-detail-value">{form.description}</div>
                      </div>
                    )}
                    <div className="tm-grid tm-grid--3">
                      <div className="tm-field"><label>Priority</label><div className="tm-detail-value">{cap(form.priority)}</div></div>
                      <div className="tm-field"><label>Department</label><div className="tm-detail-value">{deptName || '—'}</div></div>
                      <div className="tm-field"><label>Sub-Department</label><div className="tm-detail-value">{subName || '—'}</div></div>
                    </div>
                    <div className="tm-grid">
                      <div className="tm-field"><label>Location</label><div className="tm-detail-value">{locName || '—'}</div></div>
                      <div className="tm-field"><label>Project</label><div className="tm-detail-value">{projName || '—'}</div></div>
                    </div>
                    <div className="tm-grid tm-grid--3">
                      <div className="tm-field"><label>Start Date</label><div className="tm-detail-value">{fmtDate(form.start_date)}</div></div>
                      <div className="tm-field"><label>Expected Date</label><div className="tm-detail-value">{fmtDate(form.end_date)}</div></div>
                      <div className="tm-field"><label>Follow-up Date</label><div className="tm-detail-value">{fmtDate(form.follow_up_date)}</div></div>
                    </div>
                    <div className="tm-field">
                      <label>Assignees</label>
                      <div className="tm-assignees">
                        {(task?.assignees || []).map((u) => (
                          <div className="tm-assignee-row" key={u.id}>
                            <span className="tm-avatar" style={{ margin: 0 }}>{initials(u)}</span>
                            <span>{fullName(u)}{String(u.id) === String(currentUser?.id) ? ' (you)' : ''}</span>
                          </div>
                        ))}
                        {(task?.assignees || []).length === 0 && <span className="tm-hint">No assignees</span>}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── ACTIVITY TIMELINE ── */}
          {!loading && tab === 'activity' && (
            <ul className="tm-timeline">
              {(task?.remarks || []).length === 0 && <p className="tm-hint">No activity yet.</p>}
              {(task?.remarks || []).map((r) => (
                <li className="tm-timeline__item" key={r.id}>
                  <span className="tm-timeline__dot" />
                  <div className="tm-timeline__head">
                    <span className="tm-timeline__author">{r.user ? fullName(r.user) : 'System'}</span>
                    {r.status_at_time && <span className={`tm-badge tm-badge--${r.status_at_time}`}>{STATUS_LABELS[r.status_at_time]}</span>}
                    <span className="tm-timeline__time">{fmtDateTime(r.created_at)}</span>
                  </div>
                  <div className="tm-timeline__body">{r.content}</div>
                  {r.follow_up_date && <div className="tm-timeline__fu">Follow-up: {r.follow_up_date}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="tm-modal__footer">
          <div>
            {!isCreate && (isCreator || isAdmin) && (
              <button type="button" className="tm-btn tm-btn--danger" onClick={handleDelete}>Delete Task</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="tm-btn tm-btn--ghost" onClick={onClose}>Close</button>
            {isCreate && (
              <button type="button" className="tm-btn" disabled={saving} onClick={handleSaveCore}>
                {saving ? 'Saving…' : 'Create Task'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
