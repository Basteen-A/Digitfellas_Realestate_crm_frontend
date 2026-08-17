import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  SparklesIcon, CheckCircleIcon, ArrowPathIcon, PlayIcon, ArrowUturnLeftIcon,
  ExclamationTriangleIcon, SpeakerWaveIcon, DocumentTextIcon,
  BoltIcon, XCircleIcon,
} from '@heroicons/react/24/outline';
import callAnalysisApi from '../../../api/callAnalysisApi';
import { getErrorMessage } from '../../../utils/helpers';

const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const hintStyle = { fontSize: 11, color: 'var(--text-muted)', marginTop: 4 };

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

// Amber callout used for "this model cannot hear" and other blocking notes.
const Notice = ({ tone = 'warn', icon: Icon = ExclamationTriangleIcon, children }) => {
  const tones = {
    warn: { bg: '#FFFBEB', border: '#FDE68A', fg: '#92400E' },
    info: { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1D4ED8' },
    ok: { bg: '#F0FDF4', border: '#BBF7D0', fg: '#166534' },
  };
  const t = tones[tone] || tones.warn;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12,
      padding: '10px 12px', borderRadius: 8,
      background: t.bg, border: `1px solid ${t.border}`, color: t.fg, fontSize: 12.5, lineHeight: 1.5,
    }}>
      <Icon style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
};

/**
 * Provider + key + model, for one stage of the pipeline.
 *
 * The model dropdown is populated by asking the PROVIDER what this key can use
 * (POST /call-analysis/models), so a newly released model shows up without a
 * code change. The free-text box underneath stays, because a model released
 * after the provider updated its own catalogue - or a private/fine-tuned
 * deployment that never appears in it - still has to be selectable.
 */
const ProviderBlock = ({
  stage, providers, form, setForm, cfg, cached, onFetched, filter,
}) => {
  const [fetching, setFetching] = useState(false);
  const isAnalysis = stage === 'analysis';

  // Field names differ per stage; everything else about the block is identical.
  const f = isAnalysis
    ? { provider: 'provider', key: 'api_key', model: 'model', base: 'base_url' }
    : { provider: 'transcribe_provider', key: 'transcribe_api_key', model: 'transcribe_model', base: 'transcribe_base_url' };

  const providerId = form[f.provider];
  const provider = providers.find((p) => p.id === providerId) || null;
  const keySet = isAnalysis ? cfg?.key_set : cfg?.transcribe_key_set;
  const keyMask = isAnalysis ? cfg?.api_key_masked : cfg?.transcribe_api_key_masked;

  // Only offer models that can do this stage's job. Everything else stays
  // reachable through the free-text box, so the filter never traps anyone.
  const allModels = cached?.models || [];
  const usable = filter ? allModels.filter(filter) : allModels;
  const hiddenCount = allModels.length - usable.length;

  const eligible = providers.filter((p) => (isAnalysis ? true : p.can_transcribe));

  const fetchModels = async () => {
    if (!form[f.key] && !keySet) {
      toast.error('Enter an API key first.');
      return;
    }
    setFetching(true);
    try {
      const resp = await callAnalysisApi.listModels({
        stage,
        provider: providerId,
        api_key: form[f.key] || undefined, // undefined -> server uses the stored key
        base_url: form[f.base] || undefined,
      });
      onFetched(resp.data);
      const d = resp.data || {};
      toast.success(
        isAnalysis
          ? `${d.total} model(s) found - ${d.audio_capable} can read audio.`
          : `${d.total} model(s) found - ${d.transcribe_capable} can transcribe.`
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not fetch models from the provider'));
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <label style={labelStyle}>Provider</label>
      <select
        style={inputStyle}
        value={providerId || ''}
        onChange={(e) => {
          const next = e.target.value;
          const p = providers.find((x) => x.id === next);
          // Switching provider invalidates the model AND the key - never carry
          // an OpenAI key over to an Anthropic selection.
          setForm((prev) => ({
            ...prev,
            [f.provider]: next,
            [f.model]: '',
            [f.key]: '',
            [f.base]: p?.base_url_editable ? (prev[f.base] || '') : '',
          }));
        }}
      >
        {!isAnalysis && <option value="">- none -</option>}
        {eligible.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {provider?.note && <div style={hintStyle}>{provider.note}</div>}

      {provider?.base_url_editable && (
        <>
          <label style={labelStyle}>Endpoint base URL</label>
          <input
            style={inputStyle}
            value={form[f.base] || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.base]: e.target.value }))}
            placeholder="https://api.groq.com/openai/v1"
          />
          <div style={hintStyle}>
            Must serve <code>/models</code> and <code>/chat/completions</code>. Works with Groq,
            OpenRouter, Together, xAI, DeepSeek, Azure, vLLM, Ollama and LM Studio.
          </div>
        </>
      )}

      {provider && (
        <>
          <label style={labelStyle}>API key</label>
          <input
            style={inputStyle}
            type="password"
            value={form[f.key] || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            placeholder={keySet ? `Saved (${keyMask}). Leave blank to keep.` : (provider.key_hint || 'Required')}
            autoComplete="new-password"
          />

          <label style={labelStyle}>
            Model
            <button
              type="button"
              className="crm-btn crm-btn-ghost crm-btn-sm"
              style={{ marginLeft: 10, verticalAlign: 'middle', textTransform: 'none', fontWeight: 600 }}
              onClick={fetchModels}
              disabled={fetching}
            >
              <ArrowPathIcon style={{ width: 13, height: 13 }} /> {fetching ? 'Fetching…' : 'Fetch models'}
            </button>
          </label>

          <select
            style={inputStyle}
            value={usable.some((m) => m.id === form[f.model]) ? form[f.model] : '__custom'}
            onChange={(e) => {
              if (e.target.value === '__custom') return;
              setForm((prev) => ({ ...prev, [f.model]: e.target.value }));
            }}
          >
            {usable.length === 0 && <option value="__custom">- press “Fetch models”, or type an id below -</option>}
            {usable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label !== m.id ? `${m.label} (${m.id})` : m.id}{m.audio ? '  ·  reads audio' : ''}
              </option>
            ))}
            {form[f.model] && !usable.some((m) => m.id === form[f.model]) && (
              <option value="__custom">{form[f.model]} (typed in)</option>
            )}
          </select>

          <input
            style={{ ...inputStyle, marginTop: 8 }}
            value={form[f.model] || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.model]: e.target.value }))}
            placeholder="Or type a model id"
          />

          {cached?.fetched_at && (
            <div style={hintStyle}>
              {usable.length} usable model{usable.length === 1 ? '' : 's'}
              {hiddenCount > 0 && ` (${hiddenCount} hidden - they cannot ${isAnalysis ? 'be used for analysis' : 'transcribe'})`}
              {' · '}fetched {new Date(cached.fetched_at).toLocaleString()}
            </div>
          )}
        </>
      )}
    </>
  );
};

// Super Admin → Calls → AI Call Analysis. Picks the provider and model for the
// analysis (and, when that model cannot hear, for a transcription stage before
// it), the minimum call length that qualifies, and the analyst prompt every
// qualifying recording is sent with.
const CallAnalysisSettings = () => {
  const [cfg, setCfg] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [modelCache, setModelCache] = useState({});
  const [form, setForm] = useState({
    provider: 'gemini', api_key: '', model: 'gemini-flash-latest', base_url: '',
    transcribe_provider: '', transcribe_api_key: '', transcribe_model: '', transcribe_base_url: '',
    min_duration_minutes: 2, prompt: '', output_language: 'English',
    is_active: false, auto_analyze: true, max_per_run: 10, max_attempts: 3,
  });

  const providers = cfg?.providers || [];
  const analysisProvider = providers.find((p) => p.id === form.provider) || null;

  // Does the CURRENTLY SELECTED analysis model read audio? Mirrors the server's
  // aiProviderService.supportsAudio() so the screen can warn before saving
  // rather than after the first failed pass.
  const analysisReadsAudio = useMemo(() => {
    if (!analysisProvider || !analysisProvider.can_hear_audio) return false;
    const id = String(form.model || '').toLowerCase();
    if (!id) return false;
    if (form.provider === 'gemini') return id.includes('gemini');
    return /(audio|omni|realtime)/.test(id);
  }, [analysisProvider, form.provider, form.model]);

  const needsTranscription = Boolean(form.model) && !analysisReadsAudio;

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
      setModelCache(c.model_cache || {});
      setForm({
        provider: c.provider || 'gemini',
        api_key: '', // never prefilled - blank means "keep the stored key"
        model: c.model || '',
        base_url: c.base_url || '',
        transcribe_provider: c.transcribe_provider || '',
        transcribe_api_key: '',
        transcribe_model: c.transcribe_model || '',
        transcribe_base_url: c.transcribe_base_url || '',
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

  const onModelsFetched = (stage) => (data) => {
    setModelCache((prev) => ({ ...prev, [stage]: data }));
  };

  const save = async () => {
    if (!form.prompt.trim()) { toast.error('A prompt is required.'); return; }
    if (!form.model.trim()) { toast.error('Select an analysis model.'); return; }
    if (form.is_active && !form.api_key && !cfg?.key_set) {
      toast.error('Add an API key before switching analysis on.');
      return;
    }
    if (form.is_active && needsTranscription && !form.transcribe_provider) {
      toast.error(`${form.model} cannot read audio - set up a transcription provider first.`);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      // Blank means "keep the stored secret" - do not send it at all.
      if (!payload.api_key) delete payload.api_key;
      if (!payload.transcribe_api_key) delete payload.transcribe_api_key;
      const resp = await callAnalysisApi.updateConfig(payload);
      setCfg(resp.data);
      setModelCache(resp.data?.model_cache || {});
      setForm((f) => ({ ...f, api_key: '', transcribe_api_key: '' }));
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
        if (r.reason === 'misconfigured') toast.error(r.message || 'The provider setup is incomplete.');
        else if (r.reason === 'disabled') toast('Analysis is off or auto-analysis is disabled.');
        else toast('A pass is already running.');
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

  // Tests the SAVED settings, not the form - so an unsaved key would give a
  // misleading pass. Save first, then test.
  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await callAnalysisApi.testConnection();
      setTestResult(resp.data);
      if (resp.data?.ok) toast.success('Connection test passed');
      else toast.error('Connection test failed - see the details below');
    } catch (err) {
      const message = getErrorMessage(err, 'Could not run the test');
      setTestResult({ ok: false, stages: [{ stage: 'analysis', ok: false, message }] });
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const resetPrompt = () => {
    if (!cfg?.default_prompt) return;
    if (!window.confirm('Replace the prompt with the default analyst prompt?')) return;
    setForm((f) => ({ ...f, prompt: cfg.default_prompt }));
  };

  const transcribeLabel = providers.find((p) => p.id === form.transcribe_provider)?.label;

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
        <div className="page-header-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={runTest} disabled={testing || loading}>
            <BoltIcon style={{ width: 15, height: 15 }} /> {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={runNow} disabled={running || loading}>
            <PlayIcon style={{ width: 15, height: 15 }} /> {running ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>

      {/* Connection test result */}
      {testResult && (
        <div
          className="crm-card"
          style={{ padding: 18, marginBottom: 16, borderLeft: `3px solid ${testResult.ok ? '#16a34a' : '#dc2626'}` }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {testResult.ok
              ? <CheckCircleIcon style={{ width: 18, height: 18, color: '#16a34a' }} />
              : <XCircleIcon style={{ width: 18, height: 18, color: '#dc2626' }} />}
            <span style={{ fontWeight: 700 }}>
              {testResult.ok ? 'Connection test passed' : 'Connection test failed'}
            </span>
            <button
              type="button"
              className="crm-btn crm-btn-ghost crm-btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => setTestResult(null)}
            >
              Dismiss
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            Tests the <strong>saved</strong> settings, not what is typed above - save first, then test.
            It spends a few tokens, never a whole recording.
          </p>

          {(testResult.stages || []).map((s) => (
            <div
              key={s.stage}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0',
                borderTop: '1px solid var(--border-primary)',
              }}
            >
              {s.ok
                ? <CheckCircleIcon style={{ width: 16, height: 16, color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                : <XCircleIcon style={{ width: 16, height: 16, color: '#dc2626', flexShrink: 0, marginTop: 2 }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                  {s.stage}
                  {s.provider_label && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {s.provider_label}{s.model ? ` / ${s.model}` : ''}</span>}
                  {Number.isFinite(s.ms) && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {s.ms} ms</span>}
                  {Number.isFinite(s.tokens) && s.tokens !== null && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {s.tokens} tokens</span>}
                </div>
                <div style={{ fontSize: 12, color: s.ok ? 'var(--text-secondary)' : '#b91c1c', marginTop: 2 }}>
                  {s.message}
                </div>
                {s.ok && s.stage === 'analysis' && s.json_ok === false && (
                  <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
                    The key works, but this model did not return valid JSON - real analyses will likely fail.
                    Pick a model that supports structured output.
                  </div>
                )}
                {s.ok && s.stage === 'analysis' && s.reads_audio === false && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    This model cannot read audio, so every recording goes through the transcription step first.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
        {cfg?.config_error && (
          <Notice>{cfg.config_error}</Notice>
        )}
      </div>

      {/* Analysis provider */}
      <div className="crm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Analysis model</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 0 }}>
          The model that writes the analysis. Paste a key and press <strong>Fetch models</strong> -
          the list comes from the provider itself, so whatever that key can use shows up here.
        </p>

        <ProviderBlock
          stage="analysis"
          providers={providers}
          form={form}
          setForm={setForm}
          cfg={cfg}
          cached={modelCache.analysis}
          onFetched={onModelsFetched('analysis')}
        />

        {form.model && (
          analysisReadsAudio ? (
            <Notice tone="ok" icon={SpeakerWaveIcon}>
              <strong>{form.model}</strong> reads the recording directly - one API call per call,
              no transcription step needed.
            </Notice>
          ) : (
            <Notice icon={DocumentTextIcon}>
              <strong>{form.model}</strong> cannot listen to audio, so the recording has to be turned
              into text first. Configure the transcription step below.
              {form.provider === 'anthropic' && ' Claude has no audio input at all - this is always required for it.'}
            </Notice>
          )
        )}
      </div>

      {/* Transcription stage - only when the analysis model is deaf */}
      {needsTranscription && (
        <div className="crm-card" style={{ padding: 18, marginBottom: 16, borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Transcription step</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 0 }}>
            Turns the recording into text before it reaches the analysis model. This can be a
            different vendor and a different key - Gemini and OpenAI Whisper are both cheap for this.
          </p>

          <ProviderBlock
            stage="transcription"
            providers={providers}
            form={form}
            setForm={setForm}
            cfg={cfg}
            cached={modelCache.transcription}
            onFetched={onModelsFetched('transcription')}
            filter={(m) => m.transcribe}
          />

          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 8,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            fontSize: 12.5, color: 'var(--text-secondary)',
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>Pipeline:</strong>{' '}
            recording → {transcribeLabel || 'transcription'}{form.transcribe_model ? ` (${form.transcribe_model})` : ''}
            {' '}→ {analysisProvider?.label || 'analysis'}{form.model ? ` (${form.model})` : ''} → analysis JSON
            <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
              Two paid calls per recording instead of one. An audio-native model such as Gemini
              does it in a single call if cost matters more than model choice.
            </div>
          </div>
        </div>
      )}

      {/* Language */}
      <div className="crm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Analysis language</div>
        <select
          style={{ ...inputStyle, maxWidth: 240, marginTop: 10 }}
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
