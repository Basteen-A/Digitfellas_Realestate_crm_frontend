import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PhoneArrowUpRightIcon, PhoneXMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import telephonyApi from '../../../api/telephonyApi';
import Pagination from '../../../components/common/Pagination';
import RecordingCell from '../../../components/telephony/RecordingCell';
import CallDirectionIcon from '../../../components/telephony/CallDirectionIcon';
import { getErrorMessage } from '../../../utils/helpers';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'middle' };

const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—');
const fmtDuration = (secs) => {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
};
const leadName = (l) => (l ? `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.lead_number : null);

const STATUS_BADGE = {
  ANSWERED: { bg: '#dcfce7', fg: '#166534', label: 'Answered' },
  MISSED: { bg: '#fee2e2', fg: '#991b1b', label: 'Missed' },
};

const TABS = [
  { key: '', label: 'All' },
  { key: 'ANSWERED', label: 'Answered' },
  { key: 'MISSED', label: 'Missed' },
];

// Real call log for the logged-in telecaller — answered & missed calls captured
// from Tata Smartflo webhooks, with recording playback. (Replaces the old mock.)
const TelecallerCallLog = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (status) params.status = status;
      const resp = await telephonyApi.getCallLogs(params);
      setRows(resp.data || []);
      setTotal(resp.meta?.total || 0);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load call log'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Call Log</h1>
          <p className="hidden sm:block">Your answered &amp; missed calls, captured live with recordings</p>
        </div>
        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={load} disabled={loading}>
          <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Answered / Missed tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`crm-btn crm-btn-sm ${status === t.key ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
            onClick={() => { setPage(1); setStatus(t.key); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={th}>Date / Time</th>
                <th style={th}>Lead</th>
                <th style={th}>Customer No.</th>
                <th style={th}>Status</th>
                <th style={th}>Duration</th>
                <th style={th}>Recording</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>No calls recorded yet</td></tr>
              )}
              {!loading && rows.map((r) => {
                const badge = STATUS_BADGE[r.call_status] || { bg: '#e5e7eb', fg: '#374151', label: r.call_status || 'Unknown' };
                const answered = r.call_status === 'ANSWERED';
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <CallDirectionIcon direction={r.direction} status={r.call_status} />
                        {fmtDateTime(r.start_stamp || r.received_at)}
                      </span>
                    </td>
                    <td style={td}>
                      {r.lead ? (
                        <>
                          <div style={{ fontWeight: 600 }}>{leadName(r.lead)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.lead.lead_number || ''}</div>
                        </>
                      ) : <span style={{ color: 'var(--text-muted)' }}>Unknown lead</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.customer_number || '—'}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.fg }}>
                        {answered ? <PhoneArrowUpRightIcon style={{ width: 12, height: 12 }} /> : <PhoneXMarkIcon style={{ width: 12, height: 12 }} />}
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDuration(r.duration)}</td>
                    <td style={td}>
                      <RecordingCell callId={r.id} hasRecording={Boolean(r.recording_url)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPage(1); setPageSize(s); }}
          />
        )}
      </div>
    </div>
  );
};

export default TelecallerCallLog;
