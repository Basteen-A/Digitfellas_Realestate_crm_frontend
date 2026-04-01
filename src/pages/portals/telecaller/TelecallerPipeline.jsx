import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';

const TelecallerPipeline = ({ user }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await leadWorkflowApi.getLeads({ roleCode: 'TC', limit: 100 });
      setLeads(resp.data?.rows || resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load pipeline'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stages = [
    { code: 'NEW', label: 'New', color: '#94a3b8' },
    { code: 'CONTACTED', label: 'Contacted', color: 'var(--accent-blue)' },
    { code: 'FOLLOW_UP', label: 'Follow Up', color: '#6366f1' },
    { code: 'SV_SCHEDULED', label: 'SV Scheduled', color: 'var(--accent-yellow)' },
    { code: 'SV_COMPLETED', label: 'SV Completed', color: 'var(--accent-green)' },
  ];

  const getLeadsByStage = (code) => leads.filter(l => l.stageCode === code);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Pipeline Board</h1>
          <p>Drag leads between stages</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading pipeline...</div>
      ) : (
        <div className="kanban">
          {stages.map((stage) => {
            const stageLeads = getLeadsByStage(stage.code);
            return (
              <div className="kanban-col" key={stage.code}>
                <div className="kanban-col-header">
                  <div className="kanban-col-title">
                    <span className="col-dot" style={{ background: stage.color }}></span>
                    {stage.label}
                  </div>
                  <div className="kanban-col-count">{stageLeads.length}</div>
                </div>
                <div className="kanban-col-body">
                  {stageLeads.map((lead) => (
                    <div className="kanban-card" key={lead.id} style={lead.stageCode === 'SV_COMPLETED' ? { borderLeft: '3px solid var(--accent-green)' } : lead.stageCode === 'SV_SCHEDULED' ? { borderLeft: '3px solid var(--accent-yellow)' } : {}}>
                      <div className="kanban-card-header">
                        <div>
                          <div className="kanban-card-name">{lead.fullName}</div>
                          <div className="kanban-card-phone">{lead.phone}</div>
                        </div>
                        <span className={`crm-badge badge-${(lead.statusLabel || 'open').toLowerCase().replace(/\s/g, '')}`}>
                          {lead.statusLabel || 'Open'}
                        </span>
                      </div>
                      <div className="kanban-card-footer">
                        <span className="kanban-card-project">{lead.project || 'N/A'}</span>
                        <span className="kanban-card-time">
                          {lead.nextFollowUpAt
                            ? new Date(lead.nextFollowUpAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                            : '—'}
                        </span>
                      </div>
                      {lead.stageCode === 'SV_COMPLETED' && (
                        <div style={{ marginTop: 10 }}>
                          <button className="crm-btn crm-btn-primary crm-btn-sm" style={{ width: '100%' }}>⚡ Handoff to Sales Manager</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>No leads</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TelecallerPipeline;
