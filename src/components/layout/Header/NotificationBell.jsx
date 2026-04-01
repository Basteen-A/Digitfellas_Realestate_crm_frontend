import React from 'react';

const NotificationBell = () => {
  return (
    <button type="button" className="header-icon-button" title="Notifications">
      <span aria-hidden="true">🔔</span>
      <span className="header-icon-button__dot" />
    </button>
  );
};

export default NotificationBell;
