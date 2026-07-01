import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  PlusIcon, ChevronDownIcon, ClipboardDocumentListIcon, ArrowPathIcon,
  CheckCircleIcon, LockClosedIcon, XCircleIcon, ClockIcon, MicrophoneIcon,
  StopCircleIcon, TrashIcon, DocumentIcon,
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

// A follow-up date is required when moving a task into an active state.
const needsFollowUp = (status) => status === 'open' || status === 'work_in_progress';

// Completed tasks auto-close 15 days after completion (server-side
// taskAutoCloseService). Surface the remaining time so it isn't a surprise.
// AUTO_CLOSE_DAYS must stay in sync with the server's CLOSE_AFTER_DAYS.
const AUTO_CLOSE_DAYS = 15;
const autoCloseLabel = (completedAt) => {
  if (!completedAt) return '';
  const days = Math.ceil((new Date(completedAt).getTime() + AUTO_CLOSE_DAYS * 86400000 - Date.now()) / 86400000);
  if (days <= 0) return 'Auto-closes shortly';
  return `Auto-closes in ${days} day${days === 1 ? '' : 's'}`;
};

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
const mmss = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };

const emptyForm = {
  title: '', description: '', priority: 'medium',
  department_id: '', sub_department_id: '', location_id: '', project_id: '', phase_id: '',
  start_date: '', end_date: '', follow_up_date: '',
  assignee_ids: [],
};

const TaskModal = ({ mode = 'view', taskId = null, prefill = null, onClose, onSaved }) => {
  const currentUser = useSelector((state) => state.auth.user);

  const [task, setTask] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectBoxRef = useRef(null);
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
  const createFileRef = useRef(null); // hidden input behind the "Choose files" button
  // Optional documents attached alongside a status update (not mandatory).
  const [statusFiles, setStatusFiles] = useState([]);
  const statusFileRef = useRef(null);

  // Status / remark form (Quick-Action style update)
  const [statusForm, setStatusForm] = useState({ new_status: '', content: '', follow_up_date: '', cancellation_reason: '' });
  // Task Details accordion (collapsed by default in the update/view popup)
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Activity / Attachments tab switcher (Activity is the default tab).
  const [detailTab, setDetailTab] = useState('activity'); // 'activity' | 'attachments'

  // ── Voice note recorder (attached to the status update) ──
  const [recording, setRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState('');
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [recError, setRecError] = useState('');
  // Voice transcription (Gemini, via backend): chosen output language + state.
  const [voiceLang, setVoiceLang] = useState('english'); // 'tamil' | 'english'
  const [transcribing, setTranscribing] = useState(false);
  const [transcribed, setTranscribed] = useState(false);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTsRef = useRef(0);
  const streamRef = useRef(null);

  const clearVoice = () => {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceBlob(null);
    setVoiceUrl('');
    setVoiceDuration(0);
    setTranscribed(false);
  };

  const startRecording = async () => {
    setRecError('');
    clearVoice();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecError('Recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
        (streamRef.current?.getTracks() || []).forEach((t) => t.stop());
        streamRef.current = null;
      };
      mr.start();
      mediaRecRef.current = mr;
      startTsRef.current = Date.now();
      setVoiceDuration(0);
      timerRef.current = setInterval(() => setVoiceDuration(Math.round((Date.now() - startTsRef.current) / 1000)), 250);
      setRecording(true);
    } catch {
      setRecError('Microphone access was denied or is unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') mediaRecRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  // Send the recording to the backend (Gemini) to transcribe + translate into
  // the chosen language, then drop the resulting text into the remark box.
  const handleTranscribe = async () => {
    if (!voiceBlob || transcribing) return;
    setTranscribing(true);
    try {
      const res = await taskApi.transcribeVoice(voiceBlob, voiceLang);
      const text = (res?.data?.text || '').trim();
      if (!text) { toast.error('Could not transcribe the audio. Please record again.'); return; }
      setStatusForm((p) => ({ ...p, content: p.content.trim() ? `${p.content.trim()}\n${text}` : text }));
      setTranscribed(true);
      toast.success('Voice transcribed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  // Stop the stream / timer / object URL if the modal unmounts mid-record.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') mediaRecRef.current.stop();
    (streamRef.current?.getTracks() || []).forEach((t) => t.stop());
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        phase_id: t.phase_id || '',
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
    // New task opened from a group header: pre-fill that group's field
    // (department_id / project_id) so it lands in the same bucket.
    else if (prefill) setForm((p) => ({ ...p, ...prefill }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Close the "Add assignee" dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close the project search dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (projectBoxRef.current && !projectBoxRef.current.contains(e.target)) setProjectDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load phases whenever the selected project changes (task module shows all
  // phases with their approved/unapproved status).
  useEffect(() => {
    if (!form.project_id) { setPhases([]); return; }
    let active = true;
    (async () => {
      try {
        const res = await taskApi.getPhases(form.project_id);
        if (active) setPhases(res.data || []);
      } catch {
        if (active) setPhases([]);
      }
    })();
    return () => { active = false; };
  }, [form.project_id]);

  // Label for the currently selected project (shown in the search box).
  const selectedProjectName = useMemo(
    () => projects.find((p) => String(p.id) === String(form.project_id))?.project_name || '',
    [projects, form.project_id]
  );
  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return q ? projects.filter((p) => String(p.project_name || '').toLowerCase().includes(q)) : projects;
  }, [projects, projectSearch]);

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
  // On create, Title + Description + Department + Follow-up Date are required.
  const canSaveCore = isCreate
    ? !!(form.title.trim() && form.description.trim() && form.department_id && form.follow_up_date)
    : !!form.title.trim();

  // "Save Changes" is enabled only when an editable field actually differs from
  // the loaded task (assignees persist on their own, so they're excluded here).
  const DIRTY_KEYS = ['title', 'description', 'priority', 'department_id', 'sub_department_id', 'project_id', 'start_date', 'end_date'];
  const isDirty = !isCreate && original
    ? DIRTY_KEYS.some((k) => String(form[k] ?? '') !== String(original[k] ?? ''))
    : false;

  const handleSaveCore = async () => {
    if (!canSaveCore) {
      if (isCreate && form.title.trim() && form.description.trim() && !form.department_id) {
        toast.error('Department is required.');
      } else if (isCreate && form.title.trim() && form.description.trim() && form.department_id && !form.follow_up_date) {
        toast.error('Follow-up date is required.');
      } else {
        toast.error(isCreate ? 'Title, description, department and follow-up date are required.' : 'Task title is required.');
      }
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
        phase_id: form.phase_id || null,
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
    if (needsFollowUp(statusTarget) && !statusForm.follow_up_date) return false; // follow-up for Open / WIP
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
    if (needsFollowUp(target) && !statusForm.follow_up_date) {
      toast.error('A follow-up date is required for Open and Work in Progress.'); return;
    }

    if (recording) { toast.error('Stop the voice recording before applying.'); return; }

    setSaving(true);
    try {
      await taskApi.addRemark(taskId, {
        content: statusForm.content || null,
        new_status: target,
        follow_up_date: statusForm.follow_up_date || null,
        cancellation_reason: statusForm.cancellation_reason || null,
        voiceBlob: voiceBlob || undefined,
        voice_duration: voiceBlob ? voiceDuration : undefined,
        // Optional documents — uploaded with the remark and linked to it.
        documents: statusFiles.length > 0 ? statusFiles : undefined,
      });
      toast.success('Task updated');
      setStatusForm((p) => ({ ...p, content: '', cancellation_reason: '' }));
      setStatusFiles([]);
      clearVoice();
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

  // Resolve an attachment's uploader name from the people we know about
  // (creator + assignees + assignable users), since the file only stores an id.
  const userById = useMemo(() => {
    const m = new Map();
    const add = (u) => { if (u && u.id != null) m.set(String(u.id), u); };
    add(task?.creator);
    (task?.assignees || []).forEach(add);
    users.forEach(add);
    return m;
  }, [task, users]);
  const uploaderLabel = (att) => {
    const u = userById.get(String(att?.uploaded_by));
    return u ? fullName(u) : '';
  };

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
            <label className="tmq-field-label">Department{isCreate ? ' *' : ''}</label>
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

        <div className="tmq-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          {/* Searchable project select */}
          <div style={{ position: 'relative' }} ref={projectBoxRef}>
            <label className="tmq-field-label">Project</label>
            <input
              type="text"
              className="tmq-input"
              disabled={disabled}
              value={projectDropdownOpen ? projectSearch : selectedProjectName}
              placeholder="Search & select project…"
              onFocus={() => { if (!disabled) { setProjectDropdownOpen(true); setProjectSearch(''); } }}
              onChange={(e) => { setProjectSearch(e.target.value); setProjectDropdownOpen(true); }}
            />
            {projectDropdownOpen && !disabled && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                <div
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#6b7280', borderBottom: '1px solid #f1f5f9' }}
                  onClick={() => { setField('project_id', ''); setField('phase_id', ''); setProjectDropdownOpen(false); }}
                >
                  — None —
                </div>
                {filteredProjects.map((p) => (
                  <div
                    key={p.id}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, background: String(p.id) === String(form.project_id) ? '#eef2ff' : 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = String(p.id) === String(form.project_id) ? '#eef2ff' : 'transparent'; }}
                    onClick={() => { setField('project_id', String(p.id)); setField('phase_id', ''); setProjectDropdownOpen(false); }}
                  >
                    {p.project_name}
                  </div>
                ))}
                {filteredProjects.length === 0 && (
                  <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af' }}>No projects found</div>
                )}
              </div>
            )}
          </div>

          {/* Phase select — shows each phase's approval status */}
          <div>
            <label className="tmq-field-label">Phase</label>
            <select
              className="tmq-select"
              value={form.phase_id}
              disabled={disabled || !form.project_id}
              onChange={(e) => setField('phase_id', e.target.value)}
            >
              <option value="">{form.project_id ? 'Select phase' : 'Select project first'}</option>
              {phases.map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.phase_name} — {ph.is_approved === false ? 'Unapproved' : 'Approved'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="tmq-grid3" style={{ marginBottom: 10 }}>
          {/* Start / Expected dates are not collected at creation time. */}
          {!isCreate && (
            <div>
              <label className="tmq-field-label">Start Date</label>
              <input type="date" className="tmq-input" value={form.start_date || ''} disabled={disabled}
                onChange={(e) => setField('start_date', e.target.value)} />
            </div>
          )}
          {!isCreate && (
            <div>
              <label className="tmq-field-label">Expected Date</label>
              <input type="date" className="tmq-input" value={form.end_date || ''} disabled={disabled}
                onChange={(e) => setField('end_date', e.target.value)} />
            </div>
          )}
          <div>
            <label className="tmq-field-label">Follow-up Date{isCreate ? ' *' : ''}</label>
            {isCreate ? (
              <input type="date" className="tmq-input" value={form.follow_up_date || ''} disabled={disabled}
                onChange={(e) => setField('follow_up_date', e.target.value)} />
            ) : (
              /* On an existing task it's driven by status updates */
              <input type="date" className="tmq-input" value={form.follow_up_date || ''} disabled readOnly />
            )}
          </div>
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
                  {task.status === 'completed' && autoCloseLabel(task.completed_at) && (
                    <span style={{ color: '#B45309', fontWeight: 600 }}>· ⏳ {autoCloseLabel(task.completed_at)}</span>
                  )}
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
                    {/* Voice note recorder — attaches an audio clip to this update. */}
                    <div className="tmq-voice">
                      {recording ? (
                        <div className="tmq-voice-rec">
                          <span className="tmq-voice-dot" />
                          <span className="tmq-voice-time">{mmss(voiceDuration)}</span>
                          <span className="tmq-voice-hint">Recording…</span>
                          <button type="button" className="tmq-voice-btn tmq-voice-btn--stop" onClick={stopRecording}>
                            <StopCircleIcon style={{ width: 16, height: 16 }} /> Stop
                          </button>
                        </div>
                      ) : voiceBlob ? (
                        <div className="tmq-voice-card">
                          <div className="tmq-voice-rec" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                            <audio className="tmq-voice-audio" src={voiceUrl} controls preload="metadata" />
                            <span className="tmq-voice-time">{mmss(voiceDuration)}</span>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                              {!transcribed && (
                                <button type="button" className="tmq-voice-btn tmq-voice-btn--transcribe" disabled={transcribing} onClick={handleTranscribe}>
                                  <CheckCircleIcon style={{ width: 15, height: 15 }} />
                                  {transcribing ? 'Transcribing…' : 'Transcribe'}
                                </button>
                              )}
                              <button type="button" className="tmq-voice-btn tmq-voice-btn--del" onClick={clearVoice} title="Remove">
                                <TrashIcon style={{ width: 15, height: 15 }} />
                              </button>
                            </div>
                          </div>
                          {!transcribed ? (
                            <div className="tmq-voice-lang">
                              <span className="tmq-voice-lang-label">Demo voice language</span>
                              <div className="tmq-lang-toggle">
                                <button type="button" className={voiceLang === 'tamil' ? 'active' : ''} disabled={transcribing} onClick={() => setVoiceLang('tamil')}>Tamil</button>
                                <button type="button" className={voiceLang === 'english' ? 'active' : ''} disabled={transcribing} onClick={() => setVoiceLang('english')}>English</button>
                              </div>
                            </div>
                          ) : (
                            <div className="tmq-voice-done">
                              <CheckCircleIcon style={{ width: 15, height: 15 }} /> Transcribed — text added to the remark above
                            </div>
                          )}
                        </div>
                      ) : (
                        <button type="button" className="tmq-voice-btn" onClick={startRecording}>
                          <MicrophoneIcon style={{ width: 15, height: 15 }} /> Voice note
                        </button>
                      )}
                      {recError && <div className="tmq-voice-err">{recError}</div>}
                    </div>

                    {/* Optional document attachment for this status update */}
                    <div className="tmq-status-attach">
                      <label className="tmq-field-label">Attachment (optional)</label>
                      <div className="tm-file-picker">
                        <button type="button" className="tm-file-btn" onClick={() => statusFileRef.current?.click()}>
                          Choose files
                        </button>
                        <span className="tm-file-count">
                          {statusFiles.length ? `${statusFiles.length} file(s)` : 'Any file type, up to 25MB each'}
                        </span>
                        <input
                          ref={statusFileRef}
                          type="file"
                          multiple
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            setStatusFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
                            if (statusFileRef.current) statusFileRef.current.value = '';
                          }}
                        />
                      </div>
                      {statusFiles.length > 0 && (
                        <div className="tm-file-chips">
                          {statusFiles.map((f, i) => (
                            <span key={`${f.name}-${i}`} className="tm-file-chip" title={`${f.name} (${humanSize(f.size)})`}>
                              <DocumentIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                              <span className="tm-file-chip-name">{f.name}</span>
                              <button type="button" className="tm-chip-x" title="Remove"
                                onClick={() => setStatusFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {needsFollowUp(statusForm.new_status) && (
                      <div style={{ marginTop: 10 }}>
                        <label className="tmq-field-label">Follow-up Date *</label>
                        <input type="date" className="tmq-input" value={statusForm.follow_up_date || ''}
                          onChange={(e) => setStatusForm((p) => ({ ...p, follow_up_date: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  <div className="tmq-hint">A remark is required on every update. A follow-up date is required for Open and Work in Progress.</div>
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
                  <label className="tmq-field-label">Attachments</label>
                  <div className="tm-file-picker">
                    <button type="button" className="tm-file-btn" onClick={() => createFileRef.current?.click()}>
                      Choose files
                    </button>
                    <span className="tm-file-count">{pendingFiles.length} file(s)</span>
                    <input
                      ref={createFileRef}
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        setPendingFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
                        if (createFileRef.current) createFileRef.current.value = ''; // allow re-picking same file
                      }}
                    />
                  </div>
                  {pendingFiles.length > 0 && (
                    <div className="tm-file-chips">
                      {pendingFiles.map((f, i) => (
                        <span key={`${f.name}-${i}`} className="tm-file-chip" title={`${f.name} (${humanSize(f.size)})`}>
                          <DocumentIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                          <span className="tm-file-chip-name">{f.name}</span>
                          <button type="button" className="tm-chip-x" title="Remove"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="tmq-hint" style={{ padding: 0, marginTop: 8 }}>Any file type, up to 25MB each.</div>
                </div>
              )}

              {/* ── Activity / Attachments tabs (existing task) ── */}
              {!isCreate && (
                <>
                  <div className="tmq-divider" />
                  <div className="tm-tabs" style={{ padding: '0 20px' }}>
                    <button
                      type="button"
                      className={`tm-tab ${detailTab === 'activity' ? 'is-active' : ''}`}
                      onClick={() => setDetailTab('activity')}
                    >
                      Activity {remarks.length ? `(${remarks.length})` : ''}
                    </button>
                    <button
                      type="button"
                      className={`tm-tab ${detailTab === 'attachments' ? 'is-active' : ''}`}
                      onClick={() => setDetailTab('attachments')}
                    >
                      Attachments {attachments.length ? `(${attachments.length})` : ''}
                    </button>
                  </div>

                  {/* Activity tab (default) */}
                  {detailTab === 'activity' && (
                    remarks.length === 0 ? (
                      <div className="tmq-hint" style={{ marginTop: 10 }}>No activity yet.</div>
                    ) : (
                      <div className="tmq-act-tablewrap" style={{ marginTop: 10 }}>
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
                                  <td>
                                    {r.content || '—'}
                                    {r.voice?.file_url && (
                                      <div className="tmq-voice-play">
                                        <MicrophoneIcon style={{ width: 13, height: 13 }} />
                                        <audio className="tmq-voice-audio" src={r.voice.file_url} controls preload="none" />
                                        {r.voice.duration ? <span className="tmq-voice-len">{mmss(r.voice.duration)}</span> : null}
                                      </div>
                                    )}
                                    {Array.isArray(r.attachments) && r.attachments.length > 0 && (
                                      <div className="tmq-act-attachments">
                                        {r.attachments.map((att, i) => (
                                          <a
                                            key={att.id || i}
                                            href={fileHref(att)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="tmq-act-attach"
                                            title={`${att.file_name || 'File'} (${humanSize(att.file_size)})`}
                                          >
                                            <DocumentIcon style={{ width: 13, height: 13, flexShrink: 0 }} />
                                            <span className="tmq-act-attach-name">{att.file_name || 'File'}</span>
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td>{r.user ? fullName(r.user) : 'System'}</td>
                                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</td>
                                  <td style={{ whiteSpace: 'nowrap' }}>{r.follow_up_date ? fmtDate(r.follow_up_date) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {/* Attachments tab */}
                  {detailTab === 'attachments' && (
                    <>
                      {attachments.length === 0 ? (
                        <div className="tmq-hint" style={{ marginTop: 10 }}>No attachments yet.</div>
                      ) : (
                        <div className="tm-attach-list" style={{ marginTop: 10 }}>
                          {attachments.map((att, i) => {
                            const isImg = (att.mime_type || '').startsWith('image/');
                            const who = uploaderLabel(att);
                            return (
                              <a key={att.id || i} href={fileHref(att)} target="_blank" rel="noreferrer"
                                className="tm-attach-row"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', textDecoration: 'none', color: 'inherit' }}>
                                <span style={{ width: 34, height: 34, borderRadius: 6, background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                  {isImg ? <img src={fileHref(att)} alt={att.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>{(att.mime_type || '').includes('pdf') ? '📄' : '📎'}</span>}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {att.file_name || 'File'} <span className="tmq-hint" style={{ padding: 0 }}>({humanSize(att.file_size)})</span>
                                  </span>
                                  {(who || att.uploaded_at) && (
                                    <span className="tmq-hint" style={{ padding: 0, display: 'block', marginTop: 2 }}>
                                      {who ? `Uploaded by ${who}` : 'Uploaded'}{att.uploaded_at ? ` · ${fmtDateTime(att.uploaded_at)}` : ''}
                                    </span>
                                  )}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {canEditCore && (
                        <div className="tmq-attach-uploader" style={{ marginTop: 10 }}>
                          <div className="tm-file-picker">
                            <button type="button" className="tm-file-btn" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                              {uploading ? 'Uploading…' : 'Choose files'}
                            </button>
                            <span className="tm-file-count">Add any file (up to 25MB each)</span>
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            disabled={uploading}
                            onChange={(e) => handleUploadToExisting(e.target.files)}
                          />
                        </div>
                      )}
                    </>
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
