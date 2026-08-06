// Two Excel exports for the analytics dashboard, both built client-side with
// ExcelJS from the already-fetched payload:
//   exportPlainData    - one plain sheet per data block (raw tables)
//   exportAnalytics    - colorful workbook: KPI overview + embedded chart PNGs
//                        (captured from the live charts) + conditionally
//                        formatted per-metric sheets
import ExcelJS from 'exceljs';
import * as htmlToImage from 'html-to-image';
import { argb, COLORS } from './palette';

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN') : '-');

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

// Auto-size columns from header + cell text length
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

// Map of payload key → { title, columns:[{header,key}] } for tabular blocks.
const BLOCKS = (role) => {
  const leaderCols = role === 'TC' ? [
    { header: 'Name', key: 'name' },
    { header: 'Leads Created', key: 'leads_created' },
    { header: 'Total Leads', key: 'leads' },
    { header: 'Qualified', key: 'qualified' },
    { header: 'RNR', key: 'rnr' },
    { header: 'Unqualified', key: 'unqualified' },
    { header: 'Unassigned', key: 'unassigned' },
    // Two SV Done columns, matching the on-screen cards: work done in the window
    // vs the ratio's cohort-restricted numerator. See AnalyticsDashboard.
    { header: 'SV Done in Period', key: 'site_visits_in_period' },
    { header: "SV Done (This Period's Leads)", key: 'site_visits' },
    { header: 'Bookings', key: 'bookings' },
    { header: 'Calls', key: 'calls' },
    { header: 'Answered', key: 'calls_answered' },
  ] : [
    { header: 'Name', key: 'name' },
    { header: 'Leads', key: 'leads' },
    { header: 'Qualified', key: 'qualified' },
    { header: 'Site Visits', key: 'site_visits' },
    { header: 'Bookings', key: 'bookings' },
    { header: 'Calls', key: 'calls' },
    { header: 'Answered', key: 'calls_answered' },
  ];
  return {
    teamLeaderboard: { title: role === 'TC' ? 'Tele Sales Leaderboard' : 'Sales Team Leaderboard', columns: leaderCols, name: true },
    salesHeadLeaderboard: { title: 'Sales Head Leaderboard', columns: leaderCols, name: true },
    callsPerDay: { title: 'Calls Per Day', columns: [{ header: 'Day', key: 'day' }, { header: 'Answered', key: 'answered' }, { header: 'Unanswered', key: 'unanswered' }, { header: 'Total', key: 'total' }] },
    // `answer_rate` is derived in rowsFor - the API never sends it.
    hourlyCalls: { title: 'Hourly Calls', columns: [{ header: 'Hour', key: 'hour' }, { header: 'Total Calls', key: 'total' }, { header: 'Answered', key: 'answered' }, { header: 'Unanswered', key: 'unanswered' }, { header: 'Answer Rate', key: 'answer_rate' }] },
    projectWiseSiteVisit: { title: 'Project-wise Site Visits', columns: [{ header: 'Project', key: 'project_name' }, { header: 'Site Visits', key: 'site_visits' }] },
    projectWiseInventory: { title: 'Project-wise Inventory', columns: [{ header: 'Project', key: 'project_name' }, { header: 'Total', key: 'total_units' }, { header: 'Available', key: 'available' }, { header: 'Booked', key: 'booked' }, { header: 'Blocked', key: 'blocked' }] },
    smWiseSiteVisit: { title: 'SM-wise Site Visits', columns: [{ header: 'Sales Manager', key: 'name' }, { header: 'Total SV', key: 'total_visits' }, { header: 'Bookings', key: 'bookings' }, { header: 'Under Nego', key: 'negotiation' }], name: true },
    smWiseMissedFollowups: { title: 'SM-wise Missed Follow-ups', columns: [{ header: 'Sales Manager', key: 'name' }, { header: 'Missed', key: 'missed' }], name: true },
  };
};

const rowsFor = (block, raw) => (raw || []).map((r) => {
  const out = {};
  block.columns.forEach((c) => {
    if (c.key === 'name') out.name = `${r.first_name || ''} ${r.last_name || ''}`.trim();
    else out[c.key] = r[c.key];
  });
  // Derive a Total column (answered + unanswered) when the source doesn't supply one.
  if (out.total == null && (r.answered != null || r.unanswered != null)) {
    out.total = Number(r.answered || 0) + Number(r.unanswered || 0);
  }
  // Same for Answer Rate - computed here so the sheet matches the on-screen
  // column. A row with no calls gets a dash rather than a misleading 0%.
  if (block.columns.some((c) => c.key === 'answer_rate')) {
    const total = Number(out.total || 0);
    out.answer_rate = total > 0 ? `${Math.round((Number(r.answered || 0) / total) * 100)}%` : '-';
  }
  return out;
});

const headerStyle = (row, fill = COLORS.primary) => {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(fill) } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
};

const addTableSheet = (workbook, block, raw, { styled = false } = {}) => {
  const sheet = workbook.addWorksheet(block.title.slice(0, 31));
  const rows = rowsFor(block, raw);
  sheet.columns = block.columns.map((c) => ({ header: c.header, key: c.key === 'name' ? 'name' : c.key }));
  const header = sheet.getRow(1);
  if (styled) headerStyle(header); else header.font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r, i) => {
    const row = sheet.addRow(r);
    if (styled && i % 2 === 1) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
  });
  // Data bars on the first numeric column when styled
  if (styled && rows.length && block.columns.length > 1) {
    const numCol = block.columns.findIndex((c) => c.key !== 'name' && c.key !== 'project_name' && c.key !== 'day' && c.key !== 'hour');
    if (numCol > -1) {
      const letter = String.fromCharCode(65 + numCol);
      try {
        sheet.addConditionalFormatting({
          ref: `${letter}2:${letter}${rows.length + 1}`,
          // cfvo (min/max) is REQUIRED - without it ExcelJS writeBuffer() throws
          // "Cannot read properties of undefined (reading 'forEach')".
          rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: argb(COLORS.primary) } }],
        });
      } catch (e) {
        // Conditional formatting is cosmetic - never let it break the export.
      }
    }
  }
  autoWidth(sheet);
  return sheet;
};

const ratioRows = (payload) => {
  const r = [];
  const push = (label, obj) => obj && r.push({ metric: label, numerator: obj.numerator, denominator: obj.denominator, ratio: obj.ratio, pct: `${obj.pct}%` });
  push('Qualification Ratio', payload.qualificationRatio);
  push('Site Visit Ratio', payload.siteVisitRatio);
  push('Booking Ratio (SV:Booking)', payload.bookingRatio);
  push('Negotiation Ratio (SV:Negotiation)', payload.negotiationRatio);
  push('Cancellation Ratio', payload.cancellationRatio);
  return r;
};

// ── 1. PLAIN DATA ──────────────────────────────────────────────────────────────
export const exportPlainData = async (payload, meta) => {
  const wb = new ExcelJS.Workbook();
  const role = meta.role;

  // Summary sheet (funnel + ratios)
  const s = wb.addWorksheet('Summary');
  s.addRow([`${meta.roleLabel || role} Analytics`]);
  s.addRow([`Period: ${meta.period}`, `From: ${fmtDate(meta.from)}`, `To: ${fmtDate(meta.to)}`]);
  s.addRow([]);
  s.addRow(['Funnel']);
  Object.entries(payload.funnel || {}).forEach(([k, v]) => s.addRow([k, v]));
  s.addRow([]);
  s.addRow(['Ratios', 'Numerator', 'Denominator', 'Ratio', 'Percent']);
  ratioRows(payload).forEach((rr) => s.addRow([rr.metric, rr.numerator, rr.denominator, rr.ratio, rr.pct]));
  autoWidth(s);

  const blocks = BLOCKS(role);
  Object.keys(blocks).forEach((key) => {
    if (Array.isArray(payload[key]) && payload[key].length) addTableSheet(wb, blocks[key], payload[key], { styled: false });
  });

  await triggerDownload(wb, `${role}_analytics_data_${Date.now()}.xlsx`);
};

// ── 2. ANALYTICS (colorful + embedded charts) ───────────────────────────────────
export const exportAnalytics = async (payload, meta, chartRefs) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CRM Analytics';
  const role = meta.role;

  // Overview sheet
  const ov = wb.addWorksheet('Overview', { properties: { defaultColWidth: 16 } });
  ov.mergeCells('A1:F1');
  const title = ov.getCell('A1');
  title.value = `${meta.roleLabel || role} - Analytics`;
  title.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORS.primary) } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  ov.getRow(1).height = 28;
  ov.mergeCells('A2:F2');
  ov.getCell('A2').value = `Period: ${meta.period}   |   From: ${fmtDate(meta.from)}   |   To: ${fmtDate(meta.to)}`;
  ov.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };

  // KPI cards (funnel) as colored blocks
  const kpis = [
    ['Total Leads', payload.funnel?.totalLeads, COLORS.leads],
    ['Qualified', payload.funnel?.qualified, COLORS.qualified],
    ['Site Visits', payload.funnel?.siteVisits, COLORS.siteVisit],
    ['Negotiation', payload.funnel?.negotiation, COLORS.negotiation],
    ['Bookings', payload.funnel?.bookings, COLORS.booking],
    ['Cancellations', payload.funnel?.cancellations, COLORS.cancelled],
  ];
  let kr = 4;
  kpis.forEach(([label, value, color], i) => {
    const col = (i % 3) * 2 + 1; // 1,3,5
    if (i % 3 === 0 && i > 0) kr += 3;
    const c1 = ov.getRow(kr).getCell(col);
    ov.mergeCells(kr, col, kr, col + 1);
    c1.value = label;
    c1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(color) } };
    const vr = ov.getRow(kr + 1).getCell(col);
    ov.mergeCells(kr + 1, col, kr + 1, col + 1);
    vr.value = Number(value || 0);
    vr.font = { bold: true, size: 16, color: { argb: argb(color) } };
    vr.alignment = { horizontal: 'left' };
  });

  // Ratios block
  let rr = kr + 3;
  ov.getCell(`A${rr}`).value = 'Ratios';
  ov.getCell(`A${rr}`).font = { bold: true, size: 13 };
  rr += 1;
  const rhdr = ov.getRow(rr);
  ['Metric', 'Numerator', 'Denominator', 'Ratio', 'Percent'].forEach((h, i) => { rhdr.getCell(i + 1).value = h; });
  headerStyle(rhdr, COLORS.primary);
  ratioRows(payload).forEach((x) => {
    const row = ov.addRow([x.metric, x.numerator, x.denominator, x.ratio, x.pct]);
    row.getCell(5).font = { bold: true, color: { argb: argb(COLORS.booking) } };
  });

  // Embed chart images captured from the live DOM
  if (chartRefs) {
    let anchorRow = ov.lastRow.number + 2;
    for (const node of Object.values(chartRefs)) {
      if (!node) continue;
      try {
        const dataUrl = await htmlToImage.toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 });
        const imageId = wb.addImage({ base64: dataUrl, extension: 'png' });
        ov.addImage(imageId, {
          tl: { col: 0, row: anchorRow },
          ext: { width: 520, height: 280 },
        });
        anchorRow += 16; // leave vertical space for the next image
      } catch (e) {
        // chart not capturable (e.g. detached) - skip silently
      }
    }
  }
  autoWidth(ov);

  // Styled per-metric sheets
  const blocks = BLOCKS(role);
  Object.keys(blocks).forEach((key) => {
    if (Array.isArray(payload[key]) && payload[key].length) addTableSheet(wb, blocks[key], payload[key], { styled: true });
  });

  await triggerDownload(wb, `${role}_analytics_full_${Date.now()}.xlsx`);
};
