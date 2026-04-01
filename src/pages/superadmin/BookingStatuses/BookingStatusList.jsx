import React from 'react';
import MasterCrudPage from '../common/MasterCrudPage';
import { masterConfigs } from '../common/masterConfigs';

const BookingStatusList = () => <MasterCrudPage config={masterConfigs.bookingStatuses} />;

export default BookingStatusList;
