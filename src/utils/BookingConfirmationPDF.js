// ============================================================
// UTILITY: Booking Confirmation PDF Generator
// Generates a corporate-grade, 3-page A4 PDF confirmation.
// Uses jspdf — entirely client-side, no server dependency.
// ============================================================

import { jsPDF } from 'jspdf';

/* ── Colour palette (Greyscale / Black & White) ── */
const COLORS = {
  gold: [0, 0, 0],             // pure black
  darkBg: [0, 0, 0],           // pure black
  white: [255, 255, 255],      // white
  black: [0, 0, 0],            // black
  grey: [100, 100, 100],        // grey
  lightGrey: [220, 220, 220],   // light grey border
  veryLightGrey: [248, 248, 248], // warm card background
  green: [0, 0, 0],            // black
  mutedText: [120, 120, 120],   // grey
  darkText: [0, 0, 0],         // black
};

/* ── Number → Indian words ── */
const numberToWords = (num) => {
  if (num === 0) return 'Zero Rupees Only';
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

/* ── Bank Name mapping from IFSC prefix ── */
const getBankNameFromIFSC = (ifsc) => {
  if (!ifsc) return '—';
  const prefix = ifsc.substring(0, 4).toUpperCase();
  const mapping = {
    'KVBL': 'KARUR VYSYA BANK',
    'ICIC': 'ICICI BANK',
    'KKBK': 'KOTAK MAHINDRA BANK',
    'IDFB': 'IDFC FIRST BANK',
    'CIUB': 'CITY UNION BANK',
    'SBIN': 'STATE BANK OF INDIA',
    'UBIN': 'UNION BANK OF INDIA',
    'IDIB': 'INDIAN BANK',
    'IOBA': 'INDIAN OVERSEAS BANK',
    'HDFC': 'HDFC BANK',
    'BARB': 'BANK OF BARODA',
    'PUNB': 'PUNJAB NATIONAL BANK',
    'CNRB': 'CANARA BANK',
  };
  return mapping[prefix] || 'BANK';
};

/* ── Main export ── */
export const generateBookingConfirmationPDF = (booking, plotBankParam, devBankParam, termsParam) => {
  if (!booking) return;

  // Unpack bank details
  const plotBank = plotBankParam || {};
  const devBank = devBankParam || {};

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();  // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const margin = 12;
  const contentW = pageW - margin * 2; // 186

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


  const customerPhone = safe(customer.phone, '—');
  const pan = customer.pan_number ? customer.pan_number.trim() : '';
  const aadhaar = customer.aadhar_number ? customer.aadhar_number.trim() : '';

  // Customer Address
  const addressParts = [
    customer.address_line_1,
    customer.address_line_2,
    customer.city,
    customer.state,
    customer.pincode
  ].filter(Boolean);
  const customerAddress = addressParts.length > 0 ? addressParts.join(', ') : '—';


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

  const bookingNumber = safe(booking.booking_number, 'UNKNOWN');
  const bookingDate = booking.booking_date ? new Date(booking.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // Section Header helper
  const drawSectionHeader = (title, x, targetY) => {
    doc.setFillColor(...COLORS.black);
    doc.rect(x, targetY, 1.5, 5, 'F');
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, x + 3.5, targetY + 3.8);
  };

  // Footer helper
  const drawFooter = (pageNo) => {
    const footerY = pageH - 12;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.grey);
    doc.text('This is a computer-generated booking confirmation and does not require a physical signature.', pageW / 2, footerY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Contact: ${customerPhone}  |  Ref: ${bookingNumber}  |  Page ${pageNo} of 3`, pageW / 2, footerY + 4.5, { align: 'center' });
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 5, pageW - margin, pageH - 5);
  };

  // ============================================================
  // PAGE 1: CONFIRMATION DETAILS & JOURNEY TRACKER
  // ============================================================
  // Start from top, leaving 45mm empty header space for letterhead
  let y = 45;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('BOOKING CONFIRMATION', pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Ref: ${bookingNumber}  |  Date: ${bookingDate}`, pageW / 2, y, { align: 'center' });
  y += 6;

  // Thin elegant separator line
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Welcome Banner (greyscale)
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentW, 25, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLORS.black);
  doc.rect(margin, y, 1.5, 25, 'F');

  doc.setTextColor(...COLORS.black);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`Dear ${displayBuyerName},`, margin + 5, y + 7.5);

  doc.setTextColor(...COLORS.black);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  
  const bannerText = `We are pleased to confirm your booking for Plot No. ${plotNo} at ${projectName}. The booking details are summarized below.`;
  const bannerLines = doc.splitTextToSize(bannerText, contentW - 10);
  bannerLines.forEach((line, idx) => {
    doc.text(line, margin + 5, y + 14 + (idx * 5));
  });

  y += 25 + 10;

  // Property & Purchaser details side by side
  const colW = (contentW - 6) / 2; // 90mm

  drawSectionHeader('PROPERTY DETAILS', margin, y);
  drawSectionHeader('CUSTOMER DETAILS', margin + colW + 6, y);
  y += 7;

  // Cards (height increased to 78 for larger fonts/extra details)
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, colW, 78, 1.5, 1.5, 'FD');
  doc.roundedRect(margin + colW + 6, y, colW, 78, 1.5, 1.5, 'FD');

  // Property details
  let pY = y + 6.5;
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const displayProjectName = (phaseName && !projectName.toLowerCase().includes(phaseName.toLowerCase()))
    ? `${projectName} ${phaseName}`
    : projectName;
  doc.text(displayProjectName, margin + 5, pY);
  pY += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  
  // Location from project with full address details
  const locationName = safe(project.location?.location_name || booking.project?.location?.location_name || project.location?.name, '—');
  const stateName = safe(project.location?.state || booking.project?.location?.state, '');
  const fullLocation = [locationName, stateName].filter(Boolean).join(', ');
  const projectAddress = safe(project.address, '');
  
  doc.text(`Plot Number: ${plotNo}`, margin + 5, pY);
  pY += 6;
  doc.text(`Location: ${fullLocation}`, margin + 5, pY);
  pY += 6;
  if (projectAddress) {
    const addrLines = doc.splitTextToSize(`Address: ${projectAddress}`, colW - 10);
    addrLines.forEach((line) => {
      doc.text(line, margin + 5, pY);
      pY += 5;
    });
  }
  doc.text(`Area / Extent: ${area} ${areaUnit}`, margin + 5, pY);
  pY += 6;
  doc.text(`Facing: ${facing !== '—' ? `${facing} Facing` : '—'}`, margin + 5, pY);

  // Purchaser/Customer details - COMPLETE
  let uY = y + 6.5;
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(buyerName, margin + colW + 11, uY);
  uY += 7;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);

  // Gender & Relation
  const rType = safe(booking.relation_type || customer.relation_type, '');
  const rName = safe(booking.relation_name || customer.relation_name, '');
  if (rType && rName) {
    doc.text(`Relation: ${rType.toUpperCase()} ${rName}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  // Contact Information
  if (customerPhone && customerPhone !== '—') {
    doc.text(`Phone: ${customerPhone}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  const alternatePhone = safe(customer.alternate_phone, '');
  if (alternatePhone) {
    doc.text(`Alt. Phone: ${alternatePhone}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  const whatsappNumber = safe(customer.whatsapp_number, '');
  if (whatsappNumber) {
    doc.text(`WhatsApp: ${whatsappNumber}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  const customerEmail = safe(customer.email, '');
  if (customerEmail) {
    doc.text(`Email: ${customerEmail}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  // Personal Details
  const dobVal = customer.date_of_birth;
  const dobFormatted = dobVal 
    ? new Date(dobVal).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : '';
  if (dobFormatted) {
    doc.text(`DOB: ${dobFormatted}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  if (customer.gender) {
    doc.text(`Gender: ${customer.gender}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  // Identity Documents
  if (pan) {
    doc.text(`PAN: ${pan}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  if (aadhaar) {
    doc.text(`Aadhaar: ${aadhaar}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  const gstNumber = safe(customer.gst_number, '');
  if (gstNumber) {
    doc.text(`GST: ${gstNumber}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  // Professional Details
  if (customer.occupation) {
    doc.text(`Occupation: ${customer.occupation}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  const companyName = safe(customer.company_name, '');
  if (companyName) {
    doc.text(`Company: ${companyName}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  const designation = safe(customer.designation, '');
  if (designation) {
    doc.text(`Designation: ${designation}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  const annualIncome = safe(customer.annual_income, '');
  if (annualIncome) {
    doc.text(`Annual Income: ${fmtINR(annualIncome)}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  if (customer.marital_status) {
    doc.text(`Marital Status: ${customer.marital_status}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  const purchaseType = safe(booking.purchase_type || customer.purchase_type, '');
  if (purchaseType) {
    doc.text(`Purchase Type: ${purchaseType}`, margin + colW + 11, uY);
    uY += 5.2;
  }
  
  // Address Information
  if (customerAddress && customerAddress !== '—') {
    const addrLines = doc.splitTextToSize(`Address: ${customerAddress}`, colW - 14);
    addrLines.slice(0, 3).forEach((line) => {
      doc.text(line, margin + colW + 11, uY);
      uY += 4.8;
    });
  }
  
  // Permanent Address if different
  const permAddressParts = [
    customer.perm_address_line_1,
    customer.perm_address_line_2,
    customer.perm_city,
    customer.perm_state,
    customer.perm_pincode
  ].filter(Boolean);
  if (permAddressParts.length > 0 && permAddressParts.join(', ') !== customerAddress) {
    const permAddrLines = doc.splitTextToSize(`Perm. Address: ${permAddressParts.join(', ')}`, colW - 14);
    permAddrLines.slice(0, 2).forEach((line) => {
      doc.text(line, margin + colW + 11, uY);
      uY += 4.8;
    });
  }
  
  y += 78 + 10;

  // Journey Tracker Card
  drawSectionHeader('YOUR JOURNEY STATUS', margin, y);
  y += 7;

  doc.setFillColor(...COLORS.veryLightGrey);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentW, 20, 1.5, 1.5, 'FD');

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
  const circleR = 3.5;
  const stepY = y + 7;

  steps.forEach((step, i) => {
    const cx = margin + stepW * i + stepW / 2;
    const isActive = i <= activeIdx;

    if (i > 0) {
      const prevCx = margin + stepW * (i - 1) + stepW / 2;
      doc.setDrawColor(...(i <= activeIdx ? COLORS.black : COLORS.lightGrey));
      doc.setLineWidth(0.75);
      doc.line(prevCx + circleR + 1, stepY, cx - circleR - 1, stepY);
    }

    if (isActive) {
      doc.setFillColor(...COLORS.black);
      doc.circle(cx, stepY, circleR, 'F');
    } else {
      doc.setDrawColor(...COLORS.lightGrey);
      doc.setFillColor(...COLORS.white);
      doc.circle(cx, stepY, circleR, 'FD');
    }

    doc.setTextColor(...(isActive ? COLORS.black : COLORS.mutedText));
    doc.setFontSize(8.5);
    doc.setFont('helvetica', isActive ? 'bold' : 'normal');
    doc.text(step.label, cx, stepY + circleR + 6, { align: 'center' });
  });

  drawFooter(1);

  // ============================================================
  // PAGE 2: DETAILED COST BREAKDOWN
  // ============================================================
  doc.addPage();
  y = 45;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('DETAILED COST BREAKDOWN', pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Ref: ${bookingNumber}  |  Date: ${bookingDate}`, pageW / 2, y, { align: 'center' });
  y += 6;

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Cost table setup
  let tableY = y;
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.rect(margin, tableY, contentW, 8, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('Cost Description', margin + 4, tableY + 5.5);
  doc.text('Rate, Details & Words Description', margin + 65, tableY + 5.5);
  doc.text('Amount (INR)', pageW - margin - 4, tableY + 5.5, { align: 'right' });
  
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.line(margin, tableY + 8, pageW - margin, tableY + 8);
  tableY += 9;

  const drawRow = (label, details, amount, isBold = false) => {
    // Label and amount font sizes
    doc.setFontSize(11);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(...COLORS.black);
    doc.text(label, margin + 4, tableY + 5);
    
    // Details (with words) font size
    doc.setFontSize(9.5);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const words = numberToWords(amount);
    const combinedDetails = details ? `${details}\n(${words})` : `(${words})`;
    const wrappedDetails = doc.splitTextToSize(combinedDetails, 90);
    doc.text(wrappedDetails, margin + 65, tableY + 5);
    
    // Amount
    doc.setFontSize(11);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(fmtINR(amount), pageW - margin - 4, tableY + 5, { align: 'right' });
    
    const rowH = Math.max(wrappedDetails.length * 4.8, 7.5);
    doc.setDrawColor(...COLORS.lightGrey);
    doc.setLineWidth(0.2);
    doc.line(margin, tableY + rowH + 1, pageW - margin, tableY + rowH + 1);
    tableY += rowH + 2.5;
  };

  // Row 1: Plot Value
  drawRow('Plot Value (Land)', `Guideline Rate: ${fmtINR(guidelineRate)} / sq.ft`, plotValue);
  
  // Row 2: Development Charges splits
  const baseDev = (perSqftCost > 0 && plotAreaSqft > 0)
    ? Math.round(plotAreaSqft * perSqftCost * 100) / 100
    : Math.round(developmentValue / 1.18 * 100) / 100;
  const devGst = developmentValue - baseDev;
  drawRow('Development Charges (Base)', `${plotAreaSqft} sq.ft @ ${fmtINR(perSqftCost)} / sq.ft`, baseDev);
  drawRow('Development GST (18%)', '18% GST on Development charges', devGst);
  drawRow('Development Charges (Total)', 'Inclusive of GST', developmentValue, true);

  // Documentation Splits
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.rect(margin, tableY, contentW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Documentation & Registration Expenses', margin + 4, tableY + 4.8);
  tableY += 8;

  const savedRegSplit = costBreakdown.registration_split || {};
  drawRow('  Stamp Value (7%)', '7% of Guideline value', stampValue);
  drawRow('  Stamp Commission', 'Revenue stamp processing fee', toAmt(savedRegSplit.stamp_commission));
  drawRow('  Registration Fees (2%)', '2% of Guideline value', registrationValue);
  drawRow('  Online / Portal / CD Fees', 'Computer & portal submission fees', toAmt(savedRegSplit.registration_expenses));
  drawRow('  Writer Charges', 'Legal documentation writing charges', toAmt(savedRegSplit.writer_expenses));
  drawRow('  Patta Transfer Charges', 'Revenue record transfer processing fees', toAmt(savedRegSplit.patta_charges));
  drawRow('  Other Registration Expenses', 'Miscellaneous registration split', toAmt(savedRegSplit.other_registration_expenses));

  // MODT Splits
  if (costBreakdown.modt_enabled) {
    doc.setFillColor(...COLORS.veryLightGrey);
    doc.rect(margin, tableY, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('MODT Charges Split', margin + 4, tableY + 4.8);
    tableY += 8;

    const savedModtSplit = costBreakdown.modt_split || {};
    drawRow('  MODT Stamp Duty', 'MODT stamp processing', toAmt(savedModtSplit.stamp_duty));
    drawRow('  MODT Registration Fees', 'MODT registration commission', toAmt(savedModtSplit.registration_fees));
    drawRow('  MODT Stamp Commission', 'MODT stamp agent fees', toAmt(savedModtSplit.stamp_commission));
    drawRow('  MODT Registration Expenses', 'MODT portal processing charges', toAmt(savedModtSplit.registration_expenses));
    drawRow('  MODT Writer Expenses', 'MODT document authoring fees', toAmt(savedModtSplit.writer_expenses));
  }

  if (toAmt(booking.other_charges) > 0) {
    drawRow('Other Charges', 'Other miscellaneous charges', toAmt(booking.other_charges));
  }

  // Draw double line for total
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.line(margin, tableY + 1, pageW - margin, tableY + 1);
  tableY += 3.5;

  // Grand Total Row
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('TOTAL INVESTMENT (NET)', margin + 4, tableY + 1.2);
  doc.text(fmtINR(totalInvestment), pageW - margin - 4, tableY + 1.2, { align: 'right' });
  tableY += 9.5;

  // Words for grand total
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(numberToWords(totalInvestment), margin + 4, tableY);
  tableY += 12;

  drawFooter(2);

  // ============================================================
  // PAGE 3: BANK DETAILS, TERMS & CONDITIONS & SIGNATURES
  // ============================================================
  doc.addPage();
  y = 45;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('BANK PAYMENT INFORMATION', pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Ref: ${bookingNumber}  |  Date: ${bookingDate}`, pageW / 2, y, { align: 'center' });
  y += 6;

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Bank Info Cards (height adjusted to 38 for tight fitting)
  doc.setFillColor(...COLORS.veryLightGrey);
  doc.setDrawColor(...COLORS.lightGrey);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, colW, 38, 1.5, 1.5, 'FD');
  doc.roundedRect(margin + colW + 6, y, colW, 38, 1.5, 1.5, 'FD');

  doc.setFillColor(...COLORS.black);
  doc.rect(margin, y, 1, 38, 'F');
  doc.rect(margin + colW + 6, y, 1, 38, 'F');

  // Left card: Plot Amount Account
  let bY = y + 5;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('PLOT AMOUNT ACCOUNT', margin + 5, bY);
  bY += 6;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`A/c Name: `, margin + 5, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(safe(plotBank.bank_name, '—'), margin + 24, bY);
  bY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`A/c Number: `, margin + 5, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(safe(plotBank.account_number, '—'), margin + 24, bY);
  bY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Bank Name: `, margin + 5, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(getBankNameFromIFSC(plotBank.ifsc_code), margin + 24, bY);
  bY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`IFSC Code: `, margin + 5, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(safe(plotBank.ifsc_code, '—'), margin + 24, bY);
  bY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Branch: `, margin + 5, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(safe(plotBank.branch_name, '—'), margin + 24, bY);

  // Right card: Dev Amount Account
  bY = y + 5;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('DEVELOPMENT CHARGES ACCOUNT', margin + colW + 11, bY);
  bY += 6;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`A/c Name: `, margin + colW + 11, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(safe(devBank.bank_name, '—'), margin + colW + 30, bY);
  bY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`A/c Number: `, margin + colW + 11, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(safe(devBank.account_number, '—'), margin + colW + 30, bY);
  bY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Bank Name: `, margin + colW + 11, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(getBankNameFromIFSC(devBank.ifsc_code), margin + colW + 30, bY);
  bY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`IFSC Code: `, margin + colW + 11, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(safe(devBank.ifsc_code, '—'), margin + colW + 30, bY);
  bY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text(`Branch: `, margin + colW + 11, bY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text(safe(devBank.branch_name, '—'), margin + colW + 30, bY);

  y += 38 + 8;

  // Terms and conditions header
  doc.setFillColor(...COLORS.black);
  doc.rect(margin, y, 1.5, 5, 'F');
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMS & CONDITIONS', margin + 3.5, y + 3.8);
  
  y += 8;

  // Dynamic terms & conditions
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
    'In case the buyer fails to make the payment as per the agreed terms, an interest of 18% per annum shall be levied on the outstanding amount for the total tenure of the delay'
  ];

  const terms = (termsParam && termsParam.length > 0)
    ? termsParam.map(t => t.content)
    : defaultTerms;

  let termY = y;
  const totalLength = terms.reduce((sum, t) => sum + (t?.length || 0), 0);
  const useCompact = terms.length > 10 || totalLength > 1000;
  const fontSize = useCompact ? 8.5 : 9.5;
  const lineSpacing = useCompact ? 4.5 : 5.2;
  const paragraphSpacing = useCompact ? 1.5 : 2.5;
  const termContentWidth = contentW - 14;

  terms.forEach((term, idx) => {
    // Check if we need to add a new page for terms
    if (termY > pageH - 60) {
      doc.addPage();
      termY = 20;
      // Redraw header on new page
      doc.setFillColor(...COLORS.black);
      doc.rect(margin, termY, 1.5, 5, 'F');
      doc.setTextColor(...COLORS.black);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TERMS & CONDITIONS (continued)', margin + 3.5, termY + 3.8);
      termY += 12;
    }

    // Clean term text - remove HTML tags and decode entities
    let termText = safe(term, '');
    if (!termText) return;
    
    // Remove HTML tags
    termText = termText.replace(/<[^>]+>/g, ' ');
    // Replace HTML entities
    termText = termText.replace(/&nbsp;/g, ' ')
                       .replace(/&amp;/g, '&')
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
                       .replace(/&quot;/g, '"')
                       .replace(/&#39;/g, "'")
                       .replace(/&rsquo;/g, "'")
                       .replace(/&lsquo;/g, "'")
                       .replace(/&rdquo;/g, '"')
                       .replace(/&ldquo;/g, '"')
                       .replace(/&ndash;/g, '-')
                       .replace(/&mdash;/g, '-')
                       .replace(/&hellip;/g, '...')
                       .replace(/&bull;|&#8226;/g, '-');
    // Normalize raw Unicode typography to ASCII. jsPDF's standard Helvetica is
    // WinAnsi-encoded: any character outside that set (fancy bullets like
    // U+25CF/U+25AA, the Rupee sign, etc.) flips the ENTIRE text run into a
    // broken 2-byte fallback that renders as garbage (e.g. "%I") AND scrambles
    // the surrounding words. Map the common offenders, then drop anything still
    // outside the Latin-1 range as a final guard so a stray glyph can never
    // corrupt a whole term again.
    termText = termText
      .replace(/[‘’‚‛]/g, "'")   // smart single quotes -> '
      .replace(/[“”„‟]/g, '"')   // smart double quotes -> "
      .replace(/[–—―]/g, '-')         // en/em dashes -> -
      .replace(/…/g, '...')                     // ellipsis -> ...
      .replace(/[•‣⁃⁌⁍∙▪●○◦‧․·]/g, '-') // bullets / mid-dots -> -
      .replace(/₹/g, 'Rs.')                     // rupee sign -> Rs.
      .replace(/[  -   　]/g, ' ') // unicode spaces -> space
      .replace(/[​-‍﻿­]/g, '')   // zero-width / soft hyphen -> drop
      .trim();
    // Final guard: drop anything above the Latin-1 (WinAnsi) range so a stray glyph
    // can never flip the whole run into jsPDF's broken 2-byte fallback. Done by code
    // point (not regex) to stay ASCII-only and handle astral characters correctly.
    termText = Array.from(termText).filter((ch) => ch.codePointAt(0) <= 0xFF).join('');
    // Replace multiple spaces with single space
    termText = termText.replace(/\s+/g, ' ').trim();
    // Drop a leading bullet/dash artifact so numbered terms read cleanly
    termText = termText.replace(/^[\s-]+/, '').trim();

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text(`${idx + 1}.`, margin, termY + 3);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.black);
    const lines = doc.splitTextToSize(termText, termContentWidth);
    lines.forEach((line) => {
      doc.text(line, margin + 7, termY + 3);
      termY += lineSpacing;
    });
    termY += paragraphSpacing;
  });

  // Ensure we have room for signatures
  if (termY > pageH - 50) {
    doc.addPage();
    drawFooter(4);
    termY = 20;
  }

  // Signatures block positioned securely at the bottom
  let sigY = pageH - 40;
  const sigLineW = 45;
  const sigLeftX = margin + 10;
  const sigRightX = pageW - margin - sigLineW - 10;

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.4);
  doc.line(sigLeftX, sigY, sigLeftX + sigLineW, sigY);
  doc.line(sigRightX, sigY, sigRightX + sigLineW, sigY);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('Customer Signature', sigLeftX + sigLineW / 2, sigY + 5.5, { align: 'center' });
  doc.text('Authorized Signatory', sigRightX + sigLineW / 2, sigY + 5.5, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.grey);
  doc.text('Date: ________________', sigLeftX + sigLineW / 2, sigY + 10.5, { align: 'center' });
  doc.text('For Company', sigRightX + sigLineW / 2, sigY + 10.5, { align: 'center' });

  drawFooter(3);

  // ── Trigger download ──
  const fileName = `Booking_Confirmation_${bookingNumber}.pdf`;
  doc.save(fileName);
};