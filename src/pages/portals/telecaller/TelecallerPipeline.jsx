import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';

const TelecallerPipeline = ({ user, onNavigate }) => {
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsResp, configResp] = await Promise.all([
        leadWorkflowApi.getLeads({ roleCode: 'TC', limit: 200 }),
        leadWorkflowApi.getWorkflowConfig(),
      ]);

      // Handle leads data
      let leadRows = [];
      const ld = leadsResp?.data;
      if (ld?.rows) leadRows = ld.rows;
      else if (ld?.data) leadRows = ld.data;
      else if (Array.isArray(ld)) leadRows = ld;
      setLeads(leadRows);

      // Handle stages data
      const allStages = configResp?.data?.stages || [];
      // Filter for specific TC role stages
      const tcWhitelist = ['LEAD', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT'];
      const tcStages = allStages.filter(s => tcWhitelist.includes(s.stage_code));
      setStages(tcStages);

    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load pipeline'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getLeadsByStage = (stageCode) => {
    if (stageCode === 'QUALIFIED') {
      return leads.filter(l => l.stageCode === 'QUALIFIED' && l.statusCode !== 'SV_SCHEDULED');
    }
    if (stageCode === 'SITE_VISIT') {
      return leads.filter(l => l.statusCode === 'SV_SCHEDULED');
    }
    return leads.filter(l => l.stageCode === stageCode);
  };

  return (
    <div className="telecaller-pipeline">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Pipeline Board</h1>
          <p className="hidden sm:block">Track your leads through the sales funnel</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={load}> Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'tc-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading your pipeline...</p>
        </div>
      ) : (
        <div className="kanban" style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 12, minHeight: 'calc(100vh - 220px)' }}>
          {stages.map((stage) => {
            const stageLeads = getLeadsByStage(stage.stage_code);
            const stageDisplayName = stage.stage_code === 'SITE_VISIT' ? 'Site Visit Scheduled' : stage.stage_name;
            return (
              <div className="kanban-col" key={stage.id} style={{ minWidth: 280, maxWidth: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary, #f8fafc)', borderRadius: 12, border: '1px solid var(--border-primary, #e2e8f0)' }}>
                <div className="kanban-col-header" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card, #fff)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                  <div className="kanban-col-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span className="col-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color_code || '#94a3b8' }}></span>
                    {stageDisplayName}
                  </div>
                  <div className="kanban-col-count" style={{ fontSize: 11, fontWeight: 700, background: 'var(--bg-primary, #f1f5f9)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 10 }}>
                    {stageLeads.length}
                  </div>
                </div>

                <div className="kanban-col-body" style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="kanban-card" style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 10, padding: 12, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `3px solid ${stage.color_code || '#94a3b8'}` }}>
                      <div className="kanban-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="kanban-card-name" style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.fullName}</div>
                          <div className="kanban-card-phone" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{lead.phone}</div>
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: (lead.statusColor || '#64748b') + '15', color: lead.statusColor || '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {lead.statusLabel}
                        </span>
                      </div>

                      <div className="kanban-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                        <span className="kanban-card-project" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>📍 {lead.project || 'No Project'}</span>
                        <span className="kanban-card-time" style={{ fontWeight: 600, color: lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date() ? 'var(--accent-red)' : 'inherit' }}>
                          {lead.nextFollowUpAt
                            ? `Upcoming: ${new Date(lead.nextFollowUpAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                            : 'No Follow-up'}
                        </span>
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                        <button
                          className="crm-btn crm-btn-primary crm-btn-sm"
                          style={{ flex: 1, fontSize: 11, padding: '4px 0' }}
                          onClick={() => onNavigate?.('leads')}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                      No leads in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes tc-spin { to { transform: rotate(360deg); } }
        .kanban::-webkit-scrollbar { height: 8px; }
        .kanban::-webkit-scrollbar-track { background: transparent; }
        .kanban::-webkit-scrollbar-thumb { background: var(--border-primary, #e2e8f0); borderRadius: 10px; }
      `}</style>
    </div>
  );
};

export default TelecallerPipeline;
