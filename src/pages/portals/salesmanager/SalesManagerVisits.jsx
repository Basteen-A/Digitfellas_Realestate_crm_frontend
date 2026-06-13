import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import siteVisitApi from '../../../api/siteVisitApi';
import { getErrorMessage } from '../../../utils/helpers';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';

const SalesManagerVisits = ({ onNavigate }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming'); // upcoming, completed, cancelled, all
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [completingVisit, setCompletingVisit] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({
    feedback: '',
    rating: 5,
    interested_after_visit: true,
    remarks: '',
    time_spent: '',
    requirement_details: '',
    remarks_long: '',
  });

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await siteVisitApi.getAll({ my: 'true', limit: 100 });
      const data = resp.data?.data || resp.data?.rows || resp.data || [];
      setVisits(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load visits'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!completingVisit) return;
    try {
      await siteVisitApi.complete(completingVisit.id, {
        ...feedbackForm,
        rating: Number(feedbackForm.rating),
        time_spent: feedbackForm.time_spent ? Number(feedbackForm.time_spent) : null,
      });
      toast.success('Site visit marked as completed');
      setCompletingVisit(null);
      loadVisits();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete visit'));
    }
  };

  const handleCancel = async (visitId) => {
    if (!window.confirm('Are you sure you want to cancel this visit?')) return;
    try {
      await siteVisitApi.cancel(visitId, { cancel_reason: 'Cancelled by Sales Manager' });
      toast.success('Visit cancelled');
      loadVisits();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel visit'));
    }
  };

  // Extract unique projects for dropdown filter
  const uniqueProjects = Array.from(
    new Map(
      visits
        .map(v => v.project)
        .filter(Boolean)
        .map(p => [p.id, p])
    ).values()
  );

  const filteredVisits = visits.filter(v => {
    // Status Filter
    let statusMatch = true;
    if (filter === 'upcoming') statusMatch = ['Scheduled', 'Confirmed', 'Rescheduled'].includes(v.status);
    else if (filter === 'completed') statusMatch = v.status === 'Completed';
    else if (filter === 'cancelled') statusMatch = v.status === 'Cancelled';

    // Project Filter
    const projectMatch = selectedProjectId ? String(v.project?.id || v.project_id) === String(selectedProjectId) : true;

    return statusMatch && projectMatch;
  });

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filteredVisits, 25);

  return (
    <div className="visits-page">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1> Site Visits</h1>
          <p className="hidden sm:block">Track your appointments and buyer feedback</p>
        </div>
        <div className="page-header-actions flex-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="crm-form-select"
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
              minWidth: 160,
              height: 'fit-content'
            }}
          >
            <option value="">All Projects</option>
            {uniqueProjects.map(p => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </select>

          <div className="crm-btn-group">
            <button className={`crm-btn ${filter === 'upcoming' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
            <button className={`crm-btn ${filter === 'completed' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setFilter('completed')}>Completed</button>
            <button className={`crm-btn ${filter === 'cancelled' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setFilter('cancelled')}>Cancelled</button>
            <button className={`crm-btn ${filter === 'all' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setFilter('all')}>All</button>
          </div>
          <button type="button" className="crm-btn crm-btn-ghost" onClick={loadVisits}><ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh</button>
        </div>
      </div>

      {/* Project-wise visits breakdown cards */}
      {!loading && uniqueProjects.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 16
        }}>
          {uniqueProjects.map(p => {
            const scheduledCount = visits.filter(v => (v.project?.id === p.id || v.project_id === p.id) && ['Scheduled', 'Confirmed', 'Rescheduled'].includes(v.status)).length;
            const completedCount = visits.filter(v => (v.project?.id === p.id || v.project_id === p.id) && v.status === 'Completed').length;
            const cancelledCount = visits.filter(v => (v.project?.id === p.id || v.project_id === p.id) && v.status === 'Cancelled').length;

            return (
              <div 
                key={p.id}
                onClick={() => setSelectedProjectId(selectedProjectId === String(p.id) ? "" : String(p.id))}
                style={{
                  background: selectedProjectId === String(p.id) ? 'var(--accent-blue-bg, #eff6ff)' : 'var(--card-bg, #fff)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  border: selectedProjectId === String(p.id) ? '1.5px solid var(--accent-blue, #3b82f6)' : '1px solid var(--border-light, #e5e7eb)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  🏢 {p.project_name}
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Scheduled: </span>
                    <strong style={{ color: 'var(--accent-blue, #3b82f6)' }}>{scheduledCount}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Completed: </span>
                    <strong style={{ color: '#15803d' }}>{completedCount}</strong>
                  </div>
                  {cancelledCount > 0 && (
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Cancelled: </span>
                      <strong style={{ color: 'var(--accent-red, #dc2626)' }}>{cancelledCount}</strong>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'tc-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading visits...</p>
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="crm-card"><div className="empty-state"><div className="empty-icon">🏠</div><div className="empty-title">No visits found</div><div className="empty-desc">There are no visits in the "{filter}" category.</div></div></div>
      ) : (
        <div className="crm-card">
          <div className="crm-card-body-flush" style={{ overflowX: 'auto' }}>
            <table className="col-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Project</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(v => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{v.lead?.first_name} {v.lead?.last_name || ''}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v.lead?.phone}</div>
                    </td>
                    <td>{v.project?.project_name || 'N/A'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v.scheduled_date ? new Date(v.scheduled_date).toLocaleDateString() : 'N/A'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v.scheduled_time_slot || ''}</div>
                    </td>
                    <td>
                      <span className={`crm-badge badge-${v.status.toLowerCase()}`}>
                        {v.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {v.status === 'Scheduled' && (
                          <>
                            <button className="crm-btn crm-btn-success crm-btn-sm" onClick={() => setCompletingVisit(v)}>✓ Complete</button>
                            <button className="crm-btn crm-btn-danger crm-btn-sm" onClick={() => handleCancel(v.id)}>✗ Cancel</button>
                          </>
                        )}
                        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate?.('leads')}>Details</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Completion Modal */}
      {completingVisit && (
        <div className="col-modal-overlay" onClick={() => setCompletingVisit(null)}>
          <div className="col-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="col-modal-header">
              <h2>Complete Site Visit</h2>
              <button className="col-modal-close" onClick={() => setCompletingVisit(null)}>×</button>
            </div>
            <form onSubmit={handleComplete}>
              <div className="col-modal-body">
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{completingVisit.lead?.first_name} {completingVisit.lead?.last_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{completingVisit.project?.project_name} · {new Date(completingVisit.scheduled_date).toLocaleDateString()}</div>
                </div>

                <div className="col-form-group">
                  <label className="col-form-label">Buyer Rating (1-5) *</label>
                  <select className="col-form-select" value={feedbackForm.rating} onChange={e => setFeedbackForm(p => ({...p, rating: e.target.value}))}>
                    {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Stars {r === 5 ? '(Hot)' : r === 1 ? '(Cold)' : ''}</option>)}
                  </select>
                </div>

                <div className="col-form-group">
                  <label className="col-form-label">Visit Feedback/Observation *</label>
                  <textarea 
                    className="col-form-textarea" 
                    required 
                    rows={3} 
                    placeholder="How was the site visit? What did the buyer say?"
                    value={feedbackForm.feedback}
                    onChange={e => setFeedbackForm(p => ({...p, feedback: e.target.value}))}
                  />
                </div>

                <div className="col-form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox" 
                    id="interested" 
                    checked={feedbackForm.interested_after_visit} 
                    onChange={e => setFeedbackForm(p => ({...p, interested_after_visit: e.target.checked}))} 
                  />
                  <label htmlFor="interested" style={{ fontSize: 13, fontWeight: 600 }}>Buyer is interested after visit</label>
                </div>

                <div className="col-form-group">
                  <label className="col-form-label">Internal Remarks (Optional)</label>
                  <textarea 
                    className="col-form-textarea" 
                    rows={2} 
                    value={feedbackForm.remarks}
                    onChange={e => setFeedbackForm(p => ({...p, remarks: e.target.value}))}
                  />
                </div>

                <div className="lead-workspace__new-form-section" style={{ fontSize: 13, borderBottom: '1px solid var(--border-primary)', paddingBottom: 4, marginTop: 16 }}>Site Analysis</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div className="col-form-group">
                    <label className="col-form-label">Time Spent (Mins)</label>
                    <input 
                      type="number" 
                      className="col-form-input" 
                      value={feedbackForm.time_spent} 
                      onChange={e => setFeedbackForm(p => ({...p, time_spent: e.target.value}))} 
                    />
                  </div>
                </div>

                <div className="col-form-group">
                  <label className="col-form-label">Detailed Requirement Details</label>
                  <textarea 
                    className="col-form-textarea" 
                    rows={2} 
                    value={feedbackForm.requirement_details}
                    onChange={e => setFeedbackForm(p => ({...p, requirement_details: e.target.value}))}
                  />
                </div>

                <div className="col-form-group">
                  <label className="col-form-label">Long Remarks about Customer</label>
                  <textarea 
                    className="col-form-textarea" 
                    rows={2} 
                    value={feedbackForm.remarks_long}
                    onChange={e => setFeedbackForm(p => ({...p, remarks_long: e.target.value}))}
                  />
                </div>
              </div>
              <div className="col-modal-footer">
                <button type="button" className="crm-btn crm-btn-ghost" onClick={() => setCompletingVisit(null)}>Cancel</button>
                <button type="submit" className="crm-btn crm-btn-success">💾 Save Completion</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes tc-spin { to { transform: rotate(360deg); } }
        .visits-page { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default SalesManagerVisits;
