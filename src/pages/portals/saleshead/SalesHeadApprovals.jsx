import React from 'react';

const SalesHeadApprovals = ({ user }) => {
  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center gap-3">
        <div className="page-header-left">
          <h1>Pending Approvals</h1>
          <p className="hidden sm:block">Discount requests and escalations awaiting your approval</p>
        </div>
      </div>

      <div className="approval-card" style={{ borderLeft: '4px solid var(--accent-yellow)' }}>
        <div className="approval-header">
          <div>
            <div className="approval-title">Discount Request — Sample Lead</div>
            <div className="approval-sub">Submitted by Sales Manager · Pending for review</div>
          </div>
          <span className="crm-badge badge-hot">🔥 Urgent</span>
        </div>
        <div className="approval-grid">
          <div><div className="approval-field-label">Project</div><div className="approval-field-value">—</div></div>
          <div><div className="approval-field-label">Unit</div><div className="approval-field-value">—</div></div>
          <div><div className="approval-field-label">Base Price</div><div className="approval-field-value">—</div></div>
          <div><div className="approval-field-label">Requested Discount</div><div className="approval-field-value text-danger">—</div></div>
          <div><div className="approval-field-label">Buyer</div><div className="approval-field-value">—</div></div>
          <div><div className="approval-field-label">Submitted</div><div className="approval-field-value">Today</div></div>
        </div>
        <div className="approval-actions">
          <button className="crm-btn crm-btn-ghost crm-btn-sm">Add Conditions</button>
          <button className="crm-btn crm-btn-danger crm-btn-sm">✗ Reject</button>
          <button className="crm-btn crm-btn-success crm-btn-sm">✓ Approve</button>
        </div>
      </div>

      <div className="crm-card">
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-title">Approval requests will appear here</div>
          <div className="empty-desc">When team members submit discount requests or escalations, they'll show up for your review.</div>
        </div>
      </div>
    </div>
  );
};

export default SalesHeadApprovals;
