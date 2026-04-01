import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const LeadTypeList = () => <MasterCrudPage config={masterConfigs.leadTypes} />;

export default LeadTypeList;
