import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const CustomerTypeList = () => <MasterCrudPage config={masterConfigs.customerTypes} />;

export default CustomerTypeList;
