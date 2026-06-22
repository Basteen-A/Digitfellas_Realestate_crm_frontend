// ============================================================
// UTILITY: Booking Confirmation PDF Generator
// Generates a corporate-grade, single-page A4 PDF confirmation.
// Uses jspdf — entirely client-side, no server dependency.
// ============================================================

import { jsPDF } from 'jspdf';

/* ── Colour palette ── */
const COLORS = {
  gold: [193, 154, 87],       // #C19A57 — accent / borders
  darkBg: [30, 30, 35],       // primary dark charcoal
  white: [255, 255, 255],
  black: [0, 0, 0],
  grey: [100, 100, 100],
  lightGrey: [225, 222, 215],  // thin elegant warm grey
  veryLightGrey: [250, 248, 244], // warm card background
  green: [34, 139, 34],
  mutedText: [130, 130, 135],
  darkText: [40, 40, 45],
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

/* ── Currency formatter (using Rs. prefix to prevent jsPDF Helvetica font mapping bug) ── */
const fmtINR = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return 'Rs. 0';
  return 'Rs. ' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
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
  const margin = 12;
  const contentW = pageW - margin * 2; // 186
  let y = 12;

  // ── Derived data ──
  const customer = booking.customer || {};
  const inventoryUnit = booking.inventoryUnit || {};
  const project = booking.project || {};
  const buyerName = safe(booking.buyer_name || customer.buyer_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(), 'Customer');

  // Title prefix (Mr./Mrs./Ms.)
  const genderPrefix = customer.gender === 'Female' ? 'Mrs.' : customer.gender === 'Male' ? 'Mr.' : '';
  const displayBuyerName = genderPrefix ? `${genderPrefix} ${buyerName}` : buyerName;

  const plotNo = safe(booking.unit_number || inventoryUnit.unit_number, 'N/A');
  const projectName = safe(booking.project_name || project.project_name, 'N/A');
  const phaseName = safe(booking.phase_name || booking.phase?.phase_name || inventoryUnit.phase?.phase_name, '');

  const area = safe(booking.carpet_area || inventoryUnit.unit_area, '—');
  const areaUnit = safe(booking.area_unit || inventoryUnit.area_unit, 'Sq.ft');
  const facing = safe(inventoryUnit.facing, '—');

  // Location string using nested project location details
  const locationParts = [
    project.location?.location_name,
    project.location?.city,
    project.address
  ].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : '—';
  const locationText = phaseName ? `${phaseName} · ${location}` : location;

  const customerPhone = safe(customer.phone, '—');
  
  // Customer Address
  const addressParts = [
    customer.address_line_1,
    customer.address_line_2,
    customer.city,
    customer.state,
    customer.pincode
  ].filter(Boolean);
  const customerAddress = addressParts.length > 0 ? addressParts.join(', ') : '—';

  // Relation line if available
  const relationText = customer.buyer_name && customer.buyer_name !== buyerName ? customer.buyer_name : '';

  // Investment computations
  const toAmt = (v) => { const n = parseFloat(v || 0); return Number.isFinite(n) ? n : 0; };
  const guidelineRate = toAmt(booking.guideline_value);
  const plotAreaSqft = toAmt(booking.plot_area);
  const perSqftCost = toAmt(booking.development_cost_per_sqft);
  const statusCode = booking.bookingStatus?.status_code || booking.status_code || 'BOOKED';
  const isRegistered = statusCode === 'REGISTERED';

  let plotValue = 0, stampValue = 0, registrationValue = 0;
  if (guidelineRate > 0 && plotAreaSqft > 0) {
    plotValue = Math.ceil((guidelineRate * plotAreaSqft) / 100) * 100;
    if (!isRegistered) {
      stampValue = Math.ceil((plotValue * 0.07) / 100) * 100;
      registrationValue = Math.ceil((plotValue * 0.02) / 100) * 100;
    }
  } else {
    plotValue = toAmt(booking.plot_value || booking.base_price || booking.total_amount || booking.net_amount);
    if (!isRegistered) {
      stampValue = toAmt(booking.stamp_value || booking.stamp_duty);
      registrationValue = toAmt(booking.registration_exp || booking.registration_charges);
    }
  }
  
  const developmentValue = (perSqftCost > 0 && plotAreaSqft > 0)
    ? Math.round(plotAreaSqft * perSqftCost * 1.18 * 100) / 100
    : toAmt(booking.development_charges);

  // Other charges splits
  const costBreakdown = booking.custom_fields?.cost_breakdown || {};
  const sumSplit = (split) => Object.values(split || {}).reduce((sum, v) => sum + toAmt(v), 0);
  const regSplitTotal = isRegistered ? 0 : sumSplit(costBreakdown.registration_split);
  const modtSplitTotal = (!isRegistered && costBreakdown.modt_enabled) ? sumSplit(costBreakdown.modt_split) : 0;
  const otherChargesTotal = isRegistered ? 0 : (regSplitTotal + modtSplitTotal + toAmt(booking.other_charges));

  const totalInvestment = plotValue + developmentValue + stampValue + registrationValue + otherChargesTotal;

  // Banks — use first two active banks
  const activeBanks = (banks || []).filter(b => b.is_active !== false);
  const plotBank = activeBanks[0] || {};
  const devBank = activeBanks[1] || activeBanks[0] || {};

  const bookingNumber = safe(booking.booking_number, 'UNKNOWN');
  const bookingDate = booking.booking_date ? new Date(booking.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const builderName = safe(project.builder_name || 'SUJATHA DEVELOPERS', 'SUJATHA DEVELOPERS').toUpperCase();

  // Helper function to draw vertical gold bar + section titles
  const drawSectionHeader = (title, x, targetY) => {
    doc.setFillColor(...COLORS.gold);
    doc.rect(x, targetY, 1.5, 4.5, 'F');
    doc.setTextColor(...COLORS.darkBg);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(title, x + 3.5, targetY + 3.3);
  };

  // ════════════════════════════════════════════════════════════
  // 1. CORPORATE HEADER
  // ════════════════════════════════════════════════════════════
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gold);
  doc.text(builderName, margin, y + 4);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkBg);
  doc.text('BOOKING CONFIRMATION', pageW - margin, y + 3.5, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Ref: ${bookingNumber}  |  Date: ${bookingDate}`, pageW - margin, y + 8, { align: 'right' });

  // Thin elegant separator line
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.35);
  doc.line(margin, y + 11, pageW - margin, y + 11);

  y += 15;

  // ════════════════════════════════════════════════════════════
  // 2. WELCOME BANNER
  // ════════════════════════════════════════════════════════════
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, contentW, 18, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLORS.gold);
  doc.rect(margin, y, 1.5, 18, 'F');

  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Dear ${displayBuyerName},`, margin + 4, y + 5.5);

  doc.setTextColor(...COLORS.darkText);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`We are pleased to confirm your booking for Plot No. ${plotNo} at ${projectName}. The transaction details are summarized below.`, margin + 4, y + 12);

  y += 18 + 5;

  // ════════════════════════════════════════════════════════════
  // 3. PROPERTY & PURCHASER DETAILS (Side-by-Side Cards)
  // ════════════════════════════════════════════════════════════
  const colW = (contentW - 6) / 2; // 90mm

  drawSectionHeader('PROPERTY DETAILS', margin, y);
  drawSectionHeader('PURCHASER DETAILS', margin + colW + 6, y);
  y += 6;

  // Cards
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, colW, 28, 1.5, 1.5, 'FD');
  doc.roundedRect(margin + colW + 6, y, colW, 28, 1.5, 1.5, 'FD');

  // Property Details Card Content
  let pY = y + 5;
  doc.setTextColor(...COLORS.darkText);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(projectName, margin + 4, pY);
  pY += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Plot No: ${plotNo}`, margin + 4, pY);
  pY += 4.5;
  doc.text(`Area: ${area} ${areaUnit}`, margin + 4, pY);
  pY += 4.5;
  doc.text(`Facing: ${facing !== '—' ? `${facing} Facing` : '—'}`, margin + 4, pY);
  pY += 4.5;

  const locLines = doc.splitTextToSize(locationText, colW - 8);
  doc.text(locLines[0] || '—', margin + 4, pY);

  // Purchaser Details Card Content
  let uY = y + 5;
  doc.setTextColor(...COLORS.darkText);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(buyerName, margin + colW + 10, uY);
  uY += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);

  if (relationText) {
    doc.text(relationText, margin + colW + 10, uY);
    uY += 4.5;
  }

  doc.text(`Phone: ${customerPhone}`, margin + colW + 10, uY);
  uY += 4.5;

  // Render multi-line customer address (replaces configuration)
  const addrLines = doc.splitTextToSize(customerAddress, colW - 14);
  addrLines.slice(0, 2).forEach((line) => {
    doc.text(line, margin + colW + 10, uY);
    uY += 4.2;
  });

  y += 28 + 5;

  // ════════════════════════════════════════════════════════════
  // 4. JOURNEY TRACKER
  // ════════════════════════════════════════════════════════════
  drawSectionHeader('YOUR JOURNEY STATUS', margin, y);
  y += 6;

  // Tracker Card
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, contentW, 16, 1.5, 1.5, 'FD');

  const steps = [
    { label: 'BOOKED', codes: ['BOOKED', 'BOOKING_APPROVED', 'BOOKING_PENDING', 'TOKEN_RECEIVED', 'FORM_SUBMITTED'] },
    { label: 'DOCUMENTATION', codes: ['AGREEMENT_DRAFT', 'AGREEMENT_SIGNED'] },
    { label: 'REGISTRATION', codes: ['REGISTERED'] },
    { label: 'HANDOVER', codes: ['HANDOVER', 'POSSESSION'] },
  ];

  let activeIdx = 0;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].codes.includes(statusCode)) { activeIdx = i; break; }
  }

  const stepW = contentW / steps.length;
  const circleR = 2.5;
  const stepY = y + 5.5;

  steps.forEach((step, i) => {
    const cx = margin + stepW * i + stepW / 2;
    const isActive = i <= activeIdx;

    // Connecting line (before this circle)
    if (i > 0) {
      const prevCx = margin + stepW * (i - 1) + stepW / 2;
      doc.setDrawColor(...(i <= activeIdx ? COLORS.gold : COLORS.lightGrey));
      doc.setLineWidth(0.6);
      doc.line(prevCx + circleR + 1, stepY, cx - circleR - 1, stepY);
    }

    // Circle
    if (isActive) {
      doc.setFillColor(...COLORS.gold);
      doc.circle(cx, stepY, circleR, 'F');
    } else {
      doc.setDrawColor(...COLORS.lightGrey);
      doc.setFillColor(...COLORS.white);
      doc.circle(cx, stepY, circleR, 'FD');
    }

    // Label
    doc.setTextColor(...(isActive ? COLORS.darkText : COLORS.mutedText));
    doc.setFontSize(6.5);
    doc.setFont('helvetica', isActive ? 'bold' : 'normal');
    doc.text(step.label, cx, stepY + circleR + 4.5, { align: 'center' });
  });

  y += 16 + 5;

  // ════════════════════════════════════════════════════════════
  // 5. INVESTMENT SUMMARY & BANK DETAILS (Side-by-Side Grid)
  // ════════════════════════════════════════════════════════════
  drawSectionHeader('INVESTMENT SUMMARY', margin, y);
  drawSectionHeader('BANK PAYMENT INFORMATION', margin + colW + 6, y);
  y += 6;

  // Cards
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.setLineWidth(0.2);

  const mainCardH = 46;
  doc.roundedRect(margin, y, colW, mainCardH, 1.5, 1.5, 'FD');
  doc.roundedRect(margin + colW + 6, y, colW, mainCardH, 1.5, 1.5, 'FD');

  // Left: Investment summary table
  const investItems = [
    { label: 'Plot Value', value: plotValue },
    { label: 'Development Charges', value: developmentValue },
    { label: 'Stamp Duty & Registration', value: stampValue + registrationValue },
    { label: 'Other Charges', value: otherChargesTotal },
  ].filter(item => item.value > 0 || item.label === 'Plot Value');

  let tableY = y + 4;
  investItems.forEach((item, idx) => {
    // Draw alternate shaded rows
    if (idx % 2 === 1) {
      doc.setFillColor(242, 240, 235);
      doc.rect(margin + 1, tableY - 3, colW - 2, 6, 'F');
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.darkText);
    doc.text(item.label, margin + 4, tableY + 1.2);
    doc.text(fmtINR(item.value), margin + colW - 4, tableY + 1.2, { align: 'right' });
    tableY += 6;
  });

  // Divider
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.3);
  doc.line(margin + 4, tableY - 1, margin + colW - 4, tableY - 1);
  tableY += 3;

  // Total Row
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkText);
  doc.text('TOTAL INVESTMENT', margin + 4, tableY + 1);
  doc.setTextColor(...COLORS.gold);
  doc.text(fmtINR(totalInvestment), margin + colW - 4, tableY + 1, { align: 'right' });
  tableY += 5.5;

  // Words
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.mutedText);
  const wordsText = numberToWords(totalInvestment);
  const wordsLines = doc.splitTextToSize(wordsText, colW - 8);
  wordsLines.slice(0, 2).forEach((line) => {
    doc.text(line, margin + colW / 2, tableY, { align: 'center' });
    tableY += 3.5;
  });

  // Right: Bank Payment Details
  let bY = y + 4;
  
  // Sub-card 1: Plot Amount
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.roundedRect(margin + colW + 10, bY, colW - 8, 17, 1, 1, 'FD');
  
  doc.setFillColor(...COLORS.gold);
  doc.rect(margin + colW + 10, bY, 1, 17, 'F');
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gold);
  doc.text('PLOT AMOUNT ACCOUNT', margin + colW + 13, bY + 3.2);
  
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkText);
  doc.text(safe(plotBank.bank_name, 'SBI'), margin + colW + 13, bY + 6.8);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`A/c: ${maskAccount(plotBank.account_number)}  |  IFSC: ${safe(plotBank.ifsc_code, '—')}`, margin + colW + 13, bY + 10.5);
  doc.text(`Branch: ${safe(plotBank.branch_name, '—')}`, margin + colW + 13, bY + 14);

  bY += 21;

  // Sub-card 2: Dev Charges
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.roundedRect(margin + colW + 10, bY, colW - 8, 17, 1, 1, 'FD');
  
  doc.setFillColor(...COLORS.gold);
  doc.rect(margin + colW + 10, bY, 1, 17, 'F');
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.gold);
  doc.text('DEVELOPMENT CHARGES ACCOUNT', margin + colW + 13, bY + 3.2);
  
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkText);
  doc.text(safe(devBank.bank_name, 'HDFC'), margin + colW + 13, bY + 6.8);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`A/c: ${maskAccount(devBank.account_number)}  |  IFSC: ${safe(devBank.ifsc_code, '—')}`, margin + colW + 13, bY + 10.5);
  doc.text(`Branch: ${safe(devBank.branch_name, '—')}`, margin + colW + 13, bY + 14);

  y += mainCardH + 5;

  // ════════════════════════════════════════════════════════════
  // 6. TERMS & SIGNATURES (Side-by-Side Grid)
  // ════════════════════════════════════════════════════════════
  drawSectionHeader('IMPORTANT TERMS & CONDITIONS', margin, y);
  drawSectionHeader('CONFIRMATION & SIGNATURES', margin + colW + 6, y);
  y += 6;

  const bottomCardH = 34;
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, colW, bottomCardH, 1.5, 1.5, 'FD');
  doc.roundedRect(margin + colW + 6, y, colW, bottomCardH, 1.5, 1.5, 'FD');

  // Left: Terms list
  const terms = [
    'Complete payment within 30 days of booking.',
    'Aadhaar & PAN are mandatory for registration.',
    'Registration charges are borne by the purchaser.',
    'Cancellation charges apply as per company policy.',
    'Delayed payments attract interest @ 18% p.a.',
  ];
  
  let termY = y + 4.5;
  terms.forEach((term) => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.darkText);
    doc.text('•', margin + 4, termY);
    doc.text(term, margin + 7, termY);
    termY += 5.5;
  });

  // Right: Signatures
  let sigY = y + 16;
  const sigLineW = 34;
  const sigLeftX = margin + colW + 11;
  const sigRightX = margin + colW * 2 - sigLineW - 1;

  doc.setDrawColor(...COLORS.darkText);
  doc.setLineWidth(0.25);
  doc.line(sigLeftX, sigY, sigLeftX + sigLineW, sigY);
  doc.line(sigRightX, sigY, sigRightX + sigLineW, sigY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkText);
  doc.text('Customer Signature', sigLeftX + sigLineW / 2, sigY + 4, { align: 'center' });
  doc.text('Authorized Signatory', sigRightX + sigLineW / 2, sigY + 4, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text('Date: ________________', sigLeftX + sigLineW / 2, sigY + 8, { align: 'center' });
  doc.text(`For ${safe(project.builder_name, 'SUJATHA DEVELOPERS')}`, sigRightX + sigLineW / 2, sigY + 8, { align: 'center' });

  // ════════════════════════════════════════════════════════════
  // 7. FOOTER
  // ════════════════════════════════════════════════════════════
  const footerY = pageH - 12;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.grey);
  doc.text('This is a computer-generated booking confirmation and does not require a physical signature.', pageW / 2, footerY, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.text(`${safe(project.builder_name, 'SUJATHA DEVELOPERS')}  |  Contact: ${customerPhone}  |  Ref: ${bookingNumber}`, pageW / 2, footerY + 3.5, { align: 'center' });

  // Gold band at the very bottom
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, pageH - 2.5, pageW, 2.5, 'F');

  // ── Trigger download ──
  const fileName = `Booking_Confirmation_${bookingNumber}.pdf`;
  doc.save(fileName);
};
