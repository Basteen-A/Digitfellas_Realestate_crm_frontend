// VoiceNoteField — reusable voice-note composer (record + transcribe + translate),
// extracted from the task update modal so the SM/SH lead quick-action remarks can
// offer the exact same feature. Self-contained (inline styles, no external CSS).
//
//   <VoiceNoteField
//      voice={voice} onVoiceChange={setVoice}        // { blob, url, duration } | null
//      transcribeApi={leadWorkflowApi.transcribeVoice}
//      onTranscribed={(text) => appendToRemark(text)} />
import React, { useState, useRef, useEffect } from 'react';
import {
  MicrophoneIcon, StopCircleIcon, CheckCircleIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const mmss = (secs) => {
  const s = Math.max(0, Math.round(secs || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const S = {
  wrap: { marginTop: 8 },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
    padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-primary, #e2e8f0)',
    background: 'var(--bg-card, #fff)', color: 'var(--brand, #625afa)', cursor: 'pointer',
  },
  rec: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
    border: '1px solid #fecaca', background: '#fef2f2',
  },
  dot: { width: 10, height: 10, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' },
  time: { fontSize: 13, fontWeight: 800, color: '#991b1b', fontVariantNumeric: 'tabular-nums' },
  hint: { fontSize: 12, color: '#991b1b', flex: 1 },
  stopBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
    padding: '6px 12px', borderRadius: 999, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer',
  },
  card: { border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 10, padding: 10, background: 'var(--bg-card, #fff)' },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  audio: { height: 34, flex: 1 },
  iconBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-primary,#e2e8f0)', background: 'var(--bg-card,#fff)', cursor: 'pointer' },
  lang: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  langLabel: { fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 600 },
  toggle: { display: 'inline-flex', border: '1px solid var(--border-primary,#e2e8f0)', borderRadius: 999, overflow: 'hidden' },
  toggleBtn: (active) => ({ fontSize: 12, fontWeight: 700, padding: '4px 12px', border: 'none', cursor: 'pointer', background: active ? 'var(--brand,#625afa)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary,#334155)' }),
  done: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 600, color: '#16a34a' },
  err: { fontSize: 12, color: '#dc2626', marginTop: 6 },
};

export default function VoiceNoteField({ voice, onVoiceChange, transcribeApi, onTranscribed }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(voice?.duration || 0);
  const [lang, setLang] = useState('english');
  const [transcribing, setTranscribing] = useState(false);
  const [transcribed, setTranscribed] = useState(false);
  const [recError, setRecError] = useState('');

  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const streamRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mrRef.current && mrRef.current.state !== 'inactive') mrRef.current.stop();
    (streamRef.current?.getTracks() || []).forEach((t) => t.stop());
    if (voice?.url) URL.revokeObjectURL(voice.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearVoice = () => {
    if (voice?.url) URL.revokeObjectURL(voice.url);
    onVoiceChange?.(null);
    setDuration(0);
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
        const url = URL.createObjectURL(blob);
        const finalDur = Math.round((Date.now() - startRef.current) / 1000);
        onVoiceChange?.({ blob, url, duration: finalDur });
        setDuration(finalDur);
        (streamRef.current?.getTracks() || []).forEach((t) => t.stop());
        streamRef.current = null;
      };
      mr.start();
      mrRef.current = mr;
      startRef.current = Date.now();
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(Math.round((Date.now() - startRef.current) / 1000)), 250);
      setRecording(true);
    } catch {
      setRecError('Microphone access was denied or is unavailable.');
    }
  };

  const stopRecording = () => {
    if (mrRef.current && mrRef.current.state !== 'inactive') mrRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  const handleTranscribe = async () => {
    if (!voice?.blob || transcribing || !transcribeApi) return;
    setTranscribing(true);
    try {
      const res = await transcribeApi(voice.blob, lang);
      const text = (res?.data?.text || res?.text || '').trim();
      if (!text) { toast.error('Could not transcribe the audio. Please record again.'); return; }
      onTranscribed?.(text);
      setTranscribed(true);
      toast.success('Voice transcribed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div style={S.wrap}>
      {recording ? (
        <div style={S.rec}>
          <span style={S.dot} />
          <span style={S.time}>{mmss(duration)}</span>
          <span style={S.hint}>Recording…</span>
          <button type="button" style={S.stopBtn} onClick={stopRecording}>
            <StopCircleIcon style={{ width: 15, height: 15 }} /> Stop
          </button>
        </div>
      ) : voice?.blob ? (
        <div style={S.card}>
          <div style={S.row}>
            <audio style={S.audio} src={voice.url} controls preload="metadata" />
            <span style={S.time}>{mmss(duration)}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {!transcribed && (
                <button type="button" style={S.iconBtn} disabled={transcribing} onClick={handleTranscribe}>
                  <CheckCircleIcon style={{ width: 14, height: 14 }} />
                  {transcribing ? 'Transcribing…' : 'Transcribe'}
                </button>
              )}
              <button type="button" style={{ ...S.iconBtn, color: '#dc2626' }} onClick={clearVoice} title="Remove">
                <TrashIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
          {!transcribed ? (
            <div style={S.lang}>
              <span style={S.langLabel}>Voice language</span>
              <div style={S.toggle}>
                <button type="button" style={S.toggleBtn(lang === 'tamil')} disabled={transcribing} onClick={() => setLang('tamil')}>Tamil</button>
                <button type="button" style={S.toggleBtn(lang === 'english')} disabled={transcribing} onClick={() => setLang('english')}>English</button>
              </div>
            </div>
          ) : (
            <div style={S.done}>
              <CheckCircleIcon style={{ width: 14, height: 14 }} /> Transcribed — text added to the remark above
            </div>
          )}
        </div>
      ) : (
        <button type="button" style={S.btn} onClick={startRecording}>
          <MicrophoneIcon style={{ width: 15, height: 15 }} /> Voice note
        </button>
      )}
      {recError && <div style={S.err}>{recError}</div>}
    </div>
  );
}
