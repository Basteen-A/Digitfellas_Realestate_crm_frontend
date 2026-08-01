// Excel export for the Collection Report — one styled workbook holding every report
// on screen (so a collection review needs one file, not four):
//   Overview · Collection by Item · Collection by Unit · Collection by Project
//   · Project x Item (Collected) · Outstanding by Item · Outstanding by Project
//   · Project x Item (Outstanding) · Ageing · Top Outstanding · Collection Trend
// Built client-side from the already-fetched payload, with the live charts of the
// active report embedded on the Overview sheet.
//
// Amounts are written as NUMBERS with an Indian-grouped rupee format, so the sheet
// stays sortable / summable in Excel instead of shipping pre-formatted strings.
import ExcelJS from 'exceljs';
import * as htmlToImage from 'html-to-image';
import { argb, COLORS } from '../Reports/analytics/palette';

const MONEY_FMT = '₹#,##,##0';
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

// One styled sheet per table block. `columns` = [{ header, key, money, numeric }];
// `rows` are already-shaped plain objects.
const addSheet = (wb, title, columns, rows) => {
  if (!rows || !rows.length) return;
  const sheet = wb.addWorksheet(title.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key }));
  headerStyle(sheet.getRow(1));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r, i) => {
    const row = sheet.addRow(r);
    if (i % 2 === 1) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
    columns.forEach((c, ci) => { if (c.money) row.getCell(ci + 1).numFmt = MONEY_FMT; });
  });
  // Data bars on the first flagged numeric column keep the ranking readable in Excel.
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

// A project × item matrix sheet: one row per project, one column per item.
const addMatrixSheet = (wb, title, projectItem, field, firstHeader) => {
  const pMap = new Map();
  const iTotals = new Map();
  (projectItem || []).forEach((r) => {
    if (!pMap.has(r.project_id)) pMap.set(r.project_id, { name: r.project_name, total: 0, byItem: {} });
    const p = pMap.get(r.project_id);
    const v = n(r[field]);
    p.total += v;
    p.byItem[r.item] = (p.byItem[r.item] || 0) + v;
    iTotals.set(r.item, (iTotals.get(r.item) || 0) + v);
  });
  const itemCols = [...iTotals.entries()].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const projects = [...pMap.values()].filter((p) => p.total !== 0).sort((a, b) => b.total - a.total);
  addSheet(
    wb,
    title,
    [
      { header: 'Project', key: 'project' },
      { header: firstHeader, key: 'total', money: true, numeric: true },
      ...itemCols.map((c) => ({ header: c, key: c, money: true })),
    ],
    projects.map((p) => ({
      project: p.name,
      total: p.total,
      ...itemCols.reduce((m, c) => { m[c] = p.byItem[c] || 0; return m; }, {}),
    })),
  );
};

export const exportCollectionReports = async (payload, meta = {}) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CRM Collection Report';

  const t = payload.totals || {};
  const byItem = payload.byItem || [];
  const byProject = payload.byProject || [];
  const projectItem = payload.projectItem || [];
  const itemUnit = payload.itemUnit || [];
  const aging = payload.aging || [];
  const topOutstanding = payload.topOutstanding || [];
  const overdue90 = payload.overdue90 || {};
  const trend = payload.trend || [];
  // Drill-down rows carry the raw payment_category; byItem is where its display label
  // lives, so the sheet reads the same as the screen.
  const itemLabels = new Map(byItem.map((i) => [i.item, i.item_label || i.item]));

  // ── Overview ──
  const ov = wb.addWorksheet('Overview', { properties: { defaultColWidth: 18 } });
  ov.mergeCells('A1:F1');
  const title = ov.getCell('A1');
  title.value = 'Collection Report';
  title.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORS.primary) } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  ov.getRow(1).height = 28;
  ov.mergeCells('A2:F2');
  ov.getCell('A2').value = `Period: ${meta.period || '—'}   |   From: ${fmtDate(meta.from || payload.meta?.from)}   |   To: ${fmtDate(meta.to || payload.meta?.to)}   |   Scope: ${payload.meta?.scope === 'own' ? 'My bookings' : 'Organisation'}`;
  ov.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };
  ov.mergeCells('A3:F3');
  ov.getCell('A3').value = 'Collection figures are anchored on the payment date. Outstanding is a live balance across every open booking and is NOT limited by the period.';
  ov.getCell('A3').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

  const kpis = [
    ['Net Collected (period)', t.collected, COLORS.booking, true],
    ['Gross Receipts', t.gross, COLORS.qualified, true],
    ['Refunds', t.refunds, COLORS.cancelled, true],
    ['Billed to date', t.demand, COLORS.leads, true],
    ['Collected to date', t.collectedLtd, COLORS.booking, true],
    ['Outstanding', t.outstanding, COLORS.cancelled, true],
    ['Live Bookings', t.bookings, COLORS.primary, false],
    ['Bookings Pending', t.bookingsPending, COLORS.negotiation, false],
    ['Bookings Fully Paid', t.bookingsFullyPaid, COLORS.siteVisit, false],
    // Billed nothing, so owe nothing — counted apart from "fully paid" rather than
    // inflating it. Pending + Fully Paid + Unbilled = Live Bookings.
    ['Bookings Unbilled', t.bookingsUnbilled, COLORS.muted, false],
  ];
  let kr = 5;
  kpis.forEach(([label, value, color, isMoney], i) => {
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
    if (isMoney) val.numFmt = MONEY_FMT;
    val.font = { bold: true, size: 14, color: { argb: argb(color) } };
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
    ['Realisation (collected ÷ billed)', t.collectedLtd, t.demand],
    ['Outstanding ÷ billed', t.outstanding, t.demand],
    ['Verified ÷ gross receipts', t.verified, t.gross],
    ['Refunds ÷ gross receipts', t.refunds, t.gross],
  ].forEach(([label, a, b]) => {
    const row = ov.addRow([label, n(a), n(b), `${pct(a, b)}%`]);
    row.getCell(2).numFmt = MONEY_FMT;
    row.getCell(3).numFmt = MONEY_FMT;
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

  // ── 1. Total collection, item wise ──
  addSheet(
    wb,
    'Collection by Item',
    [
      { header: 'Item', key: 'item' },
      { header: 'Net Collected', key: 'collected', money: true, numeric: true },
      { header: 'Share %', key: 'share' },
      { header: 'Gross Receipts', key: 'gross', money: true },
      { header: 'Refunds', key: 'refunds', money: true },
      { header: 'Payments', key: 'payments' },
      { header: 'Verified', key: 'verified', money: true },
      { header: 'Collected to date', key: 'collected_ltd', money: true },
    ],
    [...byItem]
      .filter((r) => n(r.collected) !== 0)
      .sort((a, b) => n(b.collected) - n(a.collected))
      .map((r) => ({
        item: r.item_label || r.item,
        collected: n(r.collected),
        share: pct(r.collected, t.collected),
        gross: n(r.gross),
        refunds: n(r.refunds),
        payments: n(r.payments),
        verified: n(r.verified),
        collected_ltd: n(r.collected_ltd),
      })),
  );

  // ── 2. Total collection, project wise ──
  addSheet(
    wb,
    'Collection by Project',
    [
      { header: 'Project', key: 'project' },
      { header: 'Net Collected', key: 'collected', money: true, numeric: true },
      { header: 'Share %', key: 'share' },
      { header: 'Bookings Paid', key: 'bookings_paying' },
      { header: 'Payments', key: 'payments' },
      { header: 'Billed to date', key: 'demand', money: true },
      { header: 'Collected to date', key: 'collected_ltd', money: true },
      { header: 'Realisation %', key: 'realisation' },
    ],
    [...byProject]
      .filter((r) => n(r.collected) !== 0)
      .sort((a, b) => n(b.collected) - n(a.collected))
      .map((r) => ({
        project: r.project_name,
        collected: n(r.collected),
        share: pct(r.collected, t.collected),
        bookings_paying: n(r.bookings_paying),
        payments: n(r.payments),
        demand: n(r.demand),
        collected_ltd: n(r.collected_ltd),
        realisation: pct(r.collected_ltd, r.demand),
      })),
  );

  addMatrixSheet(wb, 'Collected Project x Item', projectItem, 'collected', 'Net Collected');

  // ── 3. Total outstanding, item wise ──
  addSheet(
    wb,
    'Outstanding by Item',
    [
      { header: 'Item', key: 'item' },
      { header: 'Billed', key: 'demand', money: true },
      { header: 'Collected', key: 'collected_ltd', money: true },
      { header: 'Outstanding', key: 'outstanding', money: true, numeric: true },
      { header: 'Excess', key: 'excess', money: true },
      { header: 'Collected %', key: 'collected_pct' },
      { header: 'Bookings Pending', key: 'bookings_pending' },
    ],
    [...byItem]
      .sort((a, b) => n(b.outstanding) - n(a.outstanding))
      .map((r) => ({
        item: r.item_label || r.item,
        demand: n(r.demand),
        collected_ltd: n(r.collected_ltd),
        outstanding: n(r.outstanding),
        excess: n(r.excess),
        collected_pct: pct(r.collected_ltd, r.demand),
        bookings_pending: n(r.bookings_pending),
      })),
  );

  // ── 4. Total outstanding, project wise ──
  addSheet(
    wb,
    'Outstanding by Project',
    [
      { header: 'Project', key: 'project' },
      { header: 'Billed', key: 'demand', money: true },
      { header: 'Collected', key: 'collected_ltd', money: true },
      { header: 'Outstanding', key: 'outstanding', money: true, numeric: true },
      { header: 'Excess', key: 'excess', money: true },
      { header: 'Collected %', key: 'collected_pct' },
      { header: 'Bookings Pending', key: 'bookings_pending' },
      { header: 'Bookings Fully Paid', key: 'bookings_fully_paid' },
    ],
    [...byProject]
      .sort((a, b) => n(b.outstanding) - n(a.outstanding))
      .map((r) => ({
        project: r.project_name,
        demand: n(r.demand),
        collected_ltd: n(r.collected_ltd),
        outstanding: n(r.outstanding),
        excess: n(r.excess),
        collected_pct: pct(r.collected_ltd, r.demand),
        bookings_pending: n(r.bookings_pending),
        bookings_fully_paid: n(r.bookings_fully_paid),
      })),
  );

  addMatrixSheet(wb, 'Outstanding Project x Item', projectItem, 'outstanding', 'Outstanding');

  addSheet(
    wb,
    'Ageing',
    [
      { header: 'Project', key: 'project' },
      { header: '0-30 days', key: 'b0_30', money: true },
      { header: '31-60 days', key: 'b31_60', money: true },
      { header: '61-90 days', key: 'b61_90', money: true },
      { header: '90+ days', key: 'b90p', money: true },
      { header: 'Total Outstanding', key: 'total', money: true, numeric: true },
      { header: 'Bookings', key: 'bookings' },
    ],
    aging.map((r) => ({
      project: r.project_name,
      b0_30: n(r.b0_30),
      b31_60: n(r.b31_60),
      b61_90: n(r.b61_90),
      b90p: n(r.b90p),
      total: n(r.total),
      bookings: n(r.bookings),
    })),
  );

  addSheet(
    wb,
    'Top Outstanding',
    [
      { header: 'Booking', key: 'booking' },
      { header: 'Buyer', key: 'buyer' },
      { header: 'Project', key: 'project' },
      { header: 'Status', key: 'status' },
      { header: 'Booking Date', key: 'booking_date' },
      { header: 'Age (days)', key: 'age_days' },
      { header: 'Billed', key: 'demand', money: true },
      { header: 'Collected', key: 'collected', money: true },
      // Billed − Collected + Excess = Outstanding: over-payment on one item never
      // settles another, so the two sides only balance with Excess in view.
      { header: 'Excess', key: 'excess', money: true },
      { header: 'Outstanding', key: 'outstanding', money: true, numeric: true },
      { header: 'Collected %', key: 'collected_pct' },
    ],
    topOutstanding.map((r) => ({
      booking: r.booking_number,
      buyer: r.buyer_name,
      project: r.project_name,
      status: r.status_name,
      booking_date: r.booking_date,
      age_days: r.age_days,
      demand: n(r.demand),
      collected: n(r.collected),
      excess: n(r.excess),
      outstanding: n(r.outstanding),
      collected_pct: pct(r.collected, r.demand),
    })),
  );

  addSheet(
    wb,
    'Collection Trend',
    [
      { header: payload.meta?.trendGranularity === 'month' ? 'Month' : 'Day', key: 'bucket' },
      { header: 'Net Collected', key: 'collected', money: true, numeric: true },
      { header: 'Gross Receipts', key: 'gross', money: true },
      { header: 'Refunds', key: 'refunds', money: true },
      { header: 'Payments', key: 'payments' },
    ],
    trend.map((r) => ({
      bucket: r.bucket,
      collected: n(r.collected),
      gross: n(r.gross),
      refunds: n(r.refunds),
      payments: n(r.payments),
    })),
  );

  // The item → project → phase → unit drill-down, flattened: one row per unit × item,
  // so the sheet pivots on any level of the hierarchy the page shows.
  addSheet(
    wb,
    'Collection by Unit',
    [
      { header: 'Item', key: 'item' },
      { header: 'Project', key: 'project' },
      { header: 'Phase', key: 'phase' },
      { header: 'Unit', key: 'unit' },
      { header: 'Booking', key: 'booking' },
      { header: 'Buyer', key: 'buyer' },
      { header: 'Net Collected', key: 'collected', money: true, numeric: true },
    ],
    itemUnit.map((r) => ({
      item: itemLabels.get(r.item) || r.item,
      project: r.project_name,
      phase: r.phase_name || 'No phase',
      unit: r.unit_label,
      booking: r.booking_number,
      buyer: r.buyer_name,
      collected: n(r.collected),
    })),
  );

  // ── 5. Overdue 90+ days ──
  // Aged from the DUE DATE (the collection follow-up on the last payment-status
  // update), not the booking date — a different axis from the Ageing sheet.
  addSheet(
    wb,
    'Overdue 90+ Days',
    [
      { header: 'Booking', key: 'booking_number' },
      { header: 'Buyer', key: 'buyer_name' },
      { header: 'Project', key: 'project_name' },
      { header: 'Due Date', key: 'due_date' },
      { header: 'Days Overdue', key: 'days_overdue', numeric: true },
      { header: 'Last Payment', key: 'last_payment_date' },
      { header: 'Days Since Payment', key: 'days_since_payment' },
      { header: 'Billed', key: 'demand', money: true },
      { header: 'Collected', key: 'collected', money: true },
      { header: 'Outstanding', key: 'outstanding', money: true },
      { header: 'Payment Status', key: 'payment_status' },
    ],
    (overdue90.rows || []).map((r) => ({
      booking_number: r.booking_number,
      buyer_name: r.buyer_name,
      project_name: r.project_name,
      due_date: r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : '',
      days_overdue: n(r.days_overdue),
      last_payment_date: r.last_payment_date ? new Date(r.last_payment_date).toLocaleDateString('en-IN') : 'Never',
      days_since_payment: r.days_since_payment == null ? '' : n(r.days_since_payment),
      demand: n(r.demand),
      collected: n(r.collected),
      outstanding: n(r.outstanding),
      payment_status: r.payment_status || '',
    })),
  );

  // The pipeline behind that list — every past-due bucket, plus the balances that
  // have no due date set at all and so cannot be aged.
  addSheet(
    wb,
    'Overdue Pipeline',
    [
      { header: 'Bucket', key: 'bucket' },
      { header: 'Bookings', key: 'bookings' },
      { header: 'Outstanding', key: 'outstanding', money: true, numeric: true },
    ],
    [
      ...[['1-30 days','d0_30'],['31-60 days','d31_60'],['61-90 days','d61_90'],['90+ days','d90p']]
        .map(([label,key]) => ({
          bucket: label,
          bookings: n(overdue90.buckets?.[key]?.bookings),
          outstanding: n(overdue90.buckets?.[key]?.outstanding),
        })),
      {
        bucket: 'No due date set',
        bookings: n(overdue90.noDueDate?.bookings),
        outstanding: n(overdue90.noDueDate?.outstanding),
      },
    ],
  );

  await triggerDownload(wb, `collection_report_${Date.now()}.xlsx`);
};

export default exportCollectionReports;
