import React, { useState } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';
import '../common/LeadWorkspacePage.css';

const ROLE_LABELS = { TC: 'Telecaller', SM: 'Sales Manager', SH: 'Sales Head', COL: 'Collection' };

const SalesManagerPullLead = ({ user }) => {
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [pullNote, setPullNote] = useState('');
  const [sending, setSending] = useState({});

  const handleSearch = async () => {
    if (!phone || phone.length < 7) { toast.error('Enter at least 7 digits'); return; }
    setSearching(true);
    setSearched(true);
    try {
      const resp = await leadWorkflowApi.searchLeadByPhone(phone);
      setResults(resp.data || []);
      if (!resp.data?.length) toast('No leads found for this number', { icon: '🔍' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Search failed'));
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePullRequest = async (lead) => {
    if (lead.assignedToId === user?.id) { toast.error('This lead is already assigned to you'); return; }
    setSending((p) => ({ ...p, [lead.id]: true }));
    try {
      await leadWorkflowApi.createPullRequest(lead.id, pullNote || `Pull request from SM for ${lead.fullName}`);
      toast.success(`Pull request sent to ${lead.assignedToName}`);
      setPullNote('');
      // Mark this lead as requested in the UI
      setResults((prev) => prev.map((r) => r.id === lead.id ? { ...r, _requested: true } : r));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send pull request'));
    } finally {
      setSending((p) => ({ ...p, [lead.id]: false }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>🔍 Pull Lead</h1>
          <p>Search by customer phone number to request a lead from a Telecaller</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="crm-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="crm-form-label">Customer Phone Number</label>
            <input
              className="crm-form-input"
              type="tel"
              placeholder="Enter phone number..."
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ fontSize: 16 }}
            />
          </div>
          <button
            className="crm-btn crm-btn-primary"
            onClick={handleSearch}
            disabled={searching || phone.length < 7}
            style={{ height: 42, padding: '0 24px' }}
          >
            {searching ? '⏳ Searching...' : '🔍 Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="crm-card">
          {results.length === 0 && !searching && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No leads found</div>
              <div className="empty-desc">No leads match this phone number. The customer may be a new lead.</div>
            </div>
          )}

          {results.length > 0 && (
            <>
              <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                Found {results.length} lead{results.length > 1 ? 's' : ''}
              </h3>
              {results.map((lead) => (
                <div key={lead.id} className="pull-request-card" style={{
                  border: '1px solid var(--border-primary)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 12,
                  background: 'var(--bg-card)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{lead.fullName}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                        📞 {lead.phone} {lead.email ? `· ✉️ ${lead.email}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <span className="crm-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontSize: 11 }}>
                          {lead.leadNumber}
                        </span>
                        <span className="crm-badge" style={{ fontSize: 11 }}>{lead.stageLabel}</span>
                        <span className="crm-badge" style={{ fontSize: 11 }}>{lead.statusLabel}</span>
                        {lead.project && <span className="crm-badge" style={{ fontSize: 11 }}>🏗️ {lead.project}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)' }}>
                        👤 {lead.assignedToName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {ROLE_LABELS[lead.assignedToRole] || lead.assignedToRoleName}
                      </div>
                    </div>
                  </div>

                  {/* Pull Request Action */}
                  {lead._requested ? (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--accent-green-bg)', borderRadius: 8, fontSize: 13, color: 'var(--accent-green)', fontWeight: 600 }}>
                      ✅ Pull request sent
                    </div>
                  ) : lead.assignedToId === user?.id ? (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--accent-blue-bg)', borderRadius: 8, fontSize: 13, color: 'var(--accent-blue)', fontWeight: 600 }}>
                      ℹ️ This lead is already assigned to you
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        className="crm-form-input"
                        placeholder="Add note (optional)..."
                        value={pullNote}
                        onChange={(e) => setPullNote(e.target.value)}
                        style={{ flex: 1, minWidth: 200 }}
                      />
                      <button
                        className="crm-btn crm-btn-primary"
                        onClick={() => handlePullRequest(lead)}
                        disabled={sending[lead.id]}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {sending[lead.id] ? '⏳ Sending...' : '📤 Send Pull Request'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SalesManagerPullLead;
