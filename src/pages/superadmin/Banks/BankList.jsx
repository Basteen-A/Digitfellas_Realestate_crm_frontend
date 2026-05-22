import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const BankList = () => <MasterCrudPage config={masterConfigs.banks} />;

export default BankList;
