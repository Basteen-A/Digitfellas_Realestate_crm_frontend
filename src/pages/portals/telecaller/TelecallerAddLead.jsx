import React from 'react';

const TelecallerAddLead = ({ user, onNavigate }) => {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Add New Lead</h1>
          <p>Enter buyer details to create a new lead</p>
        </div>
      </div>
      <div className="crm-card" style={{ maxWidth: 720 }}>
        <div className="crm-card-body">
          <div className="crm-grid crm-grid-2">
            <div className="crm-form-group"><label className="crm-form-label">Full Name *</label><input className="crm-form-input" placeholder="Enter buyer name" /></div>
            <div className="crm-form-group"><label className="crm-form-label">Phone Number *</label><input className="crm-form-input" placeholder="+91 XXXXX XXXXX" /></div>
            <div className="crm-form-group"><label className="crm-form-label">Email</label><input className="crm-form-input" placeholder="buyer@email.com" /></div>
            <div className="crm-form-group">
              <label className="crm-form-label">Source</label>
              <select className="crm-form-select">
                <option>Select source</option>
                <option>99acres</option><option>Facebook</option><option>Google Ads</option>
                <option>Walk-in</option><option>Referral</option><option>MagicBricks</option><option>Website</option>
              </select>
            </div>
            <div className="crm-form-group">
              <label className="crm-form-label">Project</label>
              <select className="crm-form-select">
                <option>Select project</option>
              </select>
            </div>
            <div className="crm-form-group">
              <label className="crm-form-label">Configuration</label>
              <select className="crm-form-select">
                <option>Select</option>
                <option>1 BHK</option><option>2 BHK</option><option>3 BHK</option>
                <option>Plot</option><option>Villa</option>
              </select>
            </div>
            <div className="crm-form-group"><label className="crm-form-label">Budget Min (₹)</label><input className="crm-form-input" placeholder="e.g. 40,00,000" /></div>
            <div className="crm-form-group"><label className="crm-form-label">Budget Max (₹)</label><input className="crm-form-input" placeholder="e.g. 60,00,000" /></div>
          </div>
          <div className="crm-form-group"><label className="crm-form-label">Notes</label><textarea className="crm-form-input" placeholder="Initial notes about the lead..."></textarea></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button className="crm-btn crm-btn-ghost" onClick={() => onNavigate?.('leads')}>Cancel</button>
            <button className="crm-btn crm-btn-primary">💾 Save Lead</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelecallerAddLead;
