import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  CreditCardIcon, ChartBarIcon, CheckCircleIcon, ClockIcon,
  XCircleIcon, ArrowPathIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import PaymentDetailModal from '../../../components/common/PaymentDetailModal';
import '../../portals/collection/CollectionWorkspace.css';
import '../Reports/Reports.css';

const FILTERS = [
  { key: 'all', label: 'Total Payments', icon: ChartBarIcon, color: 'blue' },
  { key: 'verified', label: 'Verified', icon: CheckCircleIcon, color: 'green' },
  { key: 'pending', label: 'Unverified', icon: ClockIcon, color: 'yellow' },
  { key: 'bounced', label: 'Rejected', icon: XCircleIcon, color: 'red' },
];

const extractRows = (data) => (Array.isArray(data) ? data : (data?.rows || data?.payments || []));

const FinanceRevenue = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookingApi.getAllPayments({ limit: 1000 });
      const data = res.data?.data || res.data;
      setPayments(extractRows(data));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load payments'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all: payments.length,
    verified: payments.filter((p) => p.is_verified).length,
    pending: payments.filter((p) => !p.is_verified && !p.is_bounced).length,
    bounced: payments.filter((p) => p.is_bounced).length,
  }), [payments]);

  const filtered = useMemo(() => {
    const byStatus = filter === 'all' ? payments
      : filter === 'verified' ? payments.filter((p) => p.is_verified)
      : filter === 'pending' ? payments.filter((p) => !p.is_verified && !p.is_bounced)
      : payments.filter((p) => p.is_bounced);
    const s = search.trim().toLowerCase();
    const rows = !s ? byStatus : byStatus.filter((p) => (
      (p.booking_number || '').toLowerCase().includes(s)
      || (p.customer_name || '').toLowerCase().includes(s)
      || (p.payment_number || '').toLowerCase().includes(s)
    ));
    return [...rows].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  }, [payments, filter, search]);

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filtered, 25);

  return (
    <div className="reports-page">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><CreditCardIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Revenue</h1>
          <p className="hidden sm:block">All payment transactions across bookings</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={load}><ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh</button>
        </div>
      </div>

      <div className="col-stats-grid grid-cols-2 md:grid-cols-4 gap-3">
        {FILTERS.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="col-stat-card" style={{ cursor: 'pointer', border: filter === key ? `2px solid var(--accent-${color})` : undefined }} onClick={() => setFilter(key)}>
            <div className="col-stat-icon" style={{ background: `var(--accent-${color}-bg)`, color: `var(--accent-${color})` }}><Icon style={{ width: 20, height: 20 }} /></div>
            <div className="col-stat-info"><div className="col-stat-value">{counts[key]}</div><div className="col-stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      <div className="col-section" style={{ marginBottom: 16 }}>
        <div className="col-section-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Showing {filtered.length} payment{filtered.length !== 1 ? 's' : ''}</span>
          <div style={{ position: 'relative' }}>
            <MagnifyingGlassIcon style={{ width: 15, height: 15, position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
            <input className="col-form-input" style={{ paddingLeft: 32, width: 240, height: 34 }} placeholder="Search booking / customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="col-empty"><div className="col-empty-icon"><ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">Loading payments...</div></div>
      ) : filtered.length === 0 ? (
        <div className="col-section"><div className="col-empty"><div className="col-empty-icon"><CreditCardIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">No payments found</div></div></div>
      ) : (
        <div className="col-section">
          <div className="col-section-body-flush" style={{ overflowX: 'auto' }}>
            <table className="col-table">
              <thead>
                <tr>
                  <th>Payment #</th><th>Booking</th><th>Customer</th><th>Type</th>
                  <th>Mode</th><th>Amount</th><th>Date</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id} className={p.is_bounced ? 'col-payment-bounced' : ''} style={{ cursor: 'pointer' }} onClick={() => setSelectedPayment(p)} title="View payment details">
                    <td style={{ fontWeight: 600 }}>{p.payment_number}</td>
                    <td style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{p.booking_number}</td>
                    <td>{p.customer_name}</td>
                    <td>{p.payment_type}</td>
                    <td><span className="col-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>{p.payment_mode}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(p.amount)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(p.payment_date)}</td>
                    <td>
                      {p.is_verified ? <span className="col-badge col-badge-neutral">Verified</span>
                        : p.is_bounced ? <span className="col-badge" style={{ background: 'var(--accent-red-bg)', color: 'var(--accent-red)' }}>Rejected</span>
                        : <span className="col-badge" style={{ background: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)' }}>Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      )}

      {selectedPayment && (
        <PaymentDetailModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} onSaved={load} />
      )}
    </div>
  );
};

export default FinanceRevenue;
