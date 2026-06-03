import React from 'react';
import MasterCrudPage from '../superadmin/common/MasterCrudPage';
import { masterConfigs } from '../superadmin/common/masterConfigs';

const Departments = () => <MasterCrudPage config={masterConfigs.departments} />;

export default Departments;
