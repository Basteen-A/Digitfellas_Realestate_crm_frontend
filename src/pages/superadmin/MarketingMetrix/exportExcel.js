// Excel export for the Marketing Metrix page - one styled workbook holding every
// report on screen (so a spend review needs one file, not three):
//   Overview · Cost by Source · Cost by Sub Source · Spend & Volume Trend
// Built client-side from the already-fetched payload, with the live charts of the
// active report embedded on the Overview sheet.
//
// Amounts are written as NUMBERS with an Indian-grouped rupee format so the sheet stays
// sortable and summable. A cost-per cell that could not be computed is left EMPTY, not
// zero - "we don't know what it cost" must not average in as free.
import ExcelJS from 'exceljs';
import * as htmlToImage from 'html-to-image';
import { argb, COLORS } from '../Reports/analytics/palette';

const MONEY_FMT = '₹#,##,##0';
const COST_FMT = '₹#,##,##0.00';
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN') : '-');
const n = (v) => Number(v) || 0;
const pct = (a, b) => (n(b) > 0 ? Math.round((n(a) / n(b)) * 1000) / 10 : 0);
// null / undefined survive as null so ExcelJS writes a blank cell.
const cost = (v) => (v == null ? null : Number(v));

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
    col.width = Math.min(max + 3, 40);
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

// One styled sheet per table block. `columns` = [{ header, key, money, costFmt, numeric }].
const addSheet = (wb, title, columns, rows) => {
  if (!rows || !rows.length) return;
  const sheet = wb.addWorksheet(title.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key }));
  headerStyle(sheet.getRow(1));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r, i) => {
    const row = sheet.addRow(r);
    if (i % 2 === 1) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
    columns.forEach((c, ci) => {
      if (c.money) row.getCell(ci + 1).numFmt = MONEY_FMT;
      if (c.costFmt) row.getCell(ci + 1).numFmt = COST_FMT;
    });
  });
  const numIdx = columns.findIndex((c) => c.numeric);
  if (numIdx > -1) {
    const letter = String.fromCharCode(65 + numIdx);
    try {
      sheet.addConditionalFormatting({
        ref: `${letter}2:${letter}${rows.length + 1}`,
        rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: argb(COLORS.primary) } }],
      });
    } catch (e) {
      // Conditional formatting is cosmetic - never let it break the export.
    }
  }
  autoWidth(sheet);
};

// Column set shared by the source and sub-source sheets, so both read identically.
const METRIC_COLUMNS = [
  { header: 'Budget', key: 'budget', money: true, numeric: true },
  { header: 'Share %', key: 'share' },
  { header: 'Leads', key: 'leads' },
  { header: 'Qualified', key: 'qualified' },
  { header: 'Site Visits', key: 'sv_leads' },
  { header: 'Bookings', key: 'bookings' },
  { header: 'Sq Ft Booked', key: 'booked_sqft' },
  { header: 'Cost / Lead', key: 'cost_per_lead', costFmt: true },
  { header: 'Cost / Qualified Lead', key: 'cost_per_qualified', costFmt: true },
  { header: 'Cost / Site Visit', key: 'cost_per_sv', costFmt: true },
  { header: 'Cost / Booking', key: 'cost_per_booking', costFmt: true },
  { header: 'Cost / Sq Ft', key: 'cost_per_sqft', costFmt: true },
];

const metricRow = (r, totalBudget) => ({
  budget: n(r.budget),
  share: pct(r.budget, totalBudget),
  leads: n(r.leads),
  qualified: n(r.qualified),
  sv_leads: n(r.sv_leads),
  bookings: n(r.bookings),
  booked_sqft: n(r.booked_sqft),
  cost_per_lead: cost(r.cost_per_lead),
  cost_per_qualified: cost(r.cost_per_qualified),
  cost_per_sv: cost(r.cost_per_sv),
  cost_per_booking: cost(r.cost_per_booking),
  cost_per_sqft: cost(r.cost_per_sqft),
});

export const exportMarketingMetrix = async (payload, meta = {}) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CRM Marketing Metrix';

  const t = payload.totals || {};
  const bySource = payload.bySource || [];
  const bySubSource = payload.bySubSource || [];
  const trend = payload.trend || [];
  const totalBudget = n(t.budget);

  // ── Overview ──
  const ov = wb.addWorksheet('Overview', { properties: { defaultColWidth: 18 } });
  ov.mergeCells('A1:F1');
  const title = ov.getCell('A1');
  title.value = 'Marketing Metrix';
  title.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORS.primary) } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  ov.getRow(1).height = 28;
  ov.mergeCells('A2:F2');
  ov.getCell('A2').value = `Period: ${meta.period || '-'}   |   From: ${fmtDate(meta.from || payload.meta?.from)}   |   To: ${fmtDate(meta.to || payload.meta?.to)}`;
  ov.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };
  ov.mergeCells('A3:F3');
  ov.getCell('A3').value = 'Each lead counts against the source & date of its latest marketing touch - its creation, or its newest re-enquiry, whichever is later.';
  ov.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

  const kpis = [
    ['Total Budget', t.budget, COLORS.primary, MONEY_FMT],
    ['Leads', t.leads, COLORS.leads, null],
    ['Qualified Leads', t.qualified, COLORS.qualified, null],
    ['Site Visits', t.siteVisits, COLORS.siteVisit, null],
    ['Bookings', t.bookings, COLORS.booking, null],
    ['Sq Ft Booked', t.bookedSqft, COLORS.negotiation, null],
    ['Cost per Lead', t.costPerLead, COLORS.leads, COST_FMT],
    ['Cost per Qualified Lead', t.costPerQualified, COLORS.qualified, COST_FMT],
    ['Cost per Site Visit', t.costPerSiteVisit, COLORS.siteVisit, COST_FMT],
    ['Cost per Booking', t.costPerBooking, COLORS.booking, COST_FMT],
    ['Cost per Sq Ft', t.costPerSqft, COLORS.negotiation, COST_FMT],
    ['Re-attributed Leads', payload.meta?.reattributedLeads, COLORS.muted, null],
  ];
  let kr = 5;
  kpis.forEach(([label, value, color, fmt], i) => {
    const col = (i % 3) * 2 + 1;
    if (i % 3 === 0 && i > 0) kr += 3;
    ov.mergeCells(kr, col, kr, col + 1);
    const head = ov.getRow(kr).getCell(col);
    head.value = label;
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(color) } };
    ov.mergeCells(kr + 1, col, kr + 1, col + 1);
    const val = ov.getRow(kr + 1).getCell(col);
    val.value = value == null ? 'n/a' : Number(value);
    if (fmt && value != null) val.numFmt = fmt;
    val.font = { bold: true, size: 14, color: { argb: argb(color) } };
  });

  // Ratio block
  let rr = kr + 3;
  ov.getCell(`A${rr}`).value = 'Conversion';
  ov.getCell(`A${rr}`).font = { bold: true, size: 13 };
  rr += 1;
  const rhdr = ov.getRow(rr);
  ['Metric', 'Numerator', 'Denominator', 'Percent'].forEach((h, i) => { rhdr.getCell(i + 1).value = h; });
  headerStyle(rhdr);
  [
    ['Qualification Ratio', t.qualified, t.leads],
    ['Site Visit Ratio', t.siteVisits, t.leads],
    ['Lead → Booking', t.bookings, t.leads],
    ['Site Visit → Booking', t.bookings, t.siteVisits],
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
        // chart not capturable (e.g. detached) - skip silently
      }
    }
  }
  autoWidth(ov);

  // ── Data sheets ──
  addSheet(
    wb,
    'Cost by Source',
    [{ header: 'Source', key: 'source' }, ...METRIC_COLUMNS],
    bySource.map((r) => ({ source: r.source_name, ...metricRow(r, totalBudget) })),
  );

  addSheet(
    wb,
    'Cost by Sub Source',
    [{ header: 'Source', key: 'source' }, { header: 'Sub Source', key: 'sub_source' }, ...METRIC_COLUMNS],
    bySubSource.map((r) => ({ source: r.source_name, sub_source: r.sub_source_name, ...metricRow(r, totalBudget) })),
  );

  addSheet(
    wb,
    'Spend & Volume Trend',
    [
      { header: payload.meta?.trendGranularity === 'month' ? 'Month' : 'Day', key: 'bucket' },
      { header: 'Budget', key: 'budget', money: true, numeric: true },
      { header: 'Leads', key: 'leads' },
      { header: 'Qualified', key: 'qualified' },
      { header: 'Site Visits', key: 'sv_leads' },
      { header: 'Bookings', key: 'bookings' },
      { header: 'Cost / Lead', key: 'cost_per_lead', costFmt: true },
    ],
    trend.map((r) => ({
      bucket: r.bucket,
      budget: n(r.budget),
      leads: n(r.leads),
      qualified: n(r.qualified),
      sv_leads: n(r.sv_leads),
      bookings: n(r.bookings),
      cost_per_lead: cost(r.cost_per_lead),
    })),
  );

  await triggerDownload(wb, `marketing_metrix_${Date.now()}.xlsx`);
};

export default exportMarketingMetrix;
