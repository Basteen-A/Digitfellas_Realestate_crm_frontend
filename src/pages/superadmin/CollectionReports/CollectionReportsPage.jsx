// ============================================================
// COLLECTION REPORTS
// Same shell, filter bar, sidebar catalogue and report atoms as the Reports and
// Marketing Reports pages — only the report set differs:
//   1. Collection — Item wise      (how much came in, split by cost item)
//   2. Collection — Project wise   (how much came in, split by project)
//   3. Outstanding — Item wise     (what is still owed, split by cost item)
//   4. Outstanding — Project wise  (what is still owed, split by project + ageing)
// One fetch (GET /reports/collection) feeds all four; switching reports is instant
// and never re-hits the API.
//
// ── Two date dimensions, by design ──────────────────────────────────────────
// COLLECTION blocks are anchored on the PAYMENT DATE — money that landed inside the
// period. OUTSTANDING blocks are a LIVE SNAPSHOT of the balance owed right now, so
// the period chips deliberately do not move them; only Project / Collection Manager
// do. Each outstanding block says so on screen so the two can never be misread.
//
// ── One component, two homes ────────────────────────────────────────────────
// Rendered both at /super-admin/collection-reports (org-wide) and inside the
// Collection Manager portal (own book). The server decides the scope from the
// caller's role — the page only hides the Collection Manager filter when it isn't
// the org-wide view.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  BanknotesIcon, ArrowPathIcon, ArrowDownTrayIcon, FunnelIcon, ChevronDownIcon,
  ChevronRightIcon, Squares2X2Icon, BuildingOffice2Icon, ExclamationTriangleIcon,
  CheckBadgeIcon, ClockIcon, ScaleIcon, TrophyIcon, ReceiptRefundIcon,
  CreditCardIcon, ChartPieIcon, ArrowTrendingUpIcon, DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import reportApi from '../../../api/reportApi';
import projectApi from '../../../api/projectApi';
import userApi from '../../../api/userApi';
import { formatCurrencyExact } from '../../../utils/formatters';
import { COLORS, SERIES } from '../Reports/analytics/palette';
import { ChartCard, SimpleBar, FunnelDonut, TrendLine } from '../Reports/analytics/charts/Charts';
import {
  MonoContext, KpiCard, KpiRow, Pill, ratioTone, ProgressBar,
  Card, Table, Tr, Td, TotalRow,
} from '../Reports/analytics/ui';
import { exportCollectionReports } from './exportExcel';
import '../Reports/Reports.css';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'wtd', label: 'Week' },
  { key: 'mtd', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

// Users who can own a booking's collection — the org-wide "Collection Manager" filter.
const COLLECTION_ROLE_CODES = ['COL', 'CE'];

// ── helpers ──────────────────────────────────────────────────────────────────
const num = (v) => Number(v) || 0;
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const pct1 = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const cnt = (v) => num(v).toLocaleString('en-IN');
const sumBy = (rows, key) => (rows || []).reduce((a, r) => a + num(r[key]), 0);
const userName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || '—' : '—');

// Every rupee figure on this page is EXACT — Collection & Accounts screens never
// abbreviate to Lakh/Crore.
const money = (v) => formatCurrencyExact(num(v));
// …with one exception: a chart's Y axis is a scale, not a figure you read off, and a
// full ₹1,25,00,000 tick simply doesn't fit. Ticks are shortened; the tooltip that you
// actually read the number from stays exact.
const axisMoney = (v) => {
  const n = num(v);
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `₹${Math.round(n / 1e3)}K`;
  return `₹${n}`;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');

// Donut slices: the biggest N plus an "Others" rollup, so the slices always add up to
// the real total shown in the donut centre.
const mixOf = (rows, nameKey, valueKey, top = 7) => {
  const ranked = [...(rows || [])].filter((r) => num(r[valueKey]) > 0).sort((a, b) => num(b[valueKey]) - num(a[valueKey]));
  const head = ranked.slice(0, top).map((r, i) => ({
    name: r[nameKey], value: num(r[valueKey]), color: SERIES[i % SERIES.length],
  }));
  const rest = sumBy(ranked.slice(top), valueKey);
  return rest > 0 ? [...head, { name: 'Others', value: rest, color: COLORS.muted }] : head;
};

// Project × item rows → one row per project with a per-item amount map, plus the item
// columns ordered by overall size. `field` picks which measure the matrix shows.
const pivot = (rows, field) => {
  const pMap = new Map();
  const iTotals = new Map();
  (rows || []).forEach((r) => {
    if (!pMap.has(r.project_id)) {
      pMap.set(r.project_id, { key: r.project_id, project_name: r.project_name, total: 0, byItem: {} });
    }
    const p = pMap.get(r.project_id);
    const v = num(r[field]);
    p.total += v;
    p.byItem[r.item] = (p.byItem[r.item] || 0) + v;
    iTotals.set(r.item, (iTotals.get(r.item) || 0) + v);
  });
  return {
    projects: [...pMap.values()].sort((a, b) => b.total - a.total),
    itemCols: [...iTotals.entries()].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]).map(([k]) => k),
  };
};

// ── report catalogue (drives the sidebar + the mobile picker) ────────────────
const CR = {
  'collection-item': {
    icon: BanknotesIcon,
    title: 'Total Collection — Item wise',
    sub: 'Money received in this period, split by cost item',
    rs: 'Receipts by item',
  },
  'collection-project': {
    icon: BuildingOffice2Icon,
    title: 'Total Collection — Project wise',
    sub: 'Money received in this period, split by project',
    rs: 'Receipts by project',
  },
  'outstanding-item': {
    icon: ExclamationTriangleIcon,
    title: 'Total Outstanding — Item wise',
    sub: 'Balance still owed today, split by cost item',
    rs: 'Dues by item',
  },
  'outstanding-project': {
    icon: ClockIcon,
    title: 'Total Outstanding — Project wise',
    sub: 'Balance still owed today, split by project, with ageing',
    rs: 'Dues by project',
  },
};

const GROUPS = [
  { label: 'Collection', keys: ['collection-item', 'collection-project'] },
  { label: 'Outstanding', keys: ['outstanding-item', 'outstanding-project'] },
];
const FIRST_KEY = GROUPS[0].keys[0];

// Caption repeated on every outstanding block — the single most important thing to
// understand about this report.
const SNAPSHOT_NOTE = 'Live balance across every open booking — the period filter applies to collection only';

// ── expandable group list (item → project, project → item) ───────────────────
// Mirrors the Marketing / Reports drill-down so the interaction is identical.
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

// Item label with its raw payment_category underneath, so a collection user can match
// a row to the category they pick in the Record Payment drawer.
const ItemCell = ({ row }) => (
  <Td bold>
    {row.item_label || row.item}
    {row.item_label && row.item_label !== row.item && (
      <span className="block text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>{row.item}</span>
    )}
  </Td>
);

const AGE_COLS = [
  { key: 'b0_30', label: '0–30 days' },
  { key: 'b31_60', label: '31–60 days' },
  { key: 'b61_90', label: '61–90 days' },
  { key: 'b90p', label: '90+ days' },
];

// ── report panels ────────────────────────────────────────────────────────────
const Panel = ({ rkey, d, registerRef }) => {
  const t = d?.totals || {};
  const byItem = d?.byItem || [];
  const byProject = d?.byProject || [];
  const projectItem = d?.projectItem || [];
  const aging = d?.aging || [];
  const topOutstanding = d?.topOutstanding || [];
  const modes = d?.modes || [];
  const monthly = d?.meta?.trendGranularity === 'month';
  const itemLabel = (key) => byItem.find((i) => i.item === key)?.item_label || key;

  switch (rkey) {
    // ── 1. Total Collection — Item wise ──
    case 'collection-item': {
      const collecting = byItem.filter((i) => num(i.collected) !== 0);
      const ranked = [...collecting].sort((a, b) => num(b.collected) - num(a.collected));
      const top = ranked[0];
      const chart = ranked.slice(0, 12).map((i) => ({ name: i.item_label, collected: num(i.collected) }));
      const trend = (d?.trend || []).map((r) => ({
        bucket: r.bucket, collected: num(r.collected), gross: num(r.gross), refunds: num(r.refunds),
      }));
      // Item → which projects that item's money came from.
      const groups = ranked.map((i) => ({
        key: i.item,
        label: i.item_label,
        rows: projectItem
          .filter((r) => r.item === i.item && num(r.collected) !== 0)
          .sort((a, b) => num(b.collected) - num(a.collected)),
        stats: [{ label: 'Collected', value: money(i.collected) }],
      }));

      return (
        <>
          <KpiRow>
            <KpiCard label="Net Collected" value={money(t.collected)} sub="Receipts less refunds, this period" color={COLORS.booking} icon={BanknotesIcon} valueSize={19} />
            <KpiCard label="Gross Receipts" value={money(t.gross)} sub={`${cnt(t.payments)} payment${num(t.payments) === 1 ? '' : 's'}`} color={COLORS.qualified} icon={CreditCardIcon} valueSize={19} />
            <KpiCard label="Refunds" value={money(t.refunds)} sub={`${pct1(num(t.refunds), num(t.gross))}% of gross`} color={COLORS.cancelled} icon={ReceiptRefundIcon} valueSize={19} />
            <KpiCard label="Verified" value={money(t.verified)} sub={`${pct1(num(t.verified), num(t.gross))}% of receipts verified`} color={COLORS.siteVisit} icon={DocumentCheckIcon} valueSize={19} />
            <KpiCard label="Bookings Paying" value={cnt(t.bookingsPaying)} sub={`of ${cnt(t.bookings)} live booking${num(t.bookings) === 1 ? '' : 's'}`} color={COLORS.leads} icon={Squares2X2Icon} />
            <KpiCard label="Top Item" value={top?.item_label || '—'} sub={top ? `${money(top.collected)} · ${pct(num(top.collected), num(t.collected))}% share` : ''} color={COLORS.negotiation} icon={TrophyIcon} valueSize={16} />
          </KpiRow>

          <div className="reports-charts-grid">
            <ChartCard title="Collection by Item" subtitle="Net of refunds, this period" chartKey="col-item-bar" registerRef={registerRef}>
              <SimpleBar data={chart} xKey="name" bars={[{ key: 'collected', name: 'Collected', color: COLORS.booking }]} valueFormat={money} tickFormat={axisMoney} />
            </ChartCard>
            <ChartCard title="Collection Mix" subtitle="Share of the period's collection" chartKey="col-item-mix" registerRef={registerRef}>
              <FunnelDonut data={mixOf(collecting, 'item_label', 'collected')} valueFormat={axisMoney} centreLabel="Collected" centreSize={19} />
            </ChartCard>
          </div>

          <ChartCard
            title="Collection Trend"
            subtitle={monthly ? 'Money received per month' : 'Money received per day'}
            chartKey="col-trend"
            registerRef={registerRef}
          >
            <TrendLine
              data={trend}
              monthly={monthly}
              valueFormat={money}
              tickFormat={axisMoney}
              lines={[
                { key: 'collected', name: 'Net Collected', color: COLORS.booking },
                { key: 'gross', name: 'Gross Receipts', color: COLORS.qualified },
                { key: 'refunds', name: 'Refunds', color: COLORS.cancelled },
              ]}
            />
          </ChartCard>

          <Card title="Collection by Item" sub="Net = receipts − refunds; bounced cheques never count as money in">
            <Table head={['Item', 'Net Collected', 'Share', 'Gross', 'Refunds', 'Payments', 'Verified', 'Collected to date']} colSpan={8} empty={collecting.length === 0}>
              {ranked.map((i) => (
                <Tr key={i.item}>
                  <ItemCell row={i} />
                  <Td bold>{money(i.collected)}</Td>
                  <Td><Pill tone="blue">{pct1(num(i.collected), num(t.collected))}%</Pill></Td>
                  <Td color={COLORS.qualified}>{money(i.gross)}</Td>
                  <Td color={COLORS.cancelled}>{num(i.refunds) ? money(i.refunds) : '—'}</Td>
                  <Td>{cnt(i.payments)}</Td>
                  <Td color={COLORS.siteVisit}>{money(i.verified)}</Td>
                  <Td>{money(i.collected_ltd)}</Td>
                </Tr>
              ))}
              {ranked.length > 0 && (
                <TotalRow cells={[
                  money(sumBy(ranked, 'collected')), '100%',
                  money(sumBy(ranked, 'gross')), money(sumBy(ranked, 'refunds')),
                  cnt(sumBy(ranked, 'payments')), money(sumBy(ranked, 'verified')),
                  money(sumBy(ranked, 'collected_ltd')),
                ]} />
              )}
            </Table>
          </Card>

          <Card title="Where Each Item Was Collected" sub="Expand an item to see the projects that paid it">
            <GroupRows
              groups={groups}
              emptyLabel="No collection in this period."
              head={['Project', 'Collected', 'Share of item']}
              renderRow={(r) => {
                const itemTotal = num(byItem.find((i) => i.item === r.item)?.collected);
                return (
                  <Tr key={`${r.item}-${r.project_id}`}>
                    <Td bold>{r.project_name}</Td>
                    <Td>{money(r.collected)}</Td>
                    <Td><Pill tone="blue">{pct1(num(r.collected), itemTotal)}%</Pill></Td>
                  </Tr>
                );
              }}
              totalCells={(rows) => [money(sumBy(rows, 'collected')), '100%']}
            />
          </Card>

          <Card title="How the Money Came In" sub="Payment mode split for this period" right={`${modes.length} mode${modes.length === 1 ? '' : 's'}`}>
            <Table head={['Payment Mode', 'Net Collected', 'Share', 'Payments']} colSpan={4} empty={modes.length === 0}>
              {modes.map((m) => (
                <Tr key={m.mode}>
                  <Td bold>{m.mode}</Td>
                  <Td bold>{money(m.collected)}</Td>
                  <Td><Pill tone="blue">{pct1(num(m.collected), num(t.collected))}%</Pill></Td>
                  <Td>{cnt(m.payments)}</Td>
                </Tr>
              ))}
              {modes.length > 0 && (
                <TotalRow cells={[money(sumBy(modes, 'collected')), '100%', cnt(sumBy(modes, 'payments'))]} />
              )}
            </Table>
          </Card>
        </>
      );
    }

    // ── 2. Total Collection — Project wise ──
    case 'collection-project': {
      const collecting = byProject.filter((p) => num(p.collected) !== 0)
        .sort((a, b) => num(b.collected) - num(a.collected));
      const top = collecting[0];
      const chart = collecting.slice(0, 12).map((p) => ({ name: p.project_name, collected: num(p.collected) }));
      const { projects, itemCols } = pivot(projectItem, 'collected');
      const avg = num(t.bookingsPaying) > 0 ? num(t.collected) / num(t.bookingsPaying) : 0;
      // Project → its item split for the period.
      const groups = collecting.map((p) => ({
        key: p.project_id,
        label: p.project_name,
        rows: projectItem
          .filter((r) => r.project_id === p.project_id && num(r.collected) !== 0)
          .sort((a, b) => num(b.collected) - num(a.collected)),
        stats: [
          { label: 'Bookings', value: cnt(p.bookings_paying) },
          { label: 'Collected', value: money(p.collected) },
        ],
      }));

      return (
        <>
          <KpiRow>
            <KpiCard label="Net Collected" value={money(t.collected)} sub="Across every project, this period" color={COLORS.booking} icon={BanknotesIcon} valueSize={19} />
            <KpiCard label="Projects Collecting" value={cnt(collecting.length)} sub={`of ${cnt(t.projects)} with live bookings`} color={COLORS.negotiation} icon={BuildingOffice2Icon} />
            <KpiCard label="Top Project" value={top?.project_name || '—'} sub={top ? `${money(top.collected)} · ${pct(num(top.collected), num(t.collected))}% share` : ''} color={COLORS.qualified} icon={TrophyIcon} valueSize={16} />
            <KpiCard label="Avg per Booking" value={money(avg)} sub={`${cnt(t.bookingsPaying)} booking${num(t.bookingsPaying) === 1 ? '' : 's'} paid this period`} color={COLORS.leads} icon={ScaleIcon} valueSize={19} />
            <KpiCard label="Payments" value={cnt(t.payments)} sub={`${money(t.refunds)} refunded`} color={COLORS.siteVisit} icon={CreditCardIcon} />
          </KpiRow>

          <div className="reports-charts-grid">
            <ChartCard title="Collection by Project" subtitle="Top 12 projects, net of refunds" chartKey="col-proj-bar" registerRef={registerRef}>
              <SimpleBar data={chart} xKey="name" bars={[{ key: 'collected', name: 'Collected', color: COLORS.negotiation }]} valueFormat={money} tickFormat={axisMoney} />
            </ChartCard>
            <ChartCard title="Project Mix" subtitle="Share of the period's collection" chartKey="col-proj-mix" registerRef={registerRef}>
              <FunnelDonut data={mixOf(collecting, 'project_name', 'collected')} valueFormat={axisMoney} centreLabel="Collected" centreSize={19} />
            </ChartCard>
          </div>

          <Card title="Collection by Project" sub="Realisation = collected to date ÷ total billed, for the whole project">
            <Table head={['Project', 'Net Collected', 'Share', 'Bookings Paid', 'Payments', 'Billed to date', 'Collected to date', 'Realisation']} colSpan={8} empty={collecting.length === 0}>
              {collecting.map((p) => {
                const r = pct(num(p.collected_ltd), num(p.demand));
                return (
                  <Tr key={p.project_id}>
                    <Td bold>{p.project_name}</Td>
                    <Td bold>{money(p.collected)}</Td>
                    <Td><Pill tone="blue">{pct1(num(p.collected), num(t.collected))}%</Pill></Td>
                    <Td>{cnt(p.bookings_paying)}</Td>
                    <Td>{cnt(p.payments)}</Td>
                    <Td>{money(p.demand)}</Td>
                    <Td color={COLORS.qualified}>{money(p.collected_ltd)}</Td>
                    <Td><Pill tone={ratioTone(r)}>{r}%</Pill></Td>
                  </Tr>
                );
              })}
              {collecting.length > 0 && (() => {
                const dem = sumBy(collecting, 'demand');
                const col = sumBy(collecting, 'collected_ltd');
                return (
                  <TotalRow cells={[
                    money(sumBy(collecting, 'collected')), '100%',
                    cnt(sumBy(collecting, 'bookings_paying')), cnt(sumBy(collecting, 'payments')),
                    money(dem), money(col),
                    <Pill tone={ratioTone(pct(col, dem))}>{pct(col, dem)}%</Pill>,
                  ]} />
                );
              })()}
            </Table>
          </Card>

          <Card title="Project × Item Matrix" sub="Collected in this period" right={`${itemCols.length} item${itemCols.length === 1 ? '' : 's'}`}>
            <Table head={['Project', 'Collected', ...itemCols.map(itemLabel)]} colSpan={itemCols.length + 2} empty={projects.length === 0}>
              {projects.filter((p) => p.total !== 0).map((p) => (
                <Tr key={p.key}>
                  <Td bold>{p.project_name}</Td>
                  <Td bold>{money(p.total)}</Td>
                  {itemCols.map((c) => (
                    <Td key={c} className={p.byItem[c] ? '' : 'opacity-40'}>{p.byItem[c] ? money(p.byItem[c]) : '—'}</Td>
                  ))}
                </Tr>
              ))}
              {projects.length > 0 && (
                <TotalRow cells={[
                  money(projects.reduce((a, p) => a + p.total, 0)),
                  ...itemCols.map((c) => money(projects.reduce((a, p) => a + (p.byItem[c] || 0), 0))),
                ]} />
              )}
            </Table>
          </Card>

          <Card title="Project Detail" sub="Expand a project to see which items its money went to">
            <GroupRows
              groups={groups}
              emptyLabel="No collection in this period."
              head={['Item', 'Collected', 'Share of project']}
              renderRow={(r) => {
                const projTotal = num(byProject.find((p) => p.project_id === r.project_id)?.collected);
                return (
                  <Tr key={`${r.project_id}-${r.item}`}>
                    <Td bold>{itemLabel(r.item)}</Td>
                    <Td>{money(r.collected)}</Td>
                    <Td><Pill tone="blue">{pct1(num(r.collected), projTotal)}%</Pill></Td>
                  </Tr>
                );
              }}
              totalCells={(rows) => [money(sumBy(rows, 'collected')), '100%']}
            />
          </Card>
        </>
      );
    }

    // ── 3. Total Outstanding — Item wise ──
    case 'outstanding-item': {
      const ranked = [...byItem].sort((a, b) => num(b.outstanding) - num(a.outstanding));
      const withDues = ranked.filter((i) => num(i.outstanding) > 0);
      const top = withDues[0];
      const chart = ranked.filter((i) => num(i.demand) > 0).slice(0, 12).map((i) => ({
        name: i.item_label, collected: num(i.collected_ltd), outstanding: num(i.outstanding),
      }));
      const realisation = pct1(num(t.collectedLtd), num(t.demand));
      // Item → the projects still owing it.
      const groups = withDues.map((i) => ({
        key: i.item,
        label: i.item_label,
        rows: projectItem
          .filter((r) => r.item === i.item && num(r.outstanding) > 0)
          .sort((a, b) => num(b.outstanding) - num(a.outstanding)),
        stats: [{ label: 'Outstanding', value: money(i.outstanding) }],
      }));

      return (
        <>
          <KpiRow>
            <KpiCard label="Total Outstanding" value={money(t.outstanding)} sub={SNAPSHOT_NOTE} color={COLORS.cancelled} icon={ExclamationTriangleIcon} valueSize={19} />
            <KpiCard label="Billed to date" value={money(t.demand)} sub={`Across ${cnt(t.bookings)} live booking${num(t.bookings) === 1 ? '' : 's'}`} color={COLORS.leads} icon={ChartPieIcon} valueSize={19} />
            <KpiCard label="Collected to date" value={money(t.collectedLtd)} sub={`${realisation}% of billed`} color={COLORS.booking} icon={BanknotesIcon} valueSize={19} />
            <KpiCard label="Realisation" value={`${realisation}%`} sub="Collected ÷ billed" color={COLORS.qualified} icon={ArrowTrendingUpIcon} />
            <KpiCard label="Items Pending" value={cnt(withDues.length)} sub={`of ${cnt(ranked.length)} billed item${ranked.length === 1 ? '' : 's'}`} color={COLORS.negotiation} icon={Squares2X2Icon} />
            <KpiCard label="Biggest Gap" value={top?.item_label || '—'} sub={top ? `${money(top.outstanding)} · ${pct(num(top.outstanding), num(t.outstanding))}% of dues` : 'Nothing outstanding'} color={COLORS.siteVisit} icon={TrophyIcon} valueSize={16} />
          </KpiRow>

          <div className="reports-charts-grid">
            <ChartCard title="Collected vs Outstanding by Item" subtitle="Each bar is the full amount billed" chartKey="out-item-bar" registerRef={registerRef}>
              <SimpleBar
                data={chart}
                xKey="name"
                valueFormat={money}
                tickFormat={axisMoney}
                bars={[
                  { key: 'collected', name: 'Collected', color: COLORS.booking, stack: 'o' },
                  { key: 'outstanding', name: 'Outstanding', color: COLORS.cancelled, stack: 'o' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Outstanding Mix" subtitle="Share of the total balance owed" chartKey="out-item-mix" registerRef={registerRef}>
              <FunnelDonut data={mixOf(withDues, 'item_label', 'outstanding')} valueFormat={axisMoney} centreLabel="Outstanding" centreSize={19} />
            </ChartCard>
          </div>

          <Card title="Outstanding by Item" sub={SNAPSHOT_NOTE}>
            <Table head={['Item', 'Billed', 'Collected', 'Outstanding', 'Excess', 'Collected %', 'Progress', 'Bookings Pending']} colSpan={8} empty={ranked.length === 0}>
              {ranked.map((i) => {
                const r = pct(num(i.collected_ltd), num(i.demand));
                return (
                  <Tr key={i.item}>
                    <ItemCell row={i} />
                    <Td bold>{money(i.demand)}</Td>
                    <Td color={COLORS.booking}>{money(i.collected_ltd)}</Td>
                    <Td color={COLORS.cancelled}>{num(i.outstanding) ? money(i.outstanding) : '—'}</Td>
                    <Td color={COLORS.siteVisit}>{num(i.excess) ? money(i.excess) : '—'}</Td>
                    <Td><Pill tone={ratioTone(r)}>{r}%</Pill></Td>
                    <Td><ProgressBar value={r} color={r >= 100 ? COLORS.booking : COLORS.negotiation} /></Td>
                    <Td>{cnt(i.bookings_pending)}</Td>
                  </Tr>
                );
              })}
              {ranked.length > 0 && (() => {
                const dem = sumBy(ranked, 'demand');
                const col = sumBy(ranked, 'collected_ltd');
                return (
                  <TotalRow cells={[
                    money(dem), money(col),
                    money(sumBy(ranked, 'outstanding')), money(sumBy(ranked, 'excess')),
                    <Pill tone={ratioTone(pct(col, dem))}>{pct(col, dem)}%</Pill>,
                    '', cnt(t.bookingsPending),
                  ]} />
                );
              })()}
            </Table>
          </Card>

          <Card title="Who Owes Each Item" sub="Expand an item to see the projects still carrying the balance">
            <GroupRows
              groups={groups}
              emptyLabel="Nothing outstanding — every item is fully collected."
              head={['Project', 'Billed', 'Collected', 'Outstanding']}
              renderRow={(r) => (
                <Tr key={`${r.item}-${r.project_id}`}>
                  <Td bold>{r.project_name}</Td>
                  <Td>{money(r.demand)}</Td>
                  <Td color={COLORS.booking}>{money(r.collected_ltd)}</Td>
                  <Td color={COLORS.cancelled}>{money(r.outstanding)}</Td>
                </Tr>
              )}
              totalCells={(rows) => [
                money(sumBy(rows, 'demand')), money(sumBy(rows, 'collected_ltd')), money(sumBy(rows, 'outstanding')),
              ]}
            />
          </Card>
        </>
      );
    }

    // ── 4. Total Outstanding — Project wise ──
    case 'outstanding-project': {
      const ranked = [...byProject].sort((a, b) => num(b.outstanding) - num(a.outstanding));
      const withDues = ranked.filter((p) => num(p.outstanding) > 0);
      const chart = ranked.filter((p) => num(p.demand) > 0).slice(0, 12).map((p) => ({
        name: p.project_name, collected: num(p.collected_ltd), outstanding: num(p.outstanding),
      }));
      const { projects, itemCols } = pivot(projectItem, 'outstanding');
      const realisation = pct1(num(t.collectedLtd), num(t.demand));
      const avgDue = num(t.bookingsPending) > 0 ? num(t.outstanding) / num(t.bookingsPending) : 0;
      const agingTotals = AGE_COLS.reduce((m, c) => { m[c.key] = sumBy(aging, c.key); return m; }, {});
      const overdue90 = agingTotals.b90p;

      return (
        <>
          <KpiRow>
            <KpiCard label="Total Outstanding" value={money(t.outstanding)} sub={SNAPSHOT_NOTE} color={COLORS.cancelled} icon={ExclamationTriangleIcon} valueSize={19} />
            <KpiCard label="Bookings Pending" value={cnt(t.bookingsPending)} sub={`${cnt(t.bookingsSettled)} fully settled`} color={COLORS.negotiation} icon={Squares2X2Icon} />
            <KpiCard label="Avg per Booking" value={money(avgDue)} sub="Average balance still owed" color={COLORS.leads} icon={ScaleIcon} valueSize={19} />
            <KpiCard label="Projects with Dues" value={cnt(withDues.length)} sub={`of ${cnt(t.projects)} with live bookings`} color={COLORS.siteVisit} icon={BuildingOffice2Icon} />
            <KpiCard label="Overdue 90+ days" value={money(overdue90)} sub={`${pct1(overdue90, num(t.outstanding))}% of the balance`} color={COLORS.cancelled} icon={ClockIcon} valueSize={19} />
            <KpiCard label="Realisation" value={`${realisation}%`} sub={`${money(t.collectedLtd)} of ${money(t.demand)}`} color={COLORS.booking} icon={CheckBadgeIcon} />
          </KpiRow>

          <div className="reports-charts-grid">
            <ChartCard title="Collected vs Outstanding by Project" subtitle="Each bar is the full amount billed" chartKey="out-proj-bar" registerRef={registerRef}>
              <SimpleBar
                data={chart}
                xKey="name"
                valueFormat={money}
                tickFormat={axisMoney}
                bars={[
                  { key: 'collected', name: 'Collected', color: COLORS.booking, stack: 'o' },
                  { key: 'outstanding', name: 'Outstanding', color: COLORS.cancelled, stack: 'o' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Outstanding Mix" subtitle="Share of the total balance owed" chartKey="out-proj-mix" registerRef={registerRef}>
              <FunnelDonut data={mixOf(withDues, 'project_name', 'outstanding')} valueFormat={axisMoney} centreLabel="Outstanding" centreSize={19} />
            </ChartCard>
          </div>

          <Card title="Outstanding by Project" sub={SNAPSHOT_NOTE}>
            <Table head={['Project', 'Billed', 'Collected', 'Outstanding', 'Collected %', 'Progress', 'Bookings Pending', 'Settled']} colSpan={8} empty={ranked.length === 0}>
              {ranked.map((p) => {
                const r = pct(num(p.collected_ltd), num(p.demand));
                return (
                  <Tr key={p.project_id}>
                    <Td bold>{p.project_name}</Td>
                    <Td bold>{money(p.demand)}</Td>
                    <Td color={COLORS.booking}>{money(p.collected_ltd)}</Td>
                    <Td color={COLORS.cancelled}>{num(p.outstanding) ? money(p.outstanding) : '—'}</Td>
                    <Td><Pill tone={ratioTone(r)}>{r}%</Pill></Td>
                    <Td><ProgressBar value={r} color={r >= 100 ? COLORS.booking : COLORS.negotiation} /></Td>
                    <Td>{cnt(p.bookings_pending)}</Td>
                    <Td>{cnt(p.bookings_settled)}</Td>
                  </Tr>
                );
              })}
              {ranked.length > 0 && (() => {
                const dem = sumBy(ranked, 'demand');
                const col = sumBy(ranked, 'collected_ltd');
                return (
                  <TotalRow cells={[
                    money(dem), money(col), money(sumBy(ranked, 'outstanding')),
                    <Pill tone={ratioTone(pct(col, dem))}>{pct(col, dem)}%</Pill>,
                    '', cnt(sumBy(ranked, 'bookings_pending')), cnt(sumBy(ranked, 'bookings_settled')),
                  ]} />
                );
              })()}
            </Table>
          </Card>

          <Card title="Ageing" sub="Outstanding bucketed by how long ago the booking was made — there is no per-item demand schedule, so booking age is the ageing axis">
            <Table head={['Project', ...AGE_COLS.map((c) => c.label), 'Total', 'Bookings']} colSpan={AGE_COLS.length + 3} empty={aging.length === 0}>
              {aging.map((r) => (
                <Tr key={r.project_id}>
                  <Td bold>{r.project_name}</Td>
                  {AGE_COLS.map((c, i) => (
                    <Td key={c.key} color={i >= 2 ? COLORS.cancelled : undefined} className={num(r[c.key]) ? '' : 'opacity-40'}>
                      {num(r[c.key]) ? money(r[c.key]) : '—'}
                    </Td>
                  ))}
                  <Td bold>{money(r.total)}</Td>
                  <Td>{cnt(r.bookings)}</Td>
                </Tr>
              ))}
              {aging.length > 0 && (
                <TotalRow cells={[
                  ...AGE_COLS.map((c) => money(agingTotals[c.key])),
                  money(sumBy(aging, 'total')), cnt(sumBy(aging, 'bookings')),
                ]} />
              )}
            </Table>
          </Card>

          <Card title="Project × Item Outstanding" sub="Balance owed, per project and item" right={`${itemCols.length} item${itemCols.length === 1 ? '' : 's'}`}>
            <Table head={['Project', 'Outstanding', ...itemCols.map(itemLabel)]} colSpan={itemCols.length + 2} empty={projects.length === 0}>
              {projects.filter((p) => p.total !== 0).map((p) => (
                <Tr key={p.key}>
                  <Td bold>{p.project_name}</Td>
                  <Td bold>{money(p.total)}</Td>
                  {itemCols.map((c) => (
                    <Td key={c} className={p.byItem[c] ? '' : 'opacity-40'}>{p.byItem[c] ? money(p.byItem[c]) : '—'}</Td>
                  ))}
                </Tr>
              ))}
              {projects.length > 0 && (
                <TotalRow cells={[
                  money(projects.reduce((a, p) => a + p.total, 0)),
                  ...itemCols.map((c) => money(projects.reduce((a, p) => a + (p.byItem[c] || 0), 0))),
                ]} />
              )}
            </Table>
          </Card>

          {/* Outstanding here is the SUM of each item's shortfall, not the netted
              booking balance — money over-paid into one item never settles another.
              The Excess column makes that arithmetic visible: Billed − Collected +
              Excess = Outstanding. */}
          <Card title="Highest Outstanding Bookings" sub="The 25 biggest balances — the call list" right={`${topOutstanding.length} shown`}>
            <Table head={['Booking', 'Buyer', 'Project', 'Booked', 'Age', 'Billed', 'Collected', 'Excess', 'Outstanding', 'Collected %']} colSpan={10} empty={topOutstanding.length === 0}>
              {topOutstanding.map((b) => {
                const r = pct(num(b.collected), num(b.demand));
                return (
                  <Tr key={b.booking_id}>
                    <Td bold>{b.booking_number}</Td>
                    <Td>{b.buyer_name}</Td>
                    <Td>{b.project_name}</Td>
                    <Td>{fmtDate(b.booking_date)}</Td>
                    <Td color={num(b.age_days) > 90 ? COLORS.cancelled : undefined}>{b.age_days == null ? '—' : `${cnt(b.age_days)}d`}</Td>
                    <Td>{money(b.demand)}</Td>
                    <Td color={COLORS.booking}>{money(b.collected)}</Td>
                    <Td color={COLORS.siteVisit}>{num(b.excess) ? money(b.excess) : '—'}</Td>
                    <Td bold color={COLORS.cancelled}>{money(b.outstanding)}</Td>
                    <Td><Pill tone={ratioTone(r)}>{r}%</Pill></Td>
                  </Tr>
                );
              })}
            </Table>
          </Card>
        </>
      );
    }

    default:
      return null;
  }
};

// ── page ─────────────────────────────────────────────────────────────────────
// `orgWide` renders the Super Admin view (all bookings + the Collection Manager
// filter); the Collection portal passes false and the server pins the scope to the
// signed-in user's own book.
const CollectionReportsPage = ({ orgWide = true }) => {
  const [period, setPeriod] = useState('mtd');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [projectId, setProjectId] = useState('');
  const [collectionManagerId, setCollectionManagerId] = useState('');
  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(FIRST_KEY);

  const chartRefs = useRef({});
  const registerRef = (key, el) => { if (el) chartRefs.current[key] = el; };

  useEffect(() => {
    projectApi.getDropdown()
      .then((r) => setProjects(r.data || []))
      .catch(() => { /* filters are non-fatal */ });
  }, []);

  // The Collection Manager filter only exists on the org-wide view — a Collection
  // user is always pinned to their own book (the server enforces it too).
  useEffect(() => {
    if (!orgWide) return;
    userApi.getAll({ limit: 100, is_active: 'true' })
      .then((r) => {
        const list = r?.data?.data || r?.data || [];
        setManagers((Array.isArray(list) ? list : []).filter((u) => COLLECTION_ROLE_CODES.includes(u.userType?.short_code)));
      })
      .catch(() => setManagers([]));
  }, [orgWide]);

  const load = useCallback(async () => {
    setLoading(true);
    chartRefs.current = {};
    try {
      const res = await reportApi.getCollectionReports({ period, from, to, projectId, collectionManagerId });
      setData(res?.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load collection reports');
      setData(null);
    } finally { setLoading(false); }
  }, [period, from, to, projectId, collectionManagerId]);

  useEffect(() => { load(); }, [load]);

  const hasData = !!data;
  const customActive = !!(from || to);
  const cfg = CR[selected] || CR[FIRST_KEY];
  const Icon = cfg.icon;

  const doExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportCollectionReports(data, {
        period, from, to, chartRefs: chartRefs.current, reportTitle: cfg.title,
      });
      toast.success('Export ready');
    } catch (err) {
      console.error('[Collection reports export] failed:', err);
      toast.error(`Export failed: ${err?.message || 'unknown error'}`);
    } finally { setExporting(false); }
  };

  return (
    <div className="reports-page">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>
            <BanknotesIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />
            Collection Report
          </h1>
          <p className="hidden sm:block">
            {orgWide
              ? 'Organisation-wide collection & outstanding, item wise and project wise'
              : 'Collection & outstanding across the bookings you handle, item wise and project wise'}
          </p>
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
              <label className="reports-filter__label" htmlFor="col-from">From</label>
              <input id="col-from" type="date" className="reports-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="reports-filter" style={{ flex: '1 1 130px' }}>
              <label className="reports-filter__label" htmlFor="col-to">To</label>
              <input id="col-to" type="date" className="reports-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="reports-filter" style={{ flex: '1 1 160px' }}>
              <label className="reports-filter__label" htmlFor="col-project">Project</label>
              <select id="col-project" className="reports-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            {orgWide && (
              <div className="reports-filter" style={{ flex: '1 1 180px' }}>
                <label className="reports-filter__label" htmlFor="col-manager">Collection Manager</label>
                <select id="col-manager" className="reports-select" value={collectionManagerId} onChange={(e) => setCollectionManagerId(e.target.value)}>
                  <option value="">All Collection Users</option>
                  {managers.map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
                </select>
              </div>
            )}
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
        <label className="reports-filter__label" htmlFor="col-report">Report</label>
        <select id="col-report" className="reports-select mt-1" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.keys.map((k) => <option key={k} value={k}>{CR[k].title}</option>)}
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
                  const r = CR[k]; const RIcon = r.icon; const on = selected === k;
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

          {loading && <div className="simple-loader"><div className="simple-spinner" /><p>Loading collection reports…</p></div>}
          {!loading && !hasData && <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No collection data available.</div>}
          {!loading && hasData && (
            <MonoContext.Provider value={true}>
              <Panel key={selected} rkey={selected} d={data} registerRef={registerRef} />
            </MonoContext.Provider>
          )}
        </main>
      </div>
    </div>
  );
};

export default CollectionReportsPage;
