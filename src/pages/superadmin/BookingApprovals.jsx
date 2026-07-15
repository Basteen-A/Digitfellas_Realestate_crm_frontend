import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../api/bookingApi';
import bookingStatusApi from '../../api/bookingStatusApi';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import {
  CreditCardIcon, ArrowPathIcon, ChevronRightIcon, ChevronDownIcon,
  MagnifyingGlassIcon, FunnelIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import { useAuthContext } from '../../contexts/AuthContext';
import CollectionBookingDetail from '../portals/collection/CollectionBookingDetail';
import { badgeStyle, badgeColors } from '../../utils/badgeColors';
import './BookingApprovals.css';

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];
const colorFor = (id) => {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
const avatarInitials = (u) => `${(u?.first_name || '?')[0] || ''}${(u?.last_name || '')[0] || ''}`.toUpperCase();
const fullNameOf = (u) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim();

const getComputedTotalValue = (booking) => {
  if (!booking) return 0;
  const toAmount = (v) => {
    const n = parseFloat(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const plotValue = toAmount(booking.plot_value || booking.base_price || booking.total_amount || booking.net_amount);
  const stampValue = toAmount(booking.stamp_value || booking.stamp_duty);
  const registrationValue = toAmount(booking.registration_exp || booking.registration_charges);
  const developmentValue = toAmount(booking.development_charges);
  const computedTotalValue = plotValue + stampValue + registrationValue + developmentValue;
  return computedTotalValue > 0 ? computedTotalValue : toAmount(booking.net_amount || booking.total_amount);
};

const customerName = (b) => (b.customer?.buyer_name
  || `${b.customer?.first_name || ''} ${b.customer?.last_name || ''}`.trim()
  || b.buyer_name || b.customer_name || '—');

const unitOf = (b) => b.unit_number || b.inventoryUnit?.unit_number || (b.unit_display && b.unit_display !== 'N/A' ? b.unit_display : null);

const statusOf = (b) => {
  const code = b.bookingStatus?.status_code || b.status_code;
  const cancelApproved = code === 'REQUEST_TO_CANCEL' && !!b.custom_fields?.cancel_approved_by;
  if (cancelApproved) return { label: 'Cancel Pending', color: '#C2410C' };
  return {
    label: b.status_label || b.bookingStatus?.status_name || '—',
    color: b.status_color || b.bookingStatus?.color_code || '#6B7280',
  };
};

const BookingApprovals = () => {
  const { user } = useAuthContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusList, setStatusList] = useState([]);
  
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showProjectFilter, setShowProjectFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const projectFilterRef = useRef(null);
  const statusFilterRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getAll({ limit: 500 });
      setRows(resp.data?.data || resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load bookings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bookingStatusApi.getDropdown()
      .then((r) => setStatusList(r.data?.data || r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (projectFilterRef.current && !projectFilterRef.current.contains(e.target)) {
        setShowProjectFilter(false);
      }
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target)) {
        setShowStatusFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const projects = useMemo(() => {
    const projectMap = new Map();
    rows.forEach((b) => {
      const id = b.project_id || b.project?.id;
      const name = b.project?.project_name || b.project_name;
      if (id && name && !projectMap.has(id)) {
        projectMap.set(id, { id, name });
      }
    });
    return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = rows;
    
    if (selectedProjects.length > 0) {
      list = list.filter((b) => {
        const projectId = b.project_id || b.project?.id;
        return selectedProjects.includes(projectId);
      });
    }
    
    if (selectedStatuses.length > 0) {
      list = list.filter((b) => {
        const statusCode = b.bookingStatus?.status_code || b.status_code;
        return selectedStatuses.includes(statusCode);
      });
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((b) =>
        (b.booking_number || '').toLowerCase().includes(q) ||
        (customerName(b) || '').toLowerCase().includes(q) ||
        (b.project?.project_name || b.project_name || '').toLowerCase().includes(q) ||
        (unitOf(b) || '').toLowerCase().includes(q)
      );
    }
    
    return list;
  }, [rows, searchQuery, selectedProjects, selectedStatuses]);

  const handleProjectToggle = (projectId) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleStatusToggle = (statusCode) => {
    setSelectedStatuses((prev) =>
      prev.includes(statusCode)
        ? prev.filter((code) => code !== statusCode)
        : [...prev, statusCode]
    );
  };

  const clearProjectFilter = () => setSelectedProjects([]);
  const clearStatusFilter = () => setSelectedStatuses([]);

  const getProgressClass = (pct) => {
    if (pct >= 100) return 'success';
    if (pct >= 50) return '';
    return 'warning';
  };

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filteredRows, 25);

  useEffect(() => {
    if (selectedBookingId) {
      if (!window.history.state?.bookingDetailOpen) {
        window.history.pushState({ bookingDetailOpen: true }, '');
      }
      const handlePopState = () => {
        setSelectedBookingId(null);
        load();
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
    return undefined;
  }, [selectedBookingId, load]);

  if (selectedBookingId) {
    return (
      <CollectionBookingDetail
        user={user}
        bookingId={selectedBookingId}
        onBack={() => {
          if (window.history.state?.bookingDetailOpen) {
            window.history.back();
          } else {
            setSelectedBookingId(null);
            load();
          }
        }}
      />
    );
  }

  return (
    <div className="col-bookings-page" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <header className="lead-workspace__header">
        <div>
          <h1><CreditCardIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Bookings</h1>
          <p className="hide-mobile">All bookings across every status — approve or reject those pending, open any booking to view or edit payments</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={load} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="lead-workspace__toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
        <div className="lead-workspace__toolbar-search" style={{ flex: '0 1 400px', minWidth: '200px', order: 1 }}>
          <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by booking number, customer, project or unit"
          />
        </div>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, order: 2 }}>
          <div style={{ position: 'relative' }} ref={projectFilterRef}>
            <button
              type="button"
              className={`workspace-btn workspace-btn--ghost ${selectedProjects.length > 0 ? 'has-filter' : ''}`}
              onClick={() => setShowProjectFilter(!showProjectFilter)}
              style={{ position: 'relative' }}
            >
              <FunnelIcon style={{ width: 14, height: 14 }} />
              Project
              {selectedProjects.length > 0 && (
                <span style={{ marginLeft: 4, background: '#3B82F6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                  {selectedProjects.length}
                </span>
              )}
            </button>
            {showProjectFilter && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-header">
                  <span>Filter by Project</span>
                  {selectedProjects.length > 0 && (
                    <button type="button" className="filter-clear-btn" onClick={clearProjectFilter}>Clear</button>
                  )}
                </div>
                <div className="filter-dropdown-list">
                  {projects.map((p) => (
                    <label key={p.id} className="filter-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(p.id)}
                        onChange={() => handleProjectToggle(p.id)}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }} ref={statusFilterRef}>
            <button
              type="button"
              className={`workspace-btn workspace-btn--ghost ${selectedStatuses.length > 0 ? 'has-filter' : ''}`}
              onClick={() => setShowStatusFilter(!showStatusFilter)}
              style={{ position: 'relative' }}
            >
              <FunnelIcon style={{ width: 14, height: 14 }} />
              Status
              {selectedStatuses.length > 0 && (
                <span style={{ marginLeft: 4, background: '#3B82F6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                  {selectedStatuses.length}
                </span>
              )}
            </button>
            {showStatusFilter && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-header">
                  <span>Filter by Status</span>
                  {selectedStatuses.length > 0 && (
                    <button type="button" className="filter-clear-btn" onClick={clearStatusFilter}>Clear</button>
                  )}
                </div>
                <div className="filter-dropdown-list">
                  {statusList.map((s) => (
                    <label key={s.id} className="filter-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(s.status_code)}
                        onChange={() => handleStatusToggle(s.status_code)}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color_code || '#6B7280' }} />
                        {s.status_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(selectedProjects.length > 0 || selectedStatuses.length > 0) && (
            <button
              type="button"
              className="workspace-btn workspace-btn--ghost"
              onClick={() => { setSelectedProjects([]); setSelectedStatuses([]); }}
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
            <small className="filter-tabs__records">{filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}</small>
          </div>

          {loading ? (
            <div className="simple-loader">
              <div className="simple-spinner" />
              <p>Loading...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="col-empty">
              <div className="col-empty-icon"><CreditCardIcon style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
              <div className="col-empty-title">{searchQuery || selectedProjects.length > 0 || selectedStatuses.length > 0 ? 'No bookings match your filters' : 'No bookings found'}</div>
              <div className="col-empty-desc">{searchQuery || selectedProjects.length > 0 || selectedStatuses.length > 0 ? 'Try adjusting your search or filters' : 'Bookings will appear here'}</div>
            </div>
          ) : (
            <div className="lead-workspace__table-wrap">
              <table className="lead-workspace__table">
                <thead>
                  <tr>
                    <th className="show-mobile lead-col-toggle"></th>
                    <th className="lead-col-lead" style={{ width: 'auto' }}>Booking</th>
                    <th className="hide-mobile" style={{ width: 120 }}>Phone</th>
                    <th className="hide-mobile" style={{ width: 160 }}>Project · Unit</th>
                    <th className="hide-mobile" style={{ width: 120 }}>Net Value</th>
                    <th className="hide-mobile" style={{ width: 110 }}>Progress</th>
                    <th className="lead-col-status">Status</th>
                    <th className="hide-mobile" style={{ width: 130 }}>Payment Status</th>
                    <th className="hide-mobile" style={{ width: 100 }}>Assignee</th>
                    <th className="hide-mobile" style={{ textAlign: 'center', width: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((booking) => {
                    const pct = booking.payment_percentage || 0;
                    const isExpanded = expandedId === booking.id;
                    const totalValue = getComputedTotalValue(booking);
                    const collected = parseFloat(booking.total_paid || 0);
                    const balance = totalValue - collected;
                    const st = statusOf(booking);
                    const paymentBadge = booking.payment_status ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12,
                        background: booking.payment_status === 'Full Payment Received' ? '#DCFCE7' : booking.payment_status === 'Follow Up' ? '#FEF3C7' : '#DBEAFE',
                        color: booking.payment_status === 'Full Payment Received' ? '#166534' : booking.payment_status === 'Follow Up' ? '#92400E' : '#1E40AF',
                      }}>{booking.payment_status}</span>
                    ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>;

                    return (
                      <React.Fragment key={booking.id}>
                        <tr>
                          <td className="show-mobile lead-col-toggle" style={{ padding: '10px 0', textAlign: 'center' }}>
                            <button
                              type="button"
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : booking.id); }}
                              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                            >
                              {isExpanded ? <ChevronDownIcon style={{ width: 14, height: 14 }} /> : <ChevronRightIcon style={{ width: 14, height: 14 }} />}
                            </button>
                          </td>
                          <td className="lead-col-lead">
                            <p className="lead-title">{customerName(booking)}</p>
                            <small style={{ color: '#64748b' }}>{booking.booking_number}</small>
                          </td>
                          <td className="hide-mobile">
                            <p style={{ fontSize: 13 }}>{booking.customer?.phone || booking.phone || '—'}</p>
                          </td>
                          <td className="hide-mobile">
                            <p className="lead-title">{booking.project?.project_name || booking.project_name || '—'}</p>
                            <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Unit: {unitOf(booking) || 'TBD'}</small>
                          </td>
                          <td className="hide-mobile">{formatCurrency(totalValue)}</td>
                          <td className="hide-mobile" style={{ minWidth: 90 }}>
                            <div className="col-progress" style={{ height: 6, width: '100%' }}>
                              <div className={`col-progress-bar ${getProgressClass(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{pct}%</div>
                          </td>
                          <td className="lead-col-status">
                            <span className="col-badge" style={badgeStyle(st.color)}>
                              <span className="col-badge-dot" style={{ background: badgeColors(st.color).text }} />
                              {st.label}
                            </span>
                          </td>
                          <td className="hide-mobile">{paymentBadge}</td>
                          <td className="hide-mobile">
                            {(() => {
                              // The booking is owned by the Collection Manager the Sales Head
                              // selected at booking time. Collection Executives are only assigned
                              // later (by the manager), so at approval time there usually are none —
                              // show the manager as the primary assignee, then any executives.
                              const manager = booking.collectionManager || null;
                              const execs = booking.collectionExecutives || [];
                              const seen = new Set();
                              const people = [
                                ...(manager ? [{ ...manager, _owner: true }] : []),
                                ...execs,
                              ].filter((p) => (p && !seen.has(p.id) && seen.add(p.id)));
                              if (people.length === 0) return <small style={{ color: 'var(--text-muted)' }}>—</small>;
                              return (
                                <div className="bkd-cell-avatars">
                                  {people.slice(0, 3).map((a, i) => (
                                    <span
                                      key={a.id}
                                      className="bkd-cell-avatar"
                                      title={a._owner ? `${fullNameOf(a)} · Collection Owner` : fullNameOf(a)}
                                      style={{ background: colorFor(a.id), marginLeft: i === 0 ? 0 : -8, ...(a._owner ? { boxShadow: '0 0 0 2px #16A34A' } : null) }}
                                    >
                                      {avatarInitials(a)}
                                    </span>
                                  ))}
                                  {people.length > 3 && (
                                    <span className="bkd-cell-avatar" style={{ background: '#e2e8f0', color: '#64748b', marginLeft: -8 }}>
                                      +{people.length - 3}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="hide-mobile" style={{ textAlign: 'center' }}>
                            <button type="button" className="view-link" title="View details" onClick={() => setSelectedBookingId(booking.id)}>View</button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="lead-workspace__expanded-row show-mobile">
                            <td colSpan={4}>
                              <div className="lead-workspace__expanded-card">
                                <div className="expanded-info-grid">
                                  <div className="expanded-info-item">
                                    <label>Project / Unit</label>
                                    <p>{booking.project?.project_name || booking.project_name || '-'}{unitOf(booking) ? ` / ${unitOf(booking)}` : ''}</p>
                                  </div>
                                  <div className="expanded-info-item">
                                    <label>Net Value</label>
                                    <p>{formatCurrency(totalValue)}</p>
                                  </div>
                                  <div className="expanded-info-item">
                                    <label>Collected</label>
                                    <p>{formatCurrency(collected)} · {pct}%</p>
                                  </div>
                                  <div className="expanded-info-item">
                                    <label>Balance</label>
                                    <p>{formatCurrency(balance)}</p>
                                  </div>
                                  <div className="expanded-info-item">
                                    <label>Payment Status</label>
                                    <p>{booking.payment_status || '—'}</p>
                                  </div>
                                  <div className="expanded-info-item">
                                    <label>Status</label>
                                    <p>{st.label}</p>
                                  </div>
                                  <div className="expanded-info-item full-width">
                                    <label>Actions</label>
                                    <button type="button" className="view-link" onClick={() => setSelectedBookingId(booking.id)}>View Details</button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredRows.length > 0 && (
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

      {!loading && filteredRows.length > 0 && (
        <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span><strong>{filteredRows.length}</strong> bookings</span>
          <span>Value: <strong style={{ color: 'var(--accent-blue)' }}>{formatCurrency(filteredRows.reduce((s, b) => s + getComputedTotalValue(b), 0))}</strong></span>
          <span>Collected: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(filteredRows.reduce((s, b) => s + parseFloat(b.total_paid || 0), 0))}</strong></span>
        </div>
      )}
    </div>
  );
};

export default BookingApprovals;
