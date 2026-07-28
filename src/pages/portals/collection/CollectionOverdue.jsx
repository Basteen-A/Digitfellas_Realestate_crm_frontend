import React, { useState, useEffect, useCallback } from 'react';
import bookingApi from '../../../api/bookingApi';
import { formatCurrencyExact as formatCurrency } from '../../../utils/formatters';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import './CollectionWorkspace.css';

const fmt = (v) => formatCurrency(v);

const CollectionOverdue = ({ user, onSelectBooking }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookingApi.getMyBookings({ limit: 100 });
      const data = res.data?.data || res.data;
      const rows = (data?.rows || []).filter((b) => {
        if (b.is_cancelled) return false;
        const pending = b.net_amount - (b.total_paid || 0);
        if (pending <= 0) return false;
        // Overdue: payment_status === 'Overdue' OR next_follow_up_at is past
        if (b.payment_status === 'Overdue') return true;
        if (b.next_follow_up_at && new Date(b.next_follow_up_at) < new Date()) return true;
        return false;
      });
      rows.sort((a, b) => {
        const da = a.next_follow_up_at ? new Date(a.next_follow_up_at) : new Date();
        const db = b.next_follow_up_at ? new Date(b.next_follow_up_at) : new Date();
        return da - db; // oldest first
      });
      setBookings(rows);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const getDaysOverdue = (d) => {
    if (!d) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24)));
  };

  const totalOverdue = bookings.reduce((sum, b) => sum + (b.net_amount - (b.total_paid || 0)), 0);

  const filtered = bookings.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (b.booking_number || '').toLowerCase().includes(s) ||
      (b.customer_name || b.lead_name || '').toLowerCase().includes(s) ||
      (b.project_name || '').toLowerCase().includes(s)
    );
  });

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filtered, 25);

  return (
    <div className="col-dashboard-new">
      <div className="col-greeting-new">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExclamationTriangleIcon style={{ width: 24, height: 24, color: '#dc2626' }} />
          Overdue Payments
        </h1>
        <p style={{ color: 'var(--col-text-secondary)', marginTop: 4, fontSize: '0.875rem' }}>
          Bookings with pending payments past their due date
        </p>
      </div>

      {/* Summary */}
      <div className="col-stat-grid-new" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 20 }}>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="col-stat-label-new">Overdue Bookings</div>
          <div className="col-stat-value-new" style={{ color: '#dc2626' }}>{bookings.length}</div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="col-stat-label-new">Total Overdue Amount</div>
          <div className="col-stat-value-new" style={{ color: '#dc2626' }}>{fmt(totalOverdue)}</div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="col-stat-label-new">Critical ({'>'}30 days)</div>
          <div className="col-stat-value-new" style={{ color: '#f59e0b' }}>
            {bookings.filter((b) => getDaysOverdue(b.next_follow_up_at) > 30).length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="col-card-new" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--col-border)', display: 'flex', gap: 10 }}>
          <input
            type="text" placeholder="Search customer, booking..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--col-border)', background: 'var(--col-surface)', fontSize: '0.8rem' }}
          />
        </div>

        <div className="col-table-scroll" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {loading ? (
            <div className="simple-loader">
              <div className="simple-spinner" />
              <p>Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--col-text-secondary)' }}>
              No overdue payments! Great work.
            </div>
          ) : (
            <table className="col-table-new">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Project / Unit</th>
                  <th>Total Value</th>
                  <th>Collected</th>
                  <th>Overdue Amount</th>
                  <th>Days Overdue</th>
                  <th>Severity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((b) => {
                  const pending = b.net_amount - (b.total_paid || 0);
                  const days = getDaysOverdue(b.next_follow_up_at);
                  const severity = days > 30 ? 'col-badge-danger' : days > 14 ? 'col-badge-warning' : 'col-badge-secondary';
                  const severityLabel = days > 30 ? 'Critical' : days > 14 ? 'High' : 'Medium';
                  return (
                    <tr key={b.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{b.booking_number}</td>
                      <td><strong>{b.customer_name || b.lead_name || b.buyer_name || '—'}</strong></td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {b.project_name || '—'}
                        {b.unit_number ? ` · ${b.unit_number}` : ''}
                      </td>
                      <td>{fmt(b.net_amount)}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{fmt(b.total_paid)}</td>
                      <td style={{ color: '#dc2626', fontWeight: 700 }}>{fmt(pending)}</td>
                      <td style={{ fontWeight: 700 }}>{days} days</td>
                      <td><span className={`col-badge-new ${severity}`}>{severityLabel}</span></td>
                      <td>
                        {onSelectBooking && (
                          <button
                            onClick={() => onSelectBooking(b.id)}
                            style={{
                              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                              background: 'var(--col-primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                            }}
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {!loading && (
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
  );
};

export default CollectionOverdue;
