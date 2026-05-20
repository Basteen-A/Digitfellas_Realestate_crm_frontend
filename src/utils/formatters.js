const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const formatDate = (value, locale = 'en-IN') => {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (value, locale = 'en-IN') => {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatDateTimeInTimeZone = (value, locale = 'en-IN', timeZone = 'Asia/Kolkata') => {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date);
};

export const formatCurrency = (value, currency = 'INR', locale = 'en-IN') => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';

  const absNum = Math.abs(num);
  const prefix = num < 0 ? '-' : '';
  const symbol = currency === 'INR' ? '₹' : '';

  if (absNum >= 10000000) { // 1 Crore = 10,000,000
    const crValue = absNum / 10000000;
    return `${symbol}${prefix}${crValue.toFixed(2)} Cr`;
  } else if (absNum >= 10000) { // More than 4 digits (>= 10,000)
    const lValue = absNum / 100000; // 1 Lakh = 100,000
    return `${symbol}${prefix}${lValue.toFixed(2)} L`;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatNumber = (value, locale = 'en-IN') => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat(locale).format(num);
};

export const formatPercent = (value, digits = 1, locale = 'en-IN') => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(num / 100);
};

export const formatPhone = (value) => {
  const raw = String(value || '').replace(/\D/g, '');
  if (!raw) return '-';
  if (raw.length === 10) return `${raw.slice(0, 5)} ${raw.slice(5)}`;
  return value;
};

export const formatName = (firstName, lastName) => {
  const full = `${firstName || ''} ${lastName || ''}`.trim();
  return full || '-';
};

export const formatBoolean = (value) => (value ? 'Yes' : 'No');
