import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { getErrorMessage } from '../../../utils/helpers';
import {
  MagnifyingGlassIcon, ArrowPathIcon, ClipboardDocumentListIcon,
  EyeIcon, CheckCircleIcon, ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import '../common/LeadWorkspacePage.css';
import '../collection/CollectionWorkspace.css';

const fmtDate = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

const RecordManagerBookings = ({ onSelectBooking }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  // Debounce the search box so we don't hit the API on every keystroke.
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [searchInput]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getAll({
        status_code: 'REGISTERED',
        with_documents: 1,
        is_cancelled: 'false',
        search: search || undefined,
        page,
        limit: pageSize,
      });
      const rows = resp.data?.data?.rows || resp.data?.data || [];
      setBookings(Array.isArray(rows) ? rows : []);
      setTotal(resp.data?.pagination?.total ?? rows.length ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load registered bookings'));
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const renderUploadStatus = (booking) => {
    const count = booking.document_count ?? (booking.has_documents ? 1 : 0);
    if (count > 0) {
      return (
        <span className="col-badge" style={{ background: '#16A34A22', color: '#16A34A' }}>
          <CheckCircleIcon style={{ width: 13, height: 13 }} /> Uploaded{count > 1 ? ` (${count})` : ''}
        </span>
      );
    }
    return (
      <span className="col-badge" style={{ background: '#F59E0B22', color: '#B45309' }}>
        <ExclamationCircleIcon style={{ width: 13, height: 13 }} /> Pending
      </span>
    );
  };

  return (
    <div className="col-bookings-page">
      {/* ── Header ── */}
      <header className="lead-workspace__header">
        <div>
          <h1>Registered Bookings</h1>
          <p className="hide-mobile">Upload registration documents and record the registration number</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={loadBookings} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* ── Toolbar (search) ── */}
      <div className="lead-workspace__toolbar">
        <div className="lead-workspace__toolbar-search">
          <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by registration date, doc number, project / phase / unit or buyer name"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="crm-card">
        <div className="crm-card-body-flush">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
            <small className="filter-tabs__records">{total} registered booking{total === 1 ? '' : 's'}</small>
          </div>

          {loading ? (
            <div className="simple-loader">
              <div className="simple-spinner" />
              <p>Loading...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="col-empty">
              <div className="col-empty-icon"><ClipboardDocumentListIcon style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
              <div className="col-empty-title">{search ? 'No bookings match your search' : 'No registered bookings yet'}</div>
              <div className="col-empty-desc">{search ? 'Try a different search term' : 'Registered bookings will appear here'}</div>
            </div>
          ) : (
            <div className="lead-workspace__table-wrap">
              <table className="lead-workspace__table">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Registration Date</th>
                    <th style={{ width: 'auto' }}>Buyer</th>
                    <th className="hide-mobile" style={{ width: 140 }}>File Status</th>
                    <th className="hide-mobile" style={{ width: 150 }}>Doc Number</th>
                    <th className="hide-mobile" style={{ width: 220 }}>Project · Phase · Unit</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ textAlign: 'center', width: 90 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} style={{ cursor: 'pointer' }} onClick={() => onSelectBooking(booking.id)}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDate(booking.registration_date)}</td>
                      <td className="lead-col-lead">
                        <p className="lead-title">{booking.buyer_name || booking.customer_name || '—'}</p>
                        <small>{booking.booking_number}</small>
                      </td>
                      <td className="hide-mobile">{renderUploadStatus(booking)}</td>
                      <td className="hide-mobile" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {booking.registration_number || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="hide-mobile">
                        <span style={{ fontSize: 12 }}>{booking.project_unit_display || booking.project_name || '—'}</span>
                      </td>
                      <td>
                        <span className="col-badge" style={{ background: `${booking.status_color || '#16A34A'}22`, color: booking.status_color || '#16A34A' }}>
                          <span className="col-badge-dot" style={{ background: booking.status_color || '#16A34A' }} />
                          {booking.status_label || 'Registered'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="col-qa-btn col-qa-view"
                          title="Open"
                          onClick={(e) => { e.stopPropagation(); onSelectBooking(booking.id); }}
                        >
                          <EyeIcon style={{ width: 15, height: 15 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordManagerBookings;
