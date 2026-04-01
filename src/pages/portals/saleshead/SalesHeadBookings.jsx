import React from 'react';

const SalesHeadBookings = ({ user }) => {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Bookings</h1>
          <p>Manage all confirmed property bookings</p>
        </div>
        <div className="page-header-actions">
          <div className="filter-tabs">
            <button className="filter-tab active">All</button>
            <button className="filter-tab">Active</button>
            <button className="filter-tab">Completed</button>
            <button className="filter-tab">Cancelled</button>
          </div>
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body-flush">
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Project · Unit</th>
                  <th>Booking Value</th>
                  <th>Payment Status</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    No bookings recorded yet. Bookings will appear here when leads are moved to "Closed Won."
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesHeadBookings;
