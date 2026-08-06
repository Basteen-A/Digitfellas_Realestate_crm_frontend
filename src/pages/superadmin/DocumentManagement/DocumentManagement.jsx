import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { FolderOpenIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import projectApi from '../../../api/projectApi';
import { getErrorMessage } from '../../../utils/helpers';
import ProjectDocumentsPanel from '../Projects/ProjectDocumentsPanel';
import './DocumentManagement.css';

// Super Admin "Document Management" - pick a project on the left, then upload /
// view / delete its documents on the right (one document at a time). Reuses the
// per-project ProjectDocumentsPanel + the /projects/:id/documents backend.
const DocumentManagement = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    try {
      // The list endpoint caps `limit` at 100; the dropdown returns every active
      // project unbounded, which is what a selector needs - prefer it, fall back to getAll.
      let list = [];
      try {
        const dd = await projectApi.getDropdown();
        list = dd?.data || dd?.rows || (Array.isArray(dd) ? dd : []);
      } catch (_) {
        const resp = await projectApi.getAll({ limit: 100, sort: 'project_name' });
        list = resp?.data || resp?.rows || [];
      }
      setProjects(Array.isArray(list) ? list : []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load projects'));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const selected = useMemo(
    () => projects.find((p) => String(p.id) === String(selectedId)) || null,
    [projects, selectedId],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return projects;
    const q = query.toLowerCase();
    return projects.filter((p) => `${p.project_name || ''} ${p.project_code || ''}`.toLowerCase().includes(q));
  }, [projects, query]);

  return (
    <div className="doc-mgmt">
      <header className="doc-mgmt__header">
        <div>
          <h1>Document Management</h1>
          <p>Upload and manage documents for each project - one document at a time.</p>
        </div>
        <button type="button" className="doc-mgmt__refresh" onClick={loadProjects} disabled={loading}>
          <ArrowPathIcon className="doc-mgmt__icon" /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="doc-mgmt__layout">
        <aside className="doc-mgmt__projects">
          <div className="doc-mgmt__search">
            <MagnifyingGlassIcon className="doc-mgmt__icon" />
            <input
              type="text"
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="doc-mgmt__project-list">
            {loading ? (
              <div className="doc-mgmt__empty">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="doc-mgmt__empty">No projects found</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`doc-mgmt__project${String(p.id) === String(selectedId) ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <FolderOpenIcon className="doc-mgmt__project-icon" />
                  <span className="doc-mgmt__project-name">{p.project_name}</span>
                  {p.project_code ? <span className="doc-mgmt__project-code">{p.project_code}</span> : null}
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="doc-mgmt__panel-wrap">
          {selected ? (
            <>
              <div className="doc-mgmt__panel-title">Documents · {selected.project_name}</div>
              <ProjectDocumentsPanel project={selected} />
            </>
          ) : (
            <div className="doc-mgmt__placeholder">
              <FolderOpenIcon className="doc-mgmt__placeholder-icon" />
              <p>Select a project on the left to upload and view its documents.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DocumentManagement;
