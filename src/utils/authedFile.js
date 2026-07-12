// ============================================================
// AUTHENTICATED FILE ACCESS
// The backend no longer hands out presigned S3 URLs — S3-stored files resolve
// to API-relative paths (/files/stream?key=…, /bookings/documents/:id/view)
// that REQUIRE a Bearer token on every fetch. A copied link pasted into
// another tab gets a 401. These helpers fetch the bytes through the
// token-attaching axios instance and open/download the local blob instead.
// Legacy disk files (/uploads/…) and absolute URLs pass straight through.
// ============================================================

import api, { API_URL } from '../api/axiosInstance';

const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

/** API-relative path that needs the auth token (vs legacy /uploads or absolute). */
export const isAuthedApiUrl = (url) =>
  typeof url === 'string' && url.startsWith('/') && !url.startsWith('/uploads');

/** Resolve a legacy (non-API) file URL to something the browser can open. */
export const resolveLegacyHref = (url) =>
  !url ? '' : (/^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`);

/** Fetch an API-served file with the token and return a local blob: URL. */
export async function getAuthedBlobUrl(url) {
  const { data } = await api.get(url, { responseType: 'blob' });
  return URL.createObjectURL(data);
}

/**
 * Open a file in a new tab. Opens the window synchronously (inside the click
 * gesture, so popup blockers allow it), then points it at the fetched blob.
 */
export async function openAuthedFile(url) {
  if (!url) return;
  if (!isAuthedApiUrl(url)) {
    window.open(resolveLegacyHref(url), '_blank', 'noopener');
    return;
  }
  const win = window.open('', '_blank');
  try {
    const blobUrl = await getAuthedBlobUrl(url);
    if (win) win.location = blobUrl;
    else window.open(blobUrl, '_blank');
    // Blob URLs are local to this browser session (unshareable), but revoke
    // fast anyway — the viewer tab loads it from memory within moments, and
    // after this a copied blob: URL is dead even in the same browser.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch (err) {
    if (win) win.close();
    throw err;
  }
}

/** Download a file (attachment disposition) with the auth token. */
export async function downloadAuthedFile(url, name = '') {
  if (!url) return;
  if (!isAuthedApiUrl(url)) {
    const a = document.createElement('a');
    a.href = resolveLegacyHref(url);
    a.download = name || '';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const dl = url.includes('?') ? `${url}&dl=1` : `${url}?dl=1`;
  const blobUrl = await getAuthedBlobUrl(dl);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = name || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
