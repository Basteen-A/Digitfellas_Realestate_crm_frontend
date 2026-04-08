import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';

const ELIGIBLE_STAGE_CODES = ['VISIT', 'REVISIT'];

const SalesManagerPushLeads = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [salesHeads, setSalesHeads] = useState([]);
  const [assigneeByLead, setAssigneeByLead] = useState({});
  const [noteByLead, setNoteByLead] = useState({});
  const [pushingByLead, setPushingByLead] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadResp, shResp] = await Promise.all([
        leadWorkflowApi.getLeads({ roleCode: 'SM', includeClosed: false, limit: 200 }),
        leadWorkflowApi.getAssignableUsers('SH'),
      ]);

      const leadRows = Array.isArray(leadResp?.data) ? leadResp.data : [];
      const eligibleLeads = leadRows.filter((lead) => ELIGIBLE_STAGE_CODES.includes(lead.stageCode));
      const headRows = Array.isArray(shResp?.data) ? shResp.data : [];

      setLeads(eligibleLeads);
      setSalesHeads(headRows);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load leads for push'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canPush = useMemo(() => salesHeads.length > 0, [salesHeads]);

  const handlePush = async (lead) => {
    const assignToUserId = assigneeByLead[lead.id];
    if (!assignToUserId) {
      toast.error('Please select a Sales Head');
      return;
    }

    setPushingByLead((prev) => ({ ...prev, [lead.id]: true }));
    try {
      await leadWorkflowApi.transitionLead(lead.id, 'SM_POSITIVE_VISIT', {
        assignToUserId,
        note: noteByLead[lead.id]?.trim() || 'Lead pushed to Sales Head after positive visit',
      });

      toast.success('Lead pushed to Sales Head');
      setLeads((prev) => prev.filter((row) => row.id !== lead.id));
      setNoteByLead((prev) => ({ ...prev, [lead.id]: '' }));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to push lead'));
    } finally {
      setPushingByLead((prev) => ({ ...prev, [lead.id]: false }));
    }
  };

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Push to Sales Head</h1>
          <p className="hidden sm:block">Move positive visit leads to negotiation with Sales Head</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!canPush && !loading && (
        <div className="crm-card" style={{ marginBottom: 16 }}>
          <div className="empty-state" style={{ padding: '24px 20px' }}>
            <div className="empty-icon">⚠️</div>
            <div className="empty-title">No Sales Head available</div>
            <div className="empty-desc">Please ask admin to create and activate Sales Head users.</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="crm-card" style={{ textAlign: 'center', padding: 60 }}>Loading push-ready leads...</div>
      ) : leads.length === 0 ? (
        <div className="crm-card">
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div className="empty-icon">🚀</div>
            <div className="empty-title">No leads ready to push</div>
            <div className="empty-desc">Leads in VISIT or REVISIT stage will appear here.</div>
            <button className="crm-btn crm-btn-primary" style={{ marginTop: 16 }} onClick={() => onNavigate?.('leads')}>Open My Leads</button>
          </div>
        </div>
      ) : (
        <div className="crm-card">
          <div className="crm-card-body-flush" style={{ padding: 16 }}>
            {leads.map((lead) => (
              <div
                key={lead.id}
                style={{
                  border: '1px solid var(--border-primary)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 12,
                  background: 'var(--bg-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{lead.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {lead.leadNumber} · {lead.phone}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <span className="crm-badge" style={{ fontSize: 11 }}>{lead.stageLabel}</span>
                      <span className="crm-badge" style={{ fontSize: 11 }}>{lead.statusLabel}</span>
                      {lead.project && <span className="crm-badge" style={{ fontSize: 11 }}>🏗️ {lead.project}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 10, marginTop: 14 }}>
                  <select
                    className="crm-form-select"
                    value={assigneeByLead[lead.id] || ''}
                    onChange={(e) => setAssigneeByLead((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                    disabled={!canPush || pushingByLead[lead.id]}
                  >
                    <option value="">Select Sales Head</option>
                    {salesHeads.map((sh) => (
                      <option key={sh.id} value={sh.id}>{sh.fullName}</option>
                    ))}
                  </select>
                  <input
                    className="crm-form-input"
                    placeholder="Push note (optional)"
                    value={noteByLead[lead.id] || ''}
                    onChange={(e) => setNoteByLead((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                    disabled={pushingByLead[lead.id]}
                  />
                  <button
                    className="crm-btn crm-btn-primary"
                    onClick={() => handlePush(lead)}
                    disabled={!canPush || pushingByLead[lead.id]}
                  >
                    {pushingByLead[lead.id] ? 'Pushing...' : 'Push'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesManagerPushLeads;
