// ============================================================
// MARKETING METRIX (Super Admin › Marketing › Metrix)
// Same shell, filter bar, sidebar catalogue and report atoms as the Reports,
// Marketing Reports and Collection Report pages — only the report set differs:
//   1. Cost Metrix — By Source      (spend & volume + cost per lead/qualified/SV/booking)
//   2. Cost Metrix — By Sub Source  (same, one level down, with a source drill-down)
//   3. Cost Efficiency              (ranking, funnel and spend/volume trends)
//   4. Budget Entry                 (the spend ledger: Budget + Source + Sub Source + Date)
// One fetch (GET /reports/marketing-metrix) feeds reports 1-3; switching is instant.
//
// ── Attribution ─────────────────────────────────────────────────────────────
// Every lead is credited to the source AND date of its LATEST marketing touch — its own
// creation, or its newest re-enquiry, whichever is later. So when a dead lead comes back
// through a new campaign, the new campaign gets the credit in the month it paid for it.
// The rule is stated on screen (see ATTRIBUTION_NOTE) because it changes what the
// numbers mean, and nobody should have to guess.
//
// A cost-per cell reads "—" when the metric is zero or no budget was recorded: "we
// don't know what it cost" is not the same as "it was free", so it is never shown as 0.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  CurrencyRupeeIcon, ArrowPathIcon, ArrowDownTrayIcon, FunnelIcon, ChevronDownIcon,
  ChevronRightIcon, MegaphoneIcon, UsersIcon, CheckBadgeIcon, MapPinIcon,
  BuildingOffice2Icon, TrophyIcon, ScaleIcon, ChartPieIcon, Squares2X2Icon,
  BanknotesIcon, InformationCircleIcon, ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import reportApi from '../../../api/reportApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import { formatCurrencyExact } from '../../../utils/formatters';
import { COLORS, SERIES } from '../Reports/analytics/palette';
import { ChartCard, SimpleBar, FunnelDonut, TrendLine } from '../Reports/analytics/charts/Charts';
import {
  MonoContext, KpiCard, KpiRow, Pill, ratioTone, ProgressBar,
  Card, Table, Tr, Td, TotalRow,
} from '../Reports/analytics/ui';
import BudgetEntry from './BudgetEntry';
import { exportMarketingMetrix } from './exportExcel';
import '../Reports/Reports.css';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'wtd', label: 'Week' },
  { key: 'mtd', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

const ATTRIBUTION_NOTE = 'Each lead counts against the source & date of its latest marketing touch — its creation, or its newest re-enquiry, whichever is later.';

// ── helpers ──────────────────────────────────────────────────────────────────
const num = (v) => Number(v) || 0;
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const pct1 = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const cnt = (v) => num(v).toLocaleString('en-IN');
const sumBy = (rows, key) => (rows || []).reduce((a, r) => a + num(r[key]), 0);

// Exact rupees everywhere a figure is read, matching the Collection Report.
const money = (v) => formatCurrencyExact(num(v));
// A cost-per value is null when it could not be computed — show that honestly.
const cost = (v) => (v == null ? '—' : formatCurrencyExact(num(v)));
// Chart Y axes are a scale, not a figure: full rupees don't fit, so ticks shorten.
// Tooltips keep the exact number.
const axisMoney = (v) => {
  const n = num(v);
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `₹${Math.round(n / 1e3)}K`;
  return `₹${Math.round(n)}`;
};

// How a source's cost compares to the blended average. Lower is better, so the tone
// scale is inverted against ratioTone's "higher is better" reading.
const costIndex = (value, avg) => (value == null || !avg ? null : Math.round((value / avg) * 100) / 100);
const costTone = (idx) => (idx == null ? 'gray' : idx <= 1 ? 'green' : idx <= 1.5 ? 'amber' : 'red');

const mixOf = (rows, nameKey, valueKey, top = 7) => {
  const ranked = [...(rows || [])].filter((r) => num(r[valueKey]) > 0).sort((a, b) => num(b[valueKey]) - num(a[valueKey]));
  const head = ranked.slice(0, top).map((r, i) => ({
    name: r[nameKey], value: num(r[valueKey]), color: SERIES[i % SERIES.length],
  }));
  const rest = sumBy(ranked.slice(top), valueKey);
  return rest > 0 ? [...head, { name: 'Others', value: rest, color: COLORS.muted }] : head;
};

// Cheapest source on a given cost metric, among sources with real volume — a source
// that produced two leads for ₹100 is not the "best performer".
const cheapest = (rows, costKey, volumeKey, minVolume = 5) => [...rows]
  .filter((r) => r[costKey] != null && num(r[volumeKey]) >= minVolume)
  .sort((a, b) => num(a[costKey]) - num(b[costKey]))[0];

// ── report catalogue ─────────────────────────────────────────────────────────
const MM = {
  source: {
    icon: MegaphoneIcon,
    title: 'Cost Metrix — By Source',
    sub: 'Budget against leads, qualified leads, site visits & bookings',
    rs: 'Cost by source',
  },
  subsource: {
    icon: ChartPieIcon,
    title: 'Cost Metrix — By Sub Source',
    sub: 'The same cost metrics one level down, per sub-source',
    rs: 'Cost by sub-source',
  },
  efficiency: {
    icon: ScaleIcon,
    title: 'Cost Efficiency',
    sub: 'Which spend converts cheapest, and how it moves over time',
    rs: 'Ranking & trend',
  },
  budgets: {
    icon: BanknotesIcon,
    title: 'Budget Entry',
    sub: 'Record spend: Budget + Source + Sub Source + Date',
    rs: 'Spend ledger',
  },
};

const GROUPS = [
  { label: 'Cost Metrics', keys: ['source', 'subsource'] },
  { label: 'Analysis', keys: ['efficiency'] },
  { label: 'Spend', keys: ['budgets'] },
];
const FIRST_KEY = GROUPS[0].keys[0];

// ── expandable group list (source → sub-source) ──────────────────────────────
const GroupRows = ({ groups, head, renderRow, totalCells, emptyLabel }) => {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (k) => setOpen((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  if (!groups.length) {
    return <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>{emptyLabel}</div>;
  }
  return (
    <div>
      {groups.map((g) => {
        const isOpen = open.has(g.key);
        return (
          <div key={g.key} style={{ borderTop: '1px solid var(--border-primary)' }}>
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover,#FAFAFA)]"
            >
              <ChevronRightIcon
                className="w-4 h-4 flex-shrink-0 transition-transform"
                style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none' }}
              />
              <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{g.label}</span>
              <span className="ml-auto flex items-center gap-3 flex-shrink-0">
                {g.stats.map((s) => (
                  <span key={s.label} className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    {s.label} <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</strong>
                  </span>
                ))}
              </span>
            </button>
            {isOpen && (
              <div style={{ background: 'var(--bg-hover, #FAFAFA)' }}>
                <Table head={head} colSpan={head.length} empty={g.rows.length === 0}>
                  {g.rows.map(renderRow)}
                  {g.rows.length > 0 && totalCells && <TotalRow cells={totalCells(g.rows)} />}
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Shared "spend & volume" and "cost" table bodies, so the Source and Sub Source
// reports stay column-for-column identical.
const VolumeRow = ({ r, nameCell, totalBudget }) => (
  <Tr>
    {nameCell}
    <Td bold>{money(r.budget)}</Td>
    <Td><Pill tone="blue">{pct1(num(r.budget), totalBudget)}%</Pill></Td>
    <Td bold>{cnt(r.leads)}</Td>
    <Td color={COLORS.qualified}>{cnt(r.qualified)}</Td>
    <Td color={COLORS.siteVisit}>{cnt(r.sv_leads)}</Td>
    <Td color={COLORS.booking}>{cnt(r.bookings)}</Td>
    <Td>{cnt(r.booked_sqft)}</Td>
  </Tr>
);

const CostRow = ({ r, nameCell, avgCpl }) => {
  const idx = costIndex(r.cost_per_lead, avgCpl);
  return (
    <Tr>
      {nameCell}
      <Td bold>{money(r.budget)}</Td>
      <Td bold>{cost(r.cost_per_lead)}</Td>
      <Td>{idx == null ? '—' : <Pill tone={costTone(idx)}>{idx}×</Pill>}</Td>
      <Td color={COLORS.qualified}>{cost(r.cost_per_qualified)}</Td>
      <Td color={COLORS.siteVisit}>{cost(r.cost_per_sv)}</Td>
      <Td color={COLORS.booking}>{cost(r.cost_per_booking)}</Td>
      <Td>{cost(r.cost_per_sqft)}</Td>
    </Tr>
  );
};

const VOLUME_HEAD = ['Budget', 'Share', 'Leads', 'Qualified', 'Site Visits', 'Bookings', 'Sq Ft Booked'];
const COST_HEAD = ['Budget', 'Cost / Lead', 'vs Avg', 'Cost / Qualified', 'Cost / Site Visit', 'Cost / Booking', 'Cost / Sq Ft'];

const volumeTotals = (rows) => [
  money(sumBy(rows, 'budget')), '100%',
  cnt(sumBy(rows, 'leads')), cnt(sumBy(rows, 'qualified')),
  cnt(sumBy(rows, 'sv_leads')), cnt(sumBy(rows, 'bookings')),
  cnt(sumBy(rows, 'booked_sqft')),
];

// Blended cost on the totals row — the sum of the parts, never an average of averages.
const blendedTotals = (rows) => {
  const b = sumBy(rows, 'budget');
  const per = (k) => (sumBy(rows, k) > 0 && b > 0 ? cost(b / sumBy(rows, k)) : '—');
  return [money(b), per('leads'), '', per('qualified'), per('sv_leads'), per('bookings'), per('booked_sqft')];
};

// ── report panels ────────────────────────────────────────────────────────────
const Panel = ({ rkey, d, registerRef }) => {
  const t = d?.totals || {};
  const bySource = d?.bySource || [];
  const bySubSource = d?.bySubSource || [];
  const trend = d?.trend || [];
  const monthly = d?.meta?.trendGranularity === 'month';
  const totalBudget = num(t.budget);
  const avgCpl = t.costPerLead;

  switch (rkey) {
    // ── 1. Cost Metrix — By Source ──
    case 'source': {
      const chart = [...bySource]
        .filter((r) => r.cost_per_lead != null)
        .sort((a, b) => num(a.cost_per_lead) - num(b.cost_per_lead))
        .slice(0, 12)
        .map((r) => ({ name: r.source_name, cost_per_lead: num(r.cost_per_lead) }));
      const best = cheapest(bySource, 'cost_per_lead', 'leads');

      return (
        <>
          <KpiRow>
            <KpiCard label="Total Budget" value={money(t.budget)} sub={`${cnt(d?.meta?.budgetEntries)} budget line${num(d?.meta?.budgetEntries) === 1 ? '' : 's'}`} color={COLORS.primary} icon={CurrencyRupeeIcon} valueSize={19} />
            <KpiCard label="Cost per Lead" value={cost(t.costPerLead)} sub={`${cnt(t.leads)} leads`} color={COLORS.leads} icon={UsersIcon} valueSize={19} />
            <KpiCard label="Cost per Qualified Lead" value={cost(t.costPerQualified)} sub={`${cnt(t.qualified)} qualified · ${pct1(num(t.qualified), num(t.leads))}% of leads`} color={COLORS.qualified} icon={CheckBadgeIcon} valueSize={19} />
            <KpiCard label="Cost per Site Visit" value={cost(t.costPerSiteVisit)} sub={`${cnt(t.siteVisits)} site visits`} color={COLORS.siteVisit} icon={MapPinIcon} valueSize={19} />
            <KpiCard label="Cost per Booking" value={cost(t.costPerBooking)} sub={`${cnt(t.bookings)} bookings`} color={COLORS.booking} icon={BuildingOffice2Icon} valueSize={19} />
            <KpiCard label="Cost per Sq Ft" value={cost(t.costPerSqft)} sub={`${cnt(t.bookedSqft)} sq ft booked`} color={COLORS.negotiation} icon={Squares2X2Icon} valueSize={19} />
          </KpiRow>

          <div className="reports-charts-grid">
            <ChartCard title="Cost per Lead by Source" subtitle="Cheapest first — lower is better" chartKey="mm-cpl-bar" registerRef={registerRef}>
              <SimpleBar data={chart} xKey="name" bars={[{ key: 'cost_per_lead', name: 'Cost / Lead', color: COLORS.leads }]} valueFormat={money} tickFormat={axisMoney} />
            </ChartCard>
            <ChartCard title="Budget Split" subtitle="Share of total spend" chartKey="mm-budget-mix" registerRef={registerRef}>
              <FunnelDonut data={mixOf(bySource, 'source_name', 'budget')} valueFormat={axisMoney} centreLabel="Budget" centreSize={19} />
            </ChartCard>
          </div>

          <Card title="Spend & Volume by Source" sub={`Site Visits = leads from this spend that completed a first visit (revisits not re-counted)${best ? ` · cheapest lead: ${best.source_name}` : ''}`}>
            <Table head={['Source', ...VOLUME_HEAD]} colSpan={8} empty={bySource.length === 0}>
              {bySource.map((r) => (
                <VolumeRow key={r.source_id} r={r} totalBudget={totalBudget} nameCell={<Td bold>{r.source_name}</Td>} />
              ))}
              {bySource.length > 0 && <TotalRow cells={volumeTotals(bySource)} />}
            </Table>
          </Card>

          <Card title="Cost Efficiency by Source" sub="vs Avg compares a source's cost per lead to the blended average — under 1× is cheaper than average">
            <Table head={['Source', ...COST_HEAD]} colSpan={8} empty={bySource.length === 0}>
              {bySource.map((r) => (
                <CostRow key={r.source_id} r={r} avgCpl={avgCpl} nameCell={<Td bold>{r.source_name}</Td>} />
              ))}
              {bySource.length > 0 && <TotalRow cells={blendedTotals(bySource)} label="Blended" />}
            </Table>
          </Card>
        </>
      );
    }

    // ── 2. Cost Metrix — By Sub Source ──
    case 'subsource': {
      const ranked = [...bySubSource].sort((a, b) => num(b.budget) - num(a.budget) || num(b.leads) - num(a.leads));
      const best = cheapest(ranked, 'cost_per_lead', 'leads');
      const chart = [...ranked]
        .filter((r) => r.cost_per_lead != null)
        .sort((a, b) => num(a.cost_per_lead) - num(b.cost_per_lead))
        .slice(0, 12)
        .map((r) => ({ name: r.sub_source_name, cost_per_lead: num(r.cost_per_lead) }));

      const groups = bySource.map((s) => ({
        key: s.source_id,
        label: s.source_name,
        rows: ranked.filter((r) => r.source_id === s.source_id),
        stats: [
          { label: 'Budget', value: money(s.budget) },
          { label: 'Cost/Lead', value: cost(s.cost_per_lead) },
        ],
      })).filter((g) => g.rows.length > 0);

      const nameCell = (r) => (
        <Td bold>
          {r.sub_source_name}
          <span className="block text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>{r.source_name}</span>
        </Td>
      );

      return (
        <>
          <KpiRow>
            <KpiCard label="Total Budget" value={money(t.budget)} sub={`Across ${cnt(t.subSources)} sub-source${num(t.subSources) === 1 ? '' : 's'}`} color={COLORS.primary} icon={CurrencyRupeeIcon} valueSize={19} />
            <KpiCard label="Cost per Lead" value={cost(t.costPerLead)} sub={`${cnt(t.leads)} leads`} color={COLORS.leads} icon={UsersIcon} valueSize={19} />
            <KpiCard label="Cost per Qualified Lead" value={cost(t.costPerQualified)} sub={`${cnt(t.qualified)} qualified`} color={COLORS.qualified} icon={CheckBadgeIcon} valueSize={19} />
            <KpiCard label="Cost per Site Visit" value={cost(t.costPerSiteVisit)} sub={`${cnt(t.siteVisits)} site visits`} color={COLORS.siteVisit} icon={MapPinIcon} valueSize={19} />
            <KpiCard label="Cost per Booking" value={cost(t.costPerBooking)} sub={`${cnt(t.bookings)} bookings`} color={COLORS.booking} icon={BuildingOffice2Icon} valueSize={19} />
            <KpiCard label="Cheapest Sub Source" value={best?.sub_source_name || '—'} sub={best ? `${cost(best.cost_per_lead)} per lead · ${best.source_name}` : 'Needs 5+ leads'} color={COLORS.negotiation} icon={TrophyIcon} valueSize={16} />
          </KpiRow>

          <ChartCard title="Cost per Lead by Sub Source" subtitle="Cheapest first — lower is better" chartKey="mm-sub-cpl" registerRef={registerRef}>
            <SimpleBar data={chart} xKey="name" bars={[{ key: 'cost_per_lead', name: 'Cost / Lead', color: COLORS.primary }]} valueFormat={money} tickFormat={axisMoney} />
          </ChartCard>

          <Card title="Spend & Volume by Sub Source" sub="Spend booked against a whole source shows as “Not specified”, alongside the leads that carry no sub-source">
            <Table head={['Sub Source', ...VOLUME_HEAD]} colSpan={8} empty={ranked.length === 0}>
              {ranked.map((r) => (
                <VolumeRow key={`${r.source_id}-${r.sub_source_id}`} r={r} totalBudget={totalBudget} nameCell={nameCell(r)} />
              ))}
              {ranked.length > 0 && <TotalRow cells={volumeTotals(ranked)} />}
            </Table>
          </Card>

          <Card title="Cost Efficiency by Sub Source" sub="vs Avg compares to the blended cost per lead across all spend">
            <Table head={['Sub Source', ...COST_HEAD]} colSpan={8} empty={ranked.length === 0}>
              {ranked.map((r) => (
                <CostRow key={`${r.source_id}-${r.sub_source_id}`} r={r} avgCpl={avgCpl} nameCell={nameCell(r)} />
              ))}
              {ranked.length > 0 && <TotalRow cells={blendedTotals(ranked)} label="Blended" />}
            </Table>
          </Card>

          <Card title="Source Detail" sub="Expand a source to see its sub-source split">
            <GroupRows
              groups={groups}
              emptyLabel="No spend or leads for this period."
              head={['Sub Source', 'Budget', 'Leads', 'Cost / Lead', 'Site Visits', 'Bookings']}
              renderRow={(r) => (
                <Tr key={`${r.source_id}-${r.sub_source_id}-d`}>
                  <Td bold>{r.sub_source_name}</Td>
                  <Td>{money(r.budget)}</Td>
                  <Td>{cnt(r.leads)}</Td>
                  <Td bold>{cost(r.cost_per_lead)}</Td>
                  <Td color={COLORS.siteVisit}>{cnt(r.sv_leads)}</Td>
                  <Td color={COLORS.booking}>{cnt(r.bookings)}</Td>
                </Tr>
              )}
              totalCells={(rows) => {
                const b = sumBy(rows, 'budget');
                const l = sumBy(rows, 'leads');
                return [
                  money(b), cnt(l), (l > 0 && b > 0 ? cost(b / l) : '—'),
                  cnt(sumBy(rows, 'sv_leads')), cnt(sumBy(rows, 'bookings')),
                ];
              }}
            />
          </Card>
        </>
      );
    }

    // ── 3. Cost Efficiency ──
    case 'efficiency': {
      const withCost = bySource.filter((r) => r.cost_per_lead != null);
      const ranked = [...withCost].sort((a, b) => num(a.cost_per_lead) - num(b.cost_per_lead));
      const bestLead = cheapest(bySource, 'cost_per_lead', 'leads');
      const bestBooking = cheapest(bySource, 'cost_per_booking', 'bookings', 1);
      const worst = [...withCost].filter((r) => num(r.leads) >= 5).sort((a, b) => num(b.cost_per_lead) - num(a.cost_per_lead))[0];
      const noSpend = bySource.filter((r) => num(r.budget) === 0 && num(r.leads) > 0);
      const noReturn = bySource.filter((r) => num(r.budget) > 0 && num(r.leads) === 0);

      const cplChart = ranked.slice(0, 12).map((r) => ({ name: r.source_name, cost_per_lead: num(r.cost_per_lead) }));
      const cpbChart = [...bySource]
        .filter((r) => r.cost_per_booking != null)
        .sort((a, b) => num(a.cost_per_booking) - num(b.cost_per_booking))
        .slice(0, 12)
        .map((r) => ({ name: r.source_name, cost_per_booking: num(r.cost_per_booking) }));

      return (
        <>
          <KpiRow>
            <KpiCard label="Blended Cost / Lead" value={cost(t.costPerLead)} sub={`${money(t.budget)} ÷ ${cnt(t.leads)} leads`} color={COLORS.leads} icon={UsersIcon} valueSize={19} />
            <KpiCard label="Cheapest Source" value={bestLead?.source_name || '—'} sub={bestLead ? `${cost(bestLead.cost_per_lead)} per lead` : 'Needs 5+ leads'} color={COLORS.qualified} icon={TrophyIcon} valueSize={16} />
            <KpiCard label="Most Expensive" value={worst?.source_name || '—'} sub={worst ? `${cost(worst.cost_per_lead)} per lead` : 'Needs 5+ leads'} color={COLORS.cancelled} icon={ArrowTrendingUpIcon} valueSize={16} />
            <KpiCard label="Best Cost / Booking" value={bestBooking?.source_name || '—'} sub={bestBooking ? `${cost(bestBooking.cost_per_booking)} per booking` : 'No bookings yet'} color={COLORS.booking} icon={BuildingOffice2Icon} valueSize={16} />
            <KpiCard label="Lead → Booking" value={`${pct1(num(t.bookings), num(t.leads))}%`} sub={`${cnt(t.bookings)} of ${cnt(t.leads)} leads`} color={COLORS.negotiation} icon={ScaleIcon} />
            <KpiCard label="Re-attributed Leads" value={cnt(d?.meta?.reattributedLeads)} sub="Credited to a re-enquiry, not their creation" color={COLORS.muted} icon={ArrowPathIcon} />
          </KpiRow>

          <div className="reports-charts-grid">
            <ChartCard title="Cost per Lead" subtitle="By source, cheapest first" chartKey="mm-eff-cpl" registerRef={registerRef}>
              <SimpleBar data={cplChart} xKey="name" bars={[{ key: 'cost_per_lead', name: 'Cost / Lead', color: COLORS.leads }]} valueFormat={money} tickFormat={axisMoney} />
            </ChartCard>
            <ChartCard title="Cost per Booking" subtitle="By source, cheapest first" chartKey="mm-eff-cpb" registerRef={registerRef}>
              <SimpleBar data={cpbChart} xKey="name" bars={[{ key: 'cost_per_booking', name: 'Cost / Booking', color: COLORS.booking }]} valueFormat={money} tickFormat={axisMoney} />
            </ChartCard>
          </div>

          <ChartCard title="Spend Trend" subtitle={monthly ? 'Budget recorded per month' : 'Budget recorded per day'} chartKey="mm-spend-trend" registerRef={registerRef}>
            <TrendLine
              data={trend}
              monthly={monthly}
              valueFormat={money}
              tickFormat={axisMoney}
              lines={[{ key: 'budget', name: 'Budget', color: COLORS.primary }]}
            />
          </ChartCard>

          <ChartCard title="Volume Trend" subtitle={monthly ? 'What that spend bought, per month' : 'What that spend bought, per day'} chartKey="mm-vol-trend" registerRef={registerRef}>
            <TrendLine
              data={trend}
              monthly={monthly}
              lines={[
                { key: 'leads', name: 'Leads', color: COLORS.leads },
                { key: 'qualified', name: 'Qualified', color: COLORS.qualified },
                { key: 'sv_leads', name: 'Site Visits', color: COLORS.siteVisit },
                { key: 'bookings', name: 'Bookings', color: COLORS.booking },
              ]}
            />
          </ChartCard>

          <Card title="Efficiency Ranking" sub="Sources ordered by cost per lead — cheapest first">
            <Table head={['#', 'Source', 'Budget', 'Cost / Lead', 'Cost / Qualified', 'Cost / Site Visit', 'Cost / Booking', 'vs Avg']} colSpan={8} empty={ranked.length === 0}>
              {ranked.map((r, i) => {
                const idx = costIndex(r.cost_per_lead, avgCpl);
                return (
                  <Tr key={r.source_id}>
                    <Td>{i + 1}</Td>
                    <Td bold>{r.source_name}</Td>
                    <Td>{money(r.budget)}</Td>
                    <Td bold>{cost(r.cost_per_lead)}</Td>
                    <Td color={COLORS.qualified}>{cost(r.cost_per_qualified)}</Td>
                    <Td color={COLORS.siteVisit}>{cost(r.cost_per_sv)}</Td>
                    <Td color={COLORS.booking}>{cost(r.cost_per_booking)}</Td>
                    <Td>{idx == null ? '—' : <Pill tone={costTone(idx)}>{idx}×</Pill>}</Td>
                  </Tr>
                );
              })}
            </Table>
          </Card>

          <Card title="Conversion Funnel by Source" sub="How far the leads each source bought actually travelled">
            <Table head={['Source', 'Leads', 'Qualified', 'Qual %', 'Site Visits', 'SV %', 'Bookings', 'Booking %', 'Progress']} colSpan={9} empty={bySource.length === 0}>
              {bySource.map((r) => {
                const q = pct(num(r.qualified), num(r.leads));
                const sv = pct(num(r.sv_leads), num(r.leads));
                const bk = pct(num(r.bookings), num(r.leads));
                return (
                  <Tr key={r.source_id}>
                    <Td bold>{r.source_name}</Td>
                    <Td bold>{cnt(r.leads)}</Td>
                    <Td color={COLORS.qualified}>{cnt(r.qualified)}</Td>
                    <Td><Pill tone={ratioTone(q)}>{q}%</Pill></Td>
                    <Td color={COLORS.siteVisit}>{cnt(r.sv_leads)}</Td>
                    {/* SV ratios sit far below 100% in practice, so the tone scale is
                        stretched (×3) — the same treatment the other report pages use. */}
                    <Td><Pill tone={ratioTone(sv * 3)}>{sv}%</Pill></Td>
                    <Td color={COLORS.booking}>{cnt(r.bookings)}</Td>
                    <Td><Pill tone={ratioTone(bk * 10)}>{pct1(num(r.bookings), num(r.leads))}%</Pill></Td>
                    <Td><ProgressBar value={sv * 3} color={sv >= 20 ? COLORS.booking : COLORS.siteVisit} /></Td>
                  </Tr>
                );
              })}
              {bySource.length > 0 && (() => {
                const l = sumBy(bySource, 'leads');
                return (
                  <TotalRow cells={[
                    cnt(l), cnt(sumBy(bySource, 'qualified')), `${pct(sumBy(bySource, 'qualified'), l)}%`,
                    cnt(sumBy(bySource, 'sv_leads')), `${pct(sumBy(bySource, 'sv_leads'), l)}%`,
                    cnt(sumBy(bySource, 'bookings')), `${pct1(sumBy(bySource, 'bookings'), l)}%`, '',
                  ]} />
                );
              })()}
            </Table>
          </Card>

          {(noSpend.length > 0 || noReturn.length > 0) && (
            <Card title="Data Gaps" sub="Rows where spend and volume do not line up — usually a missing budget line">
              <Table head={['Source', 'Issue', 'Budget', 'Leads']} colSpan={4} empty={false}>
                {noReturn.map((r) => (
                  <Tr key={`nr-${r.source_id}`}>
                    <Td bold>{r.source_name}</Td>
                    <Td color={COLORS.cancelled}>Budget recorded, no leads attributed in this period</Td>
                    <Td>{money(r.budget)}</Td>
                    <Td>0</Td>
                  </Tr>
                ))}
                {noSpend.map((r) => (
                  <Tr key={`ns-${r.source_id}`}>
                    <Td bold>{r.source_name}</Td>
                    <Td color={COLORS.negotiation}>Leads attributed, no budget recorded — cost cannot be computed</Td>
                    <Td>—</Td>
                    <Td>{cnt(r.leads)}</Td>
                  </Tr>
                ))}
              </Table>
            </Card>
          )}
        </>
      );
    }

    default:
      return null;
  }
};

// ── page ─────────────────────────────────────────────────────────────────────
const MarketingMetrixPage = () => {
  const [period, setPeriod] = useState('mtd');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [subSourceId, setSubSourceId] = useState('');
  const [sources, setSources] = useState([]);
  const [subSources, setSubSources] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(FIRST_KEY);

  const chartRefs = useRef({});
  const registerRef = (key, el) => { if (el) chartRefs.current[key] = el; };

  useEffect(() => {
    leadSourceApi.getDropdown()
      .then((r) => setSources(r.data || []))
      .catch(() => { /* filters are non-fatal */ });
  }, []);

  // Sub-source list follows the selected source; clearing the source clears it.
  useEffect(() => {
    setSubSourceId('');
    if (!sourceId) { setSubSources([]); return; }
    leadSubSourceApi.getBySource(sourceId)
      .then((r) => setSubSources(r.data || []))
      .catch(() => setSubSources([]));
  }, [sourceId]);

  const load = useCallback(async () => {
    setLoading(true);
    chartRefs.current = {};
    try {
      const res = await reportApi.getMarketingMetrix({ period, from, to, sourceId, subSourceId });
      setData(res?.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load marketing metrix');
      setData(null);
    } finally { setLoading(false); }
  }, [period, from, to, sourceId, subSourceId]);

  useEffect(() => { load(); }, [load]);

  const hasData = !!data;
  const customActive = !!(from || to);
  const cfg = MM[selected] || MM[FIRST_KEY];
  const Icon = cfg.icon;
  const isBudgets = selected === 'budgets';

  const doExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportMarketingMetrix(data, {
        period, from, to, chartRefs: chartRefs.current, reportTitle: cfg.title,
      });
      toast.success('Export ready');
    } catch (err) {
      console.error('[Marketing metrix export] failed:', err);
      toast.error(`Export failed: ${err?.message || 'unknown error'}`);
    } finally { setExporting(false); }
  };

  return (
    <div className="reports-page">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>
            <CurrencyRupeeIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />
            Marketing Metrix
          </h1>
          <p className="hidden sm:block">Marketing spend against leads, qualified leads, site visits & bookings — and what each one costs</p>
        </div>
      </div>

      {/* The attribution rule changes what every number here means, so it is stated
          up front rather than buried in a tooltip. */}
      <div className="crm-card" style={{ padding: 12, marginBottom: 14, borderLeft: '4px solid #2563eb', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <InformationCircleIcon style={{ width: 18, height: 18, flexShrink: 0, color: '#2563eb', marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary, var(--text-muted))', lineHeight: 1.5 }}>
          {ATTRIBUTION_NOTE}
          {' '}
          A re-enquiry through a new campaign therefore credits that campaign, in the month it came in.
        </div>
      </div>

      {/* Filter bar — identical structure to the Reports / Marketing Reports bar */}
      <div className="reports-filter-bar reports-filter-bar--card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide mr-1" style={{ color: 'var(--text-muted)' }}>Period</span>
          {PERIODS.map((p) => {
            const active = !from && !to && period === p.key;
            return (
              <button key={p.key} type="button" onClick={() => { setFrom(''); setTo(''); setPeriod(p.key); }}
                className={`reports-chip ${active ? 'reports-chip--active' : ''}`}>
                {p.label}
              </button>
            );
          })}
          <button type="button" onClick={() => setFiltersOpen(true)} className={`reports-chip ${customActive ? 'reports-chip--active' : ''}`}>
            Custom
          </button>
          <button type="button" onClick={() => setFiltersOpen((o) => !o)} className="reports-chip ml-auto" aria-expanded={filtersOpen}>
            <FunnelIcon className="w-3.5 h-3.5" /> Filters
            <ChevronDownIcon className="w-3.5 h-3.5 transition-transform" style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-end gap-3 pt-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <div className="reports-filter" style={{ flex: '1 1 130px' }}>
              <label className="reports-filter__label" htmlFor="mm-from">From</label>
              <input id="mm-from" type="date" className="reports-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="reports-filter" style={{ flex: '1 1 130px' }}>
              <label className="reports-filter__label" htmlFor="mm-to">To</label>
              <input id="mm-to" type="date" className="reports-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="reports-filter" style={{ flex: '1 1 160px' }}>
              <label className="reports-filter__label" htmlFor="mm-source">Source</label>
              <select id="mm-source" className="reports-select" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">All Sources</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.source_name}</option>)}
              </select>
            </div>
            <div className="reports-filter" style={{ flex: '1 1 160px' }}>
              <label className="reports-filter__label" htmlFor="mm-subsource">Sub Source</label>
              <select id="mm-subsource" className="reports-select" value={subSourceId} onChange={(e) => setSubSourceId(e.target.value)} disabled={!sourceId}>
                <option value="">{sourceId ? 'All Sub Sources' : 'Pick a source first'}</option>
                {subSources.map((s) => <option key={s.id} value={s.id}>{s.sub_source_name}</option>)}
              </select>
            </div>
            <div className="reports-filter-actions">
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={load} disabled={loading}>
                <ArrowPathIcon style={{ width: 14, height: 14 }} /> {loading ? 'Loading…' : 'Refresh'}
              </button>
              <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={doExport} disabled={!hasData || exporting}>
                <ArrowDownTrayIcon style={{ width: 14, height: 14 }} /> {exporting ? 'Building…' : 'Export Excel'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile report picker */}
      <div className="lg:hidden mb-3">
        <label className="reports-filter__label" htmlFor="mm-report">Report</label>
        <select id="mm-report" className="reports-select mt-1" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.keys.map((k) => <option key={k} value={k}>{MM[k].title}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block lg:w-60 lg:flex-shrink-0">
          <div className="crm-card" style={{ padding: 8 }}>
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-1">
                <div className="px-2.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{g.label}</div>
                {g.keys.map((k) => {
                  const r = MM[k]; const RIcon = r.icon; const on = selected === k;
                  return (
                    <button key={k} type="button" onClick={() => setSelected(k)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors"
                      style={on ? { background: 'var(--bg-hover, #f4f4f5)' } : {}}>
                      <span className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                        <RIcon className="w-[15px] h-[15px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
                        <span className="block text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{r.rs}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* Report panel */}
        <main className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[17px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{cfg.title}</div>
              <div className="text-[12.5px] truncate" style={{ color: 'var(--text-muted)' }}>{cfg.sub}</div>
            </div>
          </div>

          <MonoContext.Provider value={true}>
            {/* Budget Entry is a ledger, not a report — it loads its own data and is
                never blocked by the metrix fetch. Saving here reloads the reports. */}
            {isBudgets ? (
              <BudgetEntry
                sources={sources}
                from={from}
                to={to}
                sourceId={sourceId}
                subSourceId={subSourceId}
                onChanged={load}
              />
            ) : (
              <>
                {loading && <div className="simple-loader"><div className="simple-spinner" /><p>Loading marketing metrix…</p></div>}
                {!loading && !hasData && <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No marketing data available.</div>}
                {!loading && hasData && <Panel key={selected} rkey={selected} d={data} registerRef={registerRef} />}
              </>
            )}
          </MonoContext.Provider>
        </main>
      </div>
    </div>
  );
};

export default MarketingMetrixPage;
