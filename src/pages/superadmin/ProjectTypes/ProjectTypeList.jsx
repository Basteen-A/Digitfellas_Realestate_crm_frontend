import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const ProjectTypeList = () => <MasterCrudPage config={masterConfigs.projectTypes} />;

export default ProjectTypeList;
