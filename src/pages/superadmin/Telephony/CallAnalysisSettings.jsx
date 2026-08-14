import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  SparklesIcon, CheckCircleIcon, ArrowPathIcon, PlayIcon, ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import callAnalysisApi from '../../../api/callAnalysisApi';
import { getErrorMessage } from '../../../utils/helpers';

const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const hintStyle = { fontSize: 11, color: 'var(--text-muted)', marginTop: 4 };

// Models that can read an audio file directly. A text-only model cannot be
// offered here - it would need a separate speech-to-text pass before it ever
// saw the call, which this feature does not do.
const MODEL_OPTIONS = [
  { value: 'gemini-flash-latest', label: 'Gemini Flash (latest) - fastest, cheapest' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash - balanced' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro - deepest analysis, slowest' },
];

const LANGUAGES = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam'];

const Toggle = ({ label, hint, checked, onChange, disabled }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', marginTop: 14, opacity: disabled ? 0.55 : 1 }}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
    <span>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
      {hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span>}
    </span>
  </label>
);

const StatTile = ({ label, value }) => (
  <div style={{ flex: '1 1 130px', minWidth: 130, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{value}</div>
  </div>
);

// Super Admin → Calls → AI Call Analysis. Sets the provider key, the model, the
// minimum call length that qualifies, and the analyst prompt that every
// qualifying recording is sent with.
const CallAnalysisSettings = () => {
  const [cfg, setCfg] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({
    api_key: '', model: 'gemini-flash-latest', min_duration_minutes: 2,
    prompt: '', output_language: 'English', is_active: false, auto_analyze: true,
    max_per_run: 10, max_attempts: 3,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgResp, statsResp] = await Promise.all([
        callAnalysisApi.getConfig(),
        callAnalysisApi.getStats().catch(() => ({ data: null })),
      ]);
      const c = cfgResp.data || {};
      setCfg(c);
      setStats(statsResp.data || null);
      setForm({
        api_key: '', // never prefilled - blank means "keep the stored key"
        model: c.model || 'gemini-flash-latest',
        min_duration_minutes: c.min_duration_minutes ?? 2,
        prompt: c.prompt || c.default_prompt || '',
        output_language: c.output_language || 'English',
        is_active: Boolean(c.is_active),
        auto_analyze: c.auto_analyze !== false,
        max_per_run: c.max_per_run ?? 10,
        max_attempts: c.max_attempts ?? 3,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load call analysis settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.prompt.trim()) { toast.error('A prompt is required.'); return; }
    if (form.is_active && !form.api_key && !cfg?.key_set) {
      toast.error('Add an API key before switching analysis on.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.api_key) delete payload.api_key; // keep the stored secret
      const resp = await callAnalysisApi.updateConfig(payload);
      setCfg(resp.data);
      setForm((f) => ({ ...f, api_key: '' }));
      toast.success('Call analysis settings saved');
      callAnalysisApi.getStats().then((r) => setStats(r.data)).catch(() => {});
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const resp = await callAnalysisApi.runNow();
      const r = resp.data || {};
      if (r.skipped) {
        toast(r.reason === 'disabled' ? 'Analysis is off or has no API key.' : 'A pass is already running.');
      } else {
        toast.success(`Pass complete - ${r.succeeded || 0} analysed, ${r.failed || 0} failed.`);
      }
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not run the analysis pass'));
    } finally {
      setRunning(false);
    }
  };

  const resetPrompt = () => {
    if (!cfg?.default_prompt) return;
    if (!window.confirm('Replace the prompt with the default analyst prompt?')) return;
    setForm((f) => ({ ...f, prompt: cfg.default_prompt }));
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: 900 }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>
            <SparklesIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />
            AI Call Analysis
          </h1>
          <p className="hidden sm:block">
            Send qualifying call recordings for AI transcription, QA scoring and coaching feedback -
            results appear on the lead's <strong>AI Analysis</strong> tab
          </p>
        </div>
        <div className="page-header-right">
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={runNow} disabled={running || loading}>
            <PlayIcon style={{ width: 15, height: 15 }} /> {running ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>

      {/* Status + volume */}
      <div className="crm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Status</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatTile label="Qualifying calls" value={stats?.qualifying_calls ?? '—'} />
          <StatTile label="Analysed" value={stats?.analysed_calls ?? '—'} />
          <StatTile label="Pending" value={stats?.by_status?.PENDING ?? 0} />
          <StatTile label="Failed" value={stats?.by_status?.FAILED ?? 0} />
        </div>
        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: cfg?.is_active ? '#16a34a' : '#b45309' }}>
          {cfg?.is_active
            ? `● Active${cfg?.auto_analyze === false ? ' - manual only, auto-analysis is off.' : '.'}`
            : '● Paused - no recordings are being sent for analysis.'}
        </div>
        {cfg?.last_run_at && (
          <div style={hintStyle}>Last pass: {new Date(cfg.last_run_at).toLocaleString()}</div>
        )}
        {cfg?.last_error && (
          <div style={{ ...hintStyle, color: '#b91c1c' }}>Last error: {cfg.last_error}</div>
        )}
      </div>

      {/* Provider */}
      <div className="crm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Provider</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 0 }}>
          Google Gemini reads the recording directly and returns the full analysis in one call.
          Get a key from Google AI Studio.
        </p>

        <label style={labelStyle}>API key</label>
        <input
          style={inputStyle}
          type="password"
          value={form.api_key}
          onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
          placeholder={cfg?.key_set ? `Saved (${cfg.api_key_masked}). Leave blank to keep.` : 'Not set - required to analyse anything'}
          autoComplete="new-password"
        />

        <label style={labelStyle}>Model</label>
        <select
          style={inputStyle}
          value={MODEL_OPTIONS.some((m) => m.value === form.model) ? form.model : '__custom'}
          onChange={(e) => {
            if (e.target.value === '__custom') return;
            setForm((f) => ({ ...f, model: e.target.value }));
          }}
        >
          {MODEL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          {!MODEL_OPTIONS.some((m) => m.value === form.model) && (
            <option value="__custom">{form.model} (custom)</option>
          )}
        </select>
        <input
          style={{ ...inputStyle, marginTop: 8 }}
          value={form.model}
          onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          placeholder="Or type a model id"
        />
        <div style={hintStyle}>
          The model must accept audio input. Text-only models (ChatGPT, Claude) cannot read a
          recording without a separate transcription step and will fail here.
        </div>

        <label style={labelStyle}>Analysis language</label>
        <select
          style={{ ...inputStyle, maxWidth: 240 }}
          value={form.output_language}
          onChange={(e) => setForm((f) => ({ ...f, output_language: e.target.value }))}
        >
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <div style={hintStyle}>
          A Tamil call analysed in English comes back with an English-translated transcript.
        </div>
      </div>

      {/* Which calls qualify */}
      <div className="crm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Which calls get analysed</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 0 }}>
          Every recording sent costs money, so only calls that reach the minimum length are
          picked up automatically. Anything shorter can still be analysed by hand from the
          lead's AI Analysis tab.
        </p>

        <label style={labelStyle}>Minimum call duration (minutes)</label>
        <input
          style={{ ...inputStyle, maxWidth: 140 }}
          type="number"
          min="0"
          max="600"
          step="0.5"
          value={form.min_duration_minutes}
          onChange={(e) => setForm((f) => ({ ...f, min_duration_minutes: e.target.value }))}
        />
        <div style={hintStyle}>
          Calls of this length <strong>or longer</strong> are analysed. Currently{' '}
          <strong>{stats?.qualifying_calls ?? '—'}</strong> recorded calls meet the saved threshold.
        </div>

        <label style={labelStyle}>Recordings per pass</label>
        <input
          style={{ ...inputStyle, maxWidth: 140 }}
          type="number"
          min="1"
          max="200"
          value={form.max_per_run}
          onChange={(e) => setForm((f) => ({ ...f, max_per_run: e.target.value }))}
        />
        <div style={hintStyle}>A pass runs every 15 minutes. This caps how many calls one pass may send.</div>

        <label style={labelStyle}>Retry attempts before giving up</label>
        <input
          style={{ ...inputStyle, maxWidth: 140 }}
          type="number"
          min="1"
          max="10"
          value={form.max_attempts}
          onChange={(e) => setForm((f) => ({ ...f, max_attempts: e.target.value }))}
        />

        <Toggle
          label="Analyse qualifying calls automatically"
          hint="Off leaves the feature manual-only - nothing is sent until someone presses Analyse on a call."
          checked={form.auto_analyze}
          onChange={(v) => setForm((f) => ({ ...f, auto_analyze: v }))}
        />
        <Toggle
          label="AI call analysis is active"
          hint="The master switch. Off means no recording is ever sent, by the worker or by hand."
          checked={form.is_active}
          onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
        />
        {cfg?.backfill_from && (
          <div style={{ ...hintStyle, marginTop: 10 }}>
            Only calls received after <strong>{new Date(cfg.backfill_from).toLocaleString()}</strong>{' '}
            are auto-analysed, so switching the feature on did not replay the whole recording history.
          </div>
        )}
      </div>

      {/* The prompt */}
      <div className="crm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Analyst prompt</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 0, maxWidth: 620 }}>
              This is sent with every recording. Describe the analysis you want - the eight
              sections below map to the tabs on the lead's AI Analysis tab. You do not need to
              ask for JSON or describe a format: the output structure is enforced separately,
              so editing this can change <em>what</em> is analysed but never breaks the tabs.
            </p>
          </div>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={resetPrompt} disabled={!cfg?.default_prompt}>
            <ArrowUturnLeftIcon style={{ width: 15, height: 15 }} /> Reset to default
          </button>
        </div>

        <textarea
          style={{ ...inputStyle, marginTop: 14, minHeight: 320, fontFamily: 'inherit', lineHeight: 1.55, resize: 'vertical' }}
          value={form.prompt}
          onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
          placeholder="Act as an expert Call Center QA Manager and Sales Coach…"
        />
        <div style={hintStyle}>
          Stored sections: Transcript · Summary · Topics &amp; Keywords · Sentiment &amp; Lead Score ·
          Customer Intent · Objections &amp; Talk Ratio · QA Questionnaire · Agent Feedback · Next Steps.
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button className="crm-btn crm-btn-primary" onClick={save} disabled={saving || loading}>
          <CheckCircleIcon style={{ width: 16, height: 16 }} /> {saving ? 'Saving…' : 'Save settings'}
        </button>
        <button className="crm-btn crm-btn-ghost" style={{ marginLeft: 8 }} onClick={load} disabled={loading}>
          <ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh
        </button>
      </div>
    </div>
  );
};

export default CallAnalysisSettings;
