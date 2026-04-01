import React, { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import '../common/LeadWorkspacePage.css';

const CollectionDashboard = ({ user, onNavigate, leads }) => {
  const stats = useMemo(() => {
    const total = leads.length;
    const active = leads.filter((l) => !l.isClosed).length;
    const won = leads.filter((l) => l.stageCode === 'CLOSED_WON').length;
    const pending = leads.filter((l) => l.statusLabel?.toLowerCase().includes('progress')).length;
    return [
      { label: 'Total Bookings', value: total, icon: '📋', cls: 'stat--open' },
      { label: 'Active', value: active, icon: '⚡', cls: 'stat--due' },
      { label: 'Closed Won', value: won, icon: '🎉', cls: 'stat--won' },
      { label: 'In Progress', value: pending, icon: '🔄', cls: 'stat--dropped' },
    ];
  }, [leads]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>💰 Collection Dashboard</h1>
          <p>Manage bookings, payments, and customer profiles</p>
        </div>
      </div>

      {/* Stats */}
      <div className="workspace-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} className="crm-card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="crm-card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="crm-btn crm-btn-primary" onClick={() => onNavigate('leads')}>👥 View All Leads</button>
          <button className="crm-btn crm-btn-success" onClick={() => onNavigate('bookings')}>📋 Manage Bookings</button>
          <button className="crm-btn crm-btn-ghost" onClick={() => onNavigate('payments')}>💳 Payment History</button>
        </div>
      </div>

      {/* Recent Leads */}
      {leads.length > 0 && (
        <div className="crm-card">
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>Recent Leads</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="workspace-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Phone</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 5).map((lead) => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 600 }}>{lead.fullName}</td>
                    <td>{lead.phone}</td>
                    <td><span className="crm-badge" style={{ background: lead.stageColor + '22', color: lead.stageColor, fontSize: 11 }}>{lead.stageLabel}</span></td>
                    <td><span className="crm-badge" style={{ fontSize: 11 }}>{lead.statusLabel}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(lead.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const CollectionBookings = ({ user, leads, onSelectLead }) => {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>📋 Bookings</h1>
          <p>Manage customer bookings and payment milestones</p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="crm-card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">No bookings yet</div>
            <div className="empty-desc">Bookings from Sales Head approvals will appear here</div>
          </div>
        </div>
      ) : (
        <div className="crm-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="workspace-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Lead #</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Project</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Budget</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{lead.leadNumber}</td>
                    <td style={{ fontWeight: 600 }}>{lead.fullName}</td>
                    <td>📞 {lead.phone}</td>
                    <td>{lead.project || '-'}</td>
                    <td>
                      <span className="crm-badge" style={{ background: lead.stageColor + '22', color: lead.stageColor, fontSize: 11 }}>
                        {lead.stageLabel}
                      </span>
                    </td>
                    <td>
                      <span className="crm-badge" style={{ fontSize: 11 }}>{lead.statusLabel}</span>
                    </td>
                    <td>{lead.budgetMin ? formatCurrency(lead.budgetMin) : '-'}</td>
                    <td>
                      <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => onSelectLead(lead.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const CollectionPayments = ({ user }) => {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>💳 Payment History</h1>
          <p>Track and manage payment milestones for all bookings</p>
        </div>
      </div>
      <div className="crm-card">
        <div className="empty-state">
          <div className="empty-icon">💳</div>
          <div className="empty-title">Payment Tracking</div>
          <div className="empty-desc">Payment history and milestone management will be available once bookings are created from Sales Head approvals. Each payment goes through 2-step approval (Accounts → Management).</div>
        </div>

        {/* Payment structure preview */}
        <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 10 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>📝 Payment Record Fields</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {['Payment Date', 'Amount', 'Account Name', 'Payment Mode', 'Reference No.', 'Receipt', 'Approval Status'].map((field) => (
              <div key={field} style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13 }}>
                {field}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <strong>2-Step Approval Flow:</strong> Pending → Accounts Approval → Management Approval → Approved ✅
          </div>
        </div>
      </div>
    </div>
  );
};

const CollectionCustomerProfile = ({ user }) => {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>👤 Customer Profiles</h1>
          <p>Manage customer details for bookings</p>
        </div>
      </div>
      <div className="crm-card">
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <div className="empty-title">Customer Profile Management</div>
          <div className="empty-desc">Enter and manage customer details for each booking</div>
        </div>

        {/* Customer profile fields preview */}
        <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 10 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>📝 Customer Profile Fields</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {['Date of Birth', 'Permanent Address', 'Current Address', 'Occupation', 'Current Post', 'Purchase Type', 'Marital Status', 'PAN Number', 'Aadhar Number'].map((field) => (
              <div key={field} style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13 }}>
                {field}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export { CollectionDashboard, CollectionBookings, CollectionPayments, CollectionCustomerProfile };
