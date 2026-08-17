import React, { useState } from 'react';
import { PlayCircleIcon } from '@heroicons/react/24/solid';
import AuthedAudio from '../AuthedAudio';
import telephonyApi from '../../api/telephonyApi';

// Lazy call-recording player for a call-logs table cell.
//
// The trigger is a bare glyph - no button chrome, no "Play" label. In a dense
// table a bordered pill per row reads as a form control competing with the data;
// a single solid play mark is understood without being spelled out, and it is
// the same affordance every media player on the device already uses.
//
// Only when it is clicked does <AuthedAudio> mount (fetching through the
// token-attaching axios instance and streaming from the server proxy), so a
// page of rows never eager-downloads every recording. AuthedAudio carries the
// no-download attributes, so the expanded player has no save option either.
export default function RecordingCell({ callId, hasRecording }) {
  const [open, setOpen] = useState(false);

  if (!hasRecording) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>;
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Play recording"
        aria-label="Play recording"
        style={{
          background: 'none',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          color: 'var(--accent-blue)',
          lineHeight: 0,
        }}
      >
        <PlayCircleIcon style={{ width: 22, height: 22 }} />
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
