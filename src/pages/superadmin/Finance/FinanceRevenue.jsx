// Super Admin › Finance › Revenue.
//
// This is the org-wide twin of the Collection portal's Payments screen
// (portals/collection/CollectionPayments.jsx) and is deliberately kept
// IDENTICAL to it in layout, filters, columns, wording and badges — same
// header, same four stat cards, same search + multi-select filter dropdowns,
// same record-count bar, same table. Only two things differ, both on purpose:
//   • the data source is every payment in the organisation (getAllPayments)
//     rather than one collection user's own bookings, and
//   • a Status filter is offered alongside Towards / Type / Mode, because this
//     screen previously filtered by verification status via its stat cards.
// If that screen changes, change this one with it.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrencyExact as formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  CreditCardIcon, ArrowPathIcon, MagnifyingGlassIcon, FunnelIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import PaymentDetailModal from '../../../components/common/PaymentDetailModal';
import '../../portals/collection/CollectionWorkspace.css';
import '../../portals/common/LeadWorkspacePage.css';

const extractRows = (data) => (Array.isArray(data) ? data : (data?.rows || data?.payments || []));

// The three verification states, resolved the same way the badge renders them.
const statusOf = (p) => (p.is_verified ? 'Verified' : p.is_bounced ? 'Rejected' : 'Unverified');

// Distinct values of one field, alphabetically — the option list of a filter.
const optionsOf = (rows, pick) => {
  const set = new Set();
  rows.forEach((r) => { const v = pick(r); if (v) set.add(v); });
  return Array.from(set).sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
};

/**
 * One multi-select filter button + dropdown, rendering exactly the markup the
 * Collection Payments toolbar uses (.workspace-btn + .filter-dropdown).
 */
const FilterDropdown = ({ label, options, selected, onToggle, onClear }) => {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        className={`workspace-btn workspace-btn--ghost ${selected.length > 0 ? 'has-filter' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <FunnelIcon style={{ width: 14, height: 14 }} />
        {label}
        {selected.length > 0 && (
          <span style={{ marginLeft: 4, background: '#3B82F6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <div className="filter-dropdown">
          <div className="filter-dropdown-header">
            <span>Filter by {label}</span>
            {selected.length > 0 && (
              <button type="button" className="filter-clear-btn" onClick={onClear}>Clear</button>
            )}
          </div>
          <div className="filter-dropdown-list">
            {options.map((opt) => (
              <label key={opt.value} className="filter-checkbox-item">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => onToggle(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FinanceRevenue = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);

  const [selectedTowards, setSelectedTowards] = useState([]);
  const [selectedModes, setSelectedModes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);

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

  const allPayments = useMemo(
    () => [...payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)),
    [payments],
  );

  const towardsOptions = useMemo(() => optionsOf(allPayments, (p) => p.payment_category), [allPayments]);
  const modeOptions = useMemo(() => optionsOf(allPayments, (p) => p.payment_mode), [allPayments]);
  const typeOptions = useMemo(() => optionsOf(allPayments, (p) => p.payment_type), [allPayments]);
  const statusOptions = useMemo(() => optionsOf(allPayments, statusOf), [allPayments]);

  const toggler = (setter) => (val) => setter((prev) => (
    prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
  ));

  const filtered = useMemo(() => {
    let list = allPayments;
    if (selectedTowards.length > 0) list = list.filter((p) => selectedTowards.includes(p.payment_category));
    if (selectedModes.length > 0) list = list.filter((p) => selectedModes.includes(p.payment_mode));
    if (selectedTypes.length > 0) list = list.filter((p) => selectedTypes.includes(p.payment_type));
    if (selectedStatuses.length > 0) list = list.filter((p) => selectedStatuses.includes(statusOf(p)));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        (p.payment_number || '').toLowerCase().includes(q)
        || (p.booking_number || '').toLowerCase().includes(q)
        || (p.customer_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [allPayments, searchQuery, selectedTowards, selectedModes, selectedTypes, selectedStatuses]);

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filtered, 25);

  const hasFilters = selectedTowards.length > 0 || selectedModes.length > 0
    || selectedTypes.length > 0 || selectedStatuses.length > 0;

  const clearAllFilters = () => {
    setSelectedTowards([]);
    setSelectedModes([]);
    setSelectedTypes([]);
    setSelectedStatuses([]);
  };

  const totalVerified = allPayments.filter((p) => p.is_verified).length;
  const totalUnverified = allPayments.filter((p) => !p.is_verified && !p.is_bounced).length;
  const totalRejected = allPayments.filter((p) => p.is_bounced).length;

  return (
    <div className="col-bookings-page">
      <header className="lead-workspace__header">
        <div>
          <h1><CreditCardIcon style={{ width: 22, height: 22, marginRight: 6 }} />Revenue</h1>
          <p className="hide-mobile">Track all payment transactions across all bookings</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={load} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Stat cards use the shared dashboard card (.col-stat-card-new) so the
          hover lift/shadow matches every other Collection & Accounts screen. */}
      <div className="col-stat-grid-new" style={{ marginBottom: 16 }}>
        <div className="col-stat-card-new">
          <div className="col-stat-label-new">Total Payments</div>
          <div className="col-stat-value-new">{allPayments.length}</div>
        </div>
        <div className="col-stat-card-new">
          <div className="col-stat-label-new">Verified</div>
          <div className="col-stat-value-new">{totalVerified}</div>
        </div>
        <div className="col-stat-card-new">
          <div className="col-stat-label-new">Unverified</div>
          <div className="col-stat-value-new">{totalUnverified}</div>
        </div>
        <div className="col-stat-card-new">
          <div className="col-stat-label-new">Rejected</div>
          <div className="col-stat-value-new">{totalRejected}</div>
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
          <FilterDropdown
            label="Towards"
            options={towardsOptions}
            selected={selectedTowards}
            onToggle={toggler(setSelectedTowards)}
            onClear={() => setSelectedTowards([])}
          />
          <FilterDropdown
            label="Mode"
            options={modeOptions}
            selected={selectedModes}
            onToggle={toggler(setSelectedModes)}
            onClear={() => setSelectedModes([])}
          />
          <FilterDropdown
            label="Type"
            options={typeOptions}
            selected={selectedTypes}
            onToggle={toggler(setSelectedTypes)}
            onClear={() => setSelectedTypes([])}
          />
          <FilterDropdown
            label="Status"
            options={statusOptions}
            selected={selectedStatuses}
            onToggle={toggler(setSelectedStatuses)}
            onClear={() => setSelectedStatuses([])}
          />

          {hasFilters && (
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
              <div className="col-empty-title">{searchQuery || hasFilters ? 'No payments match your filters' : 'No payments found'}</div>
              <div className="col-empty-desc">{searchQuery || hasFilters ? 'Try adjusting your search or filters' : 'Payments will appear here when recorded against bookings'}</div>
            </div>
          ) : (
            <div className="lead-workspace__table-wrap">
              <table className="lead-workspace__table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Payment #</th>
                    <th style={{ width: 'auto' }}>Booking</th>
                    <th className="hide-mobile" style={{ width: 130 }}>Towards</th>
                    <th className="hide-mobile" style={{ width: 100 }}>Type</th>
                    <th className="hide-mobile" style={{ width: 100 }}>Mode</th>
                    <th className="hide-mobile" style={{ width: 120 }}>Amount</th>
                    <th className="hide-mobile" style={{ width: 110 }}>Date</th>
                    <th style={{ width: 100 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => (
                    <tr
                      key={p.id}
                      className={p.is_bounced ? 'col-payment-bounced' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedPayment(p)}
                      title="View payment details"
                    >
                      <td style={{ fontWeight: 600, color: '#2563eb' }}>{p.payment_number}</td>
                      <td>
                        <p className="lead-title">{p.customer_name || '—'}</p>
                        <small>{p.booking_number}</small>
                      </td>
                      <td className="hide-mobile">{p.payment_category || '—'}</td>
                      <td className="hide-mobile">{p.payment_type}</td>
                      <td className="hide-mobile">{p.payment_mode}</td>
                      <td className="hide-mobile">{formatCurrency(p.amount)}</td>
                      <td className="hide-mobile">{formatDate(p.payment_date)}</td>
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

      {selectedPayment && (
        <PaymentDetailModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} onSaved={load} />
      )}
    </div>
  );
};

export default FinanceRevenue;
