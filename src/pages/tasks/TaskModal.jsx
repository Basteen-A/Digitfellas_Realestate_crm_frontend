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

// Uploaded files are served by the backend at :5000/uploads (file_url is relative).
const FILE_BASE = `http://${window.location.hostname}:5000`;
const fileHref = (att) => (att?.file_url?.startsWith('http') ? att.file_url : `${FILE_BASE}${att?.file_url || ''}`);
const humanSize = (b) => (!b && b !== 0 ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

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
  const [projects, setProjects] = useState([]);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const addRef = useRef(null);

  // Attachments (photos / PDFs): files picked before create, uploaded after.
  const [pendingFiles, setPendingFiles] = useState([]); // create: File[] queued
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Status / remark form (Quick-Action style update)
  const [statusForm, setStatusForm] = useState({ new_status: '', content: '', follow_up_date: '', cancellation_reason: '' });
  // Task Details accordion (collapsed by default in the update/view popup)
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isCreate = mode === 'create';

  const loadOptions = async () => {
    try {
      const [u, d, s, proj] = await Promise.all([
        taskApi.getAssignableUsers(),
        departmentApi.getDropdown(),
        subDepartmentApi.getDropdown(),
        taskApi.getProjects(),
      ]);
      setUsers(u.data || []);
      setDepartments(d.data || []);
      setSubDepartments(s.data || []);
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

  // The creator is auto-assigned on the backend, so never show them in the
  // assignee list or the add-picker (it's redundant to pick yourself).
  const creatorId = isCreate ? currentUser?.id : task?.creator_id;
  const isCreatorId = (id) => String(id) === String(creatorId);
  const selectedAssignees = users.filter((u) => form.assignee_ids.map(String).includes(String(u.id)) && !isCreatorId(u.id));
  const availableToAdd = users.filter((u) => !form.assignee_ids.map(String).includes(String(u.id)) && !isCreatorId(u.id));

  // ── Save core (create / edit) ──
  // On create, Title + Description are required (remarks removed; no follow-up at create).
  const canSaveCore = isCreate
    ? !!(form.title.trim() && form.description.trim())
    : !!form.title.trim();

  // "Save Changes" is enabled only when an editable field actually differs from
  // the loaded task (assignees persist on their own, so they're excluded here).
  const DIRTY_KEYS = ['title', 'description', 'priority', 'department_id', 'sub_department_id', 'project_id', 'start_date', 'end_date'];
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
      // Location is no longer a task field — derive it from the chosen project so
      // existing reporting that reads location_id still works.
      const selectedProject = projects.find((p) => String(p.id) === String(form.project_id));
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        priority: form.priority,
        department_id: form.department_id || null,
        sub_department_id: form.sub_department_id || null,
        location_id: selectedProject?.location_id || null,
        project_id: form.project_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        follow_up_date: form.follow_up_date || null,
        assignee_ids: form.assignee_ids,
      };
      if (isCreate) {
        const res = await taskApi.create(payload);
        const newId = res?.data?.id;
        if (newId && pendingFiles.length > 0) {
          try {
            await taskApi.addAttachments(newId, pendingFiles);
          } catch {
            toast.error('Task created, but some files failed to upload.');
          }
        }
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

  // Upload files to an existing task immediately (view/update mode).
  const handleUploadToExisting = async (fileList) => {
    if (!taskId || !fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      await taskApi.addAttachments(taskId, fileList);
      toast.success('File(s) uploaded');
      await loadTask();
      onSaved?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Status update validation (enables the Apply button) ──
  const statusTarget = statusForm.new_status || task?.status;
  const canApply = useMemo(() => {
    if (!statusTarget) return false;
    if (!statusForm.content.trim()) return false; // a remark is required on every update
    if (statusTarget === 'cancelled' && !statusForm.cancellation_reason.trim()) return false;
    if (statusTarget === 'work_in_progress' && !statusForm.follow_up_date) return false; // follow-up only for WIP
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
    if (!statusForm.content.trim()) { toast.error('A remark is required.'); return; }
    if (target === 'work_in_progress' && !statusForm.follow_up_date) {
      toast.error('A follow-up date is required for Work in Progress.'); return;
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
  const attachments = Array.isArray(task?.attachments) ? task.attachments : [];

  // ── Task fields — same UI for everyone; `disabled` (non-creator) is read-only ──
  const renderFields = (disabled) => {
    const displayedAssignees = disabled
      ? (task?.assignees || []).filter((u) => !isCreatorId(u.id))
      : selectedAssignees;
    return (
      <div className="tmq-block">
        <div style={{ marginBottom: 10 }}>
          <label className="tmq-field-label">Title *</label>
          <input className="tmq-input" value={form.title} disabled={disabled}
            onChange={(e) => setField('title', e.target.value)} placeholder="Task title…" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="tmq-field-label">Description {isCreate && '*'}</label>
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

        <div style={{ marginBottom: 10 }}>
          <label className="tmq-field-label">Project</label>
          <select className="tmq-select" value={form.project_id} disabled={disabled}
            onChange={(e) => setField('project_id', e.target.value)}>
            <option value="">Select project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
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
              {/* No follow-up at creation; on an existing task it's driven by status updates */}
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
                <button type="button" className="tm-add-btn" onClick={() => { setAddOpen((o) => !o); setAssigneeSearch(''); }}>
                  <PlusIcon style={{ width: 14, height: 14 }} /> Add <ChevronDownIcon style={{ width: 12, height: 12 }} />
                </button>
                {addOpen && (() => {
                  const q = assigneeSearch.trim().toLowerCase();
                  const matches = availableToAdd.filter((u) =>
                    !q || `${fullName(u)} ${u.email || ''}`.toLowerCase().includes(q));
                  return (
                    <div className="tm-add-menu">
                      <input
                        className="tm-add-search"
                        type="text"
                        autoFocus
                        value={assigneeSearch}
                        placeholder="Search users…"
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                      />
                      {matches.length === 0 && <div className="tm-add-menu__empty">No users found</div>}
                      {matches.map((u) => (
                        <div className="tm-add-menu__item" key={u.id} onClick={() => { toggleAssignee(u.id); setAssigneeSearch(''); }}>
                          <span className="tm-avatar" style={{ width: 22, height: 22, margin: 0, fontSize: 10, border: 'none' }}>{initials(u)}</span>
                          {fullName(u)}{String(u.id) === String(currentUser?.id) ? ' (you)' : ''}
                        </div>
                      ))}
                    </div>
                  );
                })()}
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
              {/* ── Status buttons first (update model) ── */}
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
                  <div className="tmq-divider" />

                  {/* ── Remark & Follow-up — above Task Details (update model) ── */}
                  <div className="tmq-section">Remark &amp; Follow-up</div>
                  {statusForm.new_status === 'cancelled' && (
                    <div className="tmq-block">
                      <label className="tmq-field-label">Cancellation Reason *</label>
                      <textarea className="tmq-textarea" value={statusForm.cancellation_reason}
                        onChange={(e) => setStatusForm((p) => ({ ...p, cancellation_reason: e.target.value }))}
                        placeholder="Why is this task being cancelled?" />
                    </div>
                  )}
                  <div className="tmq-block">
                    <label className="tmq-field-label">Remark *</label>
                    <textarea className="tmq-textarea" value={statusForm.content}
                      onChange={(e) => setStatusForm((p) => ({ ...p, content: e.target.value }))}
                      placeholder="Add a remark…" />
                    {statusForm.new_status === 'work_in_progress' && (
                      <div style={{ marginTop: 10 }}>
                        <label className="tmq-field-label">Follow-up Date *</label>
                        <input type="date" className="tmq-input" value={statusForm.follow_up_date || ''}
                          onChange={(e) => setStatusForm((p) => ({ ...p, follow_up_date: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  <div className="tmq-hint">A remark is required on every update. A follow-up date is required only for Work in Progress.</div>
                  <div className="tmq-divider" />
                </>
              )}

              {/* ── Task details: plain form on create, accordion on view/update ── */}
              {isCreate && renderFields(false)}
              {!isCreate && (
                <div className="tmq-accordion">
                  <button type="button" className="tmq-acc-head" onClick={() => setDetailsOpen((o) => !o)}>
                    <span>Task Details</span>
                    <ChevronDownIcon style={{ width: 16, height: 16, transition: 'transform .15s', transform: detailsOpen ? 'rotate(180deg)' : 'none' }} />
                  </button>
                  {detailsOpen && <div className="tmq-acc-body">{renderFields(!canEditCore)}</div>}
                </div>
              )}

              {/* ── Create: attach photos / PDFs (uploaded after the task is created) ── */}
              {isCreate && (
                <div className="tmq-block">
                  <label className="tmq-field-label">Attachments (photos / PDF)</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="tmq-input"
                    onChange={(e) => setPendingFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                  />
                  {pendingFiles.length > 0 && (
                    <div className="tm-attach-list" style={{ marginTop: 8 }}>
                      {pendingFiles.map((f, i) => (
                        <div key={`${f.name}-${i}`} className="tm-attach-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            📎 {f.name} <span className="tmq-hint" style={{ padding: 0 }}>({humanSize(f.size)})</span>
                          </span>
                          <button type="button" className="tm-chip-x" title="Remove"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="tmq-hint" style={{ padding: 0 }}>Images and PDFs, up to 25MB each.</div>
                </div>
              )}

              {/* ── Attachments (existing task): view + upload more ── */}
              {!isCreate && (
                <>
                  <div className="tmq-divider" />
                  <div className="tmq-section">Attachments {attachments.length ? `(${attachments.length})` : ''}</div>
                  {attachments.length === 0 ? (
                    <div className="tmq-hint" style={{ padding: 0 }}>No attachments yet.</div>
                  ) : (
                    <div className="tm-attach-list">
                      {attachments.map((att, i) => {
                        const isImg = (att.mime_type || '').startsWith('image/');
                        return (
                          <a key={att.id || i} href={fileHref(att)} target="_blank" rel="noreferrer"
                            className="tm-attach-row"
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', textDecoration: 'none', color: 'inherit' }}>
                            <span style={{ width: 34, height: 34, borderRadius: 6, background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                              {isImg ? <img src={fileHref(att)} alt={att.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{(att.mime_type || '').includes('pdf') ? '📄' : '📎'}</span>}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.file_name || 'File'} <span className="tmq-hint" style={{ padding: 0 }}>({humanSize(att.file_size)})</span>
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                  {canEditCore && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        className="tmq-input"
                        disabled={uploading}
                        onChange={(e) => handleUploadToExisting(e.target.files)}
                      />
                      <div className="tmq-hint" style={{ padding: 0 }}>{uploading ? 'Uploading…' : 'Add photos / PDF (up to 25MB each).'}</div>
                    </div>
                  )}
                </>
              )}

              {/* ── Activity history (table) ── */}
              {!isCreate && (
                <>
                  <div className="tmq-divider" />
                  <div className="tmq-section">Activity {remarks.length ? `(${remarks.length})` : ''}</div>
                  {remarks.length === 0 ? (
                    <div className="tmq-hint" style={{ padding: 0 }}>No activity yet.</div>
                  ) : (
                    <div className="tmq-act-tablewrap">
                      <table className="tmq-act-table">
                        <thead>
                          <tr><th>Status</th><th>Remark</th><th>By</th><th>Date</th><th>Follow-up</th></tr>
                        </thead>
                        <tbody>
                          {remarks.map((r) => {
                            const meta = STATUS_META[r.status_at_time];
                            return (
                              <tr key={r.id}>
                                <td><span style={{ color: meta?.hex || 'var(--text-primary)', fontWeight: 600 }}>{STATUS_LABELS[r.status_at_time] || 'Update'}</span></td>
                                <td>{r.content || '—'}</td>
                                <td>{r.user ? fullName(r.user) : 'System'}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{r.follow_up_date ? fmtDate(r.follow_up_date) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
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
