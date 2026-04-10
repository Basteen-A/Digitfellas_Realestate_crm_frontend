import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import './LeadDetailsPage.css';

const LeadDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState(null);
  const [projectOptions, setProjectOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [activeTab, setActiveTab] = useState('activity');
  const [noteDraft, setNoteDraft] = useState('');
  const [assignedUser, setAssignedUser] = useState(null);
  const [userTotalScore, setUserTotalScore] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [leadResp, projResp, locResp] = await Promise.all([
          leadWorkflowApi.getLeadById(id),
          projectApi.getDropdown(),
          locationApi.getDropdown(),
        ]);
        const leadData = leadResp.data;
        setLead(leadData);
        setProjectOptions(projResp.data || []);
        setLocationOptions(locResp.data || []);

        // Get assigned user info and their total score
        if (leadData.assignedToUserId) {
          try {
            const userResp = await leadWorkflowApi.getUserWithScore(leadData.assignedToUserId);
            if (userResp.data) {
              setAssignedUser(userResp.data);
              setUserTotalScore(userResp.data.totalScore || 0);
            }
          } catch (e) {
            console.error('Failed to load user score:', e);
          }
        }
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load lead'));
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id, navigate]);

  const handleAddNote = async () => {
    if (!noteDraft.trim()) return;
    try {
      await leadWorkflowApi.addNote(lead.id, noteDraft.trim());
      setNoteDraft('');
      toast.success('Note added');
      const resp = await leadWorkflowApi.getLeadById(id);
      setLead(resp.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add note'));
    }
  };

  if (loading) {
    return (
      <div className="lead-details-page">
        <div className="lead-details-loading">
          <div className="lead-details-spinner" />
          <p>Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="lead-details-page">
        <div className="lead-details-error">
          <p>Lead not found</p>
          <button onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  const getProjectNames = () => {
    if (lead.interestedProjects?.length > 0) {
      return lead.interestedProjects.map((pid) => projectOptions.find((p) => p.id === pid)?.project_name).filter(Boolean);
    }
    return lead.project ? [lead.project] : [];
  };

  const getLocationNames = () => {
    if (lead.interestedLocations?.length > 0) {
      return lead.interestedLocations.map((lid) => {
        const l = locationOptions.find((loc) => loc.id === lid);
        return l ? `${l.location_name}${l.city ? ', ' + l.city : ''}` : null;
      }).filter(Boolean);
    }
    return lead.location ? [lead.location] : [];
  };

  return (
    <div className="lead-details-page">
      {/* Header */}
      <header className="lead-details-header">
        <div className="lead-details-header-left">
          <button className="lead-details-back" onClick={() => navigate(-1)}>« Back</button>
          <div>
            <h1>{lead.fullName}</h1>
            <p>{lead.phone} {lead.email ? `· ${lead.email}` : ''}</p>
          </div>
        </div>
        <div className="lead-details-header-right">
          <span className="lead-details-stage" style={{ backgroundColor: lead.stageColor + '22', color: lead.stageColor }}>
            {lead.stageLabel}
          </span>
          <span className="lead-details-status" style={{ backgroundColor: lead.statusColor + '22', color: lead.statusColor }}>
            {lead.statusIcon} {lead.statusLabel}
          </span>
          {lead.leadScore != null && (
            <span className={`lead-details-score ${lead.leadScore >= 0 ? 'positive' : 'negative'}`} title="Lead Score">
              Lead: {lead.leadScore >= 0 ? '+' : ''}{lead.leadScore}
            </span>
          )}
          {userTotalScore !== 0 && (
            <span className={`lead-details-score ${userTotalScore >= 0 ? 'positive' : 'negative'}`} title={`${assignedUser?.fullName || 'User'} Total Score`}>
              User: {userTotalScore >= 0 ? '+' : ''}{userTotalScore}
            </span>
          )}
        </div>
      </header>

      {/* Pipeline Progress Bar */}
      <div className="lead-details-pipeline">
        <div className="pipeline-stages">
          {['NEW', 'CONTACTED', 'FOLLOW_UP', 'SV_SCHEDULED', 'VISIT', 'SV_COMPLETED', 'REVISIT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'].map((stageCode, idx) => {
            const stageOrder = { NEW: 1, CONTACTED: 2, FOLLOW_UP: 3, SV_SCHEDULED: 4, VISIT: 5, SV_COMPLETED: 6, REVISIT: 7, NEGOTIATION: 8, CLOSED_WON: 9, CLOSED_LOST: 9 };
            const currentOrder = stageOrder[lead.stageCode] || 0;
            const isActive = currentOrder === idx + 1;
            const isPast = currentOrder > idx + 1;
            const isTerminal = ['CLOSED_WON', 'CLOSED_LOST'].includes(stageCode);
            return (
              <div key={stageCode} className={`pipeline-stage ${isActive ? 'active' : ''} ${isPast ? 'completed' : ''} ${isTerminal ? 'terminal' : ''}`}>
                <div className="pipeline-dot"></div>
                {idx < 9 && <div className="pipeline-line"></div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="lead-details-content">
        {/* Left Column - 1/3 */}
        <div className="lead-details-left">
          {/* Contact Information */}
          <section className="lead-details-card">
            <h3 className="lead-details-card-title">Contact Information</h3>
            <div className="lead-details-info-grid">
              <div className="lead-details-info-item">
                <span className="lead-details-label">Full Name</span>
                <span className="lead-details-value">{lead.fullName}</span>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">Phone</span>
                <span className="lead-details-value">{lead.phone}</span>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">WhatsApp</span>
                <span className="lead-details-value">{lead.whatsappNumber || '-'}</span>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">Alternate Phone</span>
                <span className="lead-details-value">{lead.alternatePhone || '-'}</span>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">Email</span>
                <span className="lead-details-value">{lead.email || '-'}</span>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">Lead Number</span>
                <span className="lead-details-value">{lead.leadNumber}</span>
              </div>
            </div>
          </section>

          {/* Requirements & Project */}
          <section className="lead-details-card">
            <h3 className="lead-details-card-title">Requirements & Project</h3>
            <div className="lead-details-info-grid">
              <div className="lead-details-info-item">
                <span className="lead-details-label">Project(s)</span>
                <div className="lead-details-tags">
                  {getProjectNames().length > 0 ? getProjectNames().map((name, i) => (
                    <span key={i} className="lead-details-tag lead-details-tag--project">{name}</span>
                  )) : <span className="lead-details-value">-</span>}
                </div>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">Location(s)</span>
                <div className="lead-details-tags">
                  {getLocationNames().length > 0 ? getLocationNames().map((name, i) => (
                    <span key={i} className="lead-details-tag lead-details-tag--location">{name}</span>
                  )) : <span className="lead-details-value">-</span>}
                </div>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">Budget</span>
                <span className="lead-details-value">
                  {(lead.budgetMin != null || lead.budgetMax != null)
                    ? `${lead.budgetMin != null ? formatCurrency(lead.budgetMin) : '0'} - ${lead.budgetMax != null ? formatCurrency(lead.budgetMax) : 'No limit'}`
                    : 'Not specified'}
                </span>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">Configuration</span>
                <span className="lead-details-value">{lead.configuration || '-'}</span>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">Purpose</span>
                <span className="lead-details-value">{lead.purpose || '-'}</span>
              </div>
              <div className="lead-details-info-item">
                <span className="lead-details-label">Source</span>
                <span className="lead-details-value">{lead.source || '-'}</span>
              </div>
            </div>
          </section>

          {/* Assignment */}
          <section className="lead-details-card">
            <h3 className="lead-details-card-title">Assignment</h3>
            <div className="lead-details-info-grid">
              <div className="lead-details-info-item">
                <span className="lead-details-label">Assigned To</span>
                <span className="lead-details-value lead-details-value--primary">{lead.assignedToUserName || 'Unassigned'}</span>
              </div>
              {lead.handoff?.fromUserName && (
                <div className="lead-details-info-item">
                  <span className="lead-details-label">Last Handoff</span>
                  <span className="lead-details-value">{lead.handoff.fromUserName} - {lead.handoff.toUserName || 'Unassigned'}</span>
                  {lead.handoff.handedOffAt && <small>{formatDateTime(lead.handoff.handedOffAt)}</small>}
                </div>
              )}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="lead-details-card">
            <h3 className="lead-details-card-title">Quick Actions</h3>
            <div className="lead-details-actions">
              <button className="lead-details-action-btn lead-details-action-btn--primary">Log Call</button>
              <button className="lead-details-action-btn lead-details-action-btn--secondary">Add Note</button>
              <button className="lead-details-action-btn lead-details-action-btn--secondary">WhatsApp</button>
              <button className="lead-details-action-btn lead-details-action-btn--secondary">Email</button>
              <button className="lead-details-action-btn lead-details-action-btn--warning">Reassign</button>
            </div>
          </section>
        </div>

        {/* Right Column - 2/3 */}
        <div className="lead-details-right">
          {/* Tabs */}
          <div className="lead-details-tabs">
            <button className={`lead-details-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Activity</button>
            <button className={`lead-details-tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>Comments</button>
            <button className={`lead-details-tab ${activeTab === 'calls' ? 'active' : ''}`} onClick={() => setActiveTab('calls')}>Call Logs</button>
            <button className={`lead-details-tab ${activeTab === 'industry' ? 'active' : ''}`} onClick={() => setActiveTab('industry')}>Industry Grade</button>
            <button className={`lead-details-tab ${activeTab === 'sitevisits' ? 'active' : ''}`} onClick={() => setActiveTab('sitevisits')}>Site Visits</button>
            <button className={`lead-details-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>Documents</button>
          </div>

          {/* Tab Content */}
          <div className="lead-details-tab-content">
            {activeTab === 'activity' && (
              <div className="lead-details-timeline">
                {(lead.timeline || []).length === 0 ? (
                  <p className="lead-details-empty">No activity yet</p>
                ) : (
                  lead.timeline.map((evt) => (
                    <div key={evt.id} className="lead-details-timeline-item">
                      <div className="lead-details-timeline-icon">
                        {evt.type === 'NOTE_ADDED' ? '?' : evt.type === 'STAGE_CHANGE' ? '?' : evt.type === 'STATUS_CHANGE' ? '?' : evt.type === 'REASSIGNMENT' ? '?' : '+'}
                      </div>
                      <div className="lead-details-timeline-content">
                        <div className="lead-details-timeline-header">
                          <span className="lead-details-timeline-title">{evt.title || evt.type.replace(/_/g, ' ')}</span>
                          <span className="lead-details-timeline-date">{formatDateTime(evt.at)}</span>
                        </div>
                        {evt.description && <p className="lead-details-timeline-desc">{evt.description}</p>}
                        <span className="lead-details-timeline-by">By {evt.by || 'System'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="lead-details-comments">
                <div className="lead-details-comment-form">
                  <textarea placeholder="Add a comment..." value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                  <button onClick={handleAddNote} disabled={!noteDraft.trim()}>Post Comment</button>
                </div>
                <p className="lead-details-empty">No comments yet</p>
              </div>
            )}

            {activeTab === 'calls' && (
              <div className="lead-details-call-logs">
                <p className="lead-details-empty">No call logs yet</p>
              </div>
            )}

            {activeTab === 'industry' && (
              <div className="lead-details-industry">
                <div className="lead-details-info-grid">
                  <div className="lead-details-info-item">
                    <span className="lead-details-label">Lead Type</span>
                    <span className="lead-details-value">{lead.leadType || '-'}</span>
                  </div>
                  <div className="lead-details-info-item">
                    <span className="lead-details-label">Customer Type</span>
                    <span className="lead-details-value">{lead.customerType || '-'}</span>
                  </div>
                  <div className="lead-details-info-item">
                    <span className="lead-details-label">Campaign</span>
                    <span className="lead-details-value">{lead.campaignName || '-'}</span>
                  </div>
                  <div className="lead-details-info-item">
                    <span className="lead-details-label">Created At</span>
                    <span className="lead-details-value">{lead.createdAt ? formatDateTime(lead.createdAt) : '-'}</span>
                  </div>
                  <div className="lead-details-info-item">
                    <span className="lead-details-label">Last Updated</span>
                    <span className="lead-details-value">{lead.updatedAt ? formatDateTime(lead.updatedAt) : '-'}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sitevisits' && (
              <div className="lead-details-sitevisits">
                <p className="lead-details-empty">No site visits recorded</p>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="lead-details-documents">
                <p className="lead-details-empty">No documents uploaded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailsPage;
