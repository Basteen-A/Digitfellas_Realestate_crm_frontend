import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const UserList = () => <MasterCrudPage config={masterConfigs.users} />;

export default UserList;
