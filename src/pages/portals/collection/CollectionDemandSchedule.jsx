import React, { useState, useEffect, useCallback } from 'react';
import bookingApi from '../../../api/bookingApi';
import { formatCurrencyExact as formatCurrency } from '../../../utils/formatters';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import './CollectionWorkspace.css';

const fmt = (v) => formatCurrency(v);
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CollectionDemandSchedule = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookingApi.getMyBookings({ limit: 100 });
      const data = res.data?.data || res.data;
      const rows = (data?.rows || []).filter(
        (b) => !b.is_cancelled && b.net_amount > (b.total_paid || 0)
      );
      // Sort by next_follow_up_at (demand date)
      rows.sort((a, b) => {
        if (!a.next_follow_up_at) return 1;
        if (!b.next_follow_up_at) return -1;
        return new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at);
      });
      setBookings(rows);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const getDemandStatus = (b) => {
    const due = b.next_follow_up_at ? new Date(b.next_follow_up_at) : null;
    if (!due) return { label: 'No Date', cls: 'col-badge-secondary' };
    const now = new Date();
    const diff = Math.floor((due - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `${Math.abs(diff)}d Overdue`, cls: 'col-badge-danger' };
    if (diff <= 7) return { label: `${diff}d Left`, cls: 'col-badge-warning' };
    return { label: `${diff}d Left`, cls: 'col-badge-success' };
  };

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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Demand Schedule</h1>
        <p style={{ color: 'var(--col-text-secondary)', marginTop: 4, fontSize: '0.875rem' }}>
          Upcoming payment demands and installment schedule for your bookings
        </p>
      </div>

      {/* Summary stats */}
      <div className="col-stat-grid-new" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 20 }}>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="col-stat-label-new">Overdue</div>
          <div className="col-stat-value-new" style={{ color: '#dc2626' }}>
            {bookings.filter((b) => b.next_follow_up_at && new Date(b.next_follow_up_at) < new Date()).length}
          </div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="col-stat-label-new">Due This Week</div>
          <div className="col-stat-value-new" style={{ color: '#f59e0b' }}>
            {bookings.filter((b) => {
              if (!b.next_follow_up_at) return false;
              const diff = Math.floor((new Date(b.next_follow_up_at) - new Date()) / (1000*60*60*24));
              return diff >= 0 && diff <= 7;
            }).length}
          </div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #059669' }}>
          <div className="col-stat-label-new">Upcoming</div>
          <div className="col-stat-value-new" style={{ color: '#059669' }}>
            {bookings.filter((b) => {
              if (!b.next_follow_up_at) return false;
              return Math.floor((new Date(b.next_follow_up_at) - new Date()) / (1000*60*60*24)) > 7;
            }).length}
          </div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid var(--col-primary)' }}>
          <div className="col-stat-label-new">Total Pending</div>
          <div className="col-stat-value-new">
            {fmt(bookings.reduce((sum, b) => sum + (b.net_amount - (b.total_paid || 0)), 0))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="col-card-new" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--col-border)', display: 'flex', gap: 10 }}>
          <input
            type="text" placeholder="Search booking, customer, project..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--col-border)', background: 'var(--col-surface)', fontSize: '0.8rem' }}
          />
        </div>

        <div className="col-table-scroll" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--col-text-secondary)' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--col-text-secondary)' }}>No demands found</div>
          ) : (
            <table className="col-table-new">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Project</th>
                  <th>Total Value</th>
                  <th>Collected</th>
                  <th>Demand Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((b) => {
                  const pending = b.net_amount - (b.total_paid || 0);
                  const status = getDemandStatus(b);
                  return (
                    <tr key={b.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{b.booking_number}</td>
                      <td><strong>{b.customer_name || b.lead_name || b.buyer_name || '—'}</strong></td>
                      <td>{b.project_name || '—'}</td>
                      <td>{fmt(b.net_amount)}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{fmt(b.total_paid)}</td>
                      <td style={{ color: '#dc2626', fontWeight: 700 }}>{fmt(pending)}</td>
                      <td style={{ fontSize: '0.75rem' }}>{fmtDate(b.next_follow_up_at)}</td>
                      <td><span className={`col-badge-new ${status.cls}`}>{status.label}</span></td>
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

export default CollectionDemandSchedule;
