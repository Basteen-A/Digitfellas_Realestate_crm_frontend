import React from 'react';
import {
  ArrowTopRightOnSquareIcon, PhoneIcon, ArrowUturnLeftIcon, DocumentIcon, PlayCircleIcon,
} from '@heroicons/react/24/outline';

// ============================================================
// Shared WhatsApp message preview — renders a chat bubble from a
// template-like object so the template builder AND the campaign
// builder show an identical, provider-style "Message Preview".
// ============================================================

// Light WhatsApp-style formatting: *bold*, _italic_, ~strike~, and newlines.
const renderFormatted = (text) => {
  if (!text) return null;
  const lines = String(text).split('\n');
  return lines.map((line, li) => {
    const tokens = line.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g).filter(Boolean);
    return (
      <React.Fragment key={li}>
        {tokens.map((tok, ti) => {
          if (/^\*[^*]+\*$/.test(tok)) return <strong key={ti}>{tok.slice(1, -1)}</strong>;
          if (/^_[^_]+_$/.test(tok)) return <em key={ti}>{tok.slice(1, -1)}</em>;
          if (/^~[^~]+~$/.test(tok)) return <span key={ti} style={{ textDecoration: 'line-through' }}>{tok.slice(1, -1)}</span>;
          return <React.Fragment key={ti}>{tok}</React.Fragment>;
        })}
        {li < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

// Substitute {{n}} placeholders with a friendly sample from body_params.
const substituteBody = (bodyText, bodyParams = []) => {
  if (!bodyText) return '';
  const byIndex = {};
  (bodyParams || []).forEach((p, i) => { byIndex[p.index || i + 1] = p; });
  return String(bodyText).replace(/\{\{\s*(\d+)\s*\}\}/g, (m, nStr) => {
    const p = byIndex[Number(nStr)];
    if (!p) return m;
    if (p.source === 'static') return p.value || m;
    if (p.field) return `[${p.field}]`;
    return m;
  });
};

const btnIcon = (type) => {
  if (type === 'URL') return <ArrowTopRightOnSquareIcon style={{ width: 15, height: 15 }} />;
  if (type === 'PHONE_NUMBER') return <PhoneIcon style={{ width: 15, height: 15 }} />;
  return <ArrowUturnLeftIcon style={{ width: 15, height: 15 }} />;
};

const WhatsappPreview = ({ template, headerMediaUrl }) => {
  const t = template || {};
  const headerType = t.header_type || 'NONE';
  const isMedia = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType);
  const mediaUrl = headerMediaUrl || t.sample_header_url || '';
  const bodyText = substituteBody(t.body_text, t.body_params);
  const buttons = Array.isArray(t.buttons) ? t.buttons : [];
  const isEmpty = headerType === 'NONE' && !bodyText && !t.footer_text && buttons.length === 0;

  return (
    <div style={{
      background: '#e5ddd5',
      backgroundImage: 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)',
      backgroundSize: '14px 14px',
      borderRadius: 12,
      padding: 16,
      minHeight: 220,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 1px rgba(0,0,0,0.15)', overflow: 'hidden', maxWidth: 320, alignSelf: 'flex-start' }}>
        {/* Header */}
        {headerType === 'TEXT' && t.header_text && (
          <div style={{ padding: '10px 12px 0', fontWeight: 700, fontSize: 14, color: '#111' }}>{t.header_text}</div>
        )}
        {isMedia && (
          mediaUrl && headerType === 'IMAGE' ? (
            <img src={mediaUrl} alt="header" style={{ width: '100%', maxHeight: 170, objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ height: 120, background: '#cfd8dc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5b6b73', gap: 6, flexDirection: 'column' }}>
              {headerType === 'VIDEO' ? <PlayCircleIcon style={{ width: 34, height: 34 }} /> : <DocumentIcon style={{ width: 34, height: 34 }} />}
              <span style={{ fontSize: 11, fontWeight: 600 }}>{headerType} header</span>
            </div>
          )
        )}

        {/* Body */}
        <div style={{ padding: '8px 12px 6px' }}>
          {isEmpty ? (
            <div style={{ fontSize: 13, color: '#9aa0a6' }}>Your message preview will appear here as you build the template.</div>
          ) : (
            <div style={{ fontSize: 13.5, color: '#111', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {renderFormatted(bodyText)}
            </div>
          )}
          {t.footer_text && (
            <div style={{ fontSize: 11, color: '#8696a0', marginTop: 6 }}>{t.footer_text}</div>
          )}
          <div style={{ textAlign: 'right', fontSize: 10, color: '#8696a0', marginTop: 2 }}>
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Buttons */}
        {buttons.length > 0 && (
          <div style={{ borderTop: '1px solid #eef0f1' }}>
            {buttons.map((b, i) => (
              <div key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid #eef0f1', padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#0096de', fontSize: 13.5, fontWeight: 600 }}>
                {btnIcon(b.type)} {b.text || (b.type === 'URL' ? 'Visit' : b.type === 'PHONE_NUMBER' ? 'Call' : 'Reply')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsappPreview;
