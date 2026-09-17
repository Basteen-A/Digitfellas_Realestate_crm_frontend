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

// Refuse an oversized file here rather than letting it go up and fail.
// The server caps header media at WA_MAX_HEADER_UPLOAD_MB (64MB by default,
// whatsappRoutes -> /marketing-campaigns/media) and the proxy in front of the
// API has a ceiling of its own. Either way the rejection lands mid-upload, and
// a proxy 413 carries no CORS header, so the browser blocks the response and
// the real reason never reaches this screen - it surfaces as a bare "the
// connection was closed" network error.
//
// This is deliberately far above WhatsApp's own 16MB media limit: the server
// re-encodes what it receives down to something WhatsApp will play, so a big
// phone recording is a file to convert, not a file to refuse.
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
const fmtSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// What the server can actually convert. Kept in step with HEADER_MEDIA_TYPES in
// whatsappRoutes.js - notably .mov, because that is what phones record, and
// NOT .heic, which the server's ffmpeg build cannot decode.
const ACCEPT_DEFAULT = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/3gpp', 'video/x-msvideo',
].join(',');

const HeaderMediaInput = ({
  value,
  onChange,
  placeholder = 'https://yourdomain.com/image.jpg',
  accept = ACCEPT_DEFAULT,
}) => {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const pick = () => { if (!uploading) fileRef.current?.click(); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`${file.name} is ${fmtSize(file.size)} - the maximum is 64 MB. Compress it and try again.`);
      return;
    }

    // No pre-emptive "this may fail" warning any more: the server now converts
    // whatever it is handed and reports back what it had to change, so guessing
    // here would either cry wolf or contradict the actual result.
    setUploading(true);
    try {
      const resp = await whatsappCampaignApi.uploadHeaderMedia(file);
      const payload = resp?.data || resp || {};
      const url = payload.url;
      if (!url) throw new Error('Upload did not return a URL.');
      setPreviewError(false);
      onChange(url);

      // Tell the admin their file was changed, and why. Silently handing back a
      // different file than the one they picked is how you get a bug report six
      // weeks later about the video "looking wrong".
      if (payload.normalized) {
        const why = (payload.normalization_reasons || [])[0];
        toast.success(
          why
            ? `Media uploaded and converted for WhatsApp (${why.replace(/,.*$/, '')})`
            : 'Media uploaded and converted for WhatsApp',
          { duration: 6000 }
        );
      } else {
        toast.success('Media uploaded');
      }
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
