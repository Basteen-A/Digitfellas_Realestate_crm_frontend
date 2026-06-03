import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  PlusIcon, ChevronDownIcon, ClipboardDocumentListIcon, ArrowPathIcon,
  CheckCircleIcon, LockClosedIcon, XCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import taskApi from '../../api/taskApi';
import departmentApi from '../../api/departmentApi';
import subDepartmentApi from '../../api/subDepartmentApi';

const STATUS_LABELS = {
  open: 'Open',
  pending: 'Pending',
  work_in_progress: 'Work in Progress',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

// Quick-Action style metadata for each status: short label, icon, selected-color
// class (matches .tmq-st-btn.sel-*) and a hex used for the history dot/label.
const STATUS_META = {
  open: { short: 'Open', Icon: ClipboardDocumentListIcon, sel: 'open', hex: '#1A5FA8' },
  pending: { short: 'Pending', Icon: ClockIcon, sel: 'pending', hex: '#B45309' },
  work_in_progress: { short: 'In Progress', Icon: ArrowPathIcon, sel: 'wip', hex: '#5B3FA6' },
  completed: { short: 'Completed', Icon: CheckCircleIcon, sel: 'completed', hex: '#0F7B5C' },
  closed: { short: 'Closed', Icon: LockClosedIcon, sel: 'closed', hex: '#6B6960' },
  cancelled: { short: 'Cancelled', Icon: XCircleIcon, sel: 'cancelled', hex: '#C0392B' },
};

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const initials = (u) =>
  `${(u?.first_name || u?.firstName || '?')[0] || ''}${(u?.last_name || u?.lastName || '')[0] || ''}`.toUpperCase();
const fullName = (u) => `${u?.first_name || u?.firstName || ''} ${u?.last_name || u?.lastName || ''}`.trim();
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
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

  const [task, setTask] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef(null);

  // Status / remark form (Quick-Action style update)
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
      const loaded = {
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
      };
      setForm(loaded);
      setOriginal(loaded);
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

  // Close the "Add assignee" dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Permissions ──
  // Only the person who created the task may edit its fields, delete it, and
  // see the Cancel / Closed status buttons. Other assignees can only post a
  // status update with a remark.
  const isCreator = task && currentUser && task.creator_id === currentUser.id;
  const canEditCore = isCreate || isCreator;
  const canManageClosure = isCreator;

  const filteredSubDepts = useMemo(
    () => subDepartments.filter((s) => !form.department_id || String(s.department_id) === String(form.department_id)),
    [subDepartments, form.department_id]
  );

  const filteredProjects = useMemo(
    () => (form.location_id ? projects.filter((p) => String(p.location_id) === String(form.location_id)) : []),
    [projects, form.location_id]
  );

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  // On an existing task, persist assignee add/remove immediately so a removed
  // person loses access right away (no need to also hit "Save Changes").
  const persistAssignees = async (ids, prev) => {
    try {
      await taskApi.update(taskId, { assignee_ids: ids });
      onSaved?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update assignees');
      setForm((p) => ({ ...p, assignee_ids: prev }));
    }
  };

  const toggleAssignee = (id) => {
    const prev = form.assignee_ids;
    const has = prev.map(String).includes(String(id));
    const next = has ? prev.filter((x) => String(x) !== String(id)) : [...prev, id];
    setForm((p) => ({ ...p, assignee_ids: next }));
    if (!isCreate && taskId) persistAssignees(next, prev);
  };

  const selectedAssignees = users.filter((u) => form.assignee_ids.map(String).includes(String(u.id)));
  const availableToAdd = users.filter((u) => !form.assignee_ids.map(String).includes(String(u.id)));

  // ── Save core (create / edit) ──
  const canSaveCore = !!form.title.trim();

  // "Save Changes" is enabled only when an editable field actually differs from
  // the loaded task (assignees persist on their own, so they're excluded here).
  const DIRTY_KEYS = ['title', 'description', 'priority', 'department_id', 'sub_department_id', 'location_id', 'project_id', 'start_date', 'end_date'];
  const isDirty = !isCreate && original
    ? DIRTY_KEYS.some((k) => String(form[k] ?? '') !== String(original[k] ?? ''))
    : false;

  const handleSaveCore = async () => {
    if (!canSaveCore) {
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

  // ── Status update validation (enables the Apply button) ──
  const statusTarget = statusForm.new_status || task?.status;
  const canApply = useMemo(() => {
    if (!statusTarget) return false;
    if (statusTarget === 'completed') return true; // completion needs no remark
    if (!statusForm.content.trim() || !statusForm.follow_up_date) return false;
    if (statusTarget === 'cancelled' && !statusForm.cancellation_reason.trim()) return false;
    return true;
  }, [statusTarget, statusForm]);

  const handleApplyStatus = async () => {
    const target = statusTarget;
    if (target === 'cancelled' && !statusForm.cancellation_reason.trim()) {
      toast.error('A cancellation reason is required to cancel a task.'); return;
    }
    if (target === 'closed') {
      if (!canManageClosure) { toast.error('Only the task creator can close the task.'); return; }
      if (task.status !== 'completed') { toast.error('Task must be Completed before it can be Closed.'); return; }
    }
    if (target !== 'completed') {
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

  // Cancel / Closed buttons only show for the creator.
  const statusOptions = useMemo(() => {
    const list = ['open', 'work_in_progress', 'completed'];
    if (task?.status === 'pending') list.splice(1, 0, 'pending');
    if (canManageClosure) list.push('closed', 'cancelled');
    return list;
  }, [task, canManageClosure]);

  const remarks = task?.remarks || [];

  // ── Task fields — same UI for everyone; `disabled` (non-creator) is read-only ──
  const renderFields = (disabled) => {
    const displayedAssignees = disabled ? (task?.assignees || []) : selectedAssignees;
    return (
      <div className="tmq-block">
        <div style={{ marginBottom: 10 }}>
          <label className="tmq-field-label">Title *</label>
          <input className="tmq-input" value={form.title} disabled={disabled}
            onChange={(e) => setField('title', e.target.value)} placeholder="Task title…" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="tmq-field-label">Description</label>
          <textarea className="tmq-textarea" value={form.description} disabled={disabled}
            onChange={(e) => setField('description', e.target.value)} placeholder="Add details…" />
        </div>

        <div className="tmq-grid3" style={{ marginBottom: 10 }}>
          <div>
            <label className="tmq-field-label">Priority</label>
            <select className="tmq-select" value={form.priority} disabled={disabled} onChange={(e) => setField('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{cap(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="tmq-field-label">Department</label>
            <select className="tmq-select" value={form.department_id} disabled={disabled}
              onChange={(e) => { setField('department_id', e.target.value); setField('sub_department_id', ''); }}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="tmq-field-label">Sub-Department</label>
            <select className="tmq-select" value={form.sub_department_id} disabled={disabled || !form.department_id}
              onChange={(e) => setField('sub_department_id', e.target.value)}>
              <option value="">{form.department_id ? 'Select sub-department' : 'Select department first'}</option>
              {filteredSubDepts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="tmq-grid2" style={{ marginBottom: 10 }}>
          <div>
            <label className="tmq-field-label">Location</label>
            <select className="tmq-select" value={form.location_id} disabled={disabled}
              onChange={(e) => { setField('location_id', e.target.value); setField('project_id', ''); }}>
              <option value="">Select location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.location_name}{l.city ? `, ${l.city}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="tmq-field-label">Project</label>
            <select className="tmq-select" value={form.project_id} disabled={disabled || !form.location_id}
              onChange={(e) => setField('project_id', e.target.value)}>
              <option value="">{form.location_id ? 'Select project' : 'Select location first'}</option>
              {filteredProjects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
        </div>

        <div className="tmq-grid3" style={{ marginBottom: 10 }}>
          <div>
            <label className="tmq-field-label">Start Date</label>
            <input type="date" className="tmq-input" value={form.start_date || ''} disabled={disabled}
              onChange={(e) => setField('start_date', e.target.value)} />
          </div>
          <div>
            <label className="tmq-field-label">Expected Date</label>
            <input type="date" className="tmq-input" value={form.end_date || ''} disabled={disabled}
              onChange={(e) => setField('end_date', e.target.value)} />
          </div>
          {!isCreate && (
            <div>
              <label className="tmq-field-label">Follow-up Date</label>
              {/* Driven by status updates — always read-only here */}
              <input type="date" className="tmq-input" value={form.follow_up_date || ''} disabled readOnly />
            </div>
          )}
        </div>

        <div>
          <label className="tmq-field-label">Assignees</label>
          <div className="tm-chips">
            {displayedAssignees.map((u) => (
              <span className="tm-chip-tag" key={u.id}>
                <span className="tm-avatar">{initials(u)}</span>
                {fullName(u)}{String(u.id) === String(currentUser?.id) ? ' (you)' : ''}
                {!disabled && (
                  <button type="button" className="tm-chip-x" title="Remove" onClick={() => toggleAssignee(u.id)}>✕</button>
                )}
              </span>
            ))}
            {!disabled && (
              <div className="tm-add-wrap" ref={addRef}>
                <button type="button" className="tm-add-btn" onClick={() => setAddOpen((o) => !o)}>
                  <PlusIcon style={{ width: 14, height: 14 }} /> Add <ChevronDownIcon style={{ width: 12, height: 12 }} />
                </button>
                {addOpen && (
                  <div className="tm-add-menu">
                    {availableToAdd.length === 0 && <div className="tm-add-menu__empty">No more users</div>}
                    {availableToAdd.map((u) => (
                      <div className="tm-add-menu__item" key={u.id} onClick={() => { toggleAssignee(u.id); }}>
                        <span className="tm-avatar" style={{ width: 22, height: 22, margin: 0, fontSize: 10, border: 'none' }}>{initials(u)}</span>
                        {fullName(u)}{String(u.id) === String(currentUser?.id) ? ' (you)' : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {disabled && displayedAssignees.length === 0 && <span className="tm-hint">No assignees</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="tm-modal-overlay" onClick={onClose}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="tmq-header">
          <div className="tmq-header-left">
            <div className="tmq-avatar">{isCreate ? '+' : (task?.title?.[0] || 'T').toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div className="tmq-name">{isCreate ? 'Create Task' : task?.title || 'Task'}</div>
              {!isCreate && task && (
                <div className="tmq-meta">
                  <span className={`tm-badge tm-badge--${task.status}`}>{STATUS_LABELS[task.status]}</span>
                  {task.is_overdue && <span className="tm-badge tm-badge--overdue">Overdue</span>}
                  <span>Priority: {cap(task.priority)}</span>
                  {task.creator && <span>· by {fullName(task.creator)}</span>}
                </div>
              )}
              {isCreate && <div className="tmq-meta">Creating as {fullName(currentUser)} (you)</div>}
            </div>
          </div>
          <button type="button" className="tmq-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Body ── */}
        <div className="tmq-body">
          {loading && <p style={{ padding: 20 }}>Loading…</p>}

          {!loading && (
            <>
              {/* Status update (Quick-Action grid) */}
              {!isCreate && (
                <>
                  <div className="tmq-section">Update Status</div>
                  <div className="tmq-status-grid">
                    {statusOptions.map((s) => {
                      const meta = STATUS_META[s];
                      const Icon = meta.Icon;
                      const sel = statusForm.new_status === s;
                      return (
                        <button
                          type="button"
                          key={s}
                          className={`tmq-st-btn ${sel ? `sel-${meta.sel}` : ''}`}
                          onClick={() => setStatusForm((p) => ({ ...p, new_status: s }))}
                        >
                          <span className="tmq-st-icon" style={sel ? { color: meta.hex } : undefined}>
                            <Icon style={{ width: 22, height: 22 }} />
                          </span>
                          <span className="tmq-st-label">{meta.short}</span>
                        </button>
                      );
                    })}
                  </div>

                  {statusForm.new_status === 'cancelled' && (
                    <div className="tmq-block">
                      <label className="tmq-field-label">Cancellation Reason *</label>
                      <textarea className="tmq-textarea" value={statusForm.cancellation_reason}
                        onChange={(e) => setStatusForm((p) => ({ ...p, cancellation_reason: e.target.value }))}
                        placeholder="Why is this task being cancelled?" />
                    </div>
                  )}

                  <div className="tmq-block">
                    <div className="tmq-grid2">
                      <div>
                        <label className="tmq-field-label">Remark {statusTarget !== 'completed' && '*'}</label>
                        <textarea className="tmq-textarea" value={statusForm.content}
                          onChange={(e) => setStatusForm((p) => ({ ...p, content: e.target.value }))}
                          placeholder="Add a remark…" />
                      </div>
                      <div>
                        <label className="tmq-field-label">Follow-up Date {statusTarget !== 'completed' && '*'}</label>
                        <input type="date" className="tmq-input" value={statusForm.follow_up_date || ''}
                          onChange={(e) => setStatusForm((p) => ({ ...p, follow_up_date: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <div className="tmq-hint">Follow-up date &amp; remark are required on every update — except when marking Completed.</div>
                  <div className="tmq-divider" />
                </>
              )}

              {/* Task details */}
              {!isCreate && <div className="tmq-section">Task Details</div>}
              {renderFields(!canEditCore)}

              {/* Activity history */}
              {!isCreate && (
                <>
                  <div className="tmq-divider" />
                  <div className="tmq-section">Activity {remarks.length ? `(${remarks.length})` : ''}</div>
                  <div className="tmq-history">
                    {remarks.length === 0 && <div className="tmq-hint" style={{ padding: 0 }}>No activity yet.</div>}
                    {remarks.map((r, i) => {
                      const meta = STATUS_META[r.status_at_time];
                      return (
                        <div className="tmq-hist-item" key={r.id}>
                          <div className="tmq-hist-col">
                            <span className="tmq-hist-dot" style={{ borderColor: meta?.hex || 'var(--accent-blue)' }} />
                            {i < remarks.length - 1 && <span className="tmq-hist-line" />}
                          </div>
                          <div className="tmq-hist-right">
                            <div className="tmq-hist-header">
                              <span className="tmq-hist-status" style={{ color: meta?.hex || 'var(--text-primary)' }}>
                                {STATUS_LABELS[r.status_at_time] || 'Update'}
                              </span>
                              <span className="tmq-hist-date">{fmtDateTime(r.created_at)}</span>
                            </div>
                            {r.content && <div className="tmq-hist-remark">{r.content}</div>}
                            <div className="tmq-hist-foot">
                              <span className="tmq-hist-by">{r.user ? fullName(r.user) : 'System'}</span>
                              {r.follow_up_date && <span className="tmq-hist-fu">Follow-up: {fmtDate(r.follow_up_date)}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Save row ── */}
        <div className="tmq-save-row">
          {!isCreate && canManageClosure && (
            <button type="button" className="tmq-del-btn" onClick={handleDelete}>Delete</button>
          )}
          <button type="button" className="tmq-skip-btn" onClick={onClose}>Close</button>
          {isCreate && (
            <button type="button" className="tmq-save-btn" disabled={saving || !canSaveCore} onClick={handleSaveCore}>
              {saving ? 'Saving…' : 'Create Task'}
            </button>
          )}
          {!isCreate && (
            <>
              {canEditCore && (
                <button type="button" className="tmq-skip-btn" disabled={saving || !canSaveCore || !isDirty} onClick={handleSaveCore}>
                  Save Changes
                </button>
              )}
              <button type="button" className="tmq-save-btn" disabled={saving || !canApply} onClick={handleApplyStatus}>
                {saving ? 'Saving…' : 'Apply Update'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
