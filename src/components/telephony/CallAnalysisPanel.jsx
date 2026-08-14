import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { SparklesIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import callAnalysisApi from '../../api/callAnalysisApi';
import { getErrorMessage } from '../../utils/helpers';
import RecordingCell from './RecordingCell';

// ============================================================
// AI CALL ANALYSIS PANEL (lead detail → "AI Analysis" tab)
//
// A lead can have many analysed calls, so this is two levels: pick a call on
// the left, then read one section of its analysis per tab on the right. The
// tab list mirrors the sections callAnalysisService stores, and a tab whose
// section came back empty is hidden rather than shown blank.
// ============================================================

const SECTION_TABS = [
  { key: 'transcript', label: 'Transcription' },
  { key: 'summary', label: 'Summary' },
  { key: 'sentiment', label: 'Sentiment Analysis' },
  { key: 'topics', label: 'Topics' },
  { key: 'customer_intent', label: 'Customer Intent' },
  { key: 'objections', label: 'Objections' },
  { key: 'questionnaire', label: 'Questionnaire' },
  { key: 'agent_feedback', label: 'Agent Feedback' },
  { key: 'keywords', label: 'Keyword Detection' },
  { key: 'next_steps', label: 'Next Steps' },
];

const SCORE_COLORS = {
  HOT: { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C' },
  WARM: { bg: '#FFFBEB', border: '#FCD34D', text: '#B45309' },
  COLD: { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8' },
};
const SENTIMENT_COLORS = {
  Positive: { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D' },
  Neutral: { bg: '#F8FAFC', border: '#CBD5E1', text: '#475569' },
  Negative: { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C' },
};

const fmtDuration = (secs) => {
  const s = Number(secs) || 0;
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : '—');

const isEmpty = (v) => {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmpty);
  return false;
};

// ── Small presentational pieces ──────────────────────────────
const Pill = ({ children, colors }) => (
  <span style={{
    display: 'inline-block', padding: '2px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
    background: colors?.bg || 'var(--bg-secondary)',
    border: `1px solid ${colors?.border || 'var(--border-primary)'}`,
    color: colors?.text || 'var(--text-muted)',
  }}>
    {children}
  </span>
);

const Metric = ({ label, value, sub }) => (
  <div style={{ flex: '1 1 120px', minWidth: 110 }}>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
  </div>
);

const SectionHeading = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '16px 0 8px' }}>
    {children}
  </div>
);

const Chips = ({ items }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {(items || []).map((item, i) => (
      <span key={i} style={{
        padding: '3px 9px', borderRadius: 6, fontSize: 12,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)',
      }}>
        {item}
      </span>
    ))}
  </div>
);

const Bullets = ({ items }) => (
  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
    {(items || []).map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);

const Prose = ({ children }) => (
  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>{children}</p>
);

const CopyBox = ({ text, label }) => {
  const copy = () => {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copied`);
  };
  return (
    <div style={{ position: 'relative', padding: '12px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap', paddingRight: 60 }}>{text}</p>
      <button className="crm-btn crm-btn-ghost crm-btn-sm" style={{ position: 'absolute', top: 8, right: 8 }} onClick={copy}>Copy</button>
    </div>
  );
};

// ── Per-section renderers ────────────────────────────────────
const renderSection = (key, a) => {
  switch (key) {
    case 'transcript':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(a.transcript || []).map((turn, i) => {
            const isAgent = /agent|telecaller|executive/i.test(turn.speaker || '');
            return (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, minWidth: 72, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textAlign: 'center',
                  background: isAgent ? '#EFF6FF' : 'var(--bg-secondary)',
                  border: `1px solid ${isAgent ? '#BFDBFE' : 'var(--border-primary)'}`,
                  color: isAgent ? '#1D4ED8' : 'var(--text-muted)',
                }}>
                  {turn.speaker}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>{turn.text}</span>
              </div>
            );
          })}
        </div>
      );

    case 'summary':
      return <Prose>{a.summary}</Prose>;

    case 'sentiment': {
      const s = a.sentiment || {};
      return (
        <div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            {s.lead_score_label && (
              <Pill colors={SCORE_COLORS[s.lead_score_label]}>
                Lead score: {s.lead_score_label}{s.lead_score != null ? ` (${s.lead_score}/10)` : ''}
              </Pill>
            )}
            {s.customer_sentiment_label && (
              <Pill colors={SENTIMENT_COLORS[s.customer_sentiment_label]}>Customer: {s.customer_sentiment_label}</Pill>
            )}
            {s.agent_sentiment_label && (
              <Pill colors={SENTIMENT_COLORS[s.agent_sentiment_label]}>Agent: {s.agent_sentiment_label}</Pill>
            )}
          </div>
          {s.customer_sentiment && (<><SectionHeading>Customer sentiment</SectionHeading><Prose>{s.customer_sentiment}</Prose></>)}
          {s.agent_sentiment && (<><SectionHeading>Agent sentiment</SectionHeading><Prose>{s.agent_sentiment}</Prose></>)}
          {s.lead_score_reason && (<><SectionHeading>Why this score</SectionHeading><Prose>{s.lead_score_reason}</Prose></>)}
        </div>
      );
    }

    case 'topics': {
      const t = a.topics || {};
      return (
        <div>
          {!isEmpty(t.primary_topics) && (<><SectionHeading>Primary topics</SectionHeading><Chips items={t.primary_topics} /></>)}
          {!isEmpty(t.landmarks) && (<><SectionHeading>Landmarks &amp; locations</SectionHeading><Chips items={t.landmarks} /></>)}
          {!isEmpty(t.pricing) && (<><SectionHeading>Pricing &amp; financials</SectionHeading><Chips items={t.pricing} /></>)}
          {!isEmpty(t.trigger_words) && (<><SectionHeading>Trigger words</SectionHeading><Chips items={t.trigger_words} /></>)}
        </div>
      );
    }

    case 'customer_intent': {
      const c = a.customer_intent || {};
      return (
        <div>
          {c.intent && <Prose>{c.intent}</Prose>}
          {!isEmpty(c.buying_signals) && (<><SectionHeading>Buying signals</SectionHeading><Bullets items={c.buying_signals} /></>)}
          {!isEmpty(c.requirements) && (<><SectionHeading>Stated requirements</SectionHeading><Bullets items={c.requirements} /></>)}
        </div>
      );
    }

    case 'objections': {
      const o = a.objections || {};
      const ratio = o.talk_to_listen_ratio || {};
      const agentPct = Number(ratio.agent_percent);
      return (
        <div>
          {Number.isFinite(agentPct) && (
            <>
              <SectionHeading>Talk-to-listen ratio</SectionHeading>
              <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
                <div style={{ width: `${agentPct}%`, background: '#3B82F6', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Agent {agentPct}%
                </div>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Customer {ratio.customer_percent ?? 100 - agentPct}%
                </div>
              </div>
            </>
          )}
          {!isEmpty(o.objections_raised) && (
            <>
              <SectionHeading>Objections raised</SectionHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {o.objections_raised.map((obj, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{obj.objection}</span>
                      {obj.effectiveness && (
                        <Pill colors={obj.effectiveness === 'Good' ? SENTIMENT_COLORS.Positive : obj.effectiveness === 'Poor' ? SENTIMENT_COLORS.Negative : SENTIMENT_COLORS.Neutral}>
                          {obj.effectiveness}
                        </Pill>
                      )}
                    </div>
                    {obj.handled && <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)', margin: '6px 0 0' }}>{obj.handled}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
          {o.sales_mechanics && (<><SectionHeading>Sales mechanics</SectionHeading><Prose>{o.sales_mechanics}</Prose></>)}
        </div>
      );
    }

    case 'questionnaire':
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
            <thead>
              <tr>
                {['Metric', 'Score', 'QA notes'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(a.questionnaire || []).map((row, i) => {
                const max = Number(row.max_score) > 0 ? Number(row.max_score) : 5;
                const pct = (Number(row.score) / max) * 100;
                return (
                  <tr key={i}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>{row.metric}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, borderTop: '1px solid var(--border-primary)', whiteSpace: 'nowrap' }}>
                      <Pill colors={pct >= 80 ? SENTIMENT_COLORS.Positive : pct >= 60 ? SENTIMENT_COLORS.Neutral : SENTIMENT_COLORS.Negative}>
                        {row.score}/{max}
                      </Pill>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted)', borderTop: '1px solid var(--border-primary)' }}>{row.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );

    case 'agent_feedback': {
      const f = a.agent_feedback || {};
      const Block = ({ title, items, accent }) => (
        <div style={{ flex: '1 1 260px', minWidth: 240 }}>
          <SectionHeading>{title}</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(items || []).map((item, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: accent.bg, border: `1px solid ${accent.border}` }}>
                {item.title && <div style={{ fontSize: 13, fontWeight: 600, color: accent.text }}>{item.title}</div>}
                {item.detail && <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)', margin: item.title ? '4px 0 0' : 0 }}>{item.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      );
      return (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {!isEmpty(f.strengths) && <Block title="Key strengths" items={f.strengths} accent={SENTIMENT_COLORS.Positive} />}
          {!isEmpty(f.improvements) && <Block title="Areas for improvement" items={f.improvements} accent={{ bg: '#FFFBEB', border: '#FCD34D', text: '#B45309' }} />}
        </div>
      );
    }

    case 'keywords':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(a.keywords || []).map((k, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
                {k.keyword}
              </span>
              {k.count != null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>×{k.count}</span>}
              {k.context && <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{k.context}</span>}
            </div>
          ))}
        </div>
      );

    case 'next_steps': {
      const n = a.next_steps || {};
      return (
        <div>
          {!isEmpty(n.follow_up_plan) && (
            <>
              <SectionHeading>Follow-up plan</SectionHeading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {n.follow_up_plan.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, minWidth: 96, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', paddingTop: 2 }}>{step.when}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>{step.action}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {n.whatsapp_draft && (<><SectionHeading>Suggested WhatsApp / SMS follow-up</SectionHeading><CopyBox text={n.whatsapp_draft} label="Message" /></>)}
          {n.crm_note && (<><SectionHeading>CRM note</SectionHeading><CopyBox text={n.crm_note} label="CRM note" /></>)}
        </div>
      );
    }

    default:
      return null;
  }
};

// ── Panel ────────────────────────────────────────────────────
/**
 * @param {string} leadId
 * @param {Array}  callLogs  The lead's call logs, if the parent already loaded
 *                           them. Calls with a recording but no analysis are
 *                           listed too, so an unanalysed call can be sent on
 *                           demand rather than waiting for the worker.
 * @param {boolean} canAnalyze Whether to show the manual "Analyse" button.
 */
const CallAnalysisPanel = ({ leadId, callLogs = null, canAnalyze = false }) => {
  const [analyses, setAnalyses] = useState(null);
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [sectionTab, setSectionTab] = useState('transcript');
  const [analyzing, setAnalyzing] = useState(null);

  const load = useCallback(async () => {
    if (!leadId) return;
    try {
      const resp = await callAnalysisApi.getForLead(leadId);
      setAnalyses(resp.data || []);
    } catch {
      setAnalyses([]);
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  // One entry per call worth showing: every analysed call, plus any recorded
  // call that has not been analysed yet (so it can be triggered by hand).
  const entries = useMemo(() => {
    if (!analyses) return null;
    const byCall = new Map(analyses.map((a) => [a.call_log_id, a]));
    const rows = analyses.map((a) => ({
      callId: a.call_log_id,
      analysis: a,
      callLog: a.callLog || null,
      at: a.callLog?.start_stamp || a.callLog?.received_at || a.created_at,
    }));
    for (const c of callLogs || []) {
      if (byCall.has(c.id)) continue;
      if (!(c.has_recording ?? c.recording_url)) continue;
      rows.push({ callId: c.id, analysis: null, callLog: c, at: c.start_stamp || c.received_at });
    }
    return rows.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [analyses, callLogs]);

  // Default to the newest entry once the list arrives.
  useEffect(() => {
    if (entries && entries.length && !entries.some((e) => e.callId === selectedCallId)) {
      setSelectedCallId(entries[0].callId);
    }
  }, [entries, selectedCallId]);

  const selected = entries?.find((e) => e.callId === selectedCallId) || null;
  const a = selected?.analysis || null;

  // Hide tabs whose section came back empty, and keep the active tab valid.
  const visibleTabs = useMemo(() => {
    if (!a || a.status !== 'COMPLETED') return [];
    return SECTION_TABS.filter((t) => !isEmpty(a[t.key]));
  }, [a]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((t) => t.key === sectionTab)) {
      setSectionTab(visibleTabs[0].key);
    }
  }, [visibleTabs, sectionTab]);

  const analyze = async (callId, force = false) => {
    setAnalyzing(callId);
    try {
      await callAnalysisApi.analyzeNow(callId, { force });
      toast.success('Call analysed');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not analyse this call'));
    } finally {
      setAnalyzing(null);
    }
  };

  if (!entries) return <p className="lead-details-empty">Loading AI analysis…</p>;
  if (entries.length === 0) {
    return (
      <p className="lead-details-empty">
        No analysed calls for this lead yet. Recordings are analysed automatically once they reach
        the minimum length set in Super Admin → Calls → AI Call Analysis.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Call picker */}
      <div style={{ flex: '0 0 220px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map((e) => {
          const active = e.callId === selectedCallId;
          const label = e.analysis?.lead_score_label;
          return (
            <button
              key={e.callId}
              onClick={() => setSelectedCallId(e.callId)}
              style={{
                textAlign: 'left', padding: '9px 11px', borderRadius: 8, cursor: 'pointer',
                background: active ? 'var(--bg-secondary)' : 'transparent',
                border: `1px solid ${active ? 'var(--border-primary)' : 'transparent'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {fmtDuration(e.callLog?.duration ?? e.analysis?.duration_seconds)}
                </span>
                {label
                  ? <Pill colors={SCORE_COLORS[label]}>{label}</Pill>
                  : <Pill>{e.analysis ? e.analysis.status : 'Not analysed'}</Pill>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{fmtDateTime(e.at)}</div>
            </button>
          );
        })}
      </div>

      {/* Selected analysis */}
      <div style={{ flex: '1 1 420px', minWidth: 300 }}>
        {!selected ? null : !a || a.status !== 'COMPLETED' ? (
          <div style={{ padding: 18, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              {a?.status === 'FAILED'
                ? <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#B45309' }} />
                : <SparklesIcon style={{ width: 18, height: 18, color: 'var(--text-muted)' }} />}
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {a?.status === 'PROCESSING' ? 'Analysis in progress…'
                  : a?.status === 'PENDING' ? 'Queued for analysis'
                  : a?.status === 'FAILED' ? 'Analysis failed'
                  : 'This call has not been analysed'}
              </span>
            </div>
            {a?.error_message && (
              <p style={{ fontSize: 12, color: '#B91C1C', margin: '0 0 10px' }}>{a.error_message}</p>
            )}
            <div style={{ marginBottom: 12 }}>
              <RecordingCell callId={selected.callId} hasRecording />
            </div>
            {canAnalyze && a?.status !== 'PROCESSING' && (
              <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => analyze(selected.callId)} disabled={analyzing === selected.callId}>
                <SparklesIcon style={{ width: 15, height: 15 }} />
                {analyzing === selected.callId ? 'Analysing…' : a ? 'Retry analysis' : 'Analyse this call'}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Header metrics */}
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <Metric
                  label="Lead score"
                  value={a.lead_score_label
                    ? <Pill colors={SCORE_COLORS[a.lead_score_label]}>{a.lead_score_label}</Pill>
                    : '—'}
                  sub={a.lead_score != null ? `${a.lead_score}/10` : null}
                />
                <Metric label="QA score" value={a.qa_score != null ? `${a.qa_score}%` : '—'} />
                <Metric
                  label="Talk / listen"
                  value={a.talk_ratio_agent != null ? `${a.talk_ratio_agent}% / ${a.talk_ratio_customer ?? 100 - a.talk_ratio_agent}%` : '—'}
                  sub="Agent / Customer"
                />
                <Metric label="Duration" value={fmtDuration(a.duration_seconds)} />
                <Metric label="Language" value={a.language_detected || '—'} />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
                <RecordingCell callId={selected.callId} hasRecording />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Analysed {fmtDateTime(a.analyzed_at)}{a.model ? ` · ${a.model}` : ''}
                </span>
                {canAnalyze && (
                  <button
                    className="crm-btn crm-btn-ghost crm-btn-sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => analyze(selected.callId, true)}
                    disabled={analyzing === selected.callId}
                  >
                    <ArrowPathIcon style={{ width: 14, height: 14 }} />
                    {analyzing === selected.callId ? 'Re-analysing…' : 'Re-analyse'}
                  </button>
                )}
              </div>
            </div>

            {/* Section tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border-primary)', marginBottom: 14 }}>
              {visibleTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSectionTab(t.key)}
                  style={{
                    padding: '7px 12px', fontSize: 12, cursor: 'pointer', background: 'none', border: 'none',
                    fontWeight: sectionTab === t.key ? 600 : 400,
                    color: sectionTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: `2px solid ${sectionTab === t.key ? 'var(--accent-primary, #2563EB)' : 'transparent'}`,
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div>{renderSection(sectionTab, a)}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default CallAnalysisPanel;
