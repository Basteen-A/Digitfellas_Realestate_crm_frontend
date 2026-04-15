import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import followUpApi from '../../../api/followUpApi';
import projectApi from '../../../api/projectApi';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import leadStatusApi from '../../../api/leadStatusApi';
import statusRemarkApi from '../../../api/statusRemarkApi';
import { formatDateTime } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';

const FOLLOW_UP_STATUS_CODES = new Set(['FOLLOW_UP', 'SV_SCHEDULED', 'RNR']);
const SV_DONE_STATUS_CODES = new Set(['SV_DONE']);
const CLOSURE_STATUS_CODES = new Set(['SPAM', 'JUNK', 'LOST', 'COLD', 'COLD_LOST', 'CLOSED_LOST']);

const TelecallerFollowUps = ({ user }) => {
  const [followUps, setFollowUps] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [statusOptions, setStatusOptions] = useState([]);
  const [remarkOptions, setRemarkOptions] = useState([]);
  const [remarkLoading, setRemarkLoading] = useState(false);
  const [projectOptions, setProjectOptions] = useState([]);
  const [smUsers, setSmUsers] = useState([]);
  const [closureReasons, setClosureReasons] = useState([]);
  const [completing, setCompleting] = useState(null);
  const [completeForm, setCompleteForm] = useState({
    outcome: '',
    notes: '',
    call_disposition: '',
    lead_status_id: '',
    statusRemarkText: '',
    statusRemarkResponseType: '',
    nextFollowUpAt: '',
    assignToUserId: '',
    svDate: '',
    svProjectId: '',
    closureReasonId: '',
  });

  /* ── Extract data safely from API responses ── */
  const extractRows = (resp) => {
    const d = resp?.data; // axios unwrap
    if (!d) return [];
    // paginatedResponse: { data: [...] }
    // successResponse: { data: [...] }
    if (Array.isArray(d.data)) return d.data;
    if (Array.isArray(d.rows)) return d.rows;
    if (Array.isArray(d)) return d;
    return [];
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === 'completed') params.is_completed = 'true';
      else if (filter === 'pending' || filter === 'today') params.is_completed = 'false';

      const [allResp, overdueResp] = await Promise.all([
        filter === 'today'
          ? followUpApi.getTodays()
          : followUpApi.getAll(params),
        followUpApi.getOverdue(),
      ]);

      setFollowUps(extractRows(allResp));
      setOverdue(extractRows(overdueResp));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load follow-ups'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const loadStatusOptions = async () => {
      try {
        const resp = await leadStatusApi.getDropdown();
        const statuses = resp.data || [];
        const allowed = statuses.filter((status) => {
          const code = String(status.status_code || '').toUpperCase();
          return FOLLOW_UP_STATUS_CODES.has(code) || SV_DONE_STATUS_CODES.has(code) || CLOSURE_STATUS_CODES.has(code);
        });
        setStatusOptions(allowed.length ? allowed : statuses);
      } catch {
        setStatusOptions([]);
      }
    };

    const loadSupportingData = async () => {
      try {
        const [projectsResp, smUsersResp] = await Promise.all([
          projectApi.getDropdown().catch(() => ({ data: [] })),
          leadWorkflowApi.getAssignableUsers('SM').catch(() => ({ data: [] })),
        ]);
        setProjectOptions(projectsResp.data || []);
        setSmUsers(smUsersResp.data || []);
      } catch {
        setProjectOptions([]);
        setSmUsers([]);
      }
    };

    loadStatusOptions();
    loadSupportingData();
  }, []);

  const selectedStatus = statusOptions.find((item) => item.id === completeForm.lead_status_id);
  const selectedStatusCode = String(selectedStatus?.status_code || '').toUpperCase();
  const requiresFollowUpDate = FOLLOW_UP_STATUS_CODES.has(selectedStatusCode);
  const requiresSvDoneFields = SV_DONE_STATUS_CODES.has(selectedStatusCode);
  const requiresClosureReason = CLOSURE_STATUS_CODES.has(selectedStatusCode);
  const requiresCallResponse = !requiresClosureReason;

  useEffect(() => {
    const loadClosureReasons = async () => {
      if (!completing || !requiresClosureReason) {
        setClosureReasons([]);
        return;
      }

      const category = selectedStatusCode === 'SPAM'
        ? 'SPAM'
        : selectedStatusCode === 'JUNK'
          ? 'JUNK'
          : selectedStatusCode === 'COLD' || selectedStatusCode === 'COLD_LOST'
            ? 'COLD'
            : '';

      try {
        const resp = await leadWorkflowApi.getClosureReasons(category);
        setClosureReasons(resp.data?.rows || resp.data || []);
      } catch {
        setClosureReasons([]);
      }
    };

    loadClosureReasons();
  }, [completing, requiresClosureReason, selectedStatusCode]);

  const loadRemarksForStatus = useCallback(async (statusId) => {
    const status = statusOptions.find((item) => item.id === statusId);
    if (!status?.status_code) {
      setRemarkOptions([]);
      return;
    }

    setRemarkLoading(true);
    try {
      const resp = await statusRemarkApi.getByStatusCode(status.status_code);
      setRemarkOptions(resp.data?.remarks || []);
    } catch {
      setRemarkOptions([]);
    } finally {
      setRemarkLoading(false);
    }
  }, [statusOptions]);

  useEffect(() => {
    if (!completing) {
      setRemarkOptions([]);
      return;
    }

    if (completeForm.lead_status_id) {
      loadRemarksForStatus(completeForm.lead_status_id);
    } else {
      setRemarkOptions([]);
    }
  }, [completing, completeForm.lead_status_id, loadRemarksForStatus]);

  const handleComplete = async (id) => {
    if (!completeForm.lead_status_id) {
      toast.error('Please select a follow-up status');
      return;
    }
    if (requiresFollowUpDate && !completeForm.nextFollowUpAt) {
      toast.error('Please select a follow-up date');
      return;
    }
    if (requiresSvDoneFields && !completeForm.assignToUserId) {
      toast.error('Please select a Sales Manager');
      return;
    }
    if (requiresSvDoneFields && !completeForm.svDate) {
      toast.error('Please select the site visit date');
      return;
    }
    if (requiresSvDoneFields && !completeForm.svProjectId) {
      toast.error('Please select the project visited');
      return;
    }
    if (requiresClosureReason && !completeForm.closureReasonId) {
      toast.error('Please select a closure reason');
      return;
    }
    if (requiresCallResponse && !completeForm.statusRemarkResponseType) {
      toast.error('Please select call answered / not answered');
      return;
    }
    try {
      const payload = {
        outcome: completeForm.outcome || undefined,
        notes: completeForm.notes?.trim() || undefined,
        call_disposition: completeForm.call_disposition || undefined,
        lead_status_id: completeForm.lead_status_id || undefined,
        statusRemarkText: completeForm.statusRemarkText || undefined,
        statusRemarkResponseType: completeForm.statusRemarkResponseType || undefined,
        next_follow_up_date: completeForm.nextFollowUpAt || undefined,
        assignToUserId: completeForm.assignToUserId || undefined,
        svDate: completeForm.svDate || undefined,
        svProjectId: completeForm.svProjectId || undefined,
        closureReasonId: completeForm.closureReasonId || undefined,
      };
      await followUpApi.complete(id, payload);
      toast.success('Follow-up completed');
      setCompleting(null);
      setRemarkOptions([]);
      setCompleteForm({
        outcome: '',
        notes: '',
        call_disposition: '',
        lead_status_id: '',
        statusRemarkText: '',
        statusRemarkResponseType: '',
        nextFollowUpAt: '',
        assignToUserId: '',
        svDate: '',
        svProjectId: '',
        closureReasonId: '',
      });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete follow-up'));
    }
  };

  const isOverdue = (scheduledAt) => {
    return scheduledAt && new Date(scheduledAt) < new Date() && filter !== 'completed';
  };

  const getRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = d - now;
    const diffMins = Math.round(diffMs / 60000);
    const diffHrs = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMs < 0) {
      const absMins = Math.abs(diffMins);
      if (absMins < 60) return `${absMins}m overdue`;
      const absHrs = Math.abs(diffHrs);
      if (absHrs < 24) return `${absHrs}h overdue`;
      return `${Math.abs(diffDays)}d overdue`;
    }
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHrs < 24) return `in ${diffHrs}h`;
    return `in ${diffDays}d`;
  };

  // Stats
  const totalCount = followUps.length;
  const overdueCount = overdue.length;
  const todayCount = followUps.filter((fu) => {
    if (!fu.scheduled_at) return false;
    const d = new Date(fu.scheduled_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div>
      {/*  Page Header  */}
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Follow-ups</h1>
          <p className="hidden sm:block">Manage your scheduled calls & follow-ups</p>
        </div>
        <div className="page-header-actions flex-wrap" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="crm-form-select"
            style={{ width: 150 }}
          >
            <option value="pending">📋 Pending</option>
            <option value="today">📅 Today</option>
            <option value="completed">✅ Completed</option>
          </select>
          <button className="crm-btn crm-btn-ghost" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Stats Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{filter === 'completed' ? 'Completed' : 'Pending'}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{totalCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>follow-ups</div>
        </div>
        <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Today</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#d97706' }}>{todayCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>scheduled</div>
        </div>
        <div style={{ background: overdueCount > 0 ? '#fef2f2' : 'var(--bg-card, #fff)', border: `1px solid ${overdueCount > 0 ? '#fecaca' : 'var(--border-primary, #e2e8f0)'}`, borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: overdueCount > 0 ? '#dc2626' : 'var(--text-secondary)', fontWeight: 500 }}>Overdue</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: overdueCount > 0 ? '#dc2626' : 'var(--text-primary)' }}>{overdueCount}</div>
          <div style={{ fontSize: 11, color: overdueCount > 0 ? '#dc2626' : 'var(--text-secondary)' }}>need attention</div>
        </div>
      </div>

      {/* ── Overdue Banner ── */}
      {overdueCount > 0 && filter !== 'completed' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24 }}>⚠️</div>
          <div>
            <div style={{ fontWeight: 600, color: '#dc2626', fontSize: 14 }}>
              You have {overdueCount} overdue follow-up{overdueCount > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 12, color: '#991b1b' }}>Please address these as soon as possible to maintain lead temperature.</div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          Loading follow-ups...
        </div>
      )}

      {/* ── Follow-Up List ── */}
      {!loading && (
        <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 12, overflow: 'hidden' }}>
          {followUps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📞</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                No {filter} follow-ups found
              </div>
              <div style={{ fontSize: 13 }}>
                {filter === 'pending' ? "You're all caught up! Great work." : filter === 'today' ? 'No follow-ups scheduled for today.' : 'No completed follow-ups yet.'}
              </div>
            </div>
          )}

          {followUps.map((fu, idx) => {
            const isLate = isOverdue(fu.scheduled_at);
            const schedDate = fu.scheduled_at ? new Date(fu.scheduled_at) : null;
            const leadName = [fu.lead?.first_name, fu.lead?.last_name].filter(Boolean).join(' ') || 'Unknown Lead';
            const leadPhone = fu.lead?.phone || '';
            const leadNumber = fu.lead?.lead_number || '';
            const projectName = fu.lead?.project?.project_name || '';
            const stageName = fu.lead?.stage?.stage_name || '';
            const stageColor = fu.lead?.stage?.color_code || '#94a3b8';
            const statusName = fu.lead?.status?.status_name || '';
            const statusColor = fu.lead?.status?.color_code || '#94a3b8';

            return (
              <div
                key={fu.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  padding: '16px 20px',
                  borderBottom: idx < followUps.length - 1 ? '1px solid var(--border-primary, #f1f5f9)' : 'none',
                  background: isLate ? '#fef2f2' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* ── Time Block ── */}
                <div style={{ minWidth: 72, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isLate ? '#dc2626' : 'var(--text-primary)', lineHeight: 1.2 }}>
                    {schedDate ? schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}
                  </div>
                  <div style={{ fontSize: 11, color: isLate ? '#dc2626' : 'var(--text-secondary)', marginTop: 2 }}>
                    {schedDate ? schedDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                  </div>
                  {isLate && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#dc2626', borderRadius: 4, padding: '2px 6px', marginTop: 4, display: 'inline-block' }}>
                      OVERDUE
                    </div>
                  )}
                  {!isLate && !fu.is_completed && schedDate && (
                    <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
                      {getRelativeTime(fu.scheduled_at)}
                    </div>
                  )}
                </div>

                {/* ── Content ── */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{leadName}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#eef2ff', color: '#4f46e5', fontWeight: 600 }}>
                      {fu.follow_up_mode || 'Call'}
                    </span>
                    {stageName && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: stageColor + '18', color: stageColor, fontWeight: 600 }}>
                        {stageName}
                      </span>
                    )}
                    {statusName && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: statusColor + '18', color: statusColor, fontWeight: 600 }}>
                        {statusName}
                      </span>
                    )}
                  </div>

                  {/* Notes */}
                  {fu.notes && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.4 }}>{fu.notes}</div>
                  )}

                  {/* Meta Row */}
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    {leadPhone && <span>📱 {leadPhone}</span>}
                    {leadNumber && <span>🔢 {leadNumber}</span>}
                    {projectName && <span>📍 {projectName}</span>}
                  </div>

                  {/* Complete Form */}
                  {!fu.is_completed && completing === fu.id && (
                    <div style={{ marginTop: 12, background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Complete Follow-up</div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Follow-up Status *</div>
                          <select
                            value={completeForm.lead_status_id}
                            onChange={(e) => setCompleteForm((p) => ({
                              ...p,
                              lead_status_id: e.target.value,
                              statusRemarkText: '',
                              notes: '',
                              nextFollowUpAt: '',
                              assignToUserId: '',
                              svDate: '',
                              svProjectId: '',
                              closureReasonId: '',
                              statusRemarkResponseType: '',
                            }))}
                            className="crm-form-select"
                            style={{ width: '100%' }}
                          >
                            <option value="">Select status...</option>
                            {statusOptions.map((item) => (
                              <option key={item.id} value={item.id}>{item.status_name || item.status_code}</option>
                            ))}
                          </select>
                        </div>

                        {requiresCallResponse && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Call Answered?</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="crm-btn crm-btn-sm"
                                style={{
                                  flex: 1,
                                  background: completeForm.statusRemarkResponseType === 'Answered' ? '#E0F4EE' : 'transparent',
                                  borderColor: completeForm.statusRemarkResponseType === 'Answered' ? '#0F7B5C' : undefined,
                                  color: completeForm.statusRemarkResponseType === 'Answered' ? '#0F7B5C' : undefined,
                                }}
                                onClick={() => setCompleteForm((p) => ({ ...p, statusRemarkResponseType: 'Answered' }))}
                              >
                                Answered
                              </button>
                              <button
                                type="button"
                                className="crm-btn crm-btn-sm"
                                style={{
                                  flex: 1,
                                  background: completeForm.statusRemarkResponseType === 'Not-Answered' ? '#FEF3C7' : 'transparent',
                                  borderColor: completeForm.statusRemarkResponseType === 'Not-Answered' ? '#B45309' : undefined,
                                  color: completeForm.statusRemarkResponseType === 'Not-Answered' ? '#B45309' : undefined,
                                }}
                                onClick={() => setCompleteForm((p) => ({ ...p, statusRemarkResponseType: 'Not-Answered' }))}
                              >
                                Not Answered
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {requiresFollowUpDate && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Next Follow-up Date *</div>
                          <input
                            type="datetime-local"
                            className="crm-form-input"
                            style={{ width: '100%' }}
                            value={completeForm.nextFollowUpAt}
                            onChange={(e) => setCompleteForm((p) => ({ ...p, nextFollowUpAt: e.target.value }))}
                          />
                        </div>
                      )}

                      {requiresSvDoneFields && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Sales Manager *</div>
                            <select
                              value={completeForm.assignToUserId}
                              onChange={(e) => setCompleteForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                              className="crm-form-select"
                              style={{ width: '100%' }}
                            >
                              <option value="">Select Sales Manager...</option>
                              {smUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Site Visit Date *</div>
                            <input
                              type="datetime-local"
                              className="crm-form-input"
                              style={{ width: '100%' }}
                              value={completeForm.svDate}
                              onChange={(e) => setCompleteForm((p) => ({ ...p, svDate: e.target.value }))}
                            />
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Project Visited *</div>
                            <select
                              value={completeForm.svProjectId}
                              onChange={(e) => setCompleteForm((p) => ({ ...p, svProjectId: e.target.value }))}
                              className="crm-form-select"
                              style={{ width: '100%' }}
                            >
                              <option value="">Select project...</option>
                              {projectOptions.map((project) => (
                                <option key={project.id} value={project.id}>{project.project_name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {requiresClosureReason && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Closure Reason *</div>
                          <select
                            value={completeForm.closureReasonId}
                            onChange={(e) => setCompleteForm((p) => ({ ...p, closureReasonId: e.target.value }))}
                            className="crm-form-select"
                            style={{ width: '100%' }}
                          >
                            <option value="">Select reason...</option>
                            {closureReasons.map((reason) => (
                              <option key={reason.id} value={reason.id}>{reason.reason_name || reason.reason}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedStatus?.status_code && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Action Remarks</div>
                          {remarkLoading ? (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading remarks...</div>
                          ) : remarkOptions.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {remarkOptions.map((remark) => (
                                <button
                                  key={remark.id}
                                  type="button"
                                  className="crm-btn crm-btn-ghost crm-btn-sm"
                                  style={{
                                    background: completeForm.statusRemarkText === remark.remark_text ? '#dbeafe' : 'transparent',
                                    borderColor: completeForm.statusRemarkText === remark.remark_text ? '#60a5fa' : undefined,
                                  }}
                                  onClick={() => setCompleteForm((p) => ({
                                    ...p,
                                    statusRemarkText: remark.remark_text,
                                    notes: remark.remark_text,
                                    statusRemarkResponseType: remark.has_ans_non_ans ? (remark.ans_non_ans_default || 'Answered') : p.statusRemarkResponseType,
                                  }))}
                                >
                                  {remark.remark_text}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No remarks configured for this status.</div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Disposition</div>
                          <select
                            value={completeForm.call_disposition}
                            onChange={(e) => setCompleteForm((p) => ({ ...p, call_disposition: e.target.value }))}
                            className="crm-form-select"
                            style={{ width: '100%' }}
                          >
                            <option value="">Select disposition...</option>
                            <option value="Connected">Connected</option>
                            <option value="Busy">Busy</option>
                            <option value="No Answer">No Answer</option>
                            <option value="Switched Off">Switched Off</option>
                            <option value="Invalid Number">Invalid Number</option>
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Action Remarks</div>
                          <textarea
                            placeholder="What was discussed and what happens next?"
                            value={completeForm.notes}
                            onChange={(e) => setCompleteForm((p) => ({ ...p, notes: e.target.value }))}
                            className="crm-form-input"
                            rows={2}
                            style={{ width: '100%', resize: 'vertical' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          type="button"
                          className="crm-btn crm-btn-ghost crm-btn-sm"
                          onClick={() => { setCompleting(null); setRemarkOptions([]); setCompleteForm({ outcome: '', notes: '', call_disposition: '', lead_status_id: '', statusRemarkText: '', statusRemarkResponseType: '' }); }}
                        >
                          Cancel
                        </button>
                        <button type="button" className="crm-btn crm-btn-success crm-btn-sm" onClick={() => handleComplete(fu.id)}>
                          ✓ Mark Complete
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Actions ── */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  {!fu.is_completed && completing !== fu.id && (
                    <button
                      className="crm-btn crm-btn-primary crm-btn-sm"
                      onClick={() => {
                        setCompleting(fu.id);
                        setCompleteForm({
                          outcome: '',
                          notes: fu.notes || '',
                          call_disposition: '',
                          lead_status_id: fu.lead?.status?.id || '',
                          statusRemarkText: '',
                          statusRemarkResponseType: '',
                          nextFollowUpAt: '',
                          assignToUserId: '',
                          svDate: '',
                          svProjectId: '',
                          closureReasonId: '',
                        });
                      }}
                    >
                      ✓ Complete
                    </button>
                  )}
                  {fu.is_completed && (
                    <div>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>✓ Completed</span>
                      {fu.outcome && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{fu.outcome}</div>}
                      {fu.call_disposition && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Call: {fu.call_disposition}</div>}
                      {fu.completed_at && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatDateTime(fu.completed_at)}</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TelecallerFollowUps;
