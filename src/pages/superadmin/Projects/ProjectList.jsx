import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const ProjectList = () => <MasterCrudPage config={masterConfigs.projects} />;

export default ProjectList;
