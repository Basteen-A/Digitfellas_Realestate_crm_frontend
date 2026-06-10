import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const PaymentStatusList = () => <MasterCrudPage config={masterConfigs.paymentStatuses} />;

export default PaymentStatusList;
