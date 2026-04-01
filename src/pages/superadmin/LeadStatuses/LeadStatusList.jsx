import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const LeadStatusList = () => <MasterCrudPage config={masterConfigs.leadStatuses} />;

export default LeadStatusList;
