import React, { useState } from 'react';
import { PlayCircleIcon } from '@heroicons/react/24/outline';
import AuthedAudio from '../AuthedAudio';
import telephonyApi from '../../api/telephonyApi';

// Lazy call-recording player for a call-logs table cell. Renders a small "Play"
// button; only when clicked does it mount <AuthedAudio> (which fetches the
// recording through the token-attaching axios instance and streams it from the
// server proxy) — so a page of rows never eager-downloads every recording.
export default function RecordingCell({ callId, hasRecording }) {
  const [open, setOpen] = useState(false);

  if (!hasRecording) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  }
  if (!open) {
    return (
      <button
        type="button"
        className="crm-btn crm-btn-ghost crm-btn-sm"
        onClick={() => setOpen(true)}
        title="Play recording"
        style={{ padding: '4px 8px' }}
      >
        <PlayCircleIcon style={{ width: 16, height: 16, marginRight: 4 }} /> Play
      </button>
    );
  }
  return (
    <AuthedAudio
      controls
      autoPlay
      preload="none"
      src={telephonyApi.recordingSrc(callId)}
      style={{ height: 34, maxWidth: 240, verticalAlign: 'middle' }}
    />
  );
}
