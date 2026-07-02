import React, { useState, useMemo } from 'react';
import { FolderOpenIcon } from '@heroicons/react/24/outline';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';
import ProjectDocumentsModal from './ProjectDocumentsModal';

const ProjectList = () => {
  const [docProject, setDocProject] = useState(null);

  // Add a per-row "Documents" action to the standard master CRUD table so the
  // Super Admin can manage each project's document archive.
  const config = useMemo(() => ({
    ...masterConfigs.projects,
    rowActions: [
      { key: 'documents', title: 'Documents', icon: FolderOpenIcon, onClick: (row) => setDocProject(row) },
    ],
  }), []);

  return (
    <>
      <MasterCrudPage config={config} />
      {docProject && (
        <ProjectDocumentsModal project={docProject} onClose={() => setDocProject(null)} />
      )}
    </>
  );
};

export default ProjectList;
