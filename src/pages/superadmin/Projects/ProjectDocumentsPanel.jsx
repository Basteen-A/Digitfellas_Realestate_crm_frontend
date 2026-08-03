import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  CloudArrowUpIcon, ArrowDownTrayIcon, TrashIcon, DocumentTextIcon, XMarkIcon,
  FolderIcon, FolderPlusIcon, PencilSquareIcon, ChevronRightIcon, HomeIcon,
} from '@heroicons/react/24/outline';
import projectDocumentApi from '../../../api/projectDocumentApi';
import { getErrorMessage } from '../../../utils/helpers';
import { getFileMeta, humanFileSize } from '../../../utils/fileMeta';
import { openAuthedFile } from '../../../utils/authedFile';
import AuthedImage from '../../../components/AuthedImage';
import './ProjectDocumentsModal.css';

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—');

const DOC_TYPES = ['Brochure', 'Approval', 'Legal', 'Layout Plan', 'RERA', 'Agreement', 'Other'];

// Server limits — mirror of middleware/upload.js (uploadDocumentsAuto). Checked
// client-side only so the user hears "too big" immediately rather than after a
// long upload ends in a 413.
const MAX_FILES = 10;
const MAX_FILE_MB = 25;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const fmtBytes = (b) => humanFileSize(b);

// Upload / list / delete for a single project's document archive, organised as a
// folder tree. Navigation is one level at a time with a breadcrumb back to the
// root — the same model as a file explorer — so nesting can go as deep as needed
// without the UI having to hold the whole tree in memory.
// Shared by the per-project ProjectDocumentsModal, the Super Admin Document
// Management screen and the Record Manager portal (which renders the same screen).
const ProjectDocumentsPanel = ({ project }) => {
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [folderId, setFolderId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Multi-file: the server takes up to 10 files of ANY type per request
  // (middleware/upload.js → uploadDocumentsAuto, allowedTypes '*'), so the panel
  // stages a list rather than a single file.
  const [files, setFiles] = useState([]);
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState(DOC_TYPES[0]);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef(null);

  const load = useCallback(async (targetFolderId = null) => {
    setLoading(true);
    try {
      const resp = await projectDocumentApi.list(project.id, targetFolderId);
      const payload = resp.data?.data || resp.data || {};
      setDocuments(payload.documents || []);
      setFolders(payload.folders || []);
      setBreadcrumb(payload.breadcrumb || []);
      setFolderId(payload.folderId ?? targetFolderId ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load project documents'));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  // Reset to the root whenever the selected project changes.
  useEffect(() => { load(null); }, [load]);

  const openFolder = (id) => { load(id); };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) { toast.error('Enter a folder name'); return; }
    setCreatingFolder(true);
    try {
      await projectDocumentApi.createFolder(project.id, { folderName: name, parentId: folderId });
      toast.success('Folder created');
      setNewFolderName('');
      load(folderId);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create folder'));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleRenameFolder = async (folder) => {
    // eslint-disable-next-line no-alert
    const name = window.prompt('Rename folder', folder.folder_name);
    if (name === null) return;
    if (!name.trim()) { toast.error('Folder name cannot be empty'); return; }
    try {
      await projectDocumentApi.renameFolder(project.id, folder.id, name.trim());
      toast.success('Folder renamed');
      load(folderId);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to rename folder'));
    }
  };

  const handleDeleteFolder = async (folder) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete the folder "${folder.folder_name}"?`)) return;
    try {
      await projectDocumentApi.removeFolder(project.id, folder.id);
      toast.success('Folder deleted');
      load(folderId);
    } catch (err) {
      // The server refuses to delete a non-empty folder and says what is inside.
      toast.error(getErrorMessage(err, 'Failed to delete folder'));
    }
  };

  // Add to the staged list rather than replacing it, so the user can pick from
  // several folders in turn. Oversized files are rejected here with a reason
  // instead of failing the whole request with a 413 after a long upload.
  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const tooBig = incoming.filter((f) => f.size > MAX_FILE_BYTES);
    const ok = incoming.filter((f) => f.size <= MAX_FILE_BYTES);
    setFiles((prev) => {
      const room = Math.max(0, MAX_FILES - prev.length);
      if (ok.length > room) {
        toast.error(`Only ${MAX_FILES} files can be uploaded at once.`);
      }
      return [...prev, ...ok.slice(0, room)];
    });
    tooBig.forEach((f) => toast.error(`"${f.name}" is larger than ${MAX_FILE_MB} MB.`));
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (files.length === 0) { toast.error('Choose at least one file to upload'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('documents', f));
      formData.append('document_type', documentType);
      // A typed name only makes sense for a single file — with several, each
      // keeps its own file name (the server applies the same rule).
      if (files.length === 1 && documentName.trim()) formData.append('document_name', documentName.trim());
      // Land the files in the folder currently being browsed.
      if (folderId) formData.append('folder_id', folderId);
      await projectDocumentApi.upload(project.id, formData);
      toast.success(files.length === 1 ? 'Document uploaded' : `${files.length} documents uploaded`);
      setFiles([]);
      setDocumentName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      load(folderId);
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

  const currentFolderName = breadcrumb.length ? breadcrumb[breadcrumb.length - 1].folder_name : null;

  return (
    <div className="proj-docs__body">
      {/* Breadcrumb — root is always reachable in one click */}
      <nav className="proj-docs__crumbs" aria-label="Folder path">
        <button
          type="button"
          className={`proj-docs__crumb${folderId ? '' : ' is-current'}`}
          onClick={() => openFolder(null)}
          disabled={!folderId}
        >
          <HomeIcon className="proj-docs__crumb-icon" /> All Documents
        </button>
        {breadcrumb.map((crumb, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <React.Fragment key={crumb.id}>
              <ChevronRightIcon className="proj-docs__crumb-sep" />
              <button
                type="button"
                className={`proj-docs__crumb${isLast ? ' is-current' : ''}`}
                onClick={() => !isLast && openFolder(crumb.id)}
                disabled={isLast}
              >
                {crumb.folder_name}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Create a folder at the level currently being browsed */}
      <div className="proj-docs__folder-create">
        <FolderPlusIcon className="master-action-icon" />
        <input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
          placeholder={currentFolderName ? `New folder inside "${currentFolderName}"…` : 'New folder name…'}
          maxLength={200}
        />
        <button
          type="button"
          className="proj-docs__upload-btn"
          disabled={creatingFolder || !newFolderName.trim()}
          onClick={handleCreateFolder}
        >
          {creatingFolder ? 'Creating…' : 'Create Folder'}
        </button>
      </div>

      {/* Upload one document at a time — into the current folder */}
      <div className="proj-docs__upload">
        <div className="proj-docs__upload-row">
          <div className="proj-docs__field">
            <label>Document Name <span className="proj-docs__muted">(optional, single file only)</span></label>
            <input
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              disabled={files.length > 1}
              placeholder={files.length > 1 ? 'Each file keeps its own name' : 'Defaults to the file name'}
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
          {/* No `accept` on purpose — every format is allowed. */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="proj-docs__file"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
          <button
            type="button"
            className="proj-docs__upload-btn"
            disabled={uploading || files.length === 0}
            onClick={handleUpload}
          >
            <CloudArrowUpIcon className="master-action-icon" />
            {uploading
              ? 'Uploading…'
              : `Upload${files.length ? ` ${files.length} file${files.length === 1 ? '' : 's'}` : ''}${currentFolderName ? ` to ${currentFolderName}` : ''}`}
          </button>
        </div>

        <div className="proj-docs__upload-hint">
          PDF, Word, Excel, images, ZIP — any file type. Up to {MAX_FILES} files, {MAX_FILE_MB} MB each.
        </div>

        {/* Staged files, removable before upload */}
        {files.length > 0 && (
          <div className="proj-docs__staged">
            {files.map((f, idx) => (
              <div key={`${f.name}-${idx}`} className="proj-docs__staged-chip">
                <DocumentTextIcon className="proj-docs__staged-icon" />
                <span className="proj-docs__staged-name" title={f.name}>{f.name}</span>
                <span className="proj-docs__staged-size">{fmtBytes(f.size)}</span>
                <button
                  type="button"
                  className="proj-docs__staged-remove"
                  onClick={() => removeFile(idx)}
                  aria-label={`Remove ${f.name}`}
                >
                  <XMarkIcon className="proj-docs__staged-x" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Folders at this level */}
      {folders.length > 0 && (
        <>
          <div className="proj-docs__list-title">Folders ({folders.length})</div>
          <div className="proj-docs__list">
            {folders.map((folder) => (
              <div key={folder.id} className="proj-docs__row proj-docs__row--folder">
                <button
                  type="button"
                  className="proj-docs__folder-open"
                  onClick={() => openFolder(folder.id)}
                  title={`Open ${folder.folder_name}`}
                >
                  <div className="proj-docs__thumb"><FolderIcon className="proj-docs__folder-icon" /></div>
                  <div className="proj-docs__row-main">
                    <div className="proj-docs__row-name">{folder.folder_name}</div>
                    <div className="proj-docs__row-meta">
                      <span>{folder.subfolder_count || 0} folder{folder.subfolder_count === 1 ? '' : 's'}</span>
                      <span>{folder.document_count || 0} document{folder.document_count === 1 ? '' : 's'}</span>
                      <span>{fmtDateTime(folder.created_at)}</span>
                    </div>
                  </div>
                </button>
                <button type="button" className="proj-docs__icon-btn" title="Rename" onClick={() => handleRenameFolder(folder)}>
                  <PencilSquareIcon className="master-action-icon" />
                </button>
                <button type="button" className="proj-docs__icon-btn danger" title="Delete" onClick={() => handleDeleteFolder(folder)}>
                  <TrashIcon className="master-action-icon" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Documents at this level */}
      <div className="proj-docs__list-title">Documents ({documents.length})</div>
      {loading ? (
        <div className="proj-docs__empty">Loading…</div>
      ) : documents.length === 0 ? (
        <div className="proj-docs__empty">
          {folders.length > 0
            ? 'No documents directly in this folder — open a folder above.'
            : `No documents ${currentFolderName ? `in "${currentFolderName}"` : 'for this project'} yet.`}
        </div>
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
                    ? <AuthedImage src={href} alt={doc.document_name} />
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
                  <a
                    className="proj-docs__icon-btn"
                    href={href}
                    onClick={(e) => { e.preventDefault(); openAuthedFile(href).catch(() => toast.error('Could not open the document')); }}
                    title="View / download"
                    style={{ cursor: 'pointer' }}
                  >
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
