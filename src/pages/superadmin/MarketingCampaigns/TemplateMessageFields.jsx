// ============================================================
// SHARED: "what message is actually going out?" fields
//
// Picking a template is not enough to know what a recipient will receive. A
// template carries a header (often a REQUIRED image), {{n}} variables that have
// to resolve to something per lead, a footer and buttons - and if any of those
// are wrong, Meta rejects every message hours later with nobody watching.
//
// The campaign builder has always shown all of that. The follow-up scheduler
// did not: it picked a template by name and showed nothing else, so a rule
// could be scheduled against a media-header template with no image, or one
// whose variables were never mapped. This component is that missing half, kept
// in one place so the two builders cannot drift.
//
// What it does NOT offer is button editing, and that is deliberate: buttons are
// baked into the template Meta approved, so they can only be changed on the
// template itself (WA Templates). They are rendered in the preview so you can
// see what the recipient will get.
// ============================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import HeaderMediaInput from './HeaderMediaInput';
import WhatsappPreview from './WhatsappPreview';

const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

const MEDIA_HEADERS = ['IMAGE', 'DOCUMENT', 'VIDEO'];

// An empty param set, in the shape the server expects for param_overrides.
export const EMPTY_PARAMS = { header_params: [], body_params: [] };

// Seed the editable values from a template's own mappings.
export const seedParams = (template) => ({
  header_params: (template?.header_params || []).map((p) => ({ ...p })),
  body_params: (template?.body_params || []).map((p) => ({ ...p })),
});

/**
 * The reason this message could not be sent yet, or null when it is ready.
 * Callers run it before submitting so the failure is a sentence on screen
 * rather than a provider rejection nobody sees.
 */
export const templateMessageError = (template, headerImageUrl, params = EMPTY_PARAMS) => {
  if (!template) return 'Select a template.';

  if (MEDIA_HEADERS.includes(template.header_type)
    && !headerImageUrl && !template.sample_header_url) {
    return `This template has a ${template.header_type} header - upload the file it should send, or WhatsApp will reject every message.`;
  }

  // A presigned link dies within days, and a follow-up may not fire for days.
  if (/x-amz-(signature|expires|credential)/i.test(headerImageUrl || '')) {
    return 'That header link is a temporary presigned URL that expires. Use the Upload button - it gives a permanent link.';
  }

  const bad = (p, label) => {
    if (p.source === 'lead_field' && !p.field) return `${label} is mapped to a lead field, but no field is selected.`;
    if (p.source === 'static' && !String(p.value || '').trim()) return `${label} is set to custom text, but the value is empty.`;
    return null;
  };
  for (const p of params.header_params || []) {
    const e = bad(p, 'Header variable {{1}}');
    if (e) return e;
  }
  for (let i = 0; i < (params.body_params || []).length; i += 1) {
    const p = params.body_params[i];
    const e = bad(p, `Variable {{${p.index || i + 1}}}`);
    if (e) return e;
  }
  return null;
};

const TemplateMessageFields = ({
  templates = [],
  templateId,
  onTemplateChange,
  headerImageUrl,
  onHeaderImageChange,
  params = EMPTY_PARAMS,
  onParamsChange,
  templateLabel = 'Template *',
  showPreview = true,
}) => {
  const [leadFields, setLeadFields] = useState([]);
  // Which template the values were last seeded from, so editing a value does
  // not immediately get overwritten by the seeding effect.
  const seededFor = useRef(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId]
  );

  // The {{n}} → lead-field dropdown, same source as the template builder.
  useEffect(() => {
    (async () => {
      try {
        const resp = await whatsappCampaignApi.getTemplateMeta();
        setLeadFields(resp.data?.lead_fields || []);
      } catch {
        /* the mapper falls back to custom text only */
      }
    })();
  }, []);

  // Re-seed the editable values whenever a DIFFERENT template is chosen.
  useEffect(() => {
    if (seededFor.current === templateId) return;
    seededFor.current = templateId;
    onParamsChange(seedParams(selectedTemplate));
  }, [templateId, selectedTemplate, onParamsChange]);

  const updateParam = (group, i, key, val) => onParamsChange({
    ...params,
    [group]: (params[group] || []).map((p, idx) => (idx === i ? { ...p, [key]: val } : p)),
  });

  const approved = useMemo(() => templates.filter((t) => t.status === 'APPROVED'), [templates]);

  const needsHeaderMedia = selectedTemplate
    && MEDIA_HEADERS.includes(selectedTemplate.header_type)
    && !headerImageUrl
    && !selectedTemplate.sample_header_url;

  const isPresigned = /x-amz-(signature|expires|credential)/i.test(headerImageUrl || '');

  // The preview substitutes the values being edited here, not the template's
  // saved ones - so what is on screen is what this send will actually deliver.
  const previewTemplate = useMemo(() => (selectedTemplate ? {
    ...selectedTemplate,
    header_params: params.header_params?.length ? params.header_params : selectedTemplate.header_params,
    body_params: params.body_params?.length ? params.body_params : selectedTemplate.body_params,
  } : null), [selectedTemplate, params]);

  const renderParamRow = (group, label, p, i) => (
    <div key={`${group}-${i}`} style={{ display: 'grid', gridTemplateColumns: '70px 130px 1fr', gap: 8, alignItems: 'center', marginTop: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
      <select style={selectStyle} value={p.source === 'lead_field' ? 'lead_field' : 'static'} onChange={(e) => updateParam(group, i, 'source', e.target.value)}>
        <option value="lead_field">Lead field</option>
        <option value="static">Custom text</option>
      </select>
      {p.source === 'lead_field' ? (
        <select style={selectStyle} value={p.field || ''} onChange={(e) => updateParam(group, i, 'field', e.target.value)}>
          <option value="">Select field…</option>
          {leadFields.map((lf) => <option key={lf.value} value={lf.value}>{lf.label}</option>)}
        </select>
      ) : (
        <input style={inputStyle} value={p.value || ''} onChange={(e) => updateParam(group, i, 'value', e.target.value)} placeholder="Text sent to every recipient" />
      )}
    </div>
  );

  const hasParams = (params.header_params?.length || 0) + (params.body_params?.length || 0) > 0;

  return (
    <>
      <div>
        <label style={labelStyle}>{templateLabel}</label>
        <select style={selectStyle} value={templateId || ''} onChange={(e) => onTemplateChange(e.target.value)}>
          <option value="">Select a template…</option>
          {approved.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.language_code}){t.header_type && t.header_type !== 'NONE' ? ` - ${t.header_type} header` : ''}
            </option>
          ))}
        </select>
        {templates.length > 0 && approved.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            No approved templates available. Sync or create templates first.
          </div>
        )}
      </div>

      {/* Everything below only makes sense once a template is chosen - showing
          an empty header field and an empty preview first is just noise. */}
      {selectedTemplate && (
        <>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>
              Header {selectedTemplate.header_type === 'NONE' ? 'Image' : selectedTemplate.header_type}{' '}
              {needsHeaderMedia
                ? <span style={{ fontWeight: 500, color: '#dc2626' }}>* REQUIRED</span>
                : <span style={{ fontWeight: 400 }}>(optional - overrides the template default)</span>}
            </label>
            <HeaderMediaInput value={headerImageUrl} onChange={onHeaderImageChange} />

            {needsHeaderMedia && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <ExclamationTriangleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span>
                  This template has a <strong>{selectedTemplate.header_type}</strong> header - you <strong>must upload a file</strong> above,
                  otherwise WhatsApp rejects every message with #132012.
                </span>
              </div>
            )}

            {isPresigned && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#B45309', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <ExclamationTriangleIcon style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                This is a temporary presigned link that expires within days - use the Upload button for a permanent URL.
                A follow-up may not fire for days, by which point the link would be dead.
              </div>
            )}
          </div>

          {hasParams && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Template Variables</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 4 }}>
                Pre-filled from the template - change the values for this send only. The saved template is not modified.
              </div>
              {(params.header_params || []).map((p, i) => renderParamRow('header_params', '{{1}} hdr', p, i))}
              {(params.body_params || []).map((p, i) => renderParamRow('body_params', `{{${p.index || i + 1}}}`, p, i))}
            </div>
          )}

          {showPreview && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Message Preview</div>
              <WhatsappPreview template={previewTemplate} headerMediaUrl={headerImageUrl} />
              {Array.isArray(selectedTemplate.buttons) && selectedTemplate.buttons.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  The buttons above are part of the approved template. WhatsApp bakes them in at approval time, so they
                  cannot be added or changed per send - edit them on the template in WA Templates.
                </div>
              )}
              {(!selectedTemplate.buttons || selectedTemplate.buttons.length === 0) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  This template has no buttons. Buttons are approved as part of a template, so add them on the template
                  in WA Templates rather than here.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
};

export default TemplateMessageFields;
