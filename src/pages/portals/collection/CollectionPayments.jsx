import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrencyExact as formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  CreditCardIcon, ArrowPathIcon, MagnifyingGlassIcon, FunnelIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import RecordPaymentModal from '../../../components/common/RecordPaymentModal';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import './CollectionWorkspace.css';

const canEditPayment = (p) => !!p && !p.is_verified && !p.is_bounced && !p.is_refund;

const CollectionPayments = ({ user, onSelectBooking }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePayment, setActivePayment] = useState(null);

  const [selectedTowards, setSelectedTowards] = useState([]);
  const [selectedModes, setSelectedModes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [showTowardsFilter, setShowTowardsFilter] = useState(false);
  const [showModeFilter, setShowModeFilter] = useState(false);
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const towardsFilterRef = useRef(null);
  const modeFilterRef = useRef(null);
  const typeFilterRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getMyBookings({ limit: 200 });
      const raw = resp.data?.data?.rows || resp.data?.data || resp.data || [];
      setBookings(Array.isArray(raw) ? raw : []);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to load')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (towardsFilterRef.current && !towardsFilterRef.current.contains(e.target)) {
        setShowTowardsFilter(false);
      }
      if (modeFilterRef.current && !modeFilterRef.current.contains(e.target)) {
        setShowModeFilter(false);
      }
      if (typeFilterRef.current && !typeFilterRef.current.contains(e.target)) {
        setShowTypeFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allPayments = useMemo(() => {
    return bookings.flatMap(b =>
      (b.payments || []).map(p => ({
        ...p,
        booking_number: b.booking_number,
        customer_name: b.customer_name || b.customer?.first_name || '',
        project_name: b.project_name || b.project?.project_name || '',
      }))
    ).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  }, [bookings]);

  const towardsOptions = useMemo(() => {
    const set = new Set();
    allPayments.forEach(p => {
      if (p.payment_category) set.add(p.payment_category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, label: v }));
  }, [allPayments]);

  const modeOptions = useMemo(() => {
    const set = new Set();
    allPayments.forEach(p => {
      if (p.payment_mode) set.add(p.payment_mode);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, label: v }));
  }, [allPayments]);

  const typeOptions = useMemo(() => {
    const set = new Set();
    allPayments.forEach(p => {
      if (p.payment_type) set.add(p.payment_type);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b)).map(v => ({ value: v, label: v }));
  }, [allPayments]);

  const handleTowardsToggle = (val) => {
    setSelectedTowards(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };
  const handleModeToggle = (val) => {
    setSelectedModes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };
  const handleTypeToggle = (val) => {
    setSelectedTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const filtered = useMemo(() => {
    let list = allPayments;
    if (selectedTowards.length > 0) {
      list = list.filter(p => selectedTowards.includes(p.payment_category));
    }
    if (selectedModes.length > 0) {
      list = list.filter(p => selectedModes.includes(p.payment_mode));
    }
    if (selectedTypes.length > 0) {
      list = list.filter(p => selectedTypes.includes(p.payment_type));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        (p.payment_number || '').toLowerCase().includes(q) ||
        (p.booking_number || '').toLowerCase().includes(q) ||
        (p.customer_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allPayments, searchQuery, selectedTowards, selectedModes, selectedTypes]);

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filtered, 25);

  const clearAllFilters = () => {
    setSelectedTowards([]);
    setSelectedModes([]);
    setSelectedTypes([]);
  };

  const totalVerified = allPayments.filter(p => p.is_verified).length;
  const totalUnverified = allPayments.filter(p => !p.is_verified && !p.is_bounced).length;
  const totalRejected = allPayments.filter(p => p.is_bounced).length;

  return (
    <div className="col-bookings-page">
      <header className="lead-workspace__header">
        <div>
          <h1><CreditCardIcon style={{ width: 22, height: 22, marginRight: 6 }} />Payments</h1>
          <p className="hide-mobile">Track all payment transactions across your bookings</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={load} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="col-stats-grid" style={{ marginBottom: 16 }}>
        <div className="col-stat-card">
          <div className="col-stat-info">
            <div className="col-stat-value">{allPayments.length}</div>
            <div className="col-stat-label">Total Payments</div>
          </div>
        </div>
        <div className="col-stat-card">
          <div className="col-stat-info">
            <div className="col-stat-value" style={{ color: '#16a34a' }}>{totalVerified}</div>
            <div className="col-stat-label">Verified</div>
          </div>
        </div>
        <div className="col-stat-card">
          <div className="col-stat-info">
            <div className="col-stat-value" style={{ color: '#f59e0b' }}>{totalUnverified}</div>
            <div className="col-stat-label">Unverified</div>
          </div>
        </div>
        <div className="col-stat-card">
          <div className="col-stat-info">
            <div className="col-stat-value" style={{ color: '#ef4444' }}>{totalRejected}</div>
            <div className="col-stat-label">Rejected</div>
          </div>
        </div>
      </div>

      <div className="lead-workspace__toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
        <div className="lead-workspace__toolbar-search" style={{ flex: '0 1 400px', minWidth: '200px', order: 1 }}>
          <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by payment #, booking, customer"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, order: 2 }}>
          <div style={{ position: 'relative' }} ref={towardsFilterRef}>
            <button
              type="button"
              className={`workspace-btn workspace-btn--ghost ${selectedTowards.length > 0 ? 'has-filter' : ''}`}
              onClick={() => setShowTowardsFilter(!showTowardsFilter)}
            >
              <FunnelIcon style={{ width: 14, height: 14 }} />
              Towards
              {selectedTowards.length > 0 && (
                <span style={{ marginLeft: 4, background: '#3B82F6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                  {selectedTowards.length}
                </span>
              )}
            </button>
            {showTowardsFilter && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-header">
                  <span>Filter by Towards</span>
                  {selectedTowards.length > 0 && (
                    <button type="button" className="filter-clear-btn" onClick={() => setSelectedTowards([])}>Clear</button>
                  )}
                </div>
                <div className="filter-dropdown-list">
                  {towardsOptions.map(opt => (
                    <label key={opt.value} className="filter-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedTowards.includes(opt.value)}
                        onChange={() => handleTowardsToggle(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }} ref={modeFilterRef}>
            <button
              type="button"
              className={`workspace-btn workspace-btn--ghost ${selectedModes.length > 0 ? 'has-filter' : ''}`}
              onClick={() => setShowModeFilter(!showModeFilter)}
            >
              <FunnelIcon style={{ width: 14, height: 14 }} />
              Mode
              {selectedModes.length > 0 && (
                <span style={{ marginLeft: 4, background: '#3B82F6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                  {selectedModes.length}
                </span>
              )}
            </button>
            {showModeFilter && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-header">
                  <span>Filter by Mode</span>
                  {selectedModes.length > 0 && (
                    <button type="button" className="filter-clear-btn" onClick={() => setSelectedModes([])}>Clear</button>
                  )}
                </div>
                <div className="filter-dropdown-list">
                  {modeOptions.map(opt => (
                    <label key={opt.value} className="filter-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedModes.includes(opt.value)}
                        onChange={() => handleModeToggle(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }} ref={typeFilterRef}>
            <button
              type="button"
              className={`workspace-btn workspace-btn--ghost ${selectedTypes.length > 0 ? 'has-filter' : ''}`}
              onClick={() => setShowTypeFilter(!showTypeFilter)}
            >
              <FunnelIcon style={{ width: 14, height: 14 }} />
              Type
              {selectedTypes.length > 0 && (
                <span style={{ marginLeft: 4, background: '#3B82F6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                  {selectedTypes.length}
                </span>
              )}
            </button>
            {showTypeFilter && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-header">
                  <span>Filter by Type</span>
                  {selectedTypes.length > 0 && (
                    <button type="button" className="filter-clear-btn" onClick={() => setSelectedTypes([])}>Clear</button>
                  )}
                </div>
                <div className="filter-dropdown-list">
                  {typeOptions.map(opt => (
                    <label key={opt.value} className="filter-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(opt.value)}
                        onChange={() => handleTypeToggle(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(selectedTowards.length > 0 || selectedModes.length > 0 || selectedTypes.length > 0) && (
            <button
              type="button"
              className="workspace-btn workspace-btn--ghost"
              onClick={clearAllFilters}
              style={{ color: '#EF4444' }}
            >
              <XMarkIcon style={{ width: 14, height: 14 }} /> Clear all
            </button>
          )}
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body-flush">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
            <small className="filter-tabs__records">{filtered.length} record{filtered.length === 1 ? '' : 's'}</small>
          </div>

          {loading ? (
            <div className="simple-loader">
              <div className="simple-spinner" />
              <p>Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-empty">
              <div className="col-empty-icon"><CreditCardIcon style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
              <div className="col-empty-title">{searchQuery || selectedTowards.length > 0 || selectedModes.length > 0 || selectedTypes.length > 0 ? 'No payments match your filters' : 'No payments found'}</div>
              <div className="col-empty-desc">{searchQuery || selectedTowards.length > 0 || selectedModes.length > 0 || selectedTypes.length > 0 ? 'Try adjusting your search or filters' : 'Payments will appear here when recorded against bookings'}</div>
            </div>
          ) : (
            <div className="lead-workspace__table-wrap">
              <table className="lead-workspace__table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Payment #</th>
                    <th style={{ width: 'auto' }}>Booking</th>
                    <th className="hide-mobile" style={{ width: 100 }}>Type</th>
                    <th className="hide-mobile" style={{ width: 100 }}>Mode</th>
                    <th className="hide-mobile" style={{ width: 120 }}>Amount</th>
                    <th className="hide-mobile" style={{ width: 110 }}>Date</th>
                    <th className="hide-mobile" style={{ width: 130 }}>Towards</th>
                    <th style={{ width: 100 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(p => (
                    <tr
                      key={p.id}
                      className={p.is_bounced ? 'col-payment-bounced' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActivePayment({ bookingId: p.booking_id, paymentId: p.id, readOnly: !canEditPayment(p) })}
                      title={canEditPayment(p) ? 'Edit payment' : 'View payment details'}
                    >
                      <td style={{ fontWeight: 600, color: '#2563eb' }}>{p.payment_number}</td>
                      <td>
                        <p className="lead-title">{p.customer_name || '—'}</p>
                        <small>
                          <button type="button" className="col-booking-link" onClick={(e) => { e.stopPropagation(); onSelectBooking && onSelectBooking(p.booking_id); }}>
                            {p.booking_number}
                          </button>
                        </small>
                      </td>
                      <td className="hide-mobile">{p.payment_type}</td>
                      <td className="hide-mobile">{p.payment_mode}</td>
                      <td className="hide-mobile">{formatCurrency(p.amount)}</td>
                      <td className="hide-mobile">{formatDate(p.payment_date)}</td>
                      <td className="hide-mobile">{p.payment_category || '—'}</td>
                      <td>
                        {p.is_verified ? <span className="bkd-badge bkd-badge-success">Verified</span>
                          : p.is_bounced ? <span className="bkd-badge bkd-badge-danger">Rejected</span>
                          : <span className="bkd-badge bkd-badge-warning">Unverified</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
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

      {activePayment && (
        <RecordPaymentModal
          bookingId={activePayment.bookingId}
          paymentId={activePayment.paymentId}
          readOnly={activePayment.readOnly}
          onClose={() => setActivePayment(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export { CollectionPayments };
export default CollectionPayments;
