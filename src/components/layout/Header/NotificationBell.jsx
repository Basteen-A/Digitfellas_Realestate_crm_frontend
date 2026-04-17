import React from 'react';
import { BellIcon } from '@heroicons/react/24/outline';

const NotificationBell = () => {
  return (
    <button type="button" className="header-icon-button" title="Notifications">
      <span aria-hidden="true"><BellIcon style={{ width: 20, height: 20 }} /></span>
      <span className="header-icon-button__dot" />
    </button>
  );
};

export default NotificationBell;
