import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { CloudArrowUpIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline';
import projectDocumentApi from '../../../api/projectDocumentApi';
import { getErrorMessage } from '../../../utils/helpers';
import { getFileMeta, humanFileSize } from '../../../utils/fileMeta';
import './ProjectDocumentsModal.css';

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—');

const DOC_TYPES = ['Brochure', 'Approval', 'Legal', 'Layout Plan', 'RERA', 'Agreement', 'Other'];

// Upload-one-at-a-time + list/delete for a single project's document archive.
// Shared by the per-project ProjectDocumentsModal and the Document Management screen.
const ProjectDocumentsPanel = ({ project }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState(DOC_TYPES[0]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await projectDocumentApi.list(project.id);
      setDocuments(resp.data?.data || resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load project documents'));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!file) { toast.error('Choose a file to upload'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('documents', file);
      formData.append('document_type', documentType);
      if (documentName.trim()) formData.append('document_name', documentName.trim());
      await projectDocumentApi.upload(project.id, formData);
      toast.success('Document uploaded');
      setFile(null);
      setDocumentName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to upload document'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${doc.document_name || doc.file_name}"?`)) return;
    try {
      await projectDocumentApi.remove(project.id, doc.id);
      toast.success('Document deleted');
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete document'));
    }
  };

  return (
    <div className="proj-docs__body">
      {/* Upload one document at a time */}
      <div className="proj-docs__upload">
        <div className="proj-docs__upload-row">
          <div className="proj-docs__field">
            <label>Document Name <span className="proj-docs__muted">(optional)</span></label>
            <input
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Defaults to the file name"
            />
          </div>
          <div className="proj-docs__field" style={{ maxWidth: 180 }}>
            <label>Document Type</label>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="proj-docs__upload-row">
          <input
            ref={fileInputRef}
            type="file"
            className="proj-docs__file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button type="button" className="proj-docs__upload-btn" disabled={uploading || !file} onClick={handleUpload}>
            <CloudArrowUpIcon className="master-action-icon" /> {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Existing documents */}
      <div className="proj-docs__list-title">Documents ({documents.length})</div>
      {loading ? (
        <div className="proj-docs__empty">Loading…</div>
      ) : documents.length === 0 ? (
        <div className="proj-docs__empty">No documents uploaded for this project yet.</div>
      ) : (
        <div className="proj-docs__list">
          {documents.map((doc) => {
            const href = doc.file_url || doc.download_url;
            const uploader = doc.uploader ? `${doc.uploader.first_name || ''} ${doc.uploader.last_name || ''}`.trim() : '';
            const meta = getFileMeta(doc.mime_type, doc.document_name || doc.file_name || '');
            return (
              <div key={doc.id} className="proj-docs__row">
                <div className="proj-docs__thumb">
                  {meta.isImage && href
                    ? <img src={href} alt={doc.document_name} />
                    : <span>{meta.icon}</span>}
                </div>
                <div className="proj-docs__row-main">
                  <div className="proj-docs__row-name">{doc.document_name || doc.file_name}</div>
                  <div className="proj-docs__row-meta">
                    {doc.document_type && !String(doc.document_type).includes('/') && (
                      <span className="proj-docs__tag">{doc.document_type}</span>
                    )}
                    {uploader && <span>{uploader}</span>}
                    <span>{fmtDateTime(doc.created_at)}</span>
                    {doc.file_size ? <span>{humanFileSize(doc.file_size)}</span> : null}
                  </div>
                </div>
                {href && (
                  <a className="proj-docs__icon-btn" href={href} target="_blank" rel="noreferrer" title="View / download">
                    <ArrowDownTrayIcon className="master-action-icon" />
                  </a>
                )}
                <button type="button" className="proj-docs__icon-btn danger" title="Delete" onClick={() => handleDelete(doc)}>
                  <TrashIcon className="master-action-icon" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectDocumentsPanel;
