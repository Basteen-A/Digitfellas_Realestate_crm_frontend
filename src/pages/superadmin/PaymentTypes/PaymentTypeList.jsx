import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const PaymentTypeList = () => <MasterCrudPage config={masterConfigs.paymentTypes} />;

export default PaymentTypeList;
