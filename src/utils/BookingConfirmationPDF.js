// ============================================================
// UTILITY: Booking Confirmation PDF Generator
// Generates a branded A4 PDF matching the company template.
// Uses jspdf — entirely client-side, no server dependency.
// ============================================================

import { jsPDF } from 'jspdf';

/* ── Colour palette ── */
const COLORS = {
  gold: [193, 154, 87],       // #C19A57 — accent / borders
  darkBg: [30, 30, 35],       // header background
  white: [255, 255, 255],
  black: [0, 0, 0],
  grey: [100, 100, 100],
  lightGrey: [200, 200, 200],
  veryLightGrey: [245, 245, 245],
  sectionBg: [250, 248, 244], // warm off-white for sections
  green: [34, 139, 34],
  mutedText: [120, 120, 120],
  darkText: [40, 40, 40],
  cardBorder: [220, 215, 205],
};

/* ── Number → Indian words ── */
const numberToWords = (num) => {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const intPart = Math.floor(Math.abs(num));
  return 'Rupees ' + convert(intPart) + ' Only';
};

/* ── Currency formatter (full, no shortening) ── */
const fmtINR = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '₹ 0';
  return '₹ ' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

/* ── Safe text helper ── */
const safe = (v, fallback = '—') => (v != null && String(v).trim() !== '' ? String(v).trim() : fallback);

/* ── Mask account number (show last 4) ── */
const maskAccount = (acct) => {
  const s = String(acct || '').replace(/\s/g, '');
  if (s.length <= 4) return s;
  return 'XXXX XXXX ' + s.slice(-4);
};

/* ── Main export ── */
export const generateBookingConfirmationPDF = (booking, banks = []) => {
  if (!booking) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();  // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Derived data ──
  const customer = booking.customer || {};
  const inventoryUnit = booking.inventoryUnit || {};
  const project = booking.project || {};
  const buyerName = safe(booking.buyer_name || customer.buyer_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(), 'Customer');

  // Title prefix (Mr./Mrs./Ms.) — infer from gender if available
  const genderPrefix = customer.gender === 'Female' ? 'Mrs.' : customer.gender === 'Male' ? 'Mr.' : '';
  const displayBuyerName = genderPrefix ? `${genderPrefix} ${buyerName}` : buyerName;

  const plotNo = safe(booking.unit_number || inventoryUnit.unit_number, 'N/A');
  const projectName = safe(booking.project_name || project.project_name, 'N/A');
  const phaseName = safe(booking.phase_name || booking.phase?.phase_name || inventoryUnit.phase?.phase_name, '');

  const area = safe(booking.carpet_area || inventoryUnit.unit_area, '—');
  const areaUnit = safe(booking.area_unit || inventoryUnit.area_unit, 'Sq.ft');
  const facing = safe(inventoryUnit.facing || booking.configuration, '—');
  const config = safe(inventoryUnit.configuration || booking.configuration, 'Future Construction');
  // Location from project
  const location = safe(project.address || project.location?.location_name, '—');

  const customerPhone = safe(customer.phone, '—');
  // Address
  const addressParts = [customer.address_line_1, customer.address_line_2, customer.city, customer.state, customer.pincode].filter(Boolean);
  const customerAddress = addressParts.length > 0 ? addressParts.join(', ') : '—';

  // Investment computations (same logic as the booking detail page)
  const toAmt = (v) => { const n = parseFloat(v || 0); return Number.isFinite(n) ? n : 0; };
  const guidelineRate = toAmt(booking.guideline_value);
  const plotAreaSqft = toAmt(booking.plot_area);
  const perSqftCost = toAmt(booking.development_cost_per_sqft);

  let plotValue, stampValue, registrationValue;
  if (guidelineRate > 0 && plotAreaSqft > 0) {
    plotValue = Math.ceil((guidelineRate * plotAreaSqft) / 100) * 100;
    stampValue = Math.ceil((plotValue * 0.07) / 100) * 100;
    registrationValue = Math.ceil((plotValue * 0.02) / 100) * 100;
  } else {
    plotValue = toAmt(booking.plot_value || booking.base_price || booking.total_amount || booking.net_amount);
    stampValue = toAmt(booking.stamp_value || booking.stamp_duty);
    registrationValue = toAmt(booking.registration_exp || booking.registration_charges);
  }
  const developmentValue = (perSqftCost > 0 && plotAreaSqft > 0)
    ? Math.round(plotAreaSqft * perSqftCost * 1.18 * 100) / 100
    : toAmt(booking.development_charges);

  // Other charges from cost breakdown
  const costBreakdown = booking.custom_fields?.cost_breakdown || {};
  const sumSplit = (split) => Object.values(split || {}).reduce((sum, v) => sum + toAmt(v), 0);
  const regSplitTotal = sumSplit(costBreakdown.registration_split);
  const modtSplitTotal = costBreakdown.modt_enabled ? sumSplit(costBreakdown.modt_split) : 0;
  const otherChargesTotal = regSplitTotal + modtSplitTotal + toAmt(booking.other_charges);

  const documentationCharges = stampValue + developmentValue;
  const totalInvestment = plotValue + documentationCharges + registrationValue + otherChargesTotal;

  // Banks — use first two active banks
  const activeBanks = (banks || []).filter(b => b.is_active !== false);
  const plotBank = activeBanks[0] || {};
  const devBank = activeBanks[1] || activeBanks[0] || {};

  // Status for journey tracker
  const statusCode = booking.bookingStatus?.status_code || booking.status_code || 'BOOKED';

  // Booking number for filename
  const bookingNumber = safe(booking.booking_number, 'UNKNOWN');

  // ════════════════════════════════════════════════════════════
  // 1. HEADER — Dark background with gold accent
  // ════════════════════════════════════════════════════════════
  const headerH = 28;
  doc.setFillColor(...COLORS.darkBg);
  doc.rect(0, 0, pageW, headerH, 'F');

  // Gold accent line
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, headerH, pageW, 1.2, 'F');

  // Title text
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('BOOKING CONFIRMATION', pageW / 2, headerH / 2 + 1, { align: 'center' });

  y = headerH + 1.2;

  // ════════════════════════════════════════════════════════════
  // 2. CONGRATULATIONS BANNER
  // ════════════════════════════════════════════════════════════
  y += 6;
  doc.setFillColor(...COLORS.sectionBg);
  doc.setDrawColor(...COLORS.cardBorder);
  const congratsH = 38;
  doc.roundedRect(margin, y, contentW, congratsH, 3, 3, 'FD');

  // "Congratulations" text
  doc.setTextColor(...COLORS.darkText);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Congratulations,', pageW / 2, y + 9, { align: 'center' });

  // Buyer name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gold);
  doc.text(displayBuyerName, pageW / 2, y + 17, { align: 'center' });

  // Property info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  const propertyLine = `Your booking for Plot No. ${plotNo} at`;
  doc.text(propertyLine, pageW / 2, y + 24, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkText);
  doc.text(projectName, pageW / 2, y + 31, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.mutedText);
  doc.text('Reserved exclusively for you.', pageW / 2, y + 36, { align: 'center' });

  y += congratsH + 6;

  // ════════════════════════════════════════════════════════════
  // 3. JOURNEY TRACKER
  // ════════════════════════════════════════════════════════════
  // Section title
  doc.setFillColor(...COLORS.darkBg);
  const journeyTitleH = 7;
  doc.roundedRect(margin, y, contentW, journeyTitleH, 2, 2, 'F');
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR JOURNEY', pageW / 2, y + 4.8, { align: 'center' });
  y += journeyTitleH + 4;

  const steps = [
    { label: 'BOOKED', codes: ['BOOKED', 'BOOKING_APPROVED', 'BOOKING_PENDING', 'TOKEN_RECEIVED', 'FORM_SUBMITTED'] },
    { label: 'DOCUMENTATION', codes: ['AGREEMENT_DRAFT', 'AGREEMENT_SIGNED'] },
    { label: 'REGISTRATION', codes: ['REGISTERED'] },
    { label: 'HANDOVER', codes: ['HANDOVER', 'POSSESSION'] },
  ];

  // Determine active step index
  let activeIdx = 0;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].codes.includes(statusCode)) { activeIdx = i; break; }
  }

  const stepW = contentW / steps.length;
  const circleR = 4;
  const stepY = y + circleR + 1;

  steps.forEach((step, i) => {
    const cx = margin + stepW * i + stepW / 2;
    const isActive = i <= activeIdx;

    // Connecting line (before this circle)
    if (i > 0) {
      const prevCx = margin + stepW * (i - 1) + stepW / 2;
      doc.setDrawColor(...(i <= activeIdx ? COLORS.gold : COLORS.lightGrey));
      doc.setLineWidth(0.8);
      doc.line(prevCx + circleR + 1, stepY, cx - circleR - 1, stepY);
    }

    // Circle
    if (isActive) {
      doc.setFillColor(...COLORS.gold);
      doc.circle(cx, stepY, circleR, 'F');
      doc.setTextColor(...COLORS.white);
    } else {
      doc.setDrawColor(...COLORS.lightGrey);
      doc.setFillColor(...COLORS.white);
      doc.circle(cx, stepY, circleR, 'FD');
      doc.setTextColor(...COLORS.lightGrey);
    }

    // Checkmark or number
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(isActive ? '✓' : String(i + 1), cx, stepY + 1.5, { align: 'center' });

    // Label
    doc.setTextColor(...(isActive ? COLORS.darkText : COLORS.mutedText));
    doc.setFontSize(6.5);
    doc.setFont('helvetica', isActive ? 'bold' : 'normal');
    doc.text(step.label, cx, stepY + circleR + 5, { align: 'center' });
  });

  y = stepY + circleR + 10;

  // ════════════════════════════════════════════════════════════
  // 4. PROPERTY & PURCHASER — Two columns
  // ════════════════════════════════════════════════════════════
  const colW = (contentW - 6) / 2;

  // Section header
  doc.setFillColor(...COLORS.darkBg);
  const propTitleH = 7;
  doc.roundedRect(margin, y, colW, propTitleH, 2, 2, 'F');
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR PROPERTY', margin + colW / 2, y + 4.8, { align: 'center' });

  doc.roundedRect(margin + colW + 6, y, colW, propTitleH, 2, 2, 'F');
  doc.text('PURCHASER', margin + colW + 6 + colW / 2, y + 4.8, { align: 'center' });
  y += propTitleH + 2;

  // Property card
  const cardStartY = y;
  const propCardH = 36;
  doc.setFillColor(...COLORS.sectionBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.roundedRect(margin, y, colW, propCardH, 2, 2, 'FD');

  const propX = margin + 5;
  let propY = y + 7;
  const propLineH = 6;

  doc.setTextColor(...COLORS.darkText);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(projectName, propX, propY);
  propY += propLineH;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Plot No. ${plotNo}`, propX, propY);
  propY += propLineH - 1;

  doc.text(`${area} ${areaUnit}`, propX, propY);
  propY += propLineH - 1;

  doc.text(`${facing} Facing`, propX, propY);
  propY += propLineH - 1;

  const locationText = phaseName ? `${phaseName} · ${location}` : location;
  // Truncate long location
  const maxLocW = colW - 10;
  const locLines = doc.splitTextToSize(locationText, maxLocW);
  doc.text(locLines[0], propX, propY);

  // Purchaser card
  doc.setFillColor(...COLORS.sectionBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.roundedRect(margin + colW + 6, cardStartY, colW, propCardH, 2, 2, 'FD');

  const purchX = margin + colW + 11;
  let purchY = cardStartY + 7;

  doc.setTextColor(...COLORS.darkText);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(buyerName, purchX, purchY);
  purchY += propLineH;

  // Relation line (buyer_name from customer may include "W/o" or "S/o")
  const relationText = customer.buyer_name && customer.buyer_name !== buyerName
    ? customer.buyer_name : '';
  if (relationText) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.grey);
    doc.text(relationText, purchX, purchY);
    purchY += propLineH - 1;
  } else {
    purchY += 0;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(customerPhone, purchX, purchY);
  purchY += propLineH - 1;

  doc.text(config, purchX, purchY);
  purchY += propLineH - 1;

  // Customer address (truncated to fit)
  const addrLines = doc.splitTextToSize(customerAddress, colW - 10);
  doc.text(addrLines[0], purchX, purchY);

  y = cardStartY + propCardH + 6;

  // ════════════════════════════════════════════════════════════
  // 5. INVESTMENT BREAKDOWN
  // ════════════════════════════════════════════════════════════
  doc.setFillColor(...COLORS.darkBg);
  const investTitleH = 7;
  doc.roundedRect(margin, y, contentW, investTitleH, 2, 2, 'F');
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR INVESTMENT', pageW / 2, y + 4.8, { align: 'center' });
  y += investTitleH + 2;

  // Investment table
  doc.setFillColor(...COLORS.sectionBg);
  doc.setDrawColor(...COLORS.cardBorder);
  const investItems = [
    { label: 'Plot Value', value: plotValue },
    { label: 'Documentation', value: documentationCharges },
    { label: 'Registration', value: registrationValue },
    { label: 'Other Charges', value: otherChargesTotal },
  ].filter(item => item.value > 0 || item.label === 'Plot Value');

  const rowH = 8;
  const investCardH = (investItems.length + 1) * rowH + 16; // +1 for total row + words
  doc.roundedRect(margin, y, contentW, investCardH, 2, 2, 'FD');

  let investY = y + 6;
  const labelX = margin + 8;
  const valueX = margin + contentW - 8;

  investItems.forEach((item) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.darkText);
    doc.text(item.label, labelX, investY);
    doc.setTextColor(...COLORS.grey);
    doc.text(fmtINR(item.value), valueX, investY, { align: 'right' });
    investY += rowH;
  });

  // Divider line
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.5);
  doc.line(labelX, investY - 2, valueX, investY - 2);
  investY += 2;

  // Total row
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkText);
  doc.text('TOTAL INVESTMENT', labelX, investY);
  doc.setTextColor(...COLORS.gold);
  doc.text(fmtINR(totalInvestment), valueX, investY, { align: 'right' });
  investY += 5;

  // Amount in words
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.mutedText);
  const wordsText = numberToWords(totalInvestment);
  const wordsLines = doc.splitTextToSize(wordsText, contentW - 16);
  doc.text(wordsLines, pageW / 2, investY, { align: 'center' });

  y += investCardH + 6;

  // ════════════════════════════════════════════════════════════
  // 6. PAYMENT INFORMATION — Two bank columns
  // ════════════════════════════════════════════════════════════
  doc.setFillColor(...COLORS.darkBg);
  const payTitleH = 7;
  doc.roundedRect(margin, y, contentW, payTitleH, 2, 2, 'F');
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT INFORMATION', pageW / 2, y + 4.8, { align: 'center' });
  y += payTitleH + 2;

  const bankCardH = 34;
  // Plot Amount bank
  doc.setFillColor(...COLORS.sectionBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.roundedRect(margin, y, colW, bankCardH, 2, 2, 'FD');

  let bY = y + 6;
  const b1X = margin + 5;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gold);
  doc.text('PLOT AMOUNT', b1X, bY);
  bY += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkText);
  doc.text(safe(plotBank.bank_name, 'Bank Name'), b1X, bY);
  bY += 4.5;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(maskAccount(plotBank.account_number), b1X, bY);
  bY += 4.5;
  doc.text(`IFSC: ${safe(plotBank.ifsc_code, '—')}`, b1X, bY);
  bY += 4.5;
  doc.text(safe(plotBank.branch_name, '—'), b1X, bY);

  // Development Charges bank
  doc.setFillColor(...COLORS.sectionBg);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.roundedRect(margin + colW + 6, y, colW, bankCardH, 2, 2, 'FD');

  bY = y + 6;
  const b2X = margin + colW + 11;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gold);
  doc.text('DEVELOPMENT CHARGES', b2X, bY);
  bY += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkText);
  doc.text(safe(devBank.bank_name, 'Bank Name'), b2X, bY);
  bY += 4.5;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(maskAccount(devBank.account_number), b2X, bY);
  bY += 4.5;
  doc.text(`IFSC: ${safe(devBank.ifsc_code, '—')}`, b2X, bY);
  bY += 4.5;
  doc.text(safe(devBank.branch_name, '—'), b2X, bY);

  y += bankCardH + 6;

  // ════════════════════════════════════════════════════════════
  // 7. IMPORTANT INFORMATION
  // ════════════════════════════════════════════════════════════
  doc.setFillColor(...COLORS.darkBg);
  const infoTitleH = 7;
  doc.roundedRect(margin, y, contentW, infoTitleH, 2, 2, 'F');
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('IMPORTANT INFORMATION', pageW / 2, y + 4.8, { align: 'center' });
  y += infoTitleH + 2;

  const terms = [
    'Complete payment within 30 days from booking.',
    'Aadhaar & PAN required before registration.',
    'Registration charges are borne by purchaser.',
    'Cancellation charges apply as per company policy.',
    'Delayed payments attract interest @ 18% per annum.',
  ];

  doc.setFillColor(...COLORS.sectionBg);
  doc.setDrawColor(...COLORS.cardBorder);
  const termsCardH = terms.length * 5.5 + 8;
  doc.roundedRect(margin, y, contentW, termsCardH, 2, 2, 'FD');

  let termY = y + 6;
  terms.forEach((term) => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.darkText);
    doc.text('•', margin + 6, termY);
    doc.text(term, margin + 10, termY);
    termY += 5.5;
  });

  y += termsCardH + 10;

  // ════════════════════════════════════════════════════════════
  // 8. SIGNATURE LINES
  // ════════════════════════════════════════════════════════════
  // Check if we need a new page
  if (y > pageH - 30) {
    doc.addPage();
    y = 20;
  }

  const sigLineW = 60;
  const sigLeftX = margin + 10;
  const sigRightX = pageW - margin - sigLineW - 10;

  doc.setDrawColor(...COLORS.darkText);
  doc.setLineWidth(0.3);
  doc.line(sigLeftX, y, sigLeftX + sigLineW, y);
  doc.line(sigRightX, y, sigRightX + sigLineW, y);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text('Customer Signature', sigLeftX + sigLineW / 2, y + 5, { align: 'center' });
  doc.text('Authorized Signatory', sigRightX + sigLineW / 2, y + 5, { align: 'center' });

  // ════════════════════════════════════════════════════════════
  // 9. FOOTER — Gold line at bottom
  // ════════════════════════════════════════════════════════════
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, pageH - 3, pageW, 3, 'F');

  // ── Trigger download ──
  const fileName = `Booking_Confirmation_${bookingNumber}.pdf`;
  doc.save(fileName);
};
