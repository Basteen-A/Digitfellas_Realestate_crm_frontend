import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import paymentPlanApi from '../../../api/paymentPlanApi';
import paymentTypeApi from '../../../api/paymentTypeApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { ClipboardDocumentListIcon, PencilSquareIcon, LinkIcon, CreditCardIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import '../collection/CollectionWorkspace.css';

const SalesHeadBookings = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [statusOptions, setStatusOptions] = useState([]);
  const [planOptions, setPlanOptions] = useState([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (activeTab === 'Active') params.is_cancelled = 'false';
      if (activeTab === 'Cancelled') params.is_cancelled = 'true';
      // For 'Completed', we might need to filter by a specific status code if available
      
      const resp = await bookingApi.getAll(params);
      setBookings(resp.data?.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load bookings'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const loadStatuses = useCallback(async () => {
    try {
      const resp = await bookingStatusApi.getDropdown();
      setStatusOptions(resp.data?.data || resp.data || []);
    } catch { /* silent */ }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const resp = await paymentPlanApi.getDropdown();
      setPlanOptions(resp.data || []);
    } catch { /* silent */ }
  }, []);

  const loadPaymentTypes = useCallback(async () => {
    try {
      const resp = await paymentTypeApi.getDropdown();
      setPaymentTypeOptions(resp.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadBookings();
    loadStatuses();
    loadPlans();
    loadPaymentTypes();
  }, [loadBookings, loadStatuses, loadPlans, loadPaymentTypes]);

  const openDetail = async (bookingId) => {
    setDetailLoading(true);
    try {
      const resp = await bookingApi.getById(bookingId);
      setSelectedBooking(resp.data?.data || resp.data);
      setEditMode(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load booking details'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedBooking) return;
    try {
      await bookingApi.update(selectedBooking.id, editForm);
      toast.success('Booking details updated');
      setEditMode(false);
      openDetail(selectedBooking.id);
      loadBookings();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update booking'));
    }
  };

  const startEdit = () => {
    setEditForm({
      unit_number: selectedBooking.unit_number || '',
      tower_block: selectedBooking.tower_block || '',
      floor_number: selectedBooking.floor_number || '',
      configuration: selectedBooking.configuration || '',
      carpet_area: selectedBooking.carpet_area || '',
      base_price: selectedBooking.base_price || '',
      total_amount: selectedBooking.total_amount || '',
      discount_amount: selectedBooking.discount_amount || '',
      net_amount: selectedBooking.net_amount || '',
      gst_amount: selectedBooking.gst_amount || '',
      stamp_duty: selectedBooking.stamp_duty || '',
      registration_charges: selectedBooking.registration_charges || '',
      booking_status_id: selectedBooking.booking_status_id || '',
      payment_plan_id: selectedBooking.payment_plan_id || '',
      payment_type_id: selectedBooking.payment_type_id || '',
      remarks: selectedBooking.remarks || '',
    });
    setEditMode(true);
  };


  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Bookings</h1>
          <p className="hidden sm:block">Manage and track all property bookings</p>
        </div>
        <div className="page-header-actions flex-wrap">
          <div className="filter-tabs">
            {['All', 'Active', 'Completed', 'Cancelled'].map(tab => (
              <button 
                key={tab}
                className={`filter-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadBookings} style={{ marginLeft: 10 }}>
            Refresh
          </button>
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body-flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="col-empty-icon"><ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div>
              <p>Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No bookings found for the selected filter.
            </div>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Booking #</th>
                    <th>Buyer</th>
                    <th>Project · Unit</th>
                    <th>Net Value</th>
                    <th>Paid</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(booking => (
                    <tr key={booking.id} className="is-clickable" onClick={() => openDetail(booking.id)}>
                      <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{booking.booking_number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{booking.customer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{booking.lead?.lead_number || ''}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{booking.project_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unit: {booking.unit_display}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(booking.net_amount)}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{formatCurrency(booking.total_paid || 0)}</td>
                      <td style={{ minWidth: 100 }}>
                        <div className="col-progress" style={{ height: 6, width: '100%' }}>
                          <div 
                            className={`col-progress-bar ${booking.payment_percentage >= 100 ? 'success' : booking.payment_percentage >= 50 ? '' : 'warning'}`}
                            style={{ width: `${Math.min(booking.payment_percentage || 0, 100)}%` }} 
                          />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{booking.payment_percentage || 0}% Collected</div>
                      </td>
                      <td>
                        <span className="col-badge" style={{ 
                          background: `${booking.status_color}22`, 
                          color: booking.status_color 
                        }}>
                          <span className="col-badge-dot" style={{ background: booking.status_color }} />
                          {booking.status_label}
                        </span>
                      </td>
                      <td>
                        <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={(e) => { e.stopPropagation(); openDetail(booking.id); }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="col-modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="col-modal col-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="col-modal-header">
              <h2><ClipboardDocumentListIcon style={{ width: 20, height: 20, display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />Booking Details: {selectedBooking.booking_number}</h2>
              <button className="col-modal-close" onClick={() => setSelectedBooking(null)}>×</button>
            </div>
            {detailLoading ? (
              <div className="col-modal-body" style={{ padding: 40, textAlign: 'center' }}>
                <div className="col-empty-icon"><ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div>
              </div>
            ) : (
              <div className="col-modal-body">
                {/* Summary amounts */}
                <div className="col-booking-amounts" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  <div className="col-amount-card"><div className="col-amount-label">Total Amount</div><div className="col-amount-value">{formatCurrency(selectedBooking.total_amount)}</div></div>
                  <div className="col-amount-card"><div className="col-amount-label">Net Amount</div><div className="col-amount-value blue">{formatCurrency(selectedBooking.net_amount)}</div></div>
                  <div className="col-amount-card"><div className="col-amount-label">Total Paid</div><div className="col-amount-value green">{formatCurrency(selectedBooking.total_paid)}</div></div>
                  <div className="col-amount-card"><div className="col-amount-label">Balance Due</div><div className="col-amount-value red">{formatCurrency(selectedBooking.total_due)}</div></div>
                </div>

                {editMode ? (
                  <div className="col-section">
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15, color: 'var(--accent-blue)' }}>Edit Pricing & Unit Details</h3>
                    <div className="col-form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
                      {[
                        ['unit_number', 'Unit #'], ['tower_block', 'Tower/Block'], ['floor_number', 'Floor'],
                        ['configuration', 'Config'], ['carpet_area', 'Carpet Area'], ['base_price', 'Base Price'],
                        ['total_amount', 'Total Amount'], ['discount_amount', 'Discount'], ['net_amount', 'Net Amount'],
                        ['gst_amount', 'GST'], ['stamp_duty', 'Stamp Duty'], ['registration_charges', 'Reg. Charges']
                      ].map(([field, label]) => (
                        <div className="col-form-group" key={field}>
                          <label className="col-form-label">{label}</label>
                          <input 
                            className="col-form-input" 
                            type={['base_price', 'total_amount', 'discount_amount', 'net_amount', 'gst_amount', 'stamp_duty', 'registration_charges'].includes(field) ? 'number' : 'text'}
                            value={editForm[field] || ''} 
                            onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))} 
                          />
                        </div>
                      ))}
                      <div className="col-form-group">
                        <label className="col-form-label">Booking Status</label>
                        <select className="col-form-select" value={editForm.booking_status_id || ''} onChange={e => setEditForm(p => ({ ...p, booking_status_id: e.target.value }))}>
                          <option value="">Select status...</option>
                          {statusOptions.map(s => <option key={s.id} value={s.id}>{s.status_name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginTop: 15 }}>
                      <div className="col-form-group">
                        <label className="col-form-label">Payment Plan</label>
                        <select className="col-form-select" value={editForm.payment_plan_id || ''} onChange={e => setEditForm(p => ({ ...p, payment_plan_id: e.target.value || null }))}>
                          <option value="">Select plan...</option>
                          {planOptions.map(pl => <option key={pl.id} value={pl.id}>{pl.plan_name} ({pl.plan_type}{pl.plan_type === 'EMI' ? ` - ${pl.emi_months}m` : ''})</option>)}
                        </select>
                      </div>
                      <div className="col-form-group">
                        <label className="col-form-label">Payment Type</label>
                        <select className="col-form-select" value={editForm.payment_type_id || ''} onChange={e => setEditForm(p => ({ ...p, payment_type_id: e.target.value || null }))}>
                          <option value="">Select type...</option>
                          {paymentTypeOptions.map(pt => <option key={pt.id} value={pt.id}>{pt.type_name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="col-form-group" style={{ marginTop: 15 }}>
                      <label className="col-form-label">Internal Remarks</label>
                      <textarea className="col-form-textarea" rows={2} value={editForm.remarks || ''} onChange={e => setEditForm(p => ({ ...p, remarks: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                      <button className="crm-btn crm-btn-ghost" onClick={() => setEditMode(false)}>Cancel</button>
                      <button className="crm-btn crm-btn-primary" onClick={handleEditSave}>Save Changes</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="col-booking-header" style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="col-booking-customer">
                        <div style={{ fontSize: 14 }}>Customer: <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.customer?.first_name} {selectedBooking.customer?.last_name || ''}</strong></div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Project: <strong>{selectedBooking.project?.project_name || '-'}</strong> | Unit: <strong>{selectedBooking.unit_number || 'TBD'}</strong></div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={startEdit}><PencilSquareIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Edit Details</button>
                        {selectedBooking.lead_id && (
                          <a href={`/leads/${selectedBooking.lead_id}`} target="_blank" rel="noopener noreferrer" className="crm-btn crm-btn-ghost crm-btn-sm" style={{ textDecoration: 'none' }}>
                            <LinkIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />View Lead
                          </a>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: 25 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}><CreditCardIcon style={{ width: 18, height: 18, display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />Payment History</h3>
                      {(!selectedBooking.payments || selectedBooking.payments.length === 0) ? (
                        <div style={{ padding: 20, textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 8, color: 'var(--text-muted)' }}>
                          No payments recorded for this booking yet.
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="col-table">
                            <thead>
                              <tr>
                                <th>Ref #</th>
                                <th>Type</th>
                                <th>Mode</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedBooking.payments.map(payment => (
                                <tr key={payment.id}>
                                  <td>{payment.payment_number}</td>
                                  <td>{payment.payment_type}</td>
                                  <td>{payment.payment_mode}</td>
                                  <td style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{formatCurrency(payment.amount)}</td>
                                  <td>{formatDate(payment.payment_date)}</td>
                                  <td>
                                    <span className="col-badge" style={{ 
                                      background: payment.management_approved ? '#10b98122' : '#f59e0b22', 
                                      color: payment.management_approved ? '#10b981' : '#f59e0b' 
                                    }}>
                                      {payment.management_approved ? 'Verified' : 'Pending Verification'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesHeadBookings;
