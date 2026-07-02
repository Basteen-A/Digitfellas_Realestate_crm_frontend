import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ProjectDocumentsPanel from './ProjectDocumentsPanel';
import './ProjectDocumentsModal.css';

// Per-project document manager, opened as a modal from the Projects list.
// The upload/list/delete UI lives in the shared ProjectDocumentsPanel, which the
// standalone Document Management screen reuses too.
const ProjectDocumentsModal = ({ project, onClose }) => (
  <div className="master-modal" role="dialog" aria-modal="true">
    <div className="master-modal__panel proj-docs__panel">
      <header className="master-modal__header">
        <h2>Documents · {project.project_name}</h2>
        <button type="button" onClick={onClose} aria-label="Close">
          <XMarkIcon className="master-action-icon" />
        </button>
      </header>

      <ProjectDocumentsPanel project={project} />
    </div>
  </div>
);

export default ProjectDocumentsModal;
