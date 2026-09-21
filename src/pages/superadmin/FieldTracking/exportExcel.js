// Excel export for the Field Tracking reports.
//
// One workbook holding what an admin actually needs off this screen:
//   Summary    per-user attendance + distance totals for the range
//   Stops      every detected halt, so "where was the team all week" is answerable
//   Info       the filters and rules the numbers were produced under
//
// Built client-side from the already-fetched payload, matching how the
// Marketing and Collection report exports work.
import ExcelJS from 'exceljs';

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
    col.width = Math.min(max + 2, 42);
  });
};

const headerStyle = (row) => {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF625AFA' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
};

const addSheet = (wb, title, columns, rows) => {
  const sheet = wb.addWorksheet(title.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key }));
  headerStyle(sheet.getRow(1));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  (rows || []).forEach((r, i) => {
    const row = sheet.addRow(r);
    if (i % 2 === 1) {
      row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
    }
  });
  autoWidth(sheet);
  return sheet;
};

const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '');
const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;

const VISIT_TYPE_LABEL = {
  CLIENT: 'Client', SITE: 'Site', VENDOR: 'Vendor',
  FOLLOW_UP: 'Follow-up', COLLECTION: 'Collection', OTHER: 'Other',
};
// Keep in step with ui.jsx VISIT_OUTCOME_STYLE and the server's
// TrackVisit.VISIT_OUTCOMES - three mirrors of one list.
const VISIT_OUTCOME_LABEL = {
  POSITIVE: 'Positive', NEGATIVE: 'Negative', REVISIT: 'Revisit',
  BOOKED: 'Booked', NOT_AVAILABLE: 'Nobody there', OTHER: 'Other',
};
const NEGATIVE_REASON_LABEL = {
  PRICE_TOO_HIGH: 'Price too high',
  LOCATION_NOT_SUITABLE: 'Location not suitable',
  NOT_SERIOUS_BUYER: 'Not a serious buyer',
  BOUGHT_ELSEWHERE: 'Already bought elsewhere',
  NEEDS_FAMILY_APPROVAL: 'Needs family approval',
  LOAN_ISSUE: 'Loan / finance issue',
  OTHER: 'Other',
};

// Shared, so the Visits sheet is identical whether it comes from the combined
// Field Tracking report or the standalone Visits download.
const VISIT_COLUMNS = [
  { header: 'Date', key: 'date' },
  { header: 'Field User', key: 'user' },
  { header: 'Role', key: 'role' },
  { header: 'Customer', key: 'customer' },
  { header: 'Phone', key: 'phone' },
  { header: 'Lead', key: 'lead' },
  { header: 'Project', key: 'project' },
  { header: 'Type', key: 'type' },
  { header: 'Purpose', key: 'purpose' },
  { header: 'Arrived', key: 'inAt' },
  { header: 'Left', key: 'outAt' },
  { header: 'Duration', key: 'duration' },
  { header: 'Minutes', key: 'minutes' },
  { header: 'Outcome', key: 'outcome' },
  // Blank for anything that did not go negative - see the server, which clears
  // the reason whenever the outcome moves off NEGATIVE.
  { header: 'Negative Reason', key: 'negativeReason' },
  { header: 'Photos', key: 'photos' },
  { header: 'Status', key: 'status' },
  // The column that makes this sheet worth exporting.
  { header: 'GPS Confirmed', key: 'gps' },
  { header: 'Known Site', key: 'site' },
  { header: 'Notes', key: 'notes' },
  { header: 'Latitude', key: 'lat' },
  { header: 'Longitude', key: 'lng' },
];

const visitRow = (v) => ({
  date: v.workDate,
  user: v.user?.name || '',
  role: v.user?.role || '',
  customer: v.customerName,
  phone: v.customerPhone || '',
  lead: v.leadNumber || '',
  project: v.projectName || '',
  type: VISIT_TYPE_LABEL[v.visitType] || v.visitType,
  purpose: v.purpose || '',
  inAt: fmtTime(v.checkedInAt),
  outAt: fmtTime(v.checkedOutAt),
  duration: v.durationMinutes != null
    ? `${Math.floor(v.durationMinutes / 60)}h ${v.durationMinutes % 60}m`
    : '',
  minutes: v.durationMinutes ?? '',
  outcome: v.outcome ? (VISIT_OUTCOME_LABEL[v.outcome] || v.outcome) : '',
  negativeReason: v.negativeReason ? (NEGATIVE_REASON_LABEL[v.negativeReason] || v.negativeReason) : '',
  photos: (v.photos || []).length || '',
  status: v.status,
  gps: v.status === 'IN_PROGRESS'
    ? 'In progress'
    : (v.unverifiedByGps ? 'NOT CONFIRMED' : 'Confirmed'),
  site: v.locationName || '',
  notes: v.notes || '',
  lat: v.latitude,
  lng: v.longitude,
});

/**
 * @param {object} summary  payload from /reports/summary
 * @param {object} halts    payload from /reports/halts (optional)
 * @param {object} meta     { from, to, role, generatedBy }
 */
export const exportFieldTrackingReport = async (summary, halts, meta = {}, visits = null) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CRM Field Tracking';
  wb.created = new Date();

  // ── Summary ──
  addSheet(
    wb,
    'Attendance Summary',
    [
      { header: 'Employee', key: 'name' },
      { header: 'Employee ID', key: 'code' },
      { header: 'Role', key: 'role' },
      { header: 'Present', key: 'present' },
      { header: 'Half Day', key: 'halfDay' },
      { header: 'Absent', key: 'absent' },
      { header: 'Week Off', key: 'weekOff' },
      { header: 'Holiday', key: 'holiday' },
      { header: 'Leave', key: 'leave' },
      { header: 'Late', key: 'late' },
      // Half a day counts as half - this is the column payroll actually wants.
      { header: 'Payable Days', key: 'payableDays' },
      { header: 'Total Worked', key: 'worked' },
      { header: 'Avg / Day', key: 'avgWorked' },
      { header: 'Travel Time', key: 'travel' },
      { header: 'Time At Stops', key: 'halt' },
      { header: 'Total Distance (km)', key: 'distanceKm' },
      { header: 'Avg Distance / Day (km)', key: 'avgDistanceKm' },
      { header: 'Stops', key: 'stops' },
    ],
    (summary?.rows || []).map((r) => ({
      name: r.user.name,
      code: r.user.employeeCode || '',
      role: r.user.role || '',
      present: r.present,
      halfDay: r.halfDay,
      absent: r.absent,
      weekOff: r.weekOff,
      holiday: r.holiday,
      leave: r.leave,
      late: r.late,
      payableDays: r.payableDays,
      worked: r.workedLabel,
      avgWorked: r.avgWorkedLabel,
      travel: r.travelLabel,
      halt: r.haltLabel,
      distanceKm: round1((r.totalDistanceM || 0) / 1000),
      avgDistanceKm: round1((r.avgDistanceM || 0) / 1000),
      stops: r.haltCount,
    }))
  );

  // ── Stops ──
  if (halts?.rows?.length) {
    addSheet(
      wb,
      'Stops',
      [
        { header: 'Date', key: 'date' },
        { header: 'Employee', key: 'name' },
        { header: 'Role', key: 'role' },
        { header: 'Place', key: 'place' },
        // The leg INTO this stop. Kept in plain metres/minutes rather than a
        // "3.4 km" label: this column exists to be summed and filtered in
        // Excel, and a formatted string cannot be.
        { header: 'Travelled From Prev (m)', key: 'legM' },
        { header: 'Travel Mins', key: 'legMins' },
        { header: 'From', key: 'from' },
        { header: 'To', key: 'to' },
        { header: 'Duration', key: 'duration' },
        { header: 'Minutes', key: 'minutes' },
        { header: 'Latitude', key: 'lat' },
        { header: 'Longitude', key: 'lng' },
        { header: 'Type', key: 'type' },
      ],
      halts.rows.map((h) => ({
        date: h.workDate,
        name: h.user.name,
        role: h.user.role || '',
        place: h.label,
        legM: h.distanceFromPrevM != null ? Math.round(h.distanceFromPrevM) : '',
        legMins: h.travelMinutesFromPrev != null ? h.travelMinutesFromPrev : '',
        from: fmtTime(h.startedAt),
        to: fmtTime(h.endedAt),
        duration: h.durationLabel,
        minutes: h.durationMinutes,
        lat: h.latitude,
        lng: h.longitude,
        type: h.haltType,
      }))
    );
  }

  // ── Visits ──
  if (visits?.rows?.length) {
    addSheet(wb, 'Customer Visits', VISIT_COLUMNS, visits.rows.map(visitRow));
  }

  // ── Info ──
  // The filters and the rules behind the numbers. A downloaded sheet outlives
  // the screen it came from, so it has to explain itself.
  const info = wb.addWorksheet('Info');
  info.columns = [{ header: 'Field', key: 'k', width: 30 }, { header: 'Value', key: 'v', width: 70 }];
  headerStyle(info.getRow(1));
  const t = summary?.totals || {};
  [
    ['Report', 'Field Tracking - attendance and movement'],
    ['Date range', `${meta.from || summary?.from} to ${meta.to || summary?.to}`],
    ['Role filter', meta.role || 'All tracked roles'],
    ['Generated at', new Date().toLocaleString('en-IN')],
    ['Generated by', meta.generatedBy || ''],
    ['', ''],
    ['Users in report', t.users ?? ''],
    ['Total present days', t.present ?? ''],
    ['Total half days', t.halfDay ?? ''],
    ['Total absent days', t.absent ?? ''],
    ['Total payable days', t.payableDays ?? ''],
    ['Total worked', t.totalWorkedLabel ?? ''],
    ['Total travel time', t.totalTravelLabel ?? ''],
    ['Total distance', t.totalDistanceLabel ?? ''],
    ['', ''],
    ['How distance is measured', 'Straight-line (great-circle) between consecutive GPS points, summed over the day. It reads slightly under a vehicle odometer because it does not follow road curvature.'],
    ['How travel time is measured', 'Time punched in, minus time spent stationary at a detected stop.'],
    ['What counts as a stop', 'Consecutive GPS points staying inside the policy radius for at least the policy minimum, both configurable per shift policy.'],
    ['Present / Half day', 'Decided by the worked minutes thresholds on the shift policy in force ON THAT DAY - changing a policy later does not re-grade past days.'],
    ['Payable days', 'Present days plus half of the half days.'],
    ['GPS Confirmed (visits)', 'A logged visit is CONFIRMED when its coordinates and time fall inside a stop the phone actually recorded. NOT CONFIRMED means no such stop exists - usually the visit was logged from elsewhere, or the rep left before the stop threshold. It is a prompt to look, not proof of anything by itself.'],
  ].forEach(([k, v]) => info.addRow({ k, v }));
  info.getColumn('v').alignment = { wrapText: true, vertical: 'top' };

  const stamp = `${meta.from || summary?.from}_to_${meta.to || summary?.to}`;
  await triggerDownload(wb, `field-tracking-${stamp}.xlsx`);
};

/**
 * Standalone Customer Visits download (the Visits tab's own button).
 * @param {object} visits  payload from /reports/visits
 * @param {object} meta    { from, to, role }
 */
export const exportVisits = async (visits, meta = {}) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CRM Field Tracking';
  wb.created = new Date();

  addSheet(wb, 'Customer Visits', VISIT_COLUMNS, (visits?.rows || []).map(visitRow));

  const t = visits?.totals || {};
  const info = wb.addWorksheet('Info');
  info.columns = [{ header: 'Field', key: 'k', width: 30 }, { header: 'Value', key: 'v', width: 70 }];
  headerStyle(info.getRow(1));
  [
    ['Report', 'Customer Visits - logged in the field'],
    ['Date range', `${meta.from || visits?.from} to ${meta.to || visits?.to}`],
    ['Role filter', meta.role || 'All tracked roles'],
    ['Generated at', new Date().toLocaleString('en-IN')],
    ['', ''],
    ['Total visits', t.visits ?? ''],
    ['Completed', t.completed ?? ''],
    ['In progress', t.inProgress ?? ''],
    ['Cancelled', t.cancelled ?? ''],
    ['Linked to a CRM lead', t.withLead ?? ''],
    ['Not GPS-confirmed', t.unverified ?? ''],
    ['', ''],
    ['What this is', 'A visit logged by a field user from their phone while punched in, with the GPS fix taken at that moment.'],
    ['What this is NOT', 'This is not the Site Visits module. That one schedules a prospect onto a property and requires both a lead and a project. These are field calls, and the customer need not exist in the CRM at all.'],
    ['GPS Confirmed', 'CONFIRMED means a stop the phone actually recorded matches this visit in time and place. NOT CONFIRMED means no such stop exists - worth reviewing, not proof of anything on its own.'],
    ['Duration', 'Time between arriving and leaving. A visit the rep forgot to close is auto-closed when the working day closes, and is marked as such.'],
  ].forEach(([k, v]) => info.addRow({ k, v }));
  info.getColumn('v').alignment = { wrapText: true, vertical: 'top' };

  const stamp = `${meta.from || visits?.from}_to_${meta.to || visits?.to}`;
  await triggerDownload(wb, `customer-visits-${stamp}.xlsx`);
};

export default exportFieldTrackingReport;
