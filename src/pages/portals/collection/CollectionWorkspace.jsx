import React, { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import PortalLayout from '../common/PortalLayout';
import LeadWorkspacePage from '../common/LeadWorkspacePage';
import { CollectionDashboard, CollectionBookings, CollectionPayments, CollectionCustomerProfile } from './CollectionComponents';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';

const collectionMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: '📊', badge: null },
  { label: 'My Leads', key: 'leads', icon: '👥', badgeColor: 'blue' },
  { label: 'Bookings', key: 'bookings', icon: '📋', badgeColor: 'green' },
  { group: 'Management' },
  { label: 'Payments', key: 'payments', icon: '💳', badge: null },
  { label: 'Customer Profiles', key: 'customers', icon: '👤', badge: null },
  { group: 'Follow-ups' },
  { label: "Today's Calls", key: 'followups', icon: '📞', badgeColor: 'orange' },
];

const CollectionWorkspace = () => {
  const user = useSelector((state) => state.auth.user);
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const loadLeads = useCallback(async () => {
    try {
      const resp = await leadWorkflowApi.getLeads({ roleCode: 'COL', limit: 100 });
      setLeads(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load leads'));
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  return (
    <PortalLayout
      menuItems={collectionMenu}
      roleName="Collection Manager"
      user={user}
      defaultScreen="dashboard"
      searchPlaceholder="Search bookings, customers..."
    >
      {({ activeScreen, setActiveScreen }) => (
        <>
          {activeScreen === 'dashboard' && (
            <CollectionDashboard user={user} onNavigate={setActiveScreen} leads={leads} />
          )}
          {activeScreen === 'leads' && (
            <LeadWorkspacePage user={user} workspaceRole="COL" />
          )}
          {activeScreen === 'bookings' && (
            <CollectionBookings
              user={user}
              leads={leads}
              onSelectLead={(id) => {
                setSelectedLeadId(id);
                setActiveScreen('leads');
              }}
            />
          )}
          {activeScreen === 'payments' && (
            <CollectionPayments user={user} />
          )}
          {activeScreen === 'customers' && (
            <CollectionCustomerProfile user={user} />
          )}
          {activeScreen === 'followups' && (
            <div>
              <div className="page-header">
                <div className="page-header-left">
                  <h1>📞 Today's Follow-ups</h1>
                  <p>Customers due for follow-up calls today</p>
                </div>
              </div>
              <div className="crm-card">
                {leads.filter((l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt) <= new Date() && !l.isClosed).length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <div className="empty-title">All caught up!</div>
                    <div className="empty-desc">No follow-ups due right now</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="workspace-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Due</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads
                          .filter((l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt) <= new Date() && !l.isClosed)
                          .map((lead) => (
                            <tr key={lead.id}>
                              <td style={{ fontWeight: 600 }}>{lead.fullName}</td>
                              <td>📞 {lead.phone}</td>
                              <td><span className="crm-badge" style={{ fontSize: 11 }}>{lead.statusLabel}</span></td>
                              <td style={{ fontSize: 12, color: 'var(--accent-red)' }}>
                                {new Date(lead.nextFollowUpAt).toLocaleString()}
                              </td>
                              <td>
                                <button
                                  className="crm-btn crm-btn-primary crm-btn-sm"
                                  onClick={() => setActiveScreen('leads')}
                                >
                                  Open
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </PortalLayout>
  );
};

export default CollectionWorkspace;
