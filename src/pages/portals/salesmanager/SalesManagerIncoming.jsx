import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import customerTypeApi from '../../../api/customerTypeApi';
import motivationApi from '../../../api/motivationApi';
import statusRemarkApi from '../../../api/statusRemarkApi';
import { formatDateTime } from '../../../utils/formatters';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/helpers';
import { getActionsForRole } from '../common/workflowConfig';
import { getRoleCode } from '../../../utils/permissions';
import CalendarPicker from '../../../components/common/CalendarPicker';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MapPinIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  HandRaisedIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  TrashIcon,
  PhoneIcon,
  CheckIcon,
  SparklesIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

/* ── helpers ── */
const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'all', label: 'All' },
  { value: 'custom', label: 'Custom Date' },
];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => { const e = new Date(d); e.setHours(23, 59, 59, 999); return e; };

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getQuickFollowUpDate = (dayOffset, hour, minute = 0) => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return toDateTimeLocalValue(date.toISOString());
};

const getQuickFollowUpForWeekday = (weekday, hour, minute = 0) => {
  const date = new Date();
  date.setSeconds(0, 0);
  const currentDay = date.getDay();
  const dayOffset = (weekday - currentDay + 7) % 7;
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return toDateTimeLocalValue(date.toISOString());
};

const getAssigneeRoleForAction = (action) => {
  if (!action) return 'SH';
  if (action.code === 'SM_SITE_VISIT') return 'SH';
  if (action.needsSvDetails) return 'SH';
  if (action.assigneeRole) return action.assigneeRole;
  return 'SH';
};

const SalesManagerIncoming = ({ onNavigate }) => {
  const authUser = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(authUser);

  const [handoffs, setHandoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');

  // Dropdown options
  const [projectOptions, setProjectOptions] = useState([]);
  const [customerTypeOptions, setCustomerTypeOptions] = useState([]);
  const [motivationOptions, setMotivationOptions] = useState([]);
  const [salesHeadOptions, setSalesHeadOptions] = useState([]);
  const [workflowConfig, setWorkflowConfig] = useState(null);

  // Per-handoff site-visit form state
  const [acceptForms, setAcceptForms] = useState({});

  // QA state (shared — only one expanded at a time)
  const [quickWorkflowAction, setQuickWorkflowAction] = useState(null);
  const [quickWorkflowForm, setQuickWorkflowForm] = useState({
    note: '', statusRemarkText: '', nextFollowUpAt: '', assignToUserId: '',
    closureReasonId: '', reason: '', callResult: 'Answered',
  });
  const [quickActionLoading] = useState(false);
  const [quickStatusRemarks, setQuickStatusRemarks] = useState([]);
  const [quickRemarkAnsNonAns, setQuickRemarkAnsNonAns] = useState(null);
  const [closureReasons, setClosureReasons] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState({});

  const roleActions = useMemo(
    () => getActionsForRole(workflowConfig?.actions || {}, roleCode),
    [workflowConfig, roleCode]
  );

  const loadOptions = useCallback(async () => {
    try {
      const [projResp, ctResp, motResp, shResp, wfResp] = await Promise.all([
        projectApi.getDropdown(),
        customerTypeApi.getDropdown(),
        motivationApi.getDropdown(),
        leadWorkflowApi.getAssignableUsers('SH'),
        leadWorkflowApi.getWorkflowConfig(),
      ]);
      setProjectOptions(projResp.data || []);
      setCustomerTypeOptions(ctResp.data || []);
      setMotivationOptions(motResp.data || []);
      setSalesHeadOptions(shResp.data || []);
      setWorkflowConfig(wfResp?.data || null);
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  }, []);

  const fetchHandoffs = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await leadWorkflowApi.getHandoffs({
        type: 'incoming', stageCode: 'SITE_VISIT', statusCode: 'SV_DONE',
        currentOnly: true, pendingAcceptance: true, limit: 200,
      });
      setHandoffs(Array.isArray(resp?.data) ? resp.data : []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load incoming leads.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHandoffs(); }, [fetchHandoffs]);
  useEffect(() => { loadOptions(); }, [loadOptions]);

  const filteredHandoffs = handoffs.filter((h) => {
    const d = h.handedOffAt ? new Date(h.handedOffAt) : null;
    if (!d) return dateFilter === 'all';
    const now = new Date();
    if (dateFilter === 'today') return d >= startOfDay(now) && d <= endOfDay(now);
    if (dateFilter === 'tomorrow') { const t = new Date(now); t.setDate(t.getDate() + 1); return d >= startOfDay(t) && d <= endOfDay(t); }
    if (dateFilter === 'custom' && customDate) { const cd = new Date(customDate); return d >= startOfDay(cd) && d <= endOfDay(cd); }
    return true;
  });

  // Accept form helpers
  const updateAcceptForm = (handoffId, patch) => setAcceptForms((prev) => ({ ...prev, [handoffId]: { ...(prev[handoffId] || {}), ...patch } }));
  const getForm = (id) => acceptForms[id] || {};

  // Reset QA state
  const resetQuickWorkflowForm = () => {
    setQuickWorkflowAction(null);
    setQuickWorkflowForm({ note: '', statusRemarkText: '', nextFollowUpAt: '', assignToUserId: '', closureReasonId: '', reason: '', callResult: 'Answered' });
    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);
    setClosureReasons([]);
  };

  // Handle action select (exactly like LeadWorkspacePage)
  const handleQuickWorkflowActionSelect = async (action) => {
    setQuickWorkflowAction(action);
    setQuickWorkflowForm({
      note: '', statusRemarkText: '', nextFollowUpAt: '', assignToUserId: '',
      closureReasonId: '', reason: '',
      callResult: action.targetStatusCode === 'RNR' || action.code.includes('RNR') ? 'Not Answered' : 'Answered',
    });
    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);

    // Load assignable users
    if (action.needsAssignee || action.needsSvDetails) {
      try {
        const roleTarget = getAssigneeRoleForAction(action);
        const resp = await leadWorkflowApi.getAssignableUsers(roleTarget);
        setAssignableUsers((prev) => ({ ...prev, [roleTarget]: resp.data || [] }));
      } catch { /* skip */ }
    }

    // Load closure reasons
    if (action.needsReason && action.reasonCategory) {
      try {
        const resp = await leadWorkflowApi.getClosureReasons(action.reasonCategory);
        setClosureReasons(resp.data?.rows || resp.data || []);
      } catch { setClosureReasons([]); }
    } else { setClosureReasons([]); }

    // Load status remarks
    if (action.targetStatusCode) {
      try {
        const resp = await statusRemarkApi.getByStatusCode(action.targetStatusCode);
        setQuickStatusRemarks(resp.data || []);
      } catch { setQuickStatusRemarks([]); }
    } else { setQuickStatusRemarks([]); }
  };

  const handleAccept = async (handoff) => {
    const form = getForm(handoff.id);
    const selectedProjectId = form.svProjectId || handoff.leadProjectId || '';

    // QA validation
    if (!quickWorkflowAction) { toast.error('Please select a Quick Action before accepting.'); return; }
    if (quickWorkflowAction.needsFollowUp && !quickWorkflowForm.nextFollowUpAt) { toast.error('Follow-up date is required.'); return; }
    if (quickWorkflowAction.needsReason && !quickWorkflowForm.closureReasonId) { toast.error('Reason is required.'); return; }

    // SV validation
    if (!form.svDate) { toast.error('Site Visit date is required.'); return; }
    if (!selectedProjectId) { toast.error('Visited Project is required.'); return; }
    if (!form.customerTypeId) { toast.error('Customer Type is required.'); return; }
    if (!form.primaryRequirement?.trim()) { toast.error('Primary Requirement is required.'); return; }
    if (!form.timeSpent) { toast.error('Time Spent is required.'); return; }
    if (!form.motivationType) { toast.error('Motivation is required.'); return; }
    if (!form.salesHeadUserId) { toast.error('Sales Head selection is required.'); return; }
    if (form.latitude == null || form.latitude === '' || form.longitude == null || form.longitude === '') {
      toast.error('Please capture location before accepting.'); return;
    }

    setProcessingId(handoff.id);
    try {
      // Step 1: Accept lead
      await leadWorkflowApi.acceptIncomingLead(handoff.leadId, {
        svDate: form.svDate, svProjectId: selectedProjectId,
        latitude: Number(form.latitude), longitude: Number(form.longitude),
        motivationType: form.motivationType, primaryRequirement: form.primaryRequirement,
        secondaryRequirement: form.secondaryRequirement || null,
        note: quickWorkflowForm.note || 'Incoming handoff accepted by Sales Manager',
        timeSpent: Number(form.timeSpent), customerTypeId: form.customerTypeId,
        salesHeadUserId: form.salesHeadUserId,
      });

      // Step 2: Transition with selected action
      try {
        const transPayload = {
          note: quickWorkflowForm.note || `Status set to ${quickWorkflowAction.label} on acceptance`,
          callResult: quickWorkflowForm.callResult || 'Answered',
          statusRemarkText: quickWorkflowForm.statusRemarkText || undefined,
        };
        if (quickWorkflowAction.needsFollowUp && quickWorkflowForm.nextFollowUpAt)
          transPayload.nextFollowUpAt = new Date(quickWorkflowForm.nextFollowUpAt).toISOString();
        if (quickWorkflowAction.needsReason && quickWorkflowForm.closureReasonId) {
          transPayload.closureReasonId = quickWorkflowForm.closureReasonId;
          transPayload.reason = quickWorkflowForm.reason || undefined;
        }
        if (quickWorkflowAction.needsAssignee || quickWorkflowAction.needsSvDetails)
          transPayload.assignToUserId = quickWorkflowForm.assignToUserId || form.salesHeadUserId;
        if (quickWorkflowAction.needsSvDetails) {
          transPayload.svDate = form.svDate; transPayload.svProjectId = selectedProjectId;
          transPayload.motivationType = form.motivationType;
          transPayload.primaryRequirement = form.primaryRequirement;
          transPayload.secondaryRequirement = form.secondaryRequirement || undefined;
          transPayload.latitude = Number(form.latitude); transPayload.longitude = Number(form.longitude);
          transPayload.time_spent = Number(form.timeSpent);
        }
        if (quickRemarkAnsNonAns) transPayload.statusRemarkResponseType = quickRemarkAnsNonAns;
        await leadWorkflowApi.transitionLead(handoff.leadId, quickWorkflowAction.code, transPayload);
      } catch (transErr) {
        toast.error('Lead accepted but status update failed: ' + getErrorMessage(transErr));
      }

      setHandoffs((prev) => prev.filter((item) => item.id !== handoff.id));
      setExpandedId(null);
      resetQuickWorkflowForm();
      toast.success('Lead accepted successfully!');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to accept lead.'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (handoff) => {
    if (!handoff.fromUserId) { toast.error('Source owner not found'); return; }
    setProcessingId(handoff.id);
    try {
      await leadWorkflowApi.assignLead(handoff.leadId, handoff.fromUserId, 'Handoff rejected by Sales Manager');
      toast.success('Lead rejected.');
      fetchHandoffs();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reject lead.'));
    } finally {
      setProcessingId(null);
    }
  };

  const toggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      resetQuickWorkflowForm();
    } else {
      setExpandedId(id);
      resetQuickWorkflowForm();
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}>Loading incoming leads...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--accent-red)' }}>{error}</div>;

  return (
    <div className="incoming-leads-page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div><h1 style={{ margin: 0 }}>Incoming Leads</h1></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {DATE_FILTERS.map((f) => (
            <button key={f.value} className={`crm-btn crm-btn-sm ${dateFilter === f.value ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setDateFilter(f.value)}>{f.label}</button>
          ))}
          {dateFilter === 'custom' && <input type="date" className="crm-form-input" value={customDate} onChange={(e) => setCustomDate(e.target.value)} style={{ height: 32, fontSize: 12 }} />}
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={fetchHandoffs}>Refresh</button>
        </div>
      </div>

      {filteredHandoffs.length === 0 ? (
        <div className="crm-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No incoming leads</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{dateFilter === 'today' ? "No leads handed off today." : "No leads match the selected filter."}</div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1.2fr 0.8fr 40px', padding: '10px 16px', background: 'var(--bg-primary, #f8fafc)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-primary)' }}>
            <span>Lead</span><span>Lead #</span><span>Project</span><span>From (TC)</span><span>Handed Off</span><span>Status</span><span></span>
          </div>

          {filteredHandoffs.map((handoff) => {
            const isExpanded = expandedId === handoff.id;
            const form = getForm(handoff.id);
            const isProcessing = processingId === handoff.id;

            return (
              <div key={handoff.id} style={{ borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                {/* Row */}
                <div onClick={() => toggleExpand(handoff.id)} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1.2fr 0.8fr 40px', padding: '12px 16px', cursor: 'pointer', background: isExpanded ? 'var(--bg-card)' : 'transparent', transition: 'background 0.15s', alignItems: 'center', fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{handoff.leadName || 'Unnamed'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{handoff.leadPhone || '—'}</div>
                  </div>
                  <span style={{ color: 'var(--text-secondary)' }}>{handoff.leadNumber || '—'}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{handoff.leadProjectName || '—'}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{handoff.fromUserName || '—'}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(handoff.handedOffAt)}</span>
                  <span className="crm-badge badge-interested" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12 }}>{handoff.stageName || 'SV Done'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{isExpanded ? <ChevronUpIcon style={{ width: 16 }} /> : <ChevronDownIcon style={{ width: 16 }} />}</span>
                </div>

                {/* Accordion Expanded */}
                {isExpanded && (
                  <div style={{ background: 'var(--bg-card, #fff)', borderTop: '1px dashed var(--border-primary)' }}>
                    {/* TC Remarks */}
                    {handoff.remarks && (
                      <div style={{ padding: '10px 20px', fontSize: 12, fontStyle: 'italic', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                        <strong>TC Remarks:</strong> "{handoff.remarks}"
                      </div>
                    )}

                    {/* ═══ QA DRAWER (exact same classes as LeadWorkspacePage) ═══ */}
                    <div className="qa-drawer-body">

                      {/* ── Update Status Grid ── */}
                      <div className="qa-drawer-section">Update status *</div>
                      <div className="qa-drawer-status-grid">
                        {roleActions.filter((a) => {
                          const isNeg = a.code.includes('NEGOTIATION');
                          const isHot = a.code.includes('NEGOTIATION_HOT') || a.targetStatusCode === 'NEGOTIATION_HOT';
                          // Hide Record Site Visit from incoming accept flow
                          if (a.code === 'SM_SITE_VISIT') return false;
                          return a.tone !== 'danger' && !a.code.includes('REASSIGN') && (!isNeg || isHot);
                        }).map((action) => {
                          let icon = <ClipboardDocumentListIcon style={{ width: 18, height: 18 }} />;
                          let selClass = 'sel-default';
                          if (action.code.includes('RNR')) { icon = <ArrowPathIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-rnr'; }
                          else if (action.code.includes('SV_DONE') || action.code.includes('SITE_VISIT')) { icon = <CheckCircleIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-sv-done'; }
                          else if (action.code.includes('SCHEDULE') || action.code.includes('REVISIT')) { icon = <CalendarDaysIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-sv-scheduled'; }
                          else if (action.code.includes('FOLLOW_UP')) { icon = <PhoneIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-follow-up'; }
                          else if (action.code.includes('NEGOTIATION')) { icon = <HandRaisedIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-negotiation'; }
                          else if (action.code.includes('BOOKING')) { icon = <SparklesIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-booking'; }
                          else if (action.code.includes('PAYMENT')) { icon = <BanknotesIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-booking'; }

                          return (
                            <button key={action.code} type="button"
                              className={`qa-drawer-st-btn ${quickWorkflowAction?.code === action.code ? selClass : ''}`}
                              disabled={quickActionLoading}
                              onClick={() => handleQuickWorkflowActionSelect(action)}>
                              <div className="qa-drawer-st-icon">{icon}</div>
                              <div className="qa-drawer-st-label">{action.label}</div>
                            </button>
                          );
                        })}
                        {/* Danger actions */}
                        {roleActions.filter(a => a.tone === 'danger').map((action) => (
                          <button key={action.code} type="button"
                            className={`qa-drawer-st-btn ${quickWorkflowAction?.code === action.code ? 'sel-junk' : ''}`}
                            disabled={quickActionLoading}
                            onClick={() => handleQuickWorkflowActionSelect(action)}>
                            <div className="qa-drawer-st-icon">
                              {action.code.includes('JUNK') ? <NoSymbolIcon style={{ width: 18, height: 18 }} /> :
                               action.code.includes('SPAM') ? <TrashIcon style={{ width: 18, height: 18 }} /> :
                               <ExclamationTriangleIcon style={{ width: 18, height: 18 }} />}
                            </div>
                            <div className="qa-drawer-st-label">{action.label}</div>
                          </button>
                        ))}
                      </div>

                      {/* ── Dynamic Form (after selecting action) ── */}
                      {quickWorkflowAction && (
                        <div style={{ animation: 'qa-fade-in 0.3s ease' }}>

                          {/* Follow-up date */}
                          {quickWorkflowAction.needsFollowUp && (
                            <div className="qa-drawer-ctx-block">
                              <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Next follow-up date</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(0, 14, 0) }))}>Today 2PM</button>
                                <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(0, 18, 0) }))}>Today 6PM</button>
                                <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(1, 11, 0) }))}>Tmrw 11AM</button>
                                <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(6, 11, 0) }))}>This Sat</button>
                                <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(0, 11, 0) }))}>This Sun</button>
                                <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(2, 11, 0) }))}>In 2 days</button>
                                <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(7, 11, 0) }))}>Next week</button>
                              </div>
                              <CalendarPicker
                                type="datetime"
                                value={quickWorkflowForm.nextFollowUpAt}
                                onChange={(val) => setQuickWorkflowForm((p) => ({ ...p, nextFollowUpAt: val }))}
                                placeholder="Select follow-up date & time..."
                                minDate={new Date().toISOString()}
                              />
                            </div>
                          )}

                          {/* Closure reason */}
                          {quickWorkflowAction.needsReason && (
                            <div className="qa-drawer-ctx-block">
                              <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Reason *</div>
                              <select className="qa-drawer-field-select" value={quickWorkflowForm.closureReasonId} onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, closureReasonId: e.target.value }))} style={{ width: '100%', marginBottom: 8 }}>
                                <option value="">Select a reason...</option>
                                {closureReasons.map(r => <option key={r.id} value={r.id}>{r.reason_name || r.reason_text || r.reason}</option>)}
                              </select>
                            </div>
                          )}

                          {/* Assignee (when action needs it) */}
                          {(quickWorkflowAction.needsAssignee || quickWorkflowAction.needsSvDetails) && (
                            <div className="qa-drawer-ctx-block">
                              <label className="qa-drawer-field-label">
                                {getAssigneeRoleForAction(quickWorkflowAction) === 'SH' ? 'Select Sales Head (Negotiator) *' : 'Assign To *'}
                              </label>
                              <select className="qa-drawer-field-select" value={quickWorkflowForm.assignToUserId} onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, assignToUserId: e.target.value }))} style={{ width: '100%' }}>
                                <option value="">
                                  {getAssigneeRoleForAction(quickWorkflowAction) === 'SH' ? 'Select Sales Head...' : 'Select user...'}
                                </option>
                                {(assignableUsers[getAssigneeRoleForAction(quickWorkflowAction)] || []).map((u) => (
                                  <option key={u.id} value={u.id}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Quick Remarks */}
                          {quickStatusRemarks.length > 0 && (
                            <>
                              <div className="qa-drawer-section">Quick remarks — tap to fill</div>
                              <div className="qa-drawer-rchip-row">
                                {quickStatusRemarks.map(remark => (
                                  <button key={remark.id} type="button"
                                    className={`qa-drawer-rchip ${quickWorkflowForm.statusRemarkText === remark.remark_text ? 'sel' : ''}`}
                                    onClick={() => {
                                      setQuickWorkflowForm(p => ({ ...p, statusRemarkText: remark.remark_text, note: remark.remark_text }));
                                      if (remark.has_ans_non_ans) {
                                        setQuickRemarkAnsNonAns(remark.ans_non_ans_default || quickRemarkAnsNonAns || 'Answered');
                                      } else { setQuickRemarkAnsNonAns(null); }
                                    }}>
                                    {remark.remark_text}
                                  </button>
                                ))}
                              </div>

                              {/* Ans/Non-Ans toggle */}
                              {quickStatusRemarks.some(r => r.has_ans_non_ans) && (
                                <div style={{ margin: '10px 0', padding: '10px', background: 'var(--bg-secondary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600 }}>Response Type:</span>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button type="button" style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, border: quickRemarkAnsNonAns === 'Answered' ? '2px solid #0F7B5C' : '1px solid var(--border-primary)', background: quickRemarkAnsNonAns === 'Answered' ? '#E0F4EE' : 'transparent', color: quickRemarkAnsNonAns === 'Answered' ? '#0F7B5C' : 'var(--text-primary)', borderRadius: 4, cursor: 'pointer' }} onClick={() => setQuickRemarkAnsNonAns('Answered')}>
                                      <CheckIcon style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 2 }} /> Answered
                                    </button>
                                    <button type="button" style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, border: quickRemarkAnsNonAns === 'Not-Answered' ? '2px solid #B45309' : '1px solid var(--border-primary)', background: quickRemarkAnsNonAns === 'Not-Answered' ? '#FEF3C7' : 'transparent', color: quickRemarkAnsNonAns === 'Not-Answered' ? '#B45309' : 'var(--text-primary)', borderRadius: 4, cursor: 'pointer' }} onClick={() => setQuickRemarkAnsNonAns('Not-Answered')}>
                                      <XMarkIcon style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 2 }} /> Not Answered
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* Notes */}
                          <div className="qa-drawer-remark-wrap">
                            <textarea className="qa-drawer-remark-ta" rows={2} value={quickWorkflowForm.note} onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, note: e.target.value }))} placeholder="What was discussed? What's the next step?" />
                          </div>
                        </div>
                      )}

                      <div className="qa-drawer-divider" />

                      {/* ── Site Visit Details ── */}
                      <div className="qa-drawer-section">Site Visit Details (All * fields are mandatory)</div>
                      <div style={{ padding: '0 20px 10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                          <div>
                            <label className="qa-drawer-field-label">SV Date *</label>
                            <input type="date" className="qa-drawer-field-input" style={{ width: '100%' }} value={form.svDate || ''} onChange={(e) => updateAcceptForm(handoff.id, { svDate: e.target.value })} />
                          </div>
                          <div>
                            <label className="qa-drawer-field-label">Visited Project *</label>
                            <select className="qa-drawer-field-select" style={{ width: '100%' }} value={form.svProjectId || handoff.leadProjectId || ''} onChange={(e) => updateAcceptForm(handoff.id, { svProjectId: e.target.value })}>
                              <option value="">Select...</option>
                              {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="qa-drawer-field-label">Customer Type *</label>
                            <select className="qa-drawer-field-select" style={{ width: '100%' }} value={form.customerTypeId || ''} onChange={(e) => updateAcceptForm(handoff.id, { customerTypeId: e.target.value })}>
                              <option value="">Select...</option>
                              {customerTypeOptions.map((ct) => <option key={ct.id} value={ct.id}>{ct.type_name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="qa-drawer-field-label">Motivation *</label>
                            <select className="qa-drawer-field-select" style={{ width: '100%' }} value={form.motivationType || ''} onChange={(e) => updateAcceptForm(handoff.id, { motivationType: e.target.value })}>
                              <option value="">Select...</option>
                              {motivationOptions.map((m) => <option key={m.id} value={m.motivation_name}>{m.motivation_name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="qa-drawer-field-label">Primary Requirement *</label>
                            <input className="qa-drawer-field-input" style={{ width: '100%' }} value={form.primaryRequirement || ''} onChange={(e) => updateAcceptForm(handoff.id, { primaryRequirement: e.target.value })} placeholder="e.g. 2BHK near school" />
                          </div>
                          <div>
                            <label className="qa-drawer-field-label">Time Spent (mins) *</label>
                            <input type="number" min="0" className="qa-drawer-field-input" style={{ width: '100%' }} value={form.timeSpent || ''} onChange={(e) => updateAcceptForm(handoff.id, { timeSpent: e.target.value })} placeholder="e.g. 30" />
                          </div>
                          <div>
                            <label className="qa-drawer-field-label">Sales Head *</label>
                            <select className="qa-drawer-field-select" style={{ width: '100%' }} value={form.salesHeadUserId || ''} onChange={(e) => updateAcceptForm(handoff.id, { salesHeadUserId: e.target.value })}>
                              <option value="">Select Sales Head...</option>
                              {salesHeadOptions.map((sh) => (
                                <option key={sh.id} value={sh.id}>{sh.fullName || `${sh.firstName || ''} ${sh.lastName || ''}`.trim()}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <label className="qa-drawer-field-label" style={{ marginBottom: 0 }}>Geo-Location *</label>
                              <button type="button" className="qa-drawer-rchip" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => {
                                if (navigator.geolocation) {
                                  navigator.geolocation.getCurrentPosition(
                                    (pos) => { updateAcceptForm(handoff.id, { latitude: pos.coords.latitude, longitude: pos.coords.longitude }); toast.success('Location captured!'); },
                                    () => toast.error('Check location permissions')
                                  );
                                }
                              }}>
                                <MapPinIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 2 }} /> Get Position
                              </button>
                            </div>
                            <div className="qa-drawer-field-row">
                              <input type="number" step="any" placeholder="Latitude" className="qa-drawer-field-input" value={form.latitude || ''} onChange={(e) => updateAcceptForm(handoff.id, { latitude: e.target.value })} />
                              <input type="number" step="any" placeholder="Longitude" className="qa-drawer-field-input" value={form.longitude || ''} onChange={(e) => updateAcceptForm(handoff.id, { longitude: e.target.value })} />
                            </div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label className="qa-drawer-field-label">Secondary Requirement / Notes</label>
                            <textarea className="qa-drawer-remark-ta" rows={2} value={form.secondaryRequirement || ''} onChange={(e) => updateAcceptForm(handoff.id, { secondaryRequirement: e.target.value })} placeholder="Additional details..." />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Save Row (sticky bottom, same as workspace) ── */}
                    <div className="qa-drawer-save-row">
                      <button className="qa-drawer-skip-btn" onClick={() => handleReject(handoff)} disabled={isProcessing}>
                        <XMarkIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        {isProcessing ? 'Wait...' : 'Reject'}
                      </button>
                      <button className="qa-drawer-save-btn"
                        disabled={isProcessing || !quickWorkflowAction
                          || (quickWorkflowAction?.needsFollowUp && !quickWorkflowForm.nextFollowUpAt)
                          || (quickWorkflowAction?.needsReason && !quickWorkflowForm.closureReasonId)
                        }
                        onClick={() => handleAccept(handoff)}
                        style={{ backgroundColor: '#625afa' }}>
                        <CheckCircleIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        {isProcessing ? 'Processing...' : 'Accept Lead'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SalesManagerIncoming;
