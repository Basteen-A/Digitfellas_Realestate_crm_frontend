// ============================================================
// MARKETING REPORTS (Super Admin › Marketing › Reports)
// Same shell, filter bar, sidebar catalogue and report atoms as the Reports
// page (../Reports) — only the report set differs:
//   1. Leads from Source / Sub Source
//   2. Lead Quality — SV Done / Qualified / RNR / Unqualified
//   3. Site Visit Ratio
//   4. Project-wise Leads (by source)
//   5. Source-wise Site Visits
// One fetch (GET /reports/marketing) feeds all five; switching reports is
// instant and never re-hits the API.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  MegaphoneIcon, ArrowPathIcon, ArrowDownTrayIcon, FunnelIcon, ChevronDownIcon,
  UsersIcon, CheckBadgeIcon, XCircleIcon, ScaleIcon, MapPinIcon, TrophyIcon,
  BuildingOffice2Icon, Squares2X2Icon, PhoneArrowUpRightIcon, ClockIcon,
  ChartPieIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import reportApi from '../../../api/reportApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import projectApi from '../../../api/projectApi';
import { COLORS, SERIES } from '../Reports/analytics/palette';
import { ChartCard, SimpleBar, FunnelDonut, TrendLine } from '../Reports/analytics/charts/Charts';
import {
  MonoContext, KpiCard, KpiRow, Pill, ratioTone, ProgressBar,
  Card, Table, Tr, Td, TotalRow,
} from '../Reports/analytics/ui';
import { exportMarketingReports } from './exportExcel';
import '../Reports/Reports.css';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'wtd', label: 'Week' },
  { key: 'mtd', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

// ── helpers ──────────────────────────────────────────────────────────────────
const num = (v) => Number(v) || 0;
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const pct1 = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const fmt = (v) => num(v).toLocaleString('en-IN');
const sumBy = (rows, key) => (rows || []).reduce((a, r) => a + num(r[key]), 0);

// Donut slices for the source mix: the 7 biggest sources plus an "Others"
// rollup, so the slices always add up to the real total in the donut centre.
const sourceMix = (bySource, top = 7) => {
  const head = bySource.slice(0, top).map((s, i) => ({
    name: s.source_name, value: num(s.leads), color: s.color_code || SERIES[i % SERIES.length],
  }));
  const rest = sumBy(bySource.slice(top), 'leads');
  return rest > 0 ? [...head, { name: 'Others', value: rest, color: COLORS.muted }] : head;
};

// Project × source rows → one row per project (with a per-source lead map) plus
// the source columns, ordered by overall volume.
const pivotProjects = (rows) => {
  const pMap = new Map();
  const sTotals = new Map();
  (rows || []).forEach((r) => {
    const key = r.project_id;
    if (!pMap.has(key)) {
      pMap.set(key, {
        key, project_name: r.project_name, leads: 0, qualified: 0, sv_leads: 0, bookings: 0, bySource: {},
      });
    }
    const p = pMap.get(key);
    p.leads += num(r.leads); p.qualified += num(r.qualified);
    p.sv_leads += num(r.sv_leads); p.bookings += num(r.bookings);
    p.bySource[r.source_name] = (p.bySource[r.source_name] || 0) + num(r.leads);
    sTotals.set(r.source_name, (sTotals.get(r.source_name) || 0) + num(r.leads));
  });
  return {
    projects: [...pMap.values()].sort((a, b) => b.leads - a.leads),
    sourceCols: [...sTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
  };
};

// ── report catalogue (drives the sidebar + the mobile picker) ────────────────
const MR = {
  sources: {
    icon: MegaphoneIcon,
    title: 'Leads from Source',
    sub: 'Volume by source & sub-source',
    rs: 'Source & sub-source',
  },
  projects: {
    icon: BuildingOffice2Icon,
    title: 'Project-wise Leads',
    sub: 'Leads per project, split by source',
    rs: 'Project × source',
  },
  quality: {
    icon: CheckBadgeIcon,
    title: 'Lead Quality',
    sub: 'SV Done / Qualified / RNR / Unqualified by source',
    rs: 'Quality mix',
  },
  svratio: {
    icon: ScaleIcon,
    title: 'Site Visit Ratio',
    sub: 'Site visits ÷ leads delivered, by source',
    rs: 'SV conversion',
  },
  svsource: {
    icon: MapPinIcon,
    title: 'Source-wise Site Visits',
    sub: 'Visits performed in this period, by lead source',
    rs: 'Visits by source',
  },
};

const GROUPS = [
  { label: 'Acquisition', keys: ['sources', 'projects'] },
  { label: 'Quality & Conversion', keys: ['quality', 'svratio', 'svsource'] },
];
const FIRST_KEY = GROUPS[0].keys[0];

// ── expandable group list (source → sub-source, source → project) ────────────
// Mirrors the Reports page's project drill-down so the interaction is identical.
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
                  <span key={s.label} className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
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

// ── report panels ────────────────────────────────────────────────────────────
const Panel = ({ rkey, d, registerRef }) => {
  const t = d?.totals || {};
  const bySource = d?.bySource || [];
  const bySubSource = d?.bySubSource || [];
  const projectWise = d?.projectWise || [];
  const svBySource = d?.sourceWiseSiteVisits || [];
  const svByProject = d?.sourceProjectSiteVisits || [];
  const monthly = d?.meta?.trendGranularity === 'month';

  switch (rkey) {
    // ── 1. Leads from Source / Sub Source ──
    case 'sources': {
      const top = bySource[0];
      const chart = bySource.slice(0, 12).map((s) => ({ source_name: s.source_name, leads: num(s.leads) }));
      const trend = (d?.leadsTrend || []).map((r) => ({
        bucket: r.bucket, leads: num(r.leads), qualified: num(r.qualified), sv_leads: num(r.sv_leads),
      }));
      const topSub = [...bySubSource].sort((a, b) => num(b.leads) - num(a.leads))[0];

      return (
        <>
          <KpiRow>
            <KpiCard label="Total Leads" value={fmt(t.leads)} sub="Delivered in this period" color={COLORS.leads} icon={UsersIcon} />
            <KpiCard label="Active Sources" value={fmt(t.sources)} sub={`${fmt(t.subSources)} sub-sources`} color={COLORS.primary} icon={MegaphoneIcon} />
            <KpiCard label="Top Source" value={top?.source_name || '—'} sub={top ? `${fmt(top.leads)} leads · ${pct(num(top.leads), num(t.leads))}% share` : ''} color={COLORS.booking} icon={TrophyIcon} valueSize={17} />
            <KpiCard label="Top Sub-source" value={topSub?.sub_source_name || '—'} sub={topSub ? `${topSub.source_name} · ${fmt(topSub.leads)} leads` : ''} color={COLORS.siteVisit} icon={ChartPieIcon} valueSize={17} />
          </KpiRow>

          <div className="reports-charts-grid">
            <ChartCard title="Leads by Source" subtitle="Top 12 sources" chartKey="mkt-source-bar" registerRef={registerRef}>
              <SimpleBar data={chart} xKey="source_name" bars={[{ key: 'leads', name: 'Leads', color: COLORS.leads }]} />
            </ChartCard>
            <ChartCard title="Source Mix" subtitle="Share of total leads" chartKey="mkt-source-mix" registerRef={registerRef}>
              <FunnelDonut data={sourceMix(bySource)} />
            </ChartCard>
          </div>

          <ChartCard
            title="Acquisition Trend"
            subtitle={monthly ? 'Leads delivered per month' : 'Leads delivered per day'}
            chartKey="mkt-trend"
            registerRef={registerRef}
          >
            <TrendLine
              data={trend}
              monthly={monthly}
              lines={[
                { key: 'leads', name: 'Leads', color: COLORS.leads },
                { key: 'qualified', name: 'Qualified', color: COLORS.qualified },
                { key: 'sv_leads', name: 'SV Done', color: COLORS.siteVisit },
              ]}
            />
          </ChartCard>

          <Card title="Leads by Source" sub="Share of total, with downstream outcome">
            <Table head={['Source', 'Leads', 'Share', 'Qualified', 'SV Done', 'Bookings']} colSpan={6} empty={bySource.length === 0}>
              {bySource.map((s) => (
                <Tr key={s.source_id}>
                  <Td bold>{s.source_name}</Td>
                  <Td bold>{fmt(s.leads)}</Td>
                  <Td><Pill tone="blue">{pct1(num(s.leads), num(t.leads))}%</Pill></Td>
                  <Td color={COLORS.qualified}>{fmt(s.qualified)}</Td>
                  <Td color={COLORS.siteVisit}>{fmt(s.sv_leads)}</Td>
                  <Td color={COLORS.booking}>{fmt(s.bookings)}</Td>
                </Tr>
              ))}
              {bySource.length > 0 && (
                <TotalRow cells={[
                  fmt(sumBy(bySource, 'leads')), '100%',
                  fmt(sumBy(bySource, 'qualified')), fmt(sumBy(bySource, 'sv_leads')), fmt(sumBy(bySource, 'bookings')),
                ]} />
              )}
            </Table>
          </Card>

          <Card title="Leads by Sub-source" sub="Sv Done = leads generated in this period that completed a first visit (revisits not re-counted)" right={`${bySubSource.length} sub-source${bySubSource.length === 1 ? '' : 's'}`}>
            <Table head={['Sub Source', 'Leads', 'Sv Done', 'Scheduled', 'Follow Up', 'RNR', 'Cold', 'Junk/Spam']} colSpan={8} empty={bySubSource.length === 0}>
              {[...bySubSource].sort((a, b) => num(b.leads) - num(a.leads)).map((r) => (
                <Tr key={`${r.source_id}-${r.sub_source_id}`}>
                  <Td bold>
                    {r.sub_source_name}
                    <span className="block text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>{r.source_name}</span>
                  </Td>
                  <Td bold>{fmt(r.leads)}</Td>
                  <Td color={COLORS.siteVisit}>{fmt(r.sv_leads)}</Td>
                  <Td color={COLORS.negotiation}>{fmt(r.scheduled)}</Td>
                  <Td color={COLORS.qualified}>{fmt(r.follow_up)}</Td>
                  <Td>{fmt(r.rnr)}</Td>
                  <Td>{fmt(r.cold)}</Td>
                  <Td color={COLORS.cancelled}>{fmt(r.junk_spam)}</Td>
                </Tr>
              ))}
              {bySubSource.length > 0 && (
                <TotalRow cells={[
                  fmt(sumBy(bySubSource, 'leads')),
                  fmt(sumBy(bySubSource, 'sv_leads')),
                  fmt(sumBy(bySubSource, 'scheduled')),
                  fmt(sumBy(bySubSource, 'follow_up')),
                  fmt(sumBy(bySubSource, 'rnr')),
                  fmt(sumBy(bySubSource, 'cold')),
                  fmt(sumBy(bySubSource, 'junk_spam')),
                ]} />
              )}
            </Table>
          </Card>
        </>
      );
    }

    // ── 2. Lead Quality ──
    case 'quality': {
      const chart = bySource.slice(0, 12).map((s) => ({
        source_name: s.source_name,
        qualified: num(s.qualified),
        rnr: num(s.rnr),
        unqualified: num(s.unqualified),
        unassigned: num(s.unassigned),
      }));
      const mix = [
        { name: 'Qualified', value: num(t.qualified), color: COLORS.qualified },
        { name: 'RNR', value: num(t.rnr), color: COLORS.siteVisit },
        { name: 'Unqualified', value: num(t.unqualified), color: COLORS.cancelled },
        { name: 'Unassigned', value: num(t.unassigned), color: COLORS.muted },
      ].filter((x) => x.value > 0);
      // Best source = highest qualification rate among sources with real volume.
      const best = [...bySource]
        .filter((s) => num(s.leads) >= 5)
        .sort((a, b) => pct1(num(b.qualified), num(b.leads)) - pct1(num(a.qualified), num(a.leads)))[0];

      return (
        <>
          <KpiRow>
            <KpiCard label="Qualified" value={fmt(t.qualified)} sub={`${pct1(num(t.qualified), num(t.leads))}% of leads`} color={COLORS.qualified} icon={CheckBadgeIcon} />
            <KpiCard label="SV Done" value={fmt(t.siteVisits)} sub={`${pct1(num(t.siteVisits), num(t.leads))}% of leads`} color={COLORS.siteVisit} icon={BuildingOffice2Icon} />
            <KpiCard label="RNR" value={fmt(t.rnr)} sub={`${pct1(num(t.rnr), num(t.leads))}% never connected`} color={COLORS.negotiation} icon={PhoneArrowUpRightIcon} />
            <KpiCard label="Unqualified" value={fmt(t.unqualified)} sub={`${pct1(num(t.unqualified), num(t.leads))}% junk / lost`} color={COLORS.cancelled} icon={XCircleIcon} />
            <KpiCard label="Unassigned" value={fmt(t.unassigned)} sub={`${pct1(num(t.unassigned), num(t.leads))}% never allocated`} color={COLORS.muted} icon={ClockIcon} />
            <KpiCard label="Best Quality Source" value={best?.source_name || '—'} sub={best ? `${pct1(num(best.qualified), num(best.leads))}% qualified` : 'Needs 5+ leads'} color={COLORS.booking} icon={TrophyIcon} valueSize={17} />
          </KpiRow>

          <div className="reports-charts-grid">
            <ChartCard title="Quality by Source" subtitle="Stacked lead outcome" chartKey="mkt-quality-bar" registerRef={registerRef}>
              <SimpleBar
                data={chart}
                xKey="source_name"
                bars={[
                  { key: 'qualified', name: 'Qualified', color: COLORS.qualified, stack: 'q' },
                  { key: 'rnr', name: 'RNR', color: COLORS.siteVisit, stack: 'q' },
                  { key: 'unqualified', name: 'Unqualified', color: COLORS.cancelled, stack: 'q' },
                  { key: 'unassigned', name: 'Unassigned', color: COLORS.muted, stack: 'q' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Overall Quality Mix" subtitle="All sources combined" chartKey="mkt-quality-mix" registerRef={registerRef}>
              <FunnelDonut data={mix} />
            </ChartCard>
          </div>

          <Card title="Lead Quality by Source" sub="Sv Done = leads generated in this period that completed a first visit · rest are current status">
            <Table head={['Source', 'Leads', 'Sv Done', 'Scheduled', 'Follow Up', 'RNR', 'Cold', 'Junk/Spam']} colSpan={8} empty={bySource.length === 0}>
              {bySource.map((s) => (
                <Tr key={s.source_id}>
                  <Td bold>{s.source_name}</Td>
                  <Td bold>{fmt(s.leads)}</Td>
                  <Td color={COLORS.siteVisit}>{fmt(s.sv_leads)}</Td>
                  <Td color={COLORS.negotiation}>{fmt(s.scheduled)}</Td>
                  <Td color={COLORS.qualified}>{fmt(s.follow_up)}</Td>
                  <Td>{fmt(s.rnr)}</Td>
                  <Td>{fmt(s.cold)}</Td>
                  <Td color={COLORS.cancelled}>{fmt(s.junk_spam)}</Td>
                </Tr>
              ))}
              {bySource.length > 0 && (
                <TotalRow cells={[
                  fmt(sumBy(bySource, 'leads')),
                  fmt(sumBy(bySource, 'sv_leads')),
                  fmt(sumBy(bySource, 'scheduled')),
                  fmt(sumBy(bySource, 'follow_up')),
                  fmt(sumBy(bySource, 'rnr')),
                  fmt(sumBy(bySource, 'cold')),
                  fmt(sumBy(bySource, 'junk_spam')),
                ]} />
              )}
            </Table>
          </Card>
        </>
      );
    }

    // ── 3. Site Visit Ratio ──
    case 'svratio': {
      const chart = bySource.slice(0, 12).map((s) => ({
        source_name: s.source_name, leads: num(s.leads), sv_leads: num(s.sv_leads),
      }));
      const best = [...bySource]
        .filter((s) => num(s.leads) >= 5)
        .sort((a, b) => pct1(num(b.sv_leads), num(b.leads)) - pct1(num(a.sv_leads), num(a.leads)))[0];
      const overall = pct1(num(t.siteVisits), num(t.leads));

      return (
        <>
          <KpiRow>
            <KpiCard label="Leads" value={fmt(t.leads)} sub="Cohort size" color={COLORS.leads} icon={UsersIcon} />
            <KpiCard label="SV Done" value={fmt(t.siteVisits)} sub="Leads that visited" color={COLORS.siteVisit} icon={BuildingOffice2Icon} />
            <KpiCard label="SV Ratio" value={`${overall}%`} sub="Site visits ÷ leads" color={COLORS.qualified} icon={ScaleIcon} />
            <KpiCard label="Bookings" value={fmt(t.bookings)} sub={`${pct1(num(t.bookings), num(t.siteVisits))}% of visits booked`} color={COLORS.booking} icon={CheckBadgeIcon} />
            <KpiCard label="Best Converting Source" value={best?.source_name || '—'} sub={best ? `${pct1(num(best.sv_leads), num(best.leads))}% SV ratio` : 'Needs 5+ leads'} color={COLORS.negotiation} icon={TrophyIcon} valueSize={17} />
          </KpiRow>

          <ChartCard title="Leads vs Site Visits by Source" subtitle="Top 12 sources" chartKey="mkt-svratio" registerRef={registerRef}>
            <SimpleBar
              data={chart}
              xKey="source_name"
              bars={[
                { key: 'leads', name: 'Leads', color: COLORS.leads },
                { key: 'sv_leads', name: 'SV Done', color: COLORS.siteVisit },
              ]}
            />
          </ChartCard>

          <Card title="Site Visit Ratio by Source" sub="Leads created in this period that reached a completed visit">
            <Table head={['Source', 'Leads', 'SV Done', 'SV Ratio', 'Progress', 'Bookings', 'SV → Booking']} colSpan={7} empty={bySource.length === 0}>
              {bySource.map((s) => {
                const r = pct(num(s.sv_leads), num(s.leads));
                const b = pct(num(s.bookings), num(s.sv_leads));
                return (
                  <Tr key={s.source_id}>
                    <Td bold>{s.source_name}</Td>
                    <Td bold>{fmt(s.leads)}</Td>
                    <Td color={COLORS.siteVisit}>{fmt(s.sv_leads)}</Td>
                    {/* SV ratios sit far below 100% in practice, so the tone scale is
                        stretched (×3) — the same treatment the Reports page uses. */}
                    <Td><Pill tone={ratioTone(r * 3)}>{r}%</Pill></Td>
                    <Td><ProgressBar value={r * 3} color={r >= 20 ? COLORS.booking : COLORS.siteVisit} /></Td>
                    <Td color={COLORS.booking}>{fmt(s.bookings)}</Td>
                    <Td><Pill tone={ratioTone(b * 2)}>{b}%</Pill></Td>
                  </Tr>
                );
              })}
              {bySource.length > 0 && (() => {
                const leads = sumBy(bySource, 'leads');
                const sv = sumBy(bySource, 'sv_leads');
                const bk = sumBy(bySource, 'bookings');
                return (
                  <TotalRow cells={[
                    fmt(leads), fmt(sv),
                    <Pill tone={ratioTone(pct(sv, leads) * 3)}>{pct(sv, leads)}%</Pill>,
                    '', fmt(bk),
                    <Pill tone={ratioTone(pct(bk, sv) * 2)}>{pct(bk, sv)}%</Pill>,
                  ]} />
                );
              })()}
            </Table>
          </Card>
        </>
      );
    }

    // ── 4. Project-wise Leads (by source) ──
    case 'projects': {
      // Pivot the project × source rows into a matrix: one row per project, one
      // column per source (ordered by overall volume), plus totals.
      const { projects, sourceCols } = pivotProjects(projectWise);

      const chart = projects.slice(0, 12).map((p) => ({ project_name: p.project_name, leads: p.leads }));
      const top = projects[0];
      // Per-project drill-down: its sources, biggest first.
      const groups = projects.map((p) => ({
        key: p.key,
        label: p.project_name,
        rows: projectWise
          .filter((r) => r.project_id === p.key)
          .sort((a, b) => num(b.leads) - num(a.leads)),
        stats: [
          { label: 'Sources', value: Object.keys(p.bySource).length },
          { label: 'Leads', value: fmt(p.leads) },
        ],
      }));

      return (
        <>
          <KpiRow>
            <KpiCard label="Total Leads" value={fmt(t.leads)} sub="Across all projects" color={COLORS.leads} icon={UsersIcon} />
            <KpiCard label="Projects with Leads" value={fmt(projects.length)} sub="Active in this period" color={COLORS.negotiation} icon={Squares2X2Icon} />
            <KpiCard label="Top Project" value={top?.project_name || '—'} sub={top ? `${fmt(top.leads)} leads · ${pct(top.leads, num(t.leads))}% share` : ''} color={COLORS.booking} icon={TrophyIcon} valueSize={17} />
            <KpiCard label="Sources in Play" value={fmt(sourceCols.length)} sub="Feeding these projects" color={COLORS.primary} icon={MegaphoneIcon} />
          </KpiRow>

          <ChartCard title="Leads by Project" subtitle="Top 12 projects" chartKey="mkt-project-bar" registerRef={registerRef}>
            <SimpleBar data={chart} xKey="project_name" bars={[{ key: 'leads', name: 'Leads', color: COLORS.negotiation }]} />
          </ChartCard>

          <Card title="Project × Source Matrix" sub="Leads per project, split by source" right={`${sourceCols.length} source${sourceCols.length === 1 ? '' : 's'}`}>
            <Table head={['Project', 'Leads', ...sourceCols]} colSpan={sourceCols.length + 2} empty={projects.length === 0}>
              {projects.map((p) => (
                <Tr key={p.key}>
                  <Td bold>{p.project_name}</Td>
                  <Td bold>{fmt(p.leads)}</Td>
                  {sourceCols.map((c) => (
                    <Td key={c} className={p.bySource[c] ? '' : 'opacity-40'}>{p.bySource[c] ? fmt(p.bySource[c]) : '—'}</Td>
                  ))}
                </Tr>
              ))}
              {projects.length > 0 && (
                <TotalRow cells={[
                  fmt(projects.reduce((a, p) => a + p.leads, 0)),
                  ...sourceCols.map((c) => fmt(projects.reduce((a, p) => a + (p.bySource[c] || 0), 0))),
                ]} />
              )}
            </Table>
          </Card>

          <Card title="Project Detail" sub="Expand a project to see its source split & outcome">
            <GroupRows
              groups={groups}
              emptyLabel="No leads for this period."
              head={['Source', 'Leads', 'Qualified', 'SV Done', 'Bookings']}
              renderRow={(r) => (
                <Tr key={`${r.project_id}-${r.source_name}`}>
                  <Td bold>{r.source_name}</Td>
                  <Td>{fmt(r.leads)}</Td>
                  <Td color={COLORS.qualified}>{fmt(r.qualified)}</Td>
                  <Td color={COLORS.siteVisit}>{fmt(r.sv_leads)}</Td>
                  <Td color={COLORS.booking}>{fmt(r.bookings)}</Td>
                </Tr>
              )}
              totalCells={(rows) => [
                fmt(sumBy(rows, 'leads')), fmt(sumBy(rows, 'qualified')),
                fmt(sumBy(rows, 'sv_leads')), fmt(sumBy(rows, 'bookings')),
              ]}
            />
          </Card>
        </>
      );
    }

    // ── 5. Source-wise Site Visits ──
    case 'svsource': {
      // Visit-anchored: total_visits = distinct leads who did a first visit; the rest
      // bucket those leads by their current outcome.
      const totalVisits = sumBy(svBySource, 'total_visits');
      const booked = sumBy(svBySource, 'booked');
      const negotiation = sumBy(svBySource, 'negotiation');
      const revisit = sumBy(svBySource, 'revisit');
      const followUp = sumBy(svBySource, 'follow_up');
      const cold = sumBy(svBySource, 'cold');
      const chart = svBySource.slice(0, 12).map((s) => ({
        source_name: s.source_name,
        booked: num(s.booked),
        negotiation: num(s.negotiation),
        revisit: num(s.revisit),
        follow_up: num(s.follow_up),
        cold: num(s.cold),
      }));
      const groups = svBySource.map((s) => ({
        key: s.source_name,
        label: s.source_name,
        rows: svByProject.filter((r) => r.source_name === s.source_name),
        stats: [
          { label: 'Visits', value: fmt(s.total_visits) },
        ],
      }));

      return (
        <>
          <KpiRow>
            <KpiCard label="Total Visits" value={fmt(totalVisits)} sub="Distinct leads · first visit only" color={COLORS.qualified} icon={MapPinIcon} />
            <KpiCard label="Booked" value={fmt(booked)} sub={`${pct1(booked, totalVisits)}% of visited leads`} color={COLORS.booking} icon={CheckBadgeIcon} />
            <KpiCard label="In Negotiation" value={fmt(negotiation)} sub="Hot / warm" color={COLORS.negotiation} icon={ScaleIcon} />
            <KpiCard label="Follow Up" value={fmt(followUp)} sub="Awaiting next step" color={COLORS.siteVisit} icon={ClockIcon} />
            <KpiCard label="Cold" value={fmt(cold)} sub={`${pct1(cold, totalVisits)}% went cold`} color={COLORS.cancelled} icon={XCircleIcon} />
          </KpiRow>

          <ChartCard title="Post-visit Outcome by Source" subtitle="Where visited leads are now" chartKey="mkt-svsource" registerRef={registerRef}>
            <SimpleBar
              data={chart}
              xKey="source_name"
              bars={[
                { key: 'booked', name: 'Booked', color: COLORS.booking, stack: 'v' },
                { key: 'negotiation', name: 'Negotiation', color: COLORS.negotiation, stack: 'v' },
                { key: 'revisit', name: 'Re Visit', color: COLORS.primary, stack: 'v' },
                { key: 'follow_up', name: 'Follow Up', color: COLORS.siteVisit, stack: 'v' },
                { key: 'cold', name: 'Cold', color: COLORS.cancelled, stack: 'v' },
              ]}
            />
          </ChartCard>

          <Card title="Source-wise Site Visits" sub="Visit-date anchored · Total Visits = distinct leads' first visit; the rest are their current outcome">
            <Table head={['Source', 'Total Visits', 'Booked', 'Negotiation', 'Re Visit', 'Follow Up', 'Cold']} colSpan={7} empty={svBySource.length === 0}>
              {svBySource.map((s) => (
                <Tr key={s.source_name}>
                  <Td bold>{s.source_name}</Td>
                  <Td bold>{fmt(s.total_visits)}</Td>
                  <Td color={COLORS.booking}>{fmt(s.booked)}</Td>
                  <Td color={COLORS.negotiation}>{fmt(s.negotiation)}</Td>
                  <Td color={COLORS.primary}>{fmt(s.revisit)}</Td>
                  <Td color={COLORS.siteVisit}>{fmt(s.follow_up)}</Td>
                  <Td color={COLORS.cancelled}>{fmt(s.cold)}</Td>
                </Tr>
              ))}
              {svBySource.length > 0 && (
                <TotalRow cells={[
                  fmt(totalVisits), fmt(booked), fmt(negotiation), fmt(revisit), fmt(followUp), fmt(cold),
                ]} />
              )}
            </Table>
          </Card>

          <Card title="Where They Visited" sub="Expand a source to see the projects its leads visited">
            <GroupRows
              groups={groups}
              emptyLabel="No site visits for this period."
              head={['Project', 'Leads Visited']}
              renderRow={(r) => (
                <Tr key={`${r.source_name}-${r.project_name}`}>
                  <Td bold>{r.project_name}</Td>
                  <Td>{fmt(r.site_visits)}</Td>
                </Tr>
              )}
              totalCells={(rows) => [fmt(sumBy(rows, 'site_visits'))]}
            />
          </Card>
        </>
      );
    }

    default:
      return null;
  }
};

// ── page ─────────────────────────────────────────────────────────────────────
const MarketingReportsPage = () => {
  const [period, setPeriod] = useState('mtd');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [subSourceId, setSubSourceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sources, setSources] = useState([]);
  const [subSources, setSubSources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(FIRST_KEY);

  const chartRefs = useRef({});
  const registerRef = (key, el) => { if (el) chartRefs.current[key] = el; };

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([leadSourceApi.getDropdown(), projectApi.getDropdown()]);
        setSources(s.data || []); setProjects(p.data || []);
      } catch { /* filters are non-fatal */ }
    })();
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
      const res = await reportApi.getMarketingReports({ period, from, to, sourceId, subSourceId, projectId });
      setData(res?.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load marketing reports');
      setData(null);
    } finally { setLoading(false); }
  }, [period, from, to, sourceId, subSourceId, projectId]);

  useEffect(() => { load(); }, [load]);

  const hasData = !!data;
  const customActive = !!(from || to);
  const cfg = MR[selected] || MR[FIRST_KEY];
  const Icon = cfg.icon;

  const doExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportMarketingReports(data, {
        period, from, to, chartRefs: chartRefs.current, reportTitle: cfg.title,
      });
      toast.success('Export ready');
    } catch (err) {
      console.error('[Marketing reports export] failed:', err);
      toast.error(`Export failed: ${err?.message || 'unknown error'}`);
    } finally { setExporting(false); }
  };

  return (
    <div className="reports-page">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>
            <MegaphoneIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />
            Marketing Reports
          </h1>
          <p className="hidden sm:block">Source & sub-source acquisition, lead quality and site-visit conversion</p>
        </div>
      </div>

      {/* Filter bar — identical structure to the Reports page Analytics bar */}
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
              <label className="reports-filter__label" htmlFor="mkt-from">From</label>
              <input id="mkt-from" type="date" className="reports-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="reports-filter" style={{ flex: '1 1 130px' }}>
              <label className="reports-filter__label" htmlFor="mkt-to">To</label>
              <input id="mkt-to" type="date" className="reports-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="reports-filter" style={{ flex: '1 1 150px' }}>
              <label className="reports-filter__label" htmlFor="mkt-source">Source</label>
              <select id="mkt-source" className="reports-select" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">All Sources</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.source_name}</option>)}
              </select>
            </div>
            <div className="reports-filter" style={{ flex: '1 1 150px' }}>
              <label className="reports-filter__label" htmlFor="mkt-subsource">Sub Source</label>
              <select id="mkt-subsource" className="reports-select" value={subSourceId} onChange={(e) => setSubSourceId(e.target.value)} disabled={!sourceId}>
                <option value="">{sourceId ? 'All Sub Sources' : 'Pick a source first'}</option>
                {subSources.map((s) => <option key={s.id} value={s.id}>{s.sub_source_name}</option>)}
              </select>
            </div>
            <div className="reports-filter" style={{ flex: '1 1 150px' }}>
              <label className="reports-filter__label" htmlFor="mkt-project">Project</label>
              <select id="mkt-project" className="reports-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
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
        <label className="reports-filter__label" htmlFor="mkt-report">Report</label>
        <select id="mkt-report" className="reports-select mt-1" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.keys.map((k) => <option key={k} value={k}>{MR[k].title}</option>)}
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
                  const r = MR[k]; const RIcon = r.icon; const on = selected === k;
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

          {loading && <div className="simple-loader"><div className="simple-spinner" /><p>Loading marketing reports…</p></div>}
          {!loading && !hasData && <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No marketing data available.</div>}
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

export default MarketingReportsPage;
