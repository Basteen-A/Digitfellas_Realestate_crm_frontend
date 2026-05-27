import React from 'react';
import { BellIcon } from '@heroicons/react/24/outline';

const NotificationBell = ({ unreadCount = 0 }) => {
  const hasUnread = unreadCount > 0;
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <button type="button" className="header-icon-button" title="Notifications">
      <span aria-hidden="true"><BellIcon style={{ width: 20, height: 20 }} /></span>
      {hasUnread && <span className="header-icon-button__badge">{badgeLabel}</span>}
    </button>
  );
};

export default NotificationBell;
