import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ArrowLeftIcon, ArrowPathIcon, CloudArrowUpIcon, DocumentTextIcon,
  ArrowDownTrayIcon, CheckCircleIcon, UserIcon, ClockIcon, IdentificationIcon,
} from '@heroicons/react/24/outline';
import '../common/LeadWorkspacePage.css';
import '../collection/CollectionWorkspace.css';

const fmtDate = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—');

const humanFileSize = (bytes) => {
  if (!bytes) return '';
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const InfoRow = ({ label, value, mono }) => (
  <div className="bkd-info-item">
    <div className="bkd-info-label">{label}</div>
    <div className={`bkd-info-value${mono ? ' mono' : ''}`}>{value || '—'}</div>
  </div>
);

const RecordManagerBookingDetail = ({ bookingId, onBack }) => {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  // Registration (document) number entry
  const [docNumber, setDocNumber] = useState('');
  const [docNumberSaving, setDocNumberSaving] = useState(false);

  // File upload
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getById(bookingId);
      const data = resp.data?.data || resp.data;
      setBooking(data);
      setDocNumber(data?.registration_number || '');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load booking'));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  const loadDocuments = useCallback(async () => {
    if (!bookingId) return;
    setDocumentsLoading(true);
    try {
      const resp = await bookingApi.getDocuments(bookingId);
      setDocuments(resp.data?.data || resp.data || []);
    } catch (err) {
      // Non-fatal — booking still renders.
    } finally {
      setDocumentsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { loadBooking(); }, [loadBooking]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleSaveDocNumber = async () => {
    if (!docNumber.trim()) { toast.error('Enter the registration (document) number'); return; }
    setDocNumberSaving(true);
    try {
      await bookingApi.updateRegistrationDetails(bookingId, { registration_number: docNumber.trim() });
      toast.success('Registration number saved');
      loadBooking();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save registration number'));
    } finally {
      setDocNumberSaving(false);
    }
  };

  const addFiles = (files) => {
    const arr = Array.from(files || []);
    if (arr.length) setSelectedFiles((prev) => [...prev, ...arr]);
  };
  const removeFile = (idx) => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer?.files);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) { toast.error('Select at least one file to upload'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('documents', file));
      formData.append('document_type', 'Registration Document');
      await bookingApi.uploadDocuments(bookingId, formData);
      toast.success('Documents uploaded');
      setSelectedFiles([]);
      loadDocuments();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to upload documents'));
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="simple-loader"><div className="simple-spinner" /><p>Loading...</p></div>
  );
  if (!booking) return (
    <div className="col-empty">
      <div className="col-empty-title">Booking not found</div>
      <button className="bkd-btn bkd-btn-ghost bkd-btn-sm" onClick={onBack}>Go Back</button>
    </div>
  );

  const statusColor = booking.status_color || '#16A34A';
  const buyerName = booking.buyer_name || booking.customer_name || '—';
  const customer = booking.customer || {};
  const phoneRaw = customer.phone || customer.phone_number || '';
  const phone = /^\s*LD[-_ ]?\d+\s*$/i.test(String(phoneRaw || '')) ? '—' : (phoneRaw || '—');

  return (
    <div className="bkd-page">
      {/* Header */}
      <div className="bkd-header">
        <div className="bkd-header-left">
          <button className="bkd-back-btn" onClick={onBack}><ArrowLeftIcon style={{ width: 16, height: 16 }} /></button>
          <div>
            <h1 className="bkd-title">
              Booking {booking.booking_number}{' '}
              <span className="bkd-status-badge" style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                {booking.status_label || 'Registered'}
              </span>
            </h1>
            <p className="bkd-subtitle">{booking.project_name} · {booking.unit_display || booking.unit_number || 'N/A'} · Registered {fmtDate(booking.registration_date)}</p>
          </div>
        </div>
        <div className="bkd-header-actions">
          <button className="bkd-btn bkd-btn-ghost" onClick={() => { loadBooking(); loadDocuments(); }} title="Refresh">
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Single-column: booking data, then registration number, then uploads.
          No financial summary and no activity/payment log for the Record Manager. */}
      <div className="bkd-single-col" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
        {/* ── Booking data ── */}
        <div className="bkd-card">
          <div className="bkd-card-title"><DocumentTextIcon style={{ width: 15, height: 15 }} /> Booking Details</div>
          <div className="bkd-info-grid">
            <InfoRow label="Buyer Name" value={buyerName} />
            <InfoRow label="Phone" value={phone} mono />
            <InfoRow label="Booking Number" value={booking.booking_number} mono />
            <InfoRow label="Registration Date" value={fmtDate(booking.registration_date)} />
            <InfoRow label="Project" value={booking.project_name} />
            <InfoRow label="Phase" value={booking.phase_name || '—'} />
            <InfoRow label="Unit" value={booking.unit_display || booking.unit_number || '—'} />
            <InfoRow label="Booking Date" value={fmtDate(booking.booking_date)} />
            {booking.lead?.lead_number && <InfoRow label="Lead" value={booking.lead.lead_number} mono />}
          </div>
        </div>

        {/* ── Registration (document) number ── */}
        <div className="bkd-card">
          <div className="bkd-card-title"><IdentificationIcon style={{ width: 15, height: 15 }} /> Registration Number</div>
          <div className="bkd-form-row" style={{ alignItems: 'flex-end' }}>
            <div className="bkd-form-group" style={{ flex: 1 }}>
              <label className="bkd-form-label">Registered Document Number</label>
              <input
                type="text"
                className="bkd-form-control"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="e.g. 1234/2026"
              />
            </div>
            <button className="bkd-btn bkd-btn-primary" disabled={docNumberSaving} onClick={handleSaveDocNumber}>
              <CheckCircleIcon style={{ width: 14, height: 14 }} /> {docNumberSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* ── Document uploads ── */}
        <div className="bkd-card">
          <div className="bkd-card-title"><CloudArrowUpIcon style={{ width: 15, height: 15 }} /> Registration Documents</div>

          <div
            className={`bkd-dropzone${dragActive ? ' is-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '1.5px dashed var(--border-primary, #cbd5e1)', borderRadius: 10,
              padding: '20px', textAlign: 'center', cursor: 'pointer',
              background: dragActive ? 'var(--bg-secondary, #f8fafc)' : 'transparent', marginBottom: 12,
            }}
          >
            <CloudArrowUpIcon style={{ width: 28, height: 28, color: 'var(--text-muted)', margin: '0 auto 6px' }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Drop files here or click to browse</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>PDF, images and documents supported</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {selectedFiles.map((file, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {file.name} <span style={{ color: 'var(--text-muted)' }}>· {humanFileSize(file.size)}</span></span>
                  <button type="button" onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              ))}
              <button className="bkd-btn bkd-btn-primary" disabled={uploading} onClick={handleUpload}>
                <CloudArrowUpIcon style={{ width: 14, height: 14 }} /> {uploading ? 'Uploading…' : `Upload ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}`}
              </button>
            </div>
          )}

          {/* Uploaded documents list with who + when (recorded on upload). */}
          <div className="bkd-card-subtitle" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '6px 0 8px' }}>
            Uploaded files ({documents.length})
          </div>
          {documentsLoading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>Loading…</div>
          ) : documents.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>No documents uploaded yet.</div>
          ) : (
            <div>
              {documents.map((doc) => {
                const href = doc.file_url || doc.download_url;
                const uploader = doc.uploader ? `${doc.uploader.first_name || ''} ${doc.uploader.last_name || ''}`.trim() : '';
                return (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                    <DocumentTextIcon style={{ width: 22, height: 22, color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.document_name || doc.file_name || 'Document'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {uploader && <span><UserIcon style={{ width: 11, height: 11, display: 'inline', verticalAlign: '-1px' }} /> {uploader}</span>}
                        <span><ClockIcon style={{ width: 11, height: 11, display: 'inline', verticalAlign: '-1px' }} /> {fmtDateTime(doc.created_at)}</span>
                        {doc.file_size ? <span>{humanFileSize(doc.file_size)}</span> : null}
                      </div>
                    </div>
                    {href && (
                      <a className="bkd-btn bkd-btn-ghost bkd-btn-sm" href={href} target="_blank" rel="noreferrer" title="View / download">
                        <ArrowDownTrayIcon style={{ width: 13, height: 13 }} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordManagerBookingDetail;
