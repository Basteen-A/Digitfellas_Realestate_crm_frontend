// Excel export for the Marketing Reports page — one styled workbook holding
// every report on screen (so a marketing review needs one file, not five):
//   Overview · Leads by Source · Leads by Sub Source · Project × Source
//   · Source-wise Site Visits · Visits by Project · Acquisition Trend
// Built client-side from the already-fetched payload, with the live charts of
// the active report embedded on the Overview sheet.
import ExcelJS from 'exceljs';
import * as htmlToImage from 'html-to-image';
import { argb, COLORS } from '../Reports/analytics/palette';

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN') : '—');
const n = (v) => Number(v) || 0;
const pct = (a, b) => (n(b) > 0 ? Math.round((n(a) / n(b)) * 1000) / 10 : 0);

const triggerDownload = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const autoWidth = (sheet) => {
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value == null ? '' : String(cell.value);
      if (v.length > max) max = v.length;
    });
    col.width = Math.min(max + 2, 40);
  });
};

const headerStyle = (row, fill = COLORS.primary) => {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(fill) } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
};

// One styled sheet per table block. `columns` = [{ header, key }]; `rows` are
// already-shaped plain objects.
const addSheet = (wb, title, columns, rows) => {
  if (!rows || !rows.length) return;
  const sheet = wb.addWorksheet(title.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key }));
  headerStyle(sheet.getRow(1));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r, i) => {
    const row = sheet.addRow(r);
    if (i % 2 === 1) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
  });
  // Data bars on the first numeric column keep the ranking readable in Excel.
  const numIdx = columns.findIndex((c) => c.numeric);
  if (numIdx > -1) {
    const letter = String.fromCharCode(65 + numIdx);
    try {
      sheet.addConditionalFormatting({
        ref: `${letter}2:${letter}${rows.length + 1}`,
        rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: argb(COLORS.primary) } }],
      });
    } catch (e) {
      // Conditional formatting is cosmetic — never let it break the export.
    }
  }
  autoWidth(sheet);
};

export const exportMarketingReports = async (payload, meta = {}) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CRM Marketing Reports';

  const t = payload.totals || {};
  const bySource = payload.bySource || [];
  const bySubSource = payload.bySubSource || [];
  const projectWise = payload.projectWise || [];
  const svBySource = payload.sourceWiseSiteVisits || [];
  const svByProject = payload.sourceProjectSiteVisits || [];
  const trend = payload.leadsTrend || [];

  // ── Overview ──
  const ov = wb.addWorksheet('Overview', { properties: { defaultColWidth: 16 } });
  ov.mergeCells('A1:F1');
  const title = ov.getCell('A1');
  title.value = 'Marketing Reports';
  title.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORS.primary) } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  ov.getRow(1).height = 28;
  ov.mergeCells('A2:F2');
  ov.getCell('A2').value = `Period: ${meta.period || '—'}   |   From: ${fmtDate(meta.from || payload.meta?.from)}   |   To: ${fmtDate(meta.to || payload.meta?.to)}`;
  ov.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };

  const kpis = [
    ['Total Leads', t.leads, COLORS.leads],
    ['Qualified', t.qualified, COLORS.qualified],
    ['SV Done', t.siteVisits, COLORS.siteVisit],
    ['RNR', t.rnr, COLORS.negotiation],
    ['Unqualified', t.unqualified, COLORS.cancelled],
    ['Bookings', t.bookings, COLORS.booking],
  ];
  let kr = 4;
  kpis.forEach(([label, value, color], i) => {
    const col = (i % 3) * 2 + 1;
    if (i % 3 === 0 && i > 0) kr += 3;
    ov.mergeCells(kr, col, kr, col + 1);
    const head = ov.getRow(kr).getCell(col);
    head.value = label;
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(color) } };
    ov.mergeCells(kr + 1, col, kr + 1, col + 1);
    const val = ov.getRow(kr + 1).getCell(col);
    val.value = n(value);
    val.font = { bold: true, size: 16, color: { argb: argb(color) } };
  });

  // Ratio block
  let rr = kr + 3;
  ov.getCell(`A${rr}`).value = 'Ratios';
  ov.getCell(`A${rr}`).font = { bold: true, size: 13 };
  rr += 1;
  const rhdr = ov.getRow(rr);
  ['Metric', 'Numerator', 'Denominator', 'Percent'].forEach((h, i) => { rhdr.getCell(i + 1).value = h; });
  headerStyle(rhdr);
  [
    ['Qualification Ratio', t.qualified, t.leads],
    ['Site Visit Ratio', t.siteVisits, t.leads],
    ['SV → Booking', t.bookings, t.siteVisits],
    ['Unqualified Rate', t.unqualified, t.leads],
    ['RNR Rate', t.rnr, t.leads],
  ].forEach(([label, a, b]) => {
    const row = ov.addRow([label, n(a), n(b), `${pct(a, b)}%`]);
    row.getCell(4).font = { bold: true, color: { argb: argb(COLORS.booking) } };
  });

  // Embed the charts of the report that is currently on screen.
  if (meta.chartRefs) {
    let anchorRow = ov.lastRow.number + 2;
    for (const node of Object.values(meta.chartRefs)) {
      if (!node) continue;
      try {
        const dataUrl = await htmlToImage.toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 });
        const imageId = wb.addImage({ base64: dataUrl, extension: 'png' });
        ov.addImage(imageId, { tl: { col: 0, row: anchorRow }, ext: { width: 520, height: 280 } });
        anchorRow += 16;
      } catch (e) {
        // chart not capturable (e.g. detached) — skip silently
      }
    }
  }
  autoWidth(ov);

  // ── Data sheets ──
  const leadCols = (first) => [
    { header: first, key: 'name' },
    { header: 'Leads', key: 'leads', numeric: true },
    { header: 'Share %', key: 'share' },
    { header: 'Qualified', key: 'qualified' },
    { header: 'Qual %', key: 'qual_pct' },
    { header: 'RNR', key: 'rnr' },
    { header: 'Unqualified', key: 'unqualified' },
    { header: 'Unassigned', key: 'unassigned' },
    { header: 'SV Done', key: 'sv_leads' },
    { header: 'SV Ratio %', key: 'sv_pct' },
    { header: 'Bookings', key: 'bookings' },
  ];
  const leadRow = (name, r) => ({
    name,
    leads: n(r.leads),
    share: pct(r.leads, t.leads),
    qualified: n(r.qualified),
    qual_pct: pct(r.qualified, r.leads),
    rnr: n(r.rnr),
    unqualified: n(r.unqualified),
    unassigned: n(r.unassigned),
    sv_leads: n(r.sv_leads),
    sv_pct: pct(r.sv_leads, r.leads),
    bookings: n(r.bookings),
  });

  addSheet(wb, 'Leads by Source', leadCols('Source'), bySource.map((r) => leadRow(r.source_name, r)));

  // Sub-source sheet mirrors the on-screen table: Leads / Sv Done / Scheduled /
  // Follow Up / RNR / Cold / Junk-Spam, anchored on the leads generated in range.
  addSheet(
    wb,
    'Leads by Sub Source',
    [
      { header: 'Source', key: 'source' },
      { header: 'Sub Source', key: 'sub_source' },
      { header: 'Leads', key: 'leads', numeric: true },
      { header: 'Sv Done', key: 'sv_done' },
      { header: 'Scheduled', key: 'scheduled' },
      { header: 'Follow Up', key: 'follow_up' },
      { header: 'RNR', key: 'rnr' },
      { header: 'Cold', key: 'cold' },
      { header: 'Junk/Spam', key: 'junk_spam' },
    ],
    bySubSource.map((r) => ({
      source: r.source_name,
      sub_source: r.sub_source_name,
      leads: n(r.leads),
      sv_done: n(r.sv_leads),
      scheduled: n(r.scheduled),
      follow_up: n(r.follow_up),
      rnr: n(r.rnr),
      cold: n(r.cold),
      junk_spam: n(r.junk_spam),
    })),
  );

  addSheet(
    wb,
    'Project x Source',
    [{ header: 'Project', key: 'project' }, ...leadCols('Source')],
    projectWise.map((r) => ({ project: r.project_name, ...leadRow(r.source_name, r) })),
  );

  addSheet(
    wb,
    'Source-wise Site Visits',
    [
      { header: 'Source', key: 'source' },
      { header: 'Total Visits', key: 'total_visits', numeric: true },
      { header: 'Booked', key: 'booked' },
      { header: 'Negotiation', key: 'negotiation' },
      { header: 'Re Visit', key: 'revisit' },
      { header: 'Follow Up', key: 'follow_up' },
      { header: 'Cold', key: 'cold' },
    ],
    svBySource.map((r) => ({
      source: r.source_name,
      total_visits: n(r.total_visits),
      booked: n(r.booked),
      negotiation: n(r.negotiation),
      revisit: n(r.revisit),
      follow_up: n(r.follow_up),
      cold: n(r.cold),
    })),
  );

  addSheet(
    wb,
    'Visits by Project',
    [
      { header: 'Source', key: 'source' },
      { header: 'Project', key: 'project' },
      { header: 'Leads Visited', key: 'site_visits', numeric: true },
    ],
    svByProject.map((r) => ({ source: r.source_name, project: r.project_name, site_visits: n(r.site_visits) })),
  );

  addSheet(
    wb,
    'Acquisition Trend',
    [
      { header: payload.meta?.trendGranularity === 'month' ? 'Month' : 'Day', key: 'bucket' },
      { header: 'Leads', key: 'leads', numeric: true },
      { header: 'Qualified', key: 'qualified' },
      { header: 'SV Done', key: 'sv_leads' },
    ],
    trend.map((r) => ({ bucket: r.bucket, leads: n(r.leads), qualified: n(r.qualified), sv_leads: n(r.sv_leads) })),
  );

  await triggerDownload(wb, `marketing_reports_${Date.now()}.xlsx`);
};

export default exportMarketingReports;
