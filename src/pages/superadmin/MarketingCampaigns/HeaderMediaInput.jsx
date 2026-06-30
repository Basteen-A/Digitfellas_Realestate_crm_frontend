import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={value || ''}
          onChange={(e) => { setPreviewError(false); onChange(e.target.value); }}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="crm-btn crm-btn-secondary crm-btn-sm"
          onClick={pick}
          disabled={uploading}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <ArrowUpTrayIcon style={{ width: 14, height: 14 }} /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept={accept} onChange={handleFile} style={{ display: 'none' }} />
      </div>
      {value && looksLikeImage(value) && !previewError && (
        <img
          src={value}
          alt="Header preview"
          onError={() => setPreviewError(true)}
          style={{ marginTop: 8, maxHeight: 90, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border-primary)', objectFit: 'contain' }}
        />
      )}
    </div>
  );
};

export default HeaderMediaInput;
