// ============================================================
// UTILITY: Booking Form PDF Generator (web, client-side jsPDF)
// Renders the company "BOOKING FORM" as bordered tables:
//   Page 1 — Plot Details + Customer Details
//   Page 2 — Terms and Conditions
//   Page 3 — Documentation / cost calculation table
//   Page 4 — Account Details (one bordered block per split account)
// MUST stay byte-identical to the server copy at
// server/src/utils/bookingConfirmationPdf.js (shared, duplicated code).
// ============================================================

import { jsPDF } from 'jspdf';

/* ── Number → words (international grouping, "... Indian rupees") ── */
const numberToWords = (num) => {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Indian Rupees Zero only';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const below1000 = (x) => {
    let s = '';
    if (x >= 100) { s += ones[Math.floor(x / 100)] + ' hundred'; x %= 100; if (x) s += ' '; }
    if (x >= 20) { s += tens[Math.floor(x / 10)]; if (x % 10) s += '-' + ones[x % 10]; }
    else if (x > 0) s += ones[x];
    return s;
  };
  const groups = [{ v: 1e9, n: 'billion' }, { v: 1e6, n: 'million' }, { v: 1e3, n: 'thousand' }];
  let rem = n;
  const parts = [];
  groups.forEach((g) => {
    if (rem >= g.v) { parts.push(below1000(Math.floor(rem / g.v)) + ' ' + g.n); rem %= g.v; }
  });
  if (rem > 0) parts.push(below1000(rem));
  const words = parts.join(', ');
  return 'Indian Rupees ' + words.charAt(0).toUpperCase() + words.slice(1) + ' only';
};

/* ── Safe text helper ── */
const safe = (v, fallback = '—') => (v != null && String(v).trim() !== '' ? String(v).trim() : fallback);

/* ── Bank Name mapping from IFSC prefix ── */
const getBankNameFromIFSC = (ifsc) => {
  if (!ifsc) return '—';
  const prefix = ifsc.substring(0, 4).toUpperCase();
  const mapping = {
    KVBL: 'KARUR VYSYA BANK', ICIC: 'ICICI BANK', KKBK: 'KOTAK MAHINDRA BANK',
    IDFB: 'IDFC FIRST BANK', CIUB: 'CITY UNION BANK', SBIN: 'STATE BANK OF INDIA',
    UBIN: 'UNION BANK OF INDIA', IDIB: 'INDIAN BANK', IOBA: 'INDIAN OVERSEAS BANK',
    HDFC: 'HDFC BANK', BARB: 'BANK OF BARODA', PUNB: 'PUNJAB NATIONAL BANK', CNRB: 'CANARA BANK',
  };
  return mapping[prefix] || 'BANK';
};

/* ── Clean a raw Term (strip HTML/entities/unicode → WinAnsi ASCII) ── */
const cleanTermText = (term) => {
  let t = safe(term, '');
  if (!t) return '';
  t = t.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&rsquo;|&lsquo;/g, '\'')
    .replace(/&rdquo;|&ldquo;/g, '"').replace(/&ndash;|&mdash;/g, '-').replace(/&hellip;/g, '...')
    .replace(/&bull;|&#8226;/g, '-');
  t = t.replace(/[‘’‚‛]/g, '\'').replace(/[“”„‟]/g, '"').replace(/[–—―]/g, '-').replace(/…/g, '...')
    .replace(/[•‣⁃⁌⁍∙▪●○◦‧․·]/g, '-').replace(/₹/g, 'Rs.')
    .replace(/[ \u3000]/g, ' ').replace(/[\u200b-\u200d\ufeff\u00ad]/g, '').trim();
  t = Array.from(t).filter((ch) => ch.codePointAt(0) <= 0xFF).join('');
  return t.replace(/\s+/g, ' ').trim();
};

/* ── Main export ── */
export const generateBookingConfirmationPDF = (booking, plotSplitsParam, devSplitsParam, termsParam, extra) => {
  if (!booking) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();  // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const margin = 12;
  const contentW = pageW - margin * 2; // 186
  const TOP = 42;                      // leaves letterhead space at the top of each page
  const BLACK = [0, 0, 0];

  // ── Derived data ──
  const customer = booking.customer || {};
  const inventoryUnit = booking.inventoryUnit || {};
  const project = booking.project || {};
  const buyerName = safe(booking.buyer_name || customer.buyer_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(), 'Customer');
  // The name typed in the Generate Booking Form prints as the buyer name when provided.
  const displayBuyer = (extra && extra.formName && String(extra.formName).trim()) ? String(extra.formName).trim() : buyerName;
  const companyName = safe(extra && extra.companyName, safe(project.builder_name, 'Sujatha Real Estate'));

  const plotNo = safe(booking.unit_number || inventoryUnit.unit_number, 'N/A');
  const projectName = safe(booking.project_name || project.project_name, 'N/A');
  const phaseName = safe(booking.phase_name || booking.phase?.phase_name || inventoryUnit.phase?.phase_name, '');
  const displayProjectName = (phaseName && phaseName !== '—' && !projectName.toLowerCase().includes(phaseName.toLowerCase()))
    ? `${projectName} ${phaseName}` : projectName;
  const locationName = safe(project.location?.location_name || project.location?.name, '');

  const area = safe(booking.carpet_area || inventoryUnit.unit_area, '—');

  const customerPhone = safe(customer.phone, '—');
  const altPhone = safe(customer.alternate_phone, '');
  const relationType = safe(booking.relation_type || customer.relation_type, '');
  const relationName = safe(booking.relation_name || customer.relation_name, '');
  const dobVal = customer.date_of_birth;
  const dobFormatted = dobVal ? new Date(dobVal).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' }).replace(/\//g, '-') : '';
  const purpose = safe(booking.purpose_of_investment || customer.purpose_of_investment || booking.custom_fields?.purpose_of_investment, '');
  const occupation = safe(customer.occupation, '');
  const pincode = safe(customer.pincode, '');
  const addressParts = [customer.address_line_1, customer.address_line_2, customer.city, customer.state].filter(Boolean);
  const customerAddress = addressParts.length > 0 ? addressParts.join(', ') : '—';

  // Investment computations
  const toAmt = (v) => { const n = parseFloat(v || 0); return Number.isFinite(n) ? n : 0; };
  const fmtAmt = (v) => { const n = Math.round(toAmt(v) * 100) / 100; return n.toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
  const guidelineRate = toAmt(booking.guideline_value);
  const plotAreaSqft = toAmt(booking.plot_area);
  const perSqftCost = toAmt(booking.development_cost_per_sqft);
  const statusCode = booking.bookingStatus?.status_code || booking.status_code || 'BOOKED';
  const isRegistered = statusCode === 'REGISTERED';

  let plotValue = 0, stampValue = 0, registrationValue = 0;
  if (guidelineRate > 0 && plotAreaSqft > 0) {
    plotValue = Math.ceil((guidelineRate * plotAreaSqft) / 100) * 100; // ROUNDUP to nearest 100
    if (!isRegistered) {
      stampValue = plotValue * 0.07;        // exact 7%, no rounding
      registrationValue = plotValue * 0.02; // exact 2%, no rounding
    }
  } else {
    plotValue = toAmt(booking.plot_value || booking.base_price || booking.total_amount || booking.net_amount);
    if (!isRegistered) {
      stampValue = toAmt(booking.stamp_value || booking.stamp_duty);
      registrationValue = toAmt(booking.registration_exp || booking.registration_charges);
    }
  }

  const developmentValue = (perSqftCost > 0 && plotAreaSqft > 0)
    ? Math.round(plotAreaSqft * perSqftCost * 1.18)
    : toAmt(booking.development_charges);

  const costBreakdown = booking.custom_fields?.cost_breakdown || {};
  const savedRegSplit = costBreakdown.registration_split || {};
  const docStampCommission = Math.round(stampValue * 0.01); // 1% of Stamp Value
  const docOnline = toAmt(savedRegSplit.registration_expenses);
  const docWriter = toAmt(savedRegSplit.writer_expenses);
  const docPatta = toAmt(savedRegSplit.patta_charges);
  const docOther = toAmt(savedRegSplit.other_registration_expenses);
  const documentationAmount = stampValue + docStampCommission + registrationValue + docOnline + docWriter + docPatta + docOther;
  const totalValue = plotValue + developmentValue + documentationAmount;
  const balanceAmount = toAmt(booking.balance_amount);

  const bookingNumber = safe(booking.booking_number, 'UNKNOWN');
  const bookingD = booking.booking_date ? new Date(booking.booking_date) : null;
  const bookingDateLong = bookingD ? bookingD.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
  const bookingDateShort = bookingD ? `${bookingD.getDate()}-${bookingD.toLocaleDateString('en-US', { month: 'short' })}` : '—';

  // ── Split rows normalization (plot + dev bank accounts) ──
  const normalizeSplits = (input) => {
    if (Array.isArray(input)) {
      return input.filter(Boolean).map((s) => ({
        account_name: (s.account_name || s.bank_name || '').toString().trim(),
        account_number: (s.account_number || '').toString().trim(),
        ifsc_code: (s.ifsc_code || '').toString().trim(),
        branch_name: (s.branch_name || '').toString().trim(),
        amount: toAmt(s.amount),
      }));
    }
    if (input && typeof input === 'object' && (input.bank_name || input.account_number || input.ifsc_code)) {
      return [{
        account_name: (input.bank_name || '').toString().trim(),
        account_number: (input.account_number || '').toString().trim(),
        ifsc_code: (input.ifsc_code || '').toString().trim(),
        branch_name: (input.branch_name || '').toString().trim(),
        amount: 0,
      }];
    }
    return [];
  };
  const plotSplits = normalizeSplits(plotSplitsParam);
  const devSplits = normalizeSplits(devSplitsParam);
  if (plotSplits.length === 1 && !plotSplits[0].amount) plotSplits[0].amount = plotValue;
  if (devSplits.length === 1 && !devSplits[0].amount) devSplits[0].amount = developmentValue;

  // ── Bordered-table renderer ──
  // rows: [{ cells: [{ text, w, align='left', bold=false, size=9.5 }] }]
  // Cell widths per row must sum to contentW. Handles wrapping + page breaks.
  const drawTable = (startY, rows) => {
    let ty = startY;
    const pageBottom = pageH - 16;
    rows.forEach((row) => {
      const measured = row.cells.map((c) => {
        doc.setFont('helvetica', c.bold ? 'bold' : 'normal');
        doc.setFontSize(c.size || 9.5);
        return doc.splitTextToSize(String(c.text == null ? '' : c.text), c.w - 4);
      });
      const maxLines = Math.max(1, ...measured.map((l) => l.length));
      const rowH = Math.max(8, maxLines * 4.6 + 3.4);
      if (ty + rowH > pageBottom) { doc.addPage(); ty = TOP; }
      let cx = margin;
      row.cells.forEach((c, i) => {
        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.3);
        doc.rect(cx, ty, c.w, rowH);
        doc.setFont('helvetica', c.bold ? 'bold' : 'normal');
        doc.setFontSize(c.size || 9.5);
        doc.setTextColor(...BLACK);
        const lines = measured[i];
        const align = c.align || 'left';
        const blockTop = ty + (rowH - (lines.length - 1) * 4.6) / 2 + 1.5;
        lines.forEach((ln, li) => {
          const yy = blockTop + li * 4.6;
          if (align === 'center') doc.text(ln, cx + c.w / 2, yy, { align: 'center' });
          else if (align === 'right') doc.text(ln, cx + c.w - 2, yy, { align: 'right' });
          else doc.text(ln, cx + 2, yy);
        });
        cx += c.w;
      });
      ty += rowH;
    });
    return ty;
  };

  // Centered, underlined section heading (Plot Details / Customer Details).
  const drawHeading = (title, startY) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BLACK);
    doc.text(title, pageW / 2, startY, { align: 'center' });
    const w = doc.getTextWidth(title);
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.4);
    doc.line(pageW / 2 - w / 2, startY + 1.5, pageW / 2 + w / 2, startY + 1.5);
    return startY + 8;
  };

  // Column templates
  const KV = [62, 124];          // label | value
  const LVW = [55, 45, 86];      // label | value | words
  const LV2 = [55, 131];         // label | value (account rows: value spans wide)

  // ============================================================
  // PAGE 1 — BOOKING FORM: Plot + Customer details
  // ============================================================
  let y = TOP;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...BLACK);
  doc.text('BOOKING FORM', pageW / 2, y, { align: 'center' });
  const titleW = doc.getTextWidth('BOOKING FORM');
  doc.setLineWidth(0.5);
  doc.line(pageW / 2 - titleW / 2, y + 2, pageW / 2 + titleW / 2, y + 2);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const welcome = `${displayBuyer}, We are glad that you have turned your Dream Into A Reality with ${companyName}.`;
  doc.splitTextToSize(welcome, contentW).forEach((ln) => { doc.text(ln, margin, y); y += 5.2; });
  y += 8;

  y = drawHeading('Plot Details', y);
  const cell = (text, w, align, bold) => ({ text, w, align: align || 'center', bold: !!bold });
  y = drawTable(y, [
    { cells: [cell('Project', KV[0]), cell(displayProjectName, KV[1], 'left')] },
    { cells: [cell('Plot Number', KV[0]), cell(plotNo, KV[1], 'left')] },
    { cells: [cell('Extent', KV[0]), cell(String(area), KV[1], 'left')] },
    { cells: [cell('Location', KV[0]), cell(locationName || '—', KV[1], 'left')] },
    { cells: [cell('Date', KV[0]), cell(bookingDateLong, KV[1], 'left')] },
  ]);
  y += 10;

  y = drawHeading('Customer Details', y);
  const custRows = [
    { cells: [cell('Name', KV[0]), cell(displayBuyer, KV[1], 'left')] },
  ];
  if (relationName && relationName !== '—') {
    custRows.push({ cells: [cell(relationType && relationType !== '—' ? relationType : 'S/o', KV[0]), cell(relationName, KV[1], 'left')] });
  }
  custRows.push({ cells: [cell('Contact Number', KV[0]), cell(customerPhone, KV[1], 'left')] });
  if (altPhone) custRows.push({ cells: [cell('Alternate Number', KV[0]), cell(altPhone, KV[1], 'left')] });
  custRows.push({ cells: [cell('Address', KV[0]), cell(customerAddress, KV[1], 'left')] });
  if (pincode) custRows.push({ cells: [cell('Pincode', KV[0]), cell(pincode, KV[1], 'left')] });
  if (dobFormatted) custRows.push({ cells: [cell('Date Of Birth', KV[0]), cell(dobFormatted, KV[1], 'left')] });
  custRows.push({ cells: [cell('Purpose of Investment', KV[0]), cell(purpose, KV[1], 'left')] });
  custRows.push({ cells: [cell('Occupation', KV[0]), cell(occupation, KV[1], 'left')] });
  drawTable(y, custRows);

  // ============================================================
  // PAGE 2 — TERMS AND CONDITIONS
  // ============================================================
  doc.addPage();
  y = TOP;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...BLACK);
  doc.text('Terms and Conditions to Booking:', margin, y);
  y += 10;

  const defaultTerms = [
    'I shall pay the plot amount in 30 days, balance amount in 30 days and shall complete registration 30 days',
    'The Purchaser shall complete all payments before registration. The Purchaser shall provide original copies of the Aadhaar Card and PAN at least 2 working days before the registration of the plot.',
    'The Developer shall provide a sale deed draft to the Purchaser 2 days prior to the date of registration. Only after the confirmation from the Purchaser the Developer shall take printouts of the documents.',
    'Final measurements of the plot may vary as per site. Final and total sale value shall be calculated from the available plot area at the site.',
    'After registration of the plot vide a registered sale deed, responsibility of maintaining the possession of the plot shall only be with the buyer.',
    'All charges of Stamp duty, registration, GST or any other statutory charges as applicable from time to time shall be borne by the Purchaser only.',
    'The payment of the plots shall be completed within a period of 30 days from the date of booking.',
    'In case of cancellation the following charges will be applicable - Up to 15 days from the date of booking - Nil, cancellation after 15 days from the date of booking - Rs.10,000/- and cancellation after 45 days from the date of booking - Rs.20,000/- In case the customer fails to make the payment within the stipulated period, the developer shall reserve all rights to cancel the plot and book in the name of other prospective buyers without giving any prior information to the customer.',
    'In case of cancellation, the developer shall refund the advance only after re-booking the same plot in favor of the prospective buyer or 90 days from the date of cancellation whichever is earlier.',
    'In case the buyer fails to make the payment as per the agreed terms, an interest of 18% per annum shall be levied on the outstanding amount for the total tenure of the delay',
  ];
  const rawTerms = (termsParam && termsParam.length > 0) ? termsParam.map((t) => t.content) : defaultTerms;
  const terms = [];
  rawTerms.forEach((term) => {
    if (!term) return;
    String(term).replace(/<\/p>/g, '\n').replace(/<p>/g, '').replace(/<br\s*\/?>/g, '\n')
      .split(/\r?\n/).forEach((part) => { const c = cleanTermText(part); if (c) terms.push(c); });
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const bulletX = margin + 3;
  const textX = margin + 8;
  terms.forEach((t) => {
    const lines = doc.splitTextToSize(t, contentW - 8);
    const blockH = lines.length * 5.2 + 3;
    if (y + blockH > pageH - 16) { doc.addPage(); y = TOP; }
    doc.text('-', bulletX, y);
    lines.forEach((ln) => { doc.text(ln, textX, y); y += 5.2; });
    y += 2.5;
  });

  // ============================================================
  // PAGE 3 — DOCUMENTATION / COST TABLE
  // ============================================================
  doc.addPage();
  y = TOP;
  const w = numberToWords;
  // Two-column detail table: Details | "Rs. amount" with the amount-in-words stacked underneath (left-aligned).
  const LW = [78, 108];
  const paramRow = (label, value) => ({ cells: [cell(label, LW[0]), cell(String(value == null ? '' : value), LW[1], 'left')] });
  const amtRow = (label, value) => ({ cells: [cell(label, LW[0]), cell(`Rs. ${fmtAmt(value)}\n${w(value)}`, LW[1], 'left')] });
  // Development is quoted inclusive of 18% GST — show the base + GST split-up.
  const devBase = (perSqftCost > 0 && plotAreaSqft > 0) ? Math.round(plotAreaSqft * perSqftCost) : Math.round(developmentValue / 1.18);
  const devGst = developmentValue - devBase;
  y = drawTable(y, [
    paramRow('Date', bookingDateShort),
    paramRow('Plot No', plotNo),
    paramRow('Area', String(area)),
    paramRow('GL Value', fmtAmt(guidelineRate)),
    paramRow('Dev Charges', perSqftCost > 0 ? fmtAmt(perSqftCost) : ''),
    paramRow('GST', '18%'),
    amtRow('Guideline Value', plotValue),
    amtRow('Development Charges (Base)', devBase),
    amtRow('Development GST (18%)', devGst),
    amtRow('Development Amount (incl. GST)', developmentValue),
    amtRow('Balance Amount', balanceAmount),
    amtRow('Documentation Amount', documentationAmount),
    { cells: [cell('Documentation Amount', contentW, 'center', true)] },
    amtRow('Stamp Value (7%)', stampValue),
    amtRow('Stamp Commission', docStampCommission),
    amtRow('Registration Fees (2%)', registrationValue),
    amtRow('Online Commission, Computer Fees, Extra pages, Survey Fees, CD Etc..', docOnline),
    amtRow('Writer Charges', docWriter),
    amtRow('Patta Transfer Charges', docPatta),
    amtRow('Other Registration Expenses', docOther),
    { cells: [cell('TOTAL VALUE', LW[0], 'center', true), cell(`Rs. ${fmtAmt(totalValue)}\n${w(totalValue)}`, LW[1], 'left', true)] },
  ]);

  // ============================================================
  // PAGE 4 — ACCOUNT DETAILS
  // ============================================================
  doc.addPage();
  y = TOP;
  const accountRows = [{ cells: [cell('Account Details', contentW, 'center', true)] }];
  const pushAccountBlock = (splits, totalLabel, totalValue) => {
    accountRows.push({ cells: [cell(totalLabel, LVW[0], 'center', true), cell(`Rs. ${fmtAmt(totalValue)}`, LVW[1], 'left', true), cell(w(totalValue), LVW[2], 'left')] });
    splits.forEach((s) => {
      if (splits.length > 1 || (splits.length === 1 && Math.abs(s.amount - totalValue) >= 1)) {
        accountRows.push({ cells: [cell('Amount', LVW[0]), cell(`Rs. ${fmtAmt(s.amount)}`, LVW[1], 'left'), cell(w(s.amount), LVW[2], 'left')] });
      }
      accountRows.push({ cells: [cell('Account Name', LV2[0]), cell(safe(s.account_name), LV2[1], 'left')] });
      accountRows.push({ cells: [cell('Account Number', LV2[0]), cell(safe(s.account_number), LV2[1], 'left')] });
      accountRows.push({ cells: [cell('Bank', LV2[0]), cell(getBankNameFromIFSC(s.ifsc_code), LV2[1], 'left')] });
      accountRows.push({ cells: [cell('IFSC Code', LV2[0]), cell(safe(s.ifsc_code), LV2[1], 'left')] });
      accountRows.push({ cells: [cell('Branch', LV2[0]), cell(safe(s.branch_name), LV2[1], 'left')] });
    });
  };
  // One account block per charge. Plot & Development always show; the remaining
  // charges show an account block when accounts were assigned (extra.chargeSplits),
  // otherwise just a total row.
  const cs = (extra && extra.chargeSplits) || {};
  const chargeSections = [
    { label: 'Plot Amount', total: plotValue, splits: plotSplits },
    { label: 'Development Amount', total: developmentValue, splits: devSplits },
    { label: 'Stamp Duty', total: stampValue, splits: normalizeSplits(cs.stamp) },
    { label: 'Registration Fees', total: registrationValue, splits: normalizeSplits(cs.registration) },
    { label: 'Stamp Commission', total: docStampCommission, splits: normalizeSplits(cs.commission) },
    { label: 'Registration Expenses', total: docOnline + docWriter + docPatta, splits: normalizeSplits(cs.reg_expenses) },
    { label: 'Other Registration Expenses', total: docOther, splits: normalizeSplits(cs.other_reg_expenses) },
  ];
  chargeSections.forEach((sec, idx) => {
    if (idx > 1 && sec.splits.length === 0) return; // skip optional charges if no bank account is selected
    if (sec.splits.length === 1 && !sec.splits[0].amount) sec.splits[0].amount = sec.total;
    if (sec.splits.length > 0) {
      pushAccountBlock(sec.splits, sec.label, sec.total);
    } else {
      accountRows.push({ cells: [cell(sec.label, LVW[0], 'center', true), cell(`Rs. ${fmtAmt(sec.total)}`, LVW[1], 'left', true), cell(w(sec.total), LVW[2], 'left')] });
    }
    accountRows.push({ cells: [cell('', contentW, 'left')] }); // spacer
  });
  drawTable(y, accountRows);

  // ── Footer (booking no. + page x of y) on every page ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BLACK);
    doc.text(`${bookingNumber}  |  Page ${i} of ${totalPages}`, pageW / 2, pageH - 8, { align: 'center' });
  }

  // ── Trigger download ──
  const sanitizeFileName = (s) => String(s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
  const formName = extra && extra.formName ? sanitizeFileName(extra.formName) : '';
  const fileName = formName ? `${formName}.pdf` : `Booking_Form_${bookingNumber}.pdf`;
  doc.save(fileName);
};
