import { formatDateTime } from './formatters';

const inBrowser = typeof window !== 'undefined';

const createBlobAndDownload = (content, mimeType, fileName) => {
  if (!inBrowser) return false;

  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  return true;
};

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const toCsv = (rows = [], columns = null) => {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const selectedColumns = columns || Object.keys(rows[0]);
  const header = selectedColumns.join(',');
  const lines = rows.map((row) =>
    selectedColumns.map((column) => escapeCsv(row[column])).join(',')
  );

  return [header, ...lines].join('\n');
};

export const exportCsv = (rows = [], options = {}) => {
  const { columns = null, fileName = `export_${Date.now()}.csv` } = options;
  const csv = toCsv(rows, columns);
  if (!csv) return false;
  return createBlobAndDownload(csv, 'text/csv;charset=utf-8;', fileName);
};

export const exportJson = (data, fileName = `export_${Date.now()}.json`) => {
  const json = JSON.stringify(data ?? {}, null, 2);
  return createBlobAndDownload(json, 'application/json;charset=utf-8;', fileName);
};

export const buildDefaultExportName = (prefix = 'export') => {
  const timestamp = formatDateTime(new Date()).replace(/[,:\s]/g, '-');
  return `${prefix}_${timestamp}`;
};
