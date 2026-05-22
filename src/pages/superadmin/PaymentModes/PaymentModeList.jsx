import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const PaymentModeList = () => <MasterCrudPage config={masterConfigs.paymentModes} />;

export default PaymentModeList;
