// ============================================================
// CAMPAIGNS › BUDGET ENTRY › DETAIL DRAWER
// Opened from a ledger row: what THIS budget line bought, over its own period.
//
// ── What this deliberately does not show ────────────────────────────────────
// No "amount spent", no "remaining balance", no burn-down bar. Nothing feeds actual ad
// spend back into the CRM, so any of those would be a number we made up - and a made-up
// balance on a finance screen is worse than no balance at all. What is real is the
// budget recorded for the period and what that period returned, so that is what this
// shows: the amount, the days it covers, the funnel it bought, and the cost of each
// outcome.
//
// ── Scope ───────────────────────────────────────────────────────────────────
// The line's own period, its source, its sub-source set, and - when the line names one -
// its campaign. Leads are counted by the same LATEST MARKETING TOUCH rule the Campaigns
// reports use (server: utils/marketingAttributionSql), so the drawer and the table it
// was opened from can never quote different numbers for the same campaign.
//
// When the line names a campaign, "Share of this source" compares it against everything
// the same source / sub-sources brought in over the same dates - the honest denominator
// for "how much of the intake did this campaign account for".

import React, { useState, useEffect } from 'react';
import {
  XMarkIcon, CalendarDaysIcon, MegaphoneIcon, BuildingStorefrontIcon,
  BanknotesIcon, UsersIcon, CheckBadgeIcon, MapPinIcon, BuildingOffice2Icon,
  Squares2X2Icon, CurrencyRupeeIcon,
} from '@heroicons/react/24/outline';
import marketingBudgetApi from '../../../api/marketingBudgetApi';
import { formatCurrencyExact } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { badgeStyle } from '../../../utils/badgeColors';
import { COLORS } from '../Reports/analytics/palette';

const num = (v) => Number(v) || 0;
const cnt = (v) => num(v).toLocaleString('en-IN');
const money = (v) => formatCurrencyExact(num(v));
// A cost-per is null when it could not be computed. "-" says we don't know what it
// cost; 0 would say it was free. They are not the same claim.
const cost = (v) => (v == null ? '-' : formatCurrencyExact(num(v)));
const pct1 = (n, d) => (num(d) > 0 ? Math.round((num(n) / num(d)) * 1000) / 10 : 0);

const fmtDate = (d) => (d
  ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '-');

const fmtPeriod = (a, b) => {
  if (!a) return '-';
  if (!b || String(a).slice(0, 10) === String(b).slice(0, 10)) return fmtDate(a);
  return `${fmtDate(a)} – ${fmtDate(b)}`;
};

const Row = ({ icon: Icon, label, value, strong }) => (
  <div className="mm-drawer__row">
    <span className="mm-drawer__key" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {Icon && <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />}
      {label}
    </span>
    <span className="mm-drawer__val" style={strong ? { fontWeight: 600 } : undefined}>{value}</span>
  </div>
);

const Section = ({ title, children }) => (
  <div className="mm-drawer__section">
    <div className="mm-drawer__section-title">{title}</div>
    {children}
  </div>
);

const BudgetDrawer = ({ budgetId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!budgetId) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);
    marketingBudgetApi.getPerformance(budgetId)
      .then((res) => { if (alive) setData(res?.data || null); })
      .catch((err) => { if (alive) { setError(getErrorMessage(err, 'Failed to load campaign details')); setData(null); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [budgetId]);

  // Esc closes, and the page behind stops scrolling while the panel is open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!budgetId) return null;

  const b = data?.budget;
  const f = data?.funnel;
  const scope = data?.scope;
  const c = data?.cost;
  const campaignFiltered = !!data?.meta?.campaignFiltered;

  // Every stage is measured against the leads the line bought, so the bars read as a
  // funnel rather than four unrelated numbers.
  const steps = f ? [
    { label: 'Leads', value: f.leads, color: COLORS.leads },
    { label: 'Qualified', value: f.qualified, color: COLORS.qualified },
    { label: 'Site Visits', value: f.siteVisits, color: COLORS.siteVisit },
    { label: 'Bookings', value: f.bookings, color: COLORS.booking },
  ] : [];

  return (
    <>
      <div className="mm-drawer-overlay" onClick={onClose} />
      <aside className="mm-drawer" role="dialog" aria-modal="true" aria-label="Campaign details">
        <div className="mm-drawer__head">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {b?.campaign_name || 'Budget line'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {b
                ? [b.source_name, b.sub_source_names?.length ? b.sub_source_names.join(', ') : 'Whole source']
                  .filter(Boolean).join(' › ')
                : 'Loading…'}
            </div>
          </div>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={onClose} aria-label="Close">
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="mm-drawer__body">
          {loading && <div className="simple-loader"><div className="simple-spinner" /><p>Loading campaign details…</p></div>}
          {!loading && error && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{error}</div>
          )}

          {!loading && !error && data && (
            <>
              <Section title="Budget Line">
                <Row icon={CalendarDaysIcon} label="Period" value={fmtPeriod(b.start_date, b.end_date)} strong />
                <Row icon={CalendarDaysIcon} label="Days covered" value={`${cnt(b.day_count)} day${num(b.day_count) === 1 ? '' : 's'}`} />
                <Row icon={BuildingStorefrontIcon} label="Source" value={b.source_name || '-'} />
                <Row
                  icon={BuildingStorefrontIcon}
                  label={`Sub Source${(b.sub_source_names?.length || 0) > 1 ? 's' : ''}`}
                  value={b.sub_source_names?.length ? b.sub_source_names.join(', ') : 'Whole source'}
                />
                <Row icon={MegaphoneIcon} label="Campaign" value={b.campaign_name || 'Not tied to a campaign'} />
                {b.remarks && <Row label="Remarks" value={b.remarks} />}
              </Section>

              <Section title="Budget for this period">
                <Row icon={BanknotesIcon} label="Budget recorded" value={money(b.amount)} strong />
                <Row icon={CurrencyRupeeIcon} label="Per day" value={b.per_day == null ? '-' : money(b.per_day)} />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                  The CRM records what was budgeted, not what an ad platform actually charged, so
                  there is no “spent” or “remaining” figure here - only this period’s budget and
                  what it returned.
                </div>
              </Section>

              <Section title={campaignFiltered ? 'What this campaign returned' : 'What this spend returned'}>
                {steps.map((s) => (
                  <div className="mm-funnel-row" key={s.label}>
                    <span className="mm-funnel-name">{s.label}</span>
                    <span className="mm-funnel-track">
                      <span
                        className="mm-funnel-fill"
                        style={{ width: `${Math.min(100, pct1(s.value, f.leads))}%`, background: s.color }}
                      />
                    </span>
                    <span className="mm-funnel-count">{cnt(s.value)}</span>
                    <span className="mm-funnel-pct">{f.leads > 0 ? `${pct1(s.value, f.leads)}%` : '-'}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                  Leads acquired in this period{campaignFiltered ? ' under this campaign' : ''} - the visit or
                  booking itself may have happened later. That is what makes the cost-per figures below valid.
                </div>
              </Section>

              <Section title="What each outcome cost">
                <Row icon={UsersIcon} label="Cost per Lead" value={cost(c.perLead)} strong />
                <Row icon={CheckBadgeIcon} label="Cost per Qualified Lead" value={cost(c.perQualified)} />
                <Row icon={MapPinIcon} label="Cost per Site Visit" value={cost(c.perSiteVisit)} />
                <Row icon={BuildingOffice2Icon} label="Cost per Booking" value={cost(c.perBooking)} />
                <Row icon={Squares2X2Icon} label="Cost per Sq Ft" value={cost(c.perSqft)} />
                <Row label="Lead → Booking" value={f.leads > 0 ? `${pct1(f.bookings, f.leads)}%` : '-'} />
                <Row label="Sq Ft booked" value={cnt(f.bookedSqft)} />
              </Section>

              {campaignFiltered && (
                <Section title="Share of this source">
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                    Everything {b.source_name || 'this source'} brought in over the same dates, campaign or not -
                    so this campaign’s contribution is readable against the whole.
                  </div>
                  <Row label="Leads" value={`${cnt(f.leads)} of ${cnt(scope.leads)} · ${pct1(f.leads, scope.leads)}%`} />
                  <Row label="Qualified" value={`${cnt(f.qualified)} of ${cnt(scope.qualified)}`} />
                  <Row label="Site Visits" value={`${cnt(f.siteVisits)} of ${cnt(scope.siteVisits)}`} />
                  <Row label="Bookings" value={`${cnt(f.bookings)} of ${cnt(scope.bookings)}`} />
                </Section>
              )}

              <Section title={`Recent leads${campaignFiltered ? ' from this campaign' : ''}`}>
                {(data.recentLeads || []).length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '10px 0' }}>
                    No leads landed against this line in its period.
                  </div>
                ) : (
                  (data.recentLeads || []).map((l) => (
                    <div className="mm-lead-row" key={l.id}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {`${l.first_name || ''} ${l.last_name || ''}`.trim() || l.lead_number || 'Unnamed lead'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {[
                            l.sub_source_name,
                            l.is_reenquiry ? 'Re-enquiry' : null,
                            fmtDate(l.touch_at),
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {l.status_name && (
                        <span
                          className="inline-flex items-center flex-shrink-0"
                          style={{
                            // badgeStyle() carries the full border shorthand already -
                            // DB color_code is the TEXT colour, bg/border derived.
                            ...badgeStyle(l.color_code),
                            fontSize: 10.5,
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: 999,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {l.status_name}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </Section>
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default BudgetDrawer;
