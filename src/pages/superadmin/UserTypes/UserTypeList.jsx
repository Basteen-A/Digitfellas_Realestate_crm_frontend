import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const UserTypeList = () => <MasterCrudPage config={masterConfigs.userTypes} />;

export default UserTypeList;
