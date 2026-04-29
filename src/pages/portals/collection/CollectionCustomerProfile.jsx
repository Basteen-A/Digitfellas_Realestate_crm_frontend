import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  UserIcon, ArrowPathIcon, PhoneIcon, EnvelopeIcon,
  PencilSquareIcon, DocumentCheckIcon, ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import './CollectionWorkspace.css';

const CollectionCustomerProfile = ({ user, initialCustomerId }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(initialCustomerId || null);
  const [customer, setCustomer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState('');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getCustomers();
      setCustomers(resp.data?.data || resp.data || []);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to load customers')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  useEffect(() => {
    if (initialCustomerId) setSelectedId(initialCustomerId);
  }, [initialCustomerId]);

  const openDetail = useCallback(async (id) => {
    setDetailLoading(true);
    setSelectedId(id);
    try {
      const resp = await bookingApi.getCustomerById(id);
      const c = resp.data?.data || resp.data;
      setCustomer(c);
      setEditMode(false);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to load customer')); }
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { if (selectedId) openDetail(selectedId); }, [selectedId, openDetail]);

  const startEdit = () => {
    if (!customer) return;
    setEditForm({
      first_name: customer.first_name || '', last_name: customer.last_name || '',
      email: customer.email || '', phone: customer.phone || '',
      alternate_phone: customer.alternate_phone || '', whatsapp_number: customer.whatsapp_number || '',
      gender: customer.gender || '', date_of_birth: customer.date_of_birth || '',
      pan_number: customer.pan_number || '', aadhar_number: customer.aadhar_number || '',
      occupation: customer.occupation || '', designation: customer.designation || '',
      company_name: customer.company_name || '', annual_income: customer.annual_income || '',
      address_line_1: customer.address_line_1 || '', address_line_2: customer.address_line_2 || '',
      city: customer.city || '', state: customer.state || '', pincode: customer.pincode || '',
      perm_address_line_1: customer.perm_address_line_1 || '', perm_address_line_2: customer.perm_address_line_2 || '',
      perm_city: customer.perm_city || '', perm_state: customer.perm_state || '', perm_pincode: customer.perm_pincode || '',
      notes: customer.notes || '',
    });
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!customer) return;
    try {
      await bookingApi.updateCustomer(customer.id, editForm);
      toast.success('Customer profile updated');
      setEditMode(false);
      openDetail(customer.id);
      loadCustomers();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update')); }
  };

  const filtered = search
    ? customers.filter(c => `${c.first_name} ${c.last_name} ${c.phone} ${c.email}`.toLowerCase().includes(search.toLowerCase()))
    : customers;

  const initials = customer ? `${(customer.first_name || '')[0] || ''}${(customer.last_name || '')[0] || ''}`.toUpperCase() : '';

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center gap-3">
        <div className="page-header-left">
          <h1><UserIcon style={{ width: 22, height: 22, display: 'inline', verticalAlign: 'text-bottom', marginRight: 8 }} />Customer Profiles</h1>
          <p className="hidden sm:block">View and manage customer details, KYC, and booking history</p>
        </div>
      </div>

      {loading ? (
        <div className="col-empty"><div className="col-empty-icon"><ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">Loading customers...</div></div>
      ) : customers.length === 0 ? (
        <div className="col-section"><div className="col-empty"><div className="col-empty-icon"><UserIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">No customers yet</div><div className="col-empty-desc">Customers are auto-created when a booking is approved</div></div></div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <input className="col-form-input" style={{ maxWidth: 400, width: '100%' }} placeholder="Search by name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="col-section">
            <div className="col-section-body-flush" style={{ overflowX: 'auto' }}>
              <table className="col-table">
                <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Bookings</th><th>Total Value</th><th>Paid</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="is-clickable" onClick={() => setSelectedId(c.id)}>
                      <td style={{ fontWeight: 600 }}>{c.first_name} {c.last_name || ''}</td>
                      <td>{c.phone}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{c.email || '-'}</td>
                      <td><span className="col-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>{c.bookings_count || 0}</span></td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(c.total_booking_value)}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{formatCurrency(c.total_paid)}</td>
                      <td><button className="crm-btn crm-btn-primary crm-btn-sm" onClick={e => { e.stopPropagation(); setSelectedId(c.id); }}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Customer Detail Modal ── */}
      {customer && selectedId && (
        <div className="col-modal-overlay" onClick={() => { setSelectedId(null); setCustomer(null); }}>
          <div className="col-modal col-modal-lg" onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div className="col-modal-body"><div className="col-empty"><div className="col-empty-icon"><ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div></div></div>
            ) : (
              <>
                <div className="col-profile-header">
                  <div className="col-profile-avatar">{initials}</div>
                  <div className="col-profile-info">
                    <h2>{customer.first_name} {customer.last_name || ''}</h2>
                    <p>{customer.phone}{customer.email ? ` · ${customer.email}` : ''}</p>
                  </div>
                  <button className="col-modal-close" onClick={() => { setSelectedId(null); setCustomer(null); }} style={{ marginLeft: 'auto' }}>×</button>
                </div>

                <div className="col-modal-body">
                  {editMode ? (
                    <>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Edit Customer Profile</h3>
                      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '12px 0 8px' }}>PERSONAL DETAILS</h4>
                      <div className="col-form-grid-3">
                        {[['first_name','First Name'],['last_name','Last Name'],['email','Email'],['phone','Phone'],['alternate_phone','Alt Phone'],['whatsapp_number','WhatsApp'],['date_of_birth','DOB (YYYY-MM-DD)'],['gender','Gender'],['occupation','Occupation'],['designation','Designation'],['company_name','Company'],['annual_income','Annual Income']].map(([k,l]) => (
                          <div className="col-form-group" key={k}>
                            <label className="col-form-label">{l}</label>
                            {k === 'gender' ? (
                              <select className="col-form-select" value={editForm[k]} onChange={e => setEditForm(p => ({...p, [k]: e.target.value}))}>
                                <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                              </select>
                            ) : (
                              <input className="col-form-input" value={editForm[k] || ''} onChange={e => setEditForm(p => ({...p, [k]: e.target.value}))} />
                            )}
                          </div>
                        ))}
                      </div>
                      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '20px 0 8px' }}>KYC DETAILS</h4>
                      <div className="col-form-grid-3">
                        {[['pan_number','PAN Number'],['aadhar_number','Aadhar Number']].map(([k,l]) => (
                          <div className="col-form-group" key={k}><label className="col-form-label">{l}</label><input className="col-form-input" value={editForm[k] || ''} onChange={e => setEditForm(p => ({...p, [k]: e.target.value}))} /></div>
                        ))}
                      </div>
                      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '20px 0 8px' }}>CURRENT ADDRESS</h4>
                      <div className="col-form-grid-3">
                        {[['address_line_1','Address Line 1'],['address_line_2','Address Line 2'],['city','City'],['state','State'],['pincode','Pincode']].map(([k,l]) => (
                          <div className="col-form-group" key={k}><label className="col-form-label">{l}</label><input className="col-form-input" value={editForm[k] || ''} onChange={e => setEditForm(p => ({...p, [k]: e.target.value}))} /></div>
                        ))}
                      </div>
                      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '20px 0 8px' }}>PERMANENT ADDRESS</h4>
                      <div className="col-form-grid-3">
                        {[['perm_address_line_1','Address Line 1'],['perm_address_line_2','Address Line 2'],['perm_city','City'],['perm_state','State'],['perm_pincode','Pincode']].map(([k,l]) => (
                          <div className="col-form-group" key={k}><label className="col-form-label">{l}</label><input className="col-form-input" value={editForm[k] || ''} onChange={e => setEditForm(p => ({...p, [k]: e.target.value}))} /></div>
                        ))}
                      </div>
                      <div className="col-form-group full-width" style={{ marginTop: 12 }}>
                        <label className="col-form-label">Notes</label>
                        <textarea className="col-form-textarea" value={editForm.notes || ''} onChange={e => setEditForm(p => ({...p, notes: e.target.value}))} rows={2} />
                      </div>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                        <button className="crm-btn crm-btn-ghost" onClick={() => setEditMode(false)}>Cancel</button>
                        <button className="crm-btn crm-btn-primary" onClick={handleSave}><DocumentCheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Save Profile</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={startEdit}><PencilSquareIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Edit Profile</button>
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Personal Details</h3>
                      <div className="col-profile-info-grid">
                        {[['Gender', customer.gender],['DOB', formatDate(customer.date_of_birth)],['Occupation', customer.occupation],['Company', customer.company_name],['PAN', customer.pan_number],['Aadhar', customer.aadhar_number],['City', customer.city],['State', customer.state]].map(([l,v]) => (
                          <div className="col-profile-field" key={l}><div className="col-profile-field-label">{l}</div><div className="col-profile-field-value">{v || '-'}</div></div>
                        ))}
                      </div>

                      {/* Bookings for this customer */}
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '24px 0 12px', color: 'var(--text-primary)' }}><ClipboardDocumentListIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />Bookings ({(customer.bookings || []).length})</h3>
                      {(customer.bookings || []).length === 0 ? (
                        <div className="col-empty" style={{ padding: 16 }}><div className="col-empty-desc">No bookings linked</div></div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="col-table">
                            <thead><tr><th>Booking #</th><th>Project</th><th>Status</th><th>Net Amount</th><th>Paid</th><th>Payments</th></tr></thead>
                            <tbody>
                              {(customer.bookings || []).map(b => (
                                <tr key={b.id}>
                                  <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{b.booking_number}</td>
                                  <td>{b.project?.project_name || '-'}</td>
                                  <td><span className="col-badge" style={{ background: (b.bookingStatus?.color_code || '#6B7280') + '22', color: b.bookingStatus?.color_code || '#6B7280' }}>{b.bookingStatus?.status_name || '-'}</span></td>
                                  <td style={{ fontWeight: 600 }}>{formatCurrency(b.net_amount)}</td>
                                  <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{formatCurrency(b.total_paid)}</td>
                                  <td>{(b.payments || []).length} payment{(b.payments || []).length !== 1 ? 's' : ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { CollectionCustomerProfile };
