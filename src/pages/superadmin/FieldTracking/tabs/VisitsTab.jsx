import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon, UserPlusIcon, ExclamationTriangleIcon, ArrowDownTrayIcon, MapIcon, PhotoIcon,
} from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import { openAuthedFile } from '../../../../utils/authedFile';
import { exportVisits } from '../exportExcel';
import {
  th, td, inputStyle, btn, StatCard, Chip, EmptyState, Spinner,
  fmtTime, fmtDuration, todayStr, daysAgoStr,
  VISIT_TYPE_LABEL, VISIT_OUTCOME_STYLE, NEGATIVE_REASON_LABEL, VisitStatusChip,
} from '../ui';

// ============================================================
// Customer Visits - who the field team actually met, and where.
//
// This is NOT the Site Visits module. That one schedules a prospect onto a
// property with a lead and a project attached. This is a rep tapping "I am at
// this customer now" from the doorstep, with the GPS fix that backs it up.
//
// The column that earns this screen its keep is "GPS": a visit whose
// coordinates never matched a detected halt means the phone never recorded the
// person actually stopping there. That is surfaced, not hidden.
// ============================================================

const VisitsTab = ({ config, onOpenTimeline }) => {
  const [from, setFrom] = useState(daysAgoStr(6));
  const [to, setTo] = useState(todayStr());
  const [role, setRole] = useState('');
  const [visitType, setVisitType] = useState('');
  const [outcome, setOutcome] = useState('');
  const [status, setStatus] = useState('');
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fieldTrackingApi.getVisitReport({
        from,
        to,
        ...(role ? { role } : {}),
        ...(visitType ? { visit_type: visitType } : {}),
        ...(outcome ? { outcome } : {}),
        ...(status ? { status } : {}),
      });
      setData(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load visits'));
    } finally {
      setLoading(false);
    }
  }, [from, to, role, visitType, outcome, status]);

  useEffect(() => { load(); }, [load]);

  const download = async () => {
    setExporting(true);
    try {
      await exportVisits(data, { from, to, role });
      toast.success('Visits downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const t = data?.totals;
  const rows = (data?.rows || []).filter((v) => (onlyUnverified ? v.unverifiedByGps : true));

  return (
    <div>
      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>FROM</div>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>TO</div>
          <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>ROLE</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, width: 160 }}>
            <option value="">All roles</option>
            {(config?.roles || [])
              .filter((r) => (config?.enabledRoles || []).includes(r.code))
              .map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>TYPE</div>
          <select value={visitType} onChange={(e) => setVisitType(e.target.value)} style={{ ...inputStyle, width: 145 }}>
            <option value="">All types</option>
            {Object.entries(VISIT_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>OUTCOME</div>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ ...inputStyle, width: 155 }}>
            <option value="">All outcomes</option>
            {Object.entries(VISIT_OUTCOME_STYLE).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>STATUS</div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: 140 }}>
            <option value="">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button type="button" onClick={load} style={btn()} disabled={loading}>
          <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Run
        </button>
        <button type="button" onClick={download} style={btn('primary')} disabled={exporting || !data?.rows?.length}>
          <ArrowDownTrayIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          {exporting ? 'Preparing…' : 'Download'}
        </button>
      </div>

      {/* ── Totals ── */}
      {t ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatCard label="Visits" value={t.visits} sub={`by ${t.uniqueUsers} people`} />
          <StatCard label="Completed" value={t.completed} accent="#16a34a" />
          <StatCard label="In Progress" value={t.inProgress} accent={t.inProgress ? '#d97706' : undefined} />
          <StatCard label="Cancelled" value={t.cancelled} />
          <StatCard label="Time At Customers" value={fmtDuration(t.totalMinutes)} />
          <StatCard label="Linked To A Lead" value={`${t.withLead}/${t.visits}`} sub="rest are new contacts" />
          <StatCard
            label="Not GPS-Confirmed"
            value={t.unverified}
            sub="no matching stop"
            accent={t.unverified ? '#dc2626' : undefined}
          />
        </div>
      ) : null}

      {t?.unverified ? (
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--text-secondary)',
          }}
        >
          <input type="checkbox" checked={onlyUnverified} onChange={(e) => setOnlyUnverified(e.target.checked)} />
          <span>
            <b>Show only the {t.unverified} visits the GPS did not confirm.</b>{' '}
            A visit is confirmed when its coordinates fall inside a stop the phone actually recorded.
            An unconfirmed one usually means the rep logged it from elsewhere, or left before the
            stop threshold - worth a look, not proof of anything on its own.
          </span>
        </label>
      ) : null}

      {/* ── Table ── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <Spinner label="Loading visits…" /> : null}

        {!loading && !rows.length ? (
          <EmptyState
            icon={UserPlusIcon}
            title={onlyUnverified ? 'Every visit was GPS-confirmed' : 'No visits logged'}
            hint={
              onlyUnverified
                ? 'Nothing to review in this range.'
                : 'Field staff log visits from the phone while punched in. Nothing appears here until they do.'
            }
          />
        ) : null}

        {!loading && rows.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
              <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Field User</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Type</th>
                  <th style={th}>In / Out</th>
                  <th style={th}>Duration</th>
                  <th style={th}>Outcome</th>
                  <th style={th}>GPS</th>
                  <th style={th}>Photos</th>
                  <th style={{ ...th, textAlign: 'right' }}>Route</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{v.workDate}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{v.user?.name || '-'}</div>
                      {v.user?.role ? <div style={{ marginTop: 3 }}><Chip>{v.user.role}</Chip></div> : null}
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{v.customerName}</div>
                      {v.customerPhone ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{v.customerPhone}</div> : null}
                      {v.leadNumber ? (
                        <div style={{ marginTop: 3 }}>
                          <Chip bg="rgba(98,90,250,0.12)" fg="#625afa">{v.leadNumber}</Chip>
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>not in CRM</div>
                      )}
                      {v.purpose ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>{v.purpose}</div> : null}
                    </td>
                    <td style={td}>
                      <Chip>{VISIT_TYPE_LABEL[v.visitType] || v.visitType}</Chip>
                      {v.projectName ? <div style={{ fontSize: 11, marginTop: 3 }}>{v.projectName}</div> : null}
                      {v.locationName ? <div style={{ fontSize: 10, color: '#16a34a', marginTop: 3 }}>{v.locationName}</div> : null}
                      {v.siteVisitNumber ? (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          closed {v.siteVisitNumber}
                        </div>
                      ) : null}
                    </td>
                    <td style={td}>
                      {fmtTime(v.checkedInAt)}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {v.checkedOutAt ? fmtTime(v.checkedOutAt) : '-'}
                      </div>
                      {v.autoClosed ? <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>auto-closed</div> : null}
                    </td>
                    <td style={td}>
                      {v.durationMinutes != null ? fmtDuration(v.durationMinutes) : '-'}
                    </td>
                    <td style={td}>
                      {v.outcome ? (
                        <Chip
                          bg={VISIT_OUTCOME_STYLE[v.outcome]?.bg}
                          fg={VISIT_OUTCOME_STYLE[v.outcome]?.fg}
                        >
                          {VISIT_OUTCOME_STYLE[v.outcome]?.label || v.outcome}
                        </Chip>
                      ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      {v.negativeReason ? (
                        <div style={{
                          fontSize: 10, color: '#9F1239', background: 'rgba(220,38,38,0.08)',
                          borderRadius: 4, padding: '1px 6px', marginTop: 4, display: 'inline-block',
                        }}
                        >
                          {NEGATIVE_REASON_LABEL[v.negativeReason] || v.negativeReason}
                        </div>
                      ) : null}
                      <div style={{ marginTop: 4 }}><VisitStatusChip status={v.status} /></div>
                      {v.notes ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, maxWidth: 220 }}>{v.notes}</div> : null}
                    </td>
                    <td style={td}>
                      {v.unverifiedByGps ? (
                        <span
                          title="No detected stop matches this visit's coordinates and time"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#dc2626', fontSize: 11, fontWeight: 700 }}
                        >
                          <ExclamationTriangleIcon style={{ width: 13, height: 13 }} />
                          Not confirmed
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>
                          {v.status === 'IN_PROGRESS' ? 'Running' : 'Confirmed'}
                        </span>
                      )}
                      {v.mockLocationFlagged ? (
                        <div style={{ fontSize: 10, color: '#dc2626', marginTop: 3, fontWeight: 700 }}>MOCK GPS</div>
                      ) : null}
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>
                        {v.latitude.toFixed(5)}, {v.longitude.toFixed(5)}
                      </div>
                    </td>
                    <td style={td}>
                      {/* Opened one at a time rather than rendered inline: each
                          photo is an authenticated fetch, and a 500-row report
                          would otherwise pull hundreds of images nobody looks at. */}
                      {(v.photos || []).length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                          {v.photos.map((ph, i) => (
                            <button
                              key={ph.id || ph.url}
                              type="button"
                              onClick={() => openAuthedFile(ph.url).catch(() => toast.error('Could not open that photo'))}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none',
                                background: 'none', padding: 0, cursor: 'pointer',
                                color: 'var(--accent-primary, #625afa)', fontSize: 11,
                              }}
                            >
                              <PhotoIcon style={{ width: 12, height: 12 }} />
                              Photo {i + 1}
                            </button>
                          ))}
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {v.user?.id ? (
                        <button
                          type="button"
                          style={{ ...btn('ghost'), color: 'var(--accent-primary, #625afa)' }}
                          onClick={() => onOpenTimeline(v.user, v.workDate)}
                        >
                          <MapIcon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px', marginRight: 4 }} />
                          Route
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.rows?.length >= 5000 ? (
              <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-primary)' }}>
                Showing the most recent 5,000 visits. Narrow the range or the role to see more.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default VisitsTab;
