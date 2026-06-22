import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Danger-zone confirmation modal for PERMANENT (hard) deletes.
 *
 * The user must re-type the exact entity identifier (project name, unit number,
 * booking id, …) before the Delete button enables. On confirm it calls the
 * async `onConfirm` prop; the parent is responsible for the actual API call and
 * refreshing its list.
 *
 * @param {boolean}  open          - whether the modal is visible
 * @param {string}   entityLabel   - lowercase noun, e.g. "project" / "unit" / "booking"
 * @param {string}   entityName    - display name shown in the warning copy
 * @param {string}   confirmValue  - the exact string the user must type to confirm
 * @param {string}   confirmLabel  - label for the input, e.g. "project name"
 * @param {string}   [extraWarning]- optional extra line (e.g. child records removed)
 * @param {function} onConfirm     - async () => {} ; throw to keep the modal open
 * @param {function} onClose       - close handler
 */
const DangerDeleteModal = ({
  open,
  entityLabel = 'record',
  entityName = '',
  confirmValue = '',
  confirmLabel = 'name',
  extraWarning = '',
  onConfirm,
  onClose,
}) => {
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTyped('');
      setLoading(false);
      // focus the input shortly after the modal mounts
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const matches = typed.trim() === String(confirmValue ?? '').trim() && confirmValue !== '';

  const handleConfirm = async () => {
    if (!matches || loading) return;
    setLoading(true);
    try {
      await onConfirm();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Delete failed');
      setLoading(false);
    }
  };

  return (
    <div style={overlay} onClick={() => !loading && onClose?.()}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={iconWrap}>
              <ExclamationTriangleIcon style={{ width: 20, height: 20 }} />
            </span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#B91C1C' }}>
              Delete {entityLabel}
            </h2>
          </div>
          <button type="button" onClick={() => !loading && onClose?.()} style={closeBtn} aria-label="Close">
            <XMarkIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={warnBox}>
            <strong>This action cannot be undone.</strong> On delete, {entityName ? <b>{entityName}</b> : `this ${entityLabel}`} will be <strong>permanently deleted from the system</strong>.
            {extraWarning ? <div style={{ marginTop: 6 }}>{extraWarning}</div> : null}
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Type the {confirmLabel} <span style={{ color: '#B91C1C' }}>“{confirmValue}”</span> to confirm
          </label>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            disabled={loading}
            placeholder={confirmValue}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            style={input}
          />
        </div>

        <div style={footer}>
          <button type="button" onClick={() => !loading && onClose?.()} style={cancelBtn} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!matches || loading}
            style={{ ...deleteBtn, opacity: !matches || loading ? 0.5 : 1, cursor: !matches || loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: 16,
};
const panel = {
  width: '100%', maxWidth: 440, background: '#fff', borderRadius: 12,
  boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden',
};
const header = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 20px', borderBottom: '1px solid #FEE2E2', background: '#FEF2F2',
};
const iconWrap = {
  width: 34, height: 34, borderRadius: '50%', background: '#FEE2E2', color: '#DC2626',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 };
const warnBox = {
  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12,
  fontSize: 13, color: '#7F1D1D', marginBottom: 16, lineHeight: 1.5,
};
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #D1D5DB',
  borderRadius: 8, fontSize: 14, outline: 'none',
};
const footer = {
  display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px',
  borderTop: '1px solid #F3F4F6',
};
const cancelBtn = {
  padding: '9px 16px', border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff',
  color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer',
};
const deleteBtn = {
  padding: '9px 16px', border: 'none', borderRadius: 8, background: '#DC2626',
  color: '#fff', fontWeight: 600, fontSize: 14,
};

export default DangerDeleteModal;
