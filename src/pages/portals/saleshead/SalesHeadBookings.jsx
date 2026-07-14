import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { ClipboardDocumentListIcon, LinkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import '../collection/CollectionWorkspace.css';

// Read-only formatters for the booking-details view. Financial sections (pricing,
// valuation, loan, agreement, channel partner) are intentionally omitted — the SH
// record shows only who booked and what unit, not money (that's Collection/Finance).
const dt = (v) => (v ? formatDate(v) : '—');
const txt = (v) => (v === null || v === undefined || String(v).trim() === '' ? '—' : String(v));

// Every field the Sales Head filled at booking time, grouped for a complete
// read-only view — the booking record is immutable to lead reassignment, so this
// always shows what the SH captured even after the lead moves to a TC/other SM.
const buildBookingSections = (b) => {
  const c = b.customer || {};
  const address = [c.address_line_1, c.address_line_2, c.city, c.state, c.pincode, c.country].filter(Boolean).join(', ');
  return [
    { title: 'Booking', rows: [
      ['Booking #', txt(b.booking_number)],
      ['Booking Date', dt(b.booking_date)],
      ['Closed By (Sales Head)', txt(b.closedBy ? `${b.closedBy.first_name || ''} ${b.closedBy.last_name || ''}`.trim() : '')],
      ['Created', dt(b.created_at)],
    ] },
    { title: 'Customer Profile', rows: [
      ['Buyer Name', txt(b.buyer_name || `${c.first_name || ''} ${c.last_name || ''}`.trim())],
      ['Relation', (b.relation_type || b.relation_name) ? `${b.relation_type || ''} ${b.relation_name || ''}`.trim() : '—'],
      ['Phone', txt(c.phone)],
      ['Email', txt(c.email)],
      ['PAN', txt(c.pan_number)],
      ['Aadhaar', txt(c.aadhar_number)],
      ['Date of Birth', dt(c.date_of_birth)],
      ['Gender', txt(c.gender)],
      ['Marital Status', txt(c.marital_status)],
      ['Occupation', txt(c.occupation)],
      ['Current Post', txt(c.current_post)],
      ['Purchase Type', txt(c.purchase_type)],
      ['Address', txt(address)],
    ] },
    { title: 'Property / Unit', rows: [
      ['Project', txt(b.project?.project_name)],
      ['Phase', txt(b.phase?.phase_name || b.inventoryUnit?.phase?.phase_name)],
      ['Location', txt(b.project?.location?.location_name)],
      ['Unit #', txt(b.unit_number || b.inventoryUnit?.unit_number)],
      ['Tower / Block', txt(b.tower_block || b.inventoryUnit?.tower_block)],
      ['Floor', txt(b.floor_number)],
      ['Configuration', txt(b.configuration || b.inventoryUnit?.configuration)],
      ['Carpet Area', txt(b.carpet_area)],
      ['Built-up Area', txt(b.built_up_area)],
      ['Super Built-up Area', txt(b.super_built_up_area)],
      ['Area Unit', txt(b.area_unit)],
      ['Facing', txt(b.inventoryUnit?.facing)],
    ] },
    { title: 'Payment Plan', rows: [
      ['Payment Plan', txt(b.paymentPlan?.plan_name)],
      ['Payment Type', txt(b.paymentType?.type_name)],
    ] },
    { title: 'Remarks', rows: [
      ['Remarks', txt(b.remarks)],
    ] },
  ];
};

const SalesHeadBookings = ({ user }) => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      // Only the bookings THIS Sales Head actually made (closed_by / created_by) —
      // /bookings/my is maker-keyed, so team members' bookings are not shown here.
      const params = { limit: 100 };
      if (activeTab === 'Active') params.is_cancelled = 'false';
      if (activeTab === 'Cancelled') params.is_cancelled = 'true';

      const resp = await bookingApi.getMyBookings(params);
      setBookings(resp.data?.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load bookings'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const openDetail = async (bookingId) => {
    setDetailLoading(true);
    try {
      const resp = await bookingApi.getById(bookingId);
      setSelectedBooking(resp.data?.data || resp.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load booking details'));
    } finally {
      setDetailLoading(false);
    }
  };

  // View Lead: the SH keeps the booking after the lead is re-engaged/reassigned, so
  // the underlying lead may no longer be theirs. Only navigate when it is still
  // assigned to this SH; otherwise tell them who holds it now.
  const handleViewLead = () => {
    const ownerId = selectedBooking?.lead?.assigned_to;
    const ownerName = selectedBooking?.lead?.assignedTo
      ? `${selectedBooking.lead.assignedTo.first_name || ''} ${selectedBooking.lead.assignedTo.last_name || ''}`.trim()
      : '';
    if (String(ownerId || '') === String(user?.id || '')) {
      navigate(`/portal/lead/${selectedBooking.lead_id}`);
    } else {
      toast(`This lead is now assigned to ${ownerName || 'another user'} — you can't access it.`, { icon: '🔒' });
    }
  };

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(bookings, 25);

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Bookings</h1>
          <p className="hidden sm:block">Manage and track all property bookings</p>
        </div>
        <div className="page-header-actions flex-wrap">
          <div className="filter-tabs">
            {['All', 'Active', 'Cancelled'].map(tab => (
              <button 
                key={tab}
                className={`filter-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <button type="button" className="crm-btn crm-btn-ghost" onClick={loadBookings} style={{ marginLeft: 10 }}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
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
                    <th>Booking Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(booking => (
                      <tr key={booking.id} className="is-clickable" onClick={() => openDetail(booking.id)}>
                        <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{booking.booking_number}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{booking.customer_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{booking.lead?.lead_number || ''}</div>
                          {booking.made_by_me && booking.lead_owner_name
                            && String(booking.lead_owner_id || '') !== String(user?.id || '') && (
                            <div style={{ fontSize: 10, color: 'var(--accent-orange, #C2410C)', marginTop: 2 }}
                              title="This booking's lead has since been re-engaged/reassigned. Your booking record stays with you.">
                              Lead now with: {booking.lead_owner_name}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{booking.project_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unit: {booking.unit_display}</div>
                        </td>
                        <td>{formatDate(booking.booking_date)}</td>
                        <td>
                          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={(e) => { e.stopPropagation(); openDetail(booking.id); }}>View</button>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && bookings.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
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
                {/* Payment/collection totals (paid, balance, progress, status) are
                    intentionally NOT shown here — those belong to Collection. This view
                    shows only what the Sales Head entered when making the booking. */}
                {(
                  <>
                    <div className="col-booking-header" style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="col-booking-customer">
                        <div style={{ fontSize: 14 }}>Customer: <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.customer?.first_name} {selectedBooking.customer?.last_name || ''}</strong></div>
                        {selectedBooking.relation_type && selectedBooking.relation_name && (
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Relation: <strong>{selectedBooking.relation_type} {selectedBooking.relation_name}</strong></div>
                        )}
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Project: <strong>{selectedBooking.project?.project_name || '-'}</strong> | Unit: <strong>{selectedBooking.unit_number || 'TBD'}</strong></div>
                        {selectedBooking.lead?.assignedTo
                          && String(selectedBooking.lead.assigned_to || '') !== String(selectedBooking.closed_by || '') && (
                          <div style={{ fontSize: 12, color: 'var(--accent-orange, #C2410C)', marginTop: 2 }}>
                            Lead now with: <strong>{`${selectedBooking.lead.assignedTo.first_name || ''} ${selectedBooking.lead.assignedTo.last_name || ''}`.trim()}</strong> · this booking record stays with you
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {selectedBooking.lead_id && (
                          <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={handleViewLead}>
                            <LinkIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />View Lead
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Full read-only booking details — every field the SH filled */}
                    <div style={{ marginTop: 20 }}>
                      {buildBookingSections(selectedBooking).map((sec) => (
                        <div key={sec.title} style={{ marginBottom: 18 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6 }}>{sec.title}</h3>
                          <div className="sh-booking-detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px 20px' }}>
                            {sec.rows.map(([label, val]) => (
                              <div key={label}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{val}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
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
