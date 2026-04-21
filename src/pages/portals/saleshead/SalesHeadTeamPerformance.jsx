import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';

const SalesHeadTeamPerformance = () => {
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState([]);

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      const resp = await leadWorkflowApi.getMySMTeam();
      setTeamData(resp.data || []);
    } catch (err) {
      toast.error('Failed to load team performance');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading team performance...
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Team Performance</h1>
          <p className="hidden sm:block">SMs who have shared leads with you</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={loadTeamData}>Refresh</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="crm-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Total SMs</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-blue)' }}>{teamData.length}</div>
        </div>
        <div className="crm-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Active Leads</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed' }}>{teamData.reduce((sum, sm) => sum + sm.activeLeads, 0)}</div>
        </div>
        <div className="crm-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Visits Done</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-green)' }}>{teamData.reduce((sum, sm) => sum + sm.completedVisits, 0)}</div>
        </div>
        <div className="crm-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Upcoming Visits</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706' }}>{teamData.reduce((sum, sm) => sum + sm.upcomingVisits, 0)}</div>
        </div>
      </div>

      {/* Team Performance Table */}
      <div className="crm-card">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', fontWeight: 700, fontSize: 14 }}>
          SM Performance (Shared Leads)
        </div>
        {teamData.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>No SMs found</div>
            <div>No Sales Managers have shared leads with you yet</div>
          </div>
        ) : (
          <div className="crm-card-body-flush">
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Sales Manager</th>
                    <th>Email</th>
                    <th style={{ textAlign: 'right' }}>Active Leads</th>
                    <th style={{ textAlign: 'right' }}>Total Leads</th>
                    <th style={{ textAlign: 'right' }}>Visits Done</th>
                    <th style={{ textAlign: 'right' }}>Upcoming</th>
                  </tr>
                </thead>
                <tbody>
                  {teamData.map((sm) => (
                    <tr key={sm.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{sm.fullName}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sm.email}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#7c3aed' }}>{sm.activeLeads}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{sm.totalLeads}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent-green)' }}>{sm.completedVisits}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{sm.upcomingVisits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default SalesHeadTeamPerformance;
