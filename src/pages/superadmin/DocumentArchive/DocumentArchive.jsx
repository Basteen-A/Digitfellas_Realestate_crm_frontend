import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon, ArrowPathIcon, ArrowDownTrayIcon, DocumentMagnifyingGlassIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import bookingApi from '../../../api/bookingApi';
import { getErrorMessage } from '../../../utils/helpers';
import Pagination from '../../../components/common/Pagination';
import './DocumentArchive.css';

const fmtDate = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—');

const DOC_TYPES = [
  'Registration Document',
  'Sale Deed',
  'Mortgage Deed',
  'Gift Deed',
  'Exchange Deed',
  'Partition Deed',
  'Settlement Deed',
  'Release Deed',
  'General Power',
  'Specific Power',
  'Will',
  'Trust Deed',
  'Partnership Deed',
  'Death Certificate',
  'Legalheir Certificate',
  'Agreement',
  'Receipt',
  'ID Proof',
  'Other'
];

const DocumentArchive = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getDocumentArchive({
        search: search || undefined,
        document_type: documentType || undefined,
        date: date || undefined,
        page,
        limit: pageSize,
      });
      const data = resp.data?.data || [];
      setRows(Array.isArray(data) ? data : []);
      setTotal(resp.data?.meta?.total ?? data.length ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load document archive'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, documentType, date, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const handleReopen = async (row) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Re-open registration record for booking ${row.booking_number}? It will return to the Record Manager's list.`)) return;
    try {
      await bookingApi.updateRecordStatus(row.booking_id, { record_status: 'OPEN' });
      toast.success('Record re-opened');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to re-open record'));
    }
  };

  return (
    <div className="doc-archive">
      <header className="doc-archive__header">
        <div>
          <h1>Document Archive</h1>
          <p>Search every registration record — open and completed. This is a read-only archive.</p>
        </div>
        <button type="button" className="doc-archive__refresh" onClick={load} disabled={loading}>
          <ArrowPathIcon className="doc-archive__icon" /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="doc-archive__toolbar">
        <div className="doc-archive__search">
          <MagnifyingGlassIcon className="doc-archive__icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by document name, booking ID, document type, buyer or seller"
          />
        </div>
        <select
          className="doc-archive__filter"
          value={documentType}
          onChange={(e) => { setDocumentType(e.target.value); setPage(1); }}
        >
          <option value="">All Document Types</option>
          {DOC_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <input
          type="date"
          className="doc-archive__filter"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1); }}
          title="Filter by date"
        />
      </div>

      <div className="doc-archive__card">
        <div className="doc-archive__count">{total} record{total === 1 ? '' : 's'}</div>

        {loading ? (
          <div className="doc-archive__empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="doc-archive__empty">
            <DocumentMagnifyingGlassIcon className="doc-archive__empty-icon" />
            <div>No records match your search.</div>
          </div>
        ) : (
          <div className="doc-archive__table-wrap">
            <table className="doc-archive__table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>Booking ID</th>
                  <th>Doc Date</th>
                  <th>Type</th>
                  <th>Buyer</th>
                  <th>Seller</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const href = row.file_url;
                  const completed = row.record_status === 'COMPLETED';
                  return (
                    <tr key={row.document_id || `${row.booking_id}-${idx}`}>
                      <td className="doc-archive__name">{row.document_name || <span className="doc-archive__muted">— no file uploaded —</span>}</td>
                      <td className="doc-archive__mono">{row.booking_number}</td>
                      <td>{fmtDate(row.registration_document_date || row.registration_date)}</td>
                      <td>
                        {row.document_type && !String(row.document_type).includes('/')
                          ? <span className="doc-archive__tag">{row.document_type}</span>
                          : <span className="doc-archive__muted">—</span>}
                      </td>
                      <td>{row.buyer_name || '—'}</td>
                      <td>{row.seller_name || '—'}</td>
                      <td>
                        <span className={`doc-archive__status ${completed ? 'is-completed' : 'is-open'}`}>
                          {completed ? 'Completed' : 'Open'}
                        </span>
                      </td>
                      <td className="doc-archive__muted">{fmtDateTime(row.uploaded_at)}{row.uploaded_by_name ? ` · ${row.uploaded_by_name}` : ''}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="doc-archive__actions">
                          {href && (
                            <a className="doc-archive__icon-btn" href={href} target="_blank" rel="noreferrer" title="View / download">
                              <ArrowDownTrayIcon className="doc-archive__icon" />
                            </a>
                          )}
                          {completed && (
                            <button type="button" className="doc-archive__icon-btn" title="Re-open record" onClick={() => handleReopen(row)}>
                              <ArrowUturnLeftIcon className="doc-archive__icon" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
  );
};

export default DocumentArchive;
