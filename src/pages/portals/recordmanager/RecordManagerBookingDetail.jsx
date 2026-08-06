import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { getErrorMessage } from '../../../utils/helpers';
import { getFileMeta, humanFileSize } from '../../../utils/fileMeta';
import { openAuthedFile, downloadAuthedFile } from '../../../utils/authedFile';
import AuthedImage from '../../../components/AuthedImage';
import { badgeColors } from '../../../utils/badgeColors';
import {
  ArrowLeftIcon, ArrowPathIcon, CloudArrowUpIcon, DocumentTextIcon,
  ArrowDownTrayIcon, CheckCircleIcon, UserIcon, IdentificationIcon,
  CheckBadgeIcon, CalendarDaysIcon, BuildingOffice2Icon,
  FolderIcon, FolderPlusIcon, HomeIcon, ChevronRightIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import '../common/LeadWorkspacePage.css';
import '../collection/CollectionWorkspace.css';

const fmtDate = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '-');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '-');

const DOC_TYPES = [
  'Registration Document',
  'Sale Deed',
  'Mortgage Deed',
  'Gift Deed',
  'Exchange Deed',
  'Partition Deed',
  'Settlement Deed',
  'Release Deed',
  'General Power',
  'Specific Power',
  'Will',
  'Trust Deed',
  'Partnership Deed',
  'Death Certificate',
  'Legalheir Certificate',
  'Agreement',
  'Receipt',
  'ID Proof',
  'Other'
];

const InfoRow = ({ label, value, mono }) => (
  <div className="bkd-info-item">
    <div className="bkd-info-label">{label}</div>
    <div className={`bkd-info-value${mono ? ' mono' : ''}`}>{value || '-'}</div>
  </div>
);

const RecordManagerBookingDetail = ({ bookingId, onBack }) => {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  // Registration details entry (Doc No / Doc Date / Seller)
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState('');
  const [seller, setSeller] = useState('');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // File upload
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState(DOC_TYPES[0]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Document folders. Registration paperwork is filed into a folder tree - the
  // same model as the project Document Archive. `folderId` is the folder the
  // upload lands in; null = the root.
  const [folderId, setFolderId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const toDateInput = (d) => (d ? String(d).slice(0, 10) : '');

  const loadBooking = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getById(bookingId);
      const data = resp.data?.data || resp.data;
      setBooking(data);
      setDocNumber(data?.registration_number || '');
      setDocDate(toDateInput(data?.registration_document_date));
      // Pre-fill Seller from the project builder when not yet set on the booking.
      setSeller(data?.seller_name || data?.project?.builder_name || data?.builder_name || '');
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
      // Non-fatal - booking still renders.
    } finally {
      setDocumentsLoading(false);
    }
  }, [bookingId]);

  // One level of the folder tree - the folders the upload can be filed into and
  // the breadcrumb back to the root. The document LIST stays flat (loadDocuments
  // above) so the Uploaded panel keeps showing everything on this booking.
  const loadFolders = useCallback(async () => {
    if (!bookingId) return;
    try {
      const resp = await bookingApi.getDocumentTree(bookingId, folderId);
      const payload = resp.data?.data || resp.data || {};
      setFolders(payload.folders || []);
      setBreadcrumb(payload.breadcrumb || []);
    } catch (err) {
      // Non-fatal - the flat document list and upload still work at the root.
      setFolders([]);
      setBreadcrumb([]);
    }
  }, [bookingId, folderId]);

  useEffect(() => { loadBooking(); }, [loadBooking]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { loadFolders(); }, [loadFolders]);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) { toast.error('Enter a folder name'); return; }
    setCreatingFolder(true);
    try {
      await bookingApi.createDocumentFolder(bookingId, { folderName: name, parentId: folderId });
      toast.success(`Folder "${name}" created`);
      setNewFolderName('');
      loadFolders();
    } catch (err) {
      // The server rejects a duplicate name in the same parent and says so.
      toast.error(getErrorMessage(err, 'Failed to create folder'));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folder) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete folder "${folder.folder_name}"?`)) return;
    try {
      await bookingApi.deleteDocumentFolder(bookingId, folder.id);
      toast.success('Folder deleted');
      loadFolders();
    } catch (err) {
      // A non-empty folder is refused, and the message names what is inside.
      toast.error(getErrorMessage(err, 'Failed to delete folder'));
    }
  };

  const handleMoveDocument = async (doc, targetFolderId) => {
    try {
      await bookingApi.moveDocument(bookingId, doc.id, targetFolderId || null);
      toast.success('Document moved');
      loadDocuments();
      loadFolders();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to move document'));
    }
  };

  const handleSaveDetails = async () => {
    if (!docNumber.trim() && !docDate && !seller.trim()) {
      toast.error('Enter a document number, document date or seller');
      return;
    }
    setSaving(true);
    try {
      await bookingApi.updateRegistrationDetails(bookingId, {
        registration_number: docNumber.trim(),
        registration_document_date: docDate || null,
        seller_name: seller.trim(),
      });
      toast.success('Registration details saved');
      loadBooking();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save registration details'));
    } finally {
      setSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Mark this registration record as Completed? It will move to the archive and leave your list.')) return;
    setCompleting(true);
    try {
      await bookingApi.updateRecordStatus(bookingId, { record_status: 'COMPLETED' });
      toast.success('Record marked as Completed');
      onBack();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to mark completed'));
    } finally {
      setCompleting(false);
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
      formData.append('document_type', documentType || 'Registration Document');
      if (selectedFiles.length === 1 && documentName.trim()) formData.append('document_name', documentName.trim());
      // Land the files in the folder currently open; absent = the root.
      if (folderId) formData.append('folder_id', folderId);
      await bookingApi.uploadDocuments(bookingId, formData);
      const where = breadcrumb.length ? ` to ${breadcrumb[breadcrumb.length - 1].folder_name}` : '';
      toast.success(`Documents uploaded${where}`);
      setSelectedFiles([]);
      setDocumentName('');
      loadDocuments();
      loadFolders();
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

  const statusBadge = badgeColors(booking.status_color, '#065F46');
  const buyerName = booking.buyer_name || booking.customer_name || '-';
  const customer = booking.customer || {};
  const phoneRaw = customer.phone || customer.phone_number || '';
  const phone = /^\s*LD[-_ ]?\d+\s*$/i.test(String(phoneRaw || '')) ? '-' : (phoneRaw || '-');
  const isCompleted = booking.record_status === 'COMPLETED';
  const recordBadge = isCompleted
    ? { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' }
    : { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };

  return (
    <div className="bkd-page">
      {/* Header */}
      <div className="bkd-header">
        <div className="bkd-header-left">
          <button className="bkd-back-btn" onClick={onBack}><ArrowLeftIcon style={{ width: 16, height: 16 }} /></button>
          <div>
            <h1 className="bkd-title">
              Booking {booking.booking_number}{' '}
              <span className="bkd-status-badge" style={{ background: statusBadge.bg, color: statusBadge.text, border: `1px solid ${statusBadge.border}` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusBadge.text, display: 'inline-block' }} />
                {booking.status_label || 'Registered'}
              </span>
              <span className="bkd-status-badge" style={{ background: recordBadge.bg, color: recordBadge.text, border: `1px solid ${recordBadge.border}`, marginLeft: 6 }}>
                {isCompleted ? 'Completed' : 'Open'}
              </span>
            </h1>
            <p className="bkd-subtitle">{booking.project_name} · {booking.unit_display || booking.unit_number || 'N/A'} · Registered {fmtDate(booking.registration_date)}</p>
          </div>
        </div>
        <div className="bkd-header-actions">
          <button className="bkd-btn bkd-btn-ghost" onClick={() => { loadBooking(); loadDocuments(); }} title="Refresh">
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
          {isCompleted ? (
            <span className="bkd-btn bkd-btn-outline" style={{ color: '#16A34A', borderColor: '#16A34A', cursor: 'default' }}>
              <CheckBadgeIcon style={{ width: 15, height: 15 }} /> Completed
            </span>
          ) : (
            <button className="bkd-btn bkd-btn-primary" onClick={handleMarkCompleted} disabled={completing} title="Mark this registration record Completed">
              <CheckBadgeIcon style={{ width: 15, height: 15 }} /> {completing ? 'Completing…' : 'Mark as Completed'}
            </button>
          )}
        </div>
      </div>

      {/* Single-column body: booking data → registration details → document manager.
          No financial summary and no activity/payment log for the Record Manager. */}
      <div className="bkd-single-col" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1040 }}>
        {/* ── Booking data ── */}
        <div className="bkd-card">
          <div className="bkd-card-header"><div className="bkd-card-title"><DocumentTextIcon style={{ width: 15, height: 15 }} /> Booking Details</div></div>
          <div className="bkd-card-body">
            <div className="bkd-info-grid">
              <InfoRow label="Buyer Name" value={buyerName} />
              <InfoRow label="Phone" value={phone} mono />
              <InfoRow label="Booking Number" value={booking.booking_number} mono />
              <InfoRow label="Registration Date" value={fmtDate(booking.registration_date)} />
              <InfoRow label="Project" value={booking.project_name} />
              <InfoRow label="Phase" value={booking.phase_name || '-'} />
              <InfoRow label="Unit" value={booking.unit_display || booking.unit_number || '-'} />
              <InfoRow label="Booking Date" value={fmtDate(booking.booking_date)} />
              {booking.lead?.lead_number && <InfoRow label="Lead" value={booking.lead.lead_number} mono />}
            </div>
          </div>
        </div>

        {/* ── Registration details: Doc No / Doc Date / Buyer / Seller ── */}
        <div className="bkd-card">
          <div className="bkd-card-header"><div className="bkd-card-title"><IdentificationIcon style={{ width: 15, height: 15 }} /> Registration Details</div></div>
          <div className="bkd-card-body">
            <div className="bkd-form-row" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="bkd-form-group" style={{ flex: '1 1 220px' }}>
                <label className="bkd-form-label">Doc No (Document Number)</label>
                <input
                  type="text"
                  className="bkd-form-control"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="e.g. 1234/2026"
                  disabled={isCompleted}
                />
              </div>
              <div className="bkd-form-group" style={{ flex: '1 1 180px' }}>
                <label className="bkd-form-label"><CalendarDaysIcon style={{ width: 12, height: 12, verticalAlign: '-1px' }} /> Doc Date</label>
                <input
                  type="date"
                  className="bkd-form-control"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  disabled={isCompleted}
                />
              </div>
            </div>
            <div className="bkd-form-row" style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
              <div className="bkd-form-group" style={{ flex: '1 1 220px' }}>
                <label className="bkd-form-label"><UserIcon style={{ width: 12, height: 12, verticalAlign: '-1px' }} /> Buyer</label>
                <input type="text" className="bkd-form-control" value={buyerName} readOnly disabled title="Buyer comes from the booking" />
              </div>
              <div className="bkd-form-group" style={{ flex: '1 1 220px' }}>
                <label className="bkd-form-label"><BuildingOffice2Icon style={{ width: 12, height: 12, verticalAlign: '-1px' }} /> Seller</label>
                <input
                  type="text"
                  className="bkd-form-control"
                  value={seller}
                  onChange={(e) => setSeller(e.target.value)}
                  placeholder={booking.project?.builder_name || booking.builder_name || 'Seller / builder name'}
                  disabled={isCompleted}
                />
              </div>
            </div>
            {!isCompleted && (
              <div style={{ marginTop: 14 }}>
                <button className="bkd-btn bkd-btn-primary" disabled={saving} onClick={handleSaveDetails}>
                  <CheckCircleIcon style={{ width: 14, height: 14 }} /> {saving ? 'Saving…' : 'Save Registration Details'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Document manager (two-panel: upload | uploaded) ── */}
        <div className="bkd-card">
          <div className="bkd-card-header"><div className="bkd-card-title"><CloudArrowUpIcon style={{ width: 15, height: 15 }} /> Registration Documents</div></div>
          <div className="bkd-card-body">
            <div className="bkd-upload-grid">
              {/* Upload panel */}
              <div className="bkd-upload-panel">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                />

                {/* ── Folder bar ──────────────────────────────────────────────
                    Registration paperwork is filed into a folder tree, the same
                    model as the project Document Archive. Whatever folder is open
                    here is where the next upload lands. */}
                <div className="bkd-folder-bar">
                  <div className="bkd-folder-crumbs">
                    <button
                      type="button"
                      className={`bkd-crumb ${!folderId ? 'is-current' : ''}`}
                      onClick={() => setFolderId(null)}
                    >
                      <HomeIcon style={{ width: 12, height: 12 }} /> Root
                    </button>
                    {breadcrumb.map((c, i) => (
                      <React.Fragment key={c.id}>
                        <ChevronRightIcon className="bkd-crumb-sep" />
                        <button
                          type="button"
                          className={`bkd-crumb ${i === breadcrumb.length - 1 ? 'is-current' : ''}`}
                          onClick={() => setFolderId(c.id)}
                        >
                          {c.folder_name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  {folders.length > 0 && (
                    <div className="bkd-folder-list">
                      {folders.map((f) => (
                        <div key={f.id} className="bkd-folder-chip">
                          <button
                            type="button"
                            className="bkd-folder-open"
                            onClick={() => setFolderId(f.id)}
                            title={`Open ${f.folder_name}`}
                          >
                            <FolderIcon style={{ width: 14, height: 14 }} />
                            <span className="bkd-folder-name">{f.folder_name}</span>
                            <span className="bkd-folder-count">
                              {f.document_count || 0}
                            </span>
                          </button>
                          {!isCompleted && (
                            <button
                              type="button"
                              className="bkd-folder-del"
                              onClick={() => handleDeleteFolder(f)}
                              aria-label={`Delete ${f.folder_name}`}
                            >
                              <TrashIcon style={{ width: 12, height: 12 }} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!isCompleted && (
                    <div className="bkd-folder-new">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
                        placeholder={breadcrumb.length
                          ? `New folder inside "${breadcrumb[breadcrumb.length - 1].folder_name}"…`
                          : 'New folder name…'}
                        maxLength={200}
                      />
                      <button
                        type="button"
                        className="bkd-btn bkd-btn-ghost"
                        disabled={creatingFolder || !newFolderName.trim()}
                        onClick={handleCreateFolder}
                      >
                        <FolderPlusIcon style={{ width: 14, height: 14 }} />
                        {creatingFolder ? 'Creating…' : 'Create'}
                      </button>
                    </div>
                  )}
                </div>
                <div
                  className="bkd-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                  onDrop={handleDrop}
                  style={{
                    cursor: 'pointer',
                    border: `2px dashed ${dragActive ? '#4f46e5' : 'var(--border-primary, #e5e7eb)'}`,
                    background: dragActive ? '#eef2ff' : 'var(--bg-secondary, #f9fafb)',
                    transition: 'all 0.15s',
                  }}
                >
                  <CloudArrowUpIcon style={{ width: 28, height: 28, color: 'var(--col-primary, #4f46e5)' }} />
                  <div style={{ fontWeight: 700 }}>{dragActive ? 'Drop files here' : 'Click to choose files or drag & drop'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>PDF, images, Word, Excel, ZIP - any file type.</div>
                </div>

                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>Selected ({selectedFiles.length}):</div>
                    {selectedFiles.map((file, idx) => {
                      const meta = getFileMeta(file.type, file.name);
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <meta.Icon style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--text-muted, #94a3b8)' }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{file.name}</span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 11 }}>{humanFileSize(file.size)}</span>
                            <button type="button" onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="bkd-form-group" style={{ marginTop: 14 }}>
                  <label className="bkd-form-label">Document Type</label>
                  <select className="bkd-form-control" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                    {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                {selectedFiles.length === 1 && (
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Document Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                    <input className="bkd-form-control" value={documentName} onChange={(e) => setDocumentName(e.target.value)} placeholder="Defaults to the file name" />
                  </div>
                )}
                <button className="bkd-btn bkd-btn-primary" onClick={handleUpload} disabled={uploading || selectedFiles.length === 0} style={{ marginTop: 10 }}>
                  {uploading ? 'Uploading…' : <><CloudArrowUpIcon style={{ width: 14, height: 14 }} /> Upload {selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}` : 'Documents'}</>}
                </button>
              </div>

              {/* Uploaded documents panel */}
              <div className="bkd-upload-panel">
                <div className="bkd-card-title" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><DocumentTextIcon style={{ width: 15, height: 15 }} /> Uploaded Documents</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted, #6b7280)' }}>{documents.length} file{documents.length === 1 ? '' : 's'}</span>
                </div>
                {documentsLoading ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</div>
                ) : documents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No documents uploaded yet.</div>
                ) : (
                  <div className="bkd-document-list">
                    {documents.map((doc) => {
                      const meta = getFileMeta(doc.mime_type, doc.document_name || doc.file_name || '');
                      const viewUrl = doc.file_url || doc.download_url;
                      const downloadUrl = doc.download_url || doc.file_url;
                      const uploader = doc.uploader ? `${doc.uploader.first_name || ''} ${doc.uploader.last_name || ''}`.trim() : '';
                      return (
                        <div className="bkd-document-item" key={doc.id} style={{ alignItems: 'flex-start', minWidth: 0 }}>
                          <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, overflow: 'hidden' }}>
                            {meta.isImage && viewUrl
                              ? <AuthedImage src={viewUrl} alt={doc.document_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <meta.Icon style={{ width: 22, height: 22, color: 'var(--text-muted, #94a3b8)' }} />}
                          </div>
                          <div className="bkd-document-main" style={{ flex: 1, minWidth: 0 }}>
                            <div className="bkd-document-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.document_name || doc.file_name || 'Document'}
                            </div>
                            <div className="bkd-document-meta">
                              {doc.document_type && !String(doc.document_type).includes('/') ? `${doc.document_type} · ` : ''}{(meta.ext || '').toUpperCase() || doc.mime_type || 'File'} · {humanFileSize(doc.file_size)}
                            </div>
                            <div className="bkd-document-meta">
                              {uploader ? `Uploaded by ${uploader} · ` : ''}{fmtDateTime(doc.created_at)}
                            </div>
                            {/* Which folder this document is filed in, and a way
                                to re-file it without re-uploading. */}
                            <div className="bkd-document-folder">
                              <FolderIcon style={{ width: 11, height: 11 }} />
                              <span>{doc.folder_name || 'Root'}</span>
                              {!isCompleted && (folders.length > 0 || doc.folder_id) && (
                                <select
                                  className="bkd-document-move"
                                  value={doc.folder_id || ''}
                                  onChange={(e) => handleMoveDocument(doc, e.target.value)}
                                  title="Move to another folder"
                                >
                                  <option value="">Root</option>
                                  {folders.map((f) => (
                                    <option key={f.id} value={f.id}>{f.folder_name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                          <div className="bkd-document-actions" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                            {viewUrl && (
                              <a className="bkd-btn bkd-btn-ghost bkd-btn-sm" href={viewUrl} style={{ cursor: 'pointer' }} title="View / Preview"
                                onClick={(e) => { e.preventDefault(); openAuthedFile(viewUrl).catch(() => toast.error('Could not open the document')); }}>
                                View
                              </a>
                            )}
                            {downloadUrl && (
                              <a className="bkd-btn bkd-btn-ghost bkd-btn-sm" href={downloadUrl} style={{ cursor: 'pointer' }} title="Download"
                                onClick={(e) => { e.preventDefault(); downloadAuthedFile(downloadUrl, doc.document_name || doc.file_name || '').catch(() => toast.error('Could not download the document')); }}>
                                <ArrowDownTrayIcon style={{ width: 13, height: 13 }} /> Download
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordManagerBookingDetail;
