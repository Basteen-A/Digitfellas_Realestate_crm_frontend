import React from 'react';

const SalesManagerIncoming = ({ user, onNavigate }) => {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Incoming Leads</h1>
          <p>Leads handed off from telecallers after site visit completion</p>
        </div>
      </div>

      <div className="approval-card" style={{ borderLeft: '4px solid var(--accent-yellow)' }}>
        <div className="approval-header">
          <div>
            <div className="approval-title">Awaiting Acceptance</div>
            <div className="approval-sub">From Telecaller · SV Completed recently</div>
          </div>
          <span className="crm-badge badge-interested">Interested</span>
        </div>
        <div className="approval-grid">
          <div><div className="approval-field-label">Project</div><div className="approval-field-value">—</div></div>
          <div><div className="approval-field-label">Configuration</div><div className="approval-field-value">—</div></div>
          <div><div className="approval-field-label">Budget</div><div className="approval-field-value">—</div></div>
          <div><div className="approval-field-label">SV Feedback</div><div className="approval-field-value">Awaiting details</div></div>
        </div>
        <div className="approval-actions">
          <button className="crm-btn crm-btn-ghost crm-btn-sm">Reject</button>
          <button className="crm-btn crm-btn-success crm-btn-sm">✓ Accept Lead</button>
        </div>
      </div>

      <div className="crm-card">
        <div className="empty-state">
          <div className="empty-icon">⚡</div>
          <div className="empty-title">Incoming leads will appear here</div>
          <div className="empty-desc">When telecallers complete site visits and hand off leads, you'll see them in this queue.</div>
        </div>
      </div>
    </div>
  );
};

export default SalesManagerIncoming;
