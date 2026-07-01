import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import { getErrorMessage } from '../../../utils/helpers';

// A URL text field paired with an Upload button. The button pushes the chosen
// file to /marketing-campaigns/media (disk-backed → a stable public URL the
// WhatsApp provider can fetch) and writes the returned URL back via onChange.
// onChange receives the URL string directly (not a DOM event).
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };

const looksLikeImage = (url) => /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(url || '');

const HeaderMediaInput = ({
  value,
  onChange,
  placeholder = 'https://yourdomain.com/image.jpg',
  accept = 'image/*,application/pdf,video/mp4',
}) => {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const pick = () => { if (!uploading) fileRef.current?.click(); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    try {
      const resp = await whatsappCampaignApi.uploadHeaderMedia(file);
      const url = resp?.data?.url || resp?.url;
      if (!url) throw new Error('Upload did not return a URL.');
      setPreviewError(false);
      onChange(url);
      toast.success('Media uploaded');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        style={inputStyle}
        value={value || ''}
        onChange={(e) => { setPreviewError(false); onChange(e.target.value); }}
        placeholder={placeholder}
      />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: '1px', background: 'var(--border-primary)', zIndex: 1 }}></div>
        <span style={{ position: 'relative', zIndex: 2, background: 'var(--bg-primary)', padding: '0 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR UPLOAD</span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="crm-btn crm-btn-secondary crm-btn-sm"
          onClick={pick}
          disabled={uploading}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {uploading ? 'Uploading…' : 'Choose File'}
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 120 }}>
          {value ? value.split('/').pop().split('?')[0] : 'No file chosen'}
        </span>
        {value && (
          <button
            type="button"
            className="crm-btn crm-btn-ghost crm-btn-sm"
            onClick={() => { setPreviewError(false); onChange(''); }}
            style={{ color: '#dc2626', fontSize: 13 }}
          >
            Clear file
          </button>
        )}
        <input ref={fileRef} type="file" accept={accept} onChange={handleFile} style={{ display: 'none' }} />
      </div>

      {value && looksLikeImage(value) && !previewError && (
        <img
          src={value}
          alt="Header preview"
          onError={() => setPreviewError(true)}
          style={{ marginTop: 12, maxHeight: 90, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border-primary)', objectFit: 'contain' }}
        />
      )}
    </div>
  );
};

export default HeaderMediaInput;
