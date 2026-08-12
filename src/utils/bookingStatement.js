// ============================================================
// Statement of Account - fetch + open in a browser tab
// ============================================================
// The statement is rendered by the server (GET /bookings/:id/statement-pdf) and
// returned inline; nothing is ever stored, so each open is freshly generated from
// the booking and its payments as they stand right now.
//
// Two details this helper exists for:
//
//  1. AUTH. The API only accepts a Bearer header (there is no `?token=` fallback
//     anywhere in this app), so a plain window.open of the URL would 401. The PDF
//     has to come back through the authenticated axios client as a blob.
//
//  2. POPUP BLOCKING. window.open only survives if it is called inside the click's
//     user-gesture window - and the fetch above is async. So the tab is opened
//     FIRST, synchronously, and pointed at the blob once it arrives. If the browser
//     blocked it anyway, we fall back to a download so the statement is never lost.

import bookingApi from '../api/bookingApi';

/** An error response arrives as a Blob when responseType is 'blob' - dig the message out. */
const messageFromBlobError = async (error, fallback) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed?.message) return parsed.message;
    } catch {
      /* not JSON - fall through */
    }
  }
  return error?.response?.data?.message || error?.message || fallback;
};

/**
 * Fetch a booking's Statement of Account and show it in a new tab.
 *
 * MUST be called directly from a click handler, or the popup is blocked.
 *
 * @param {string} bookingId
 * @param {object} options
 * @param {string} options.bookingNumber Used for the download filename fallback.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export const openBookingStatement = async (bookingId, { bookingNumber } = {}) => {
  if (!bookingId) return { ok: false, error: 'No booking selected.' };

  // Claim the tab now, while the user gesture is still live.
  const tab = window.open('', '_blank');
  if (tab) {
    tab.document.write(
      '<title>Statement of Account</title>'
      + '<body style="margin:0;font:14px system-ui,-apple-system,Segoe UI,sans-serif;color:#475569;'
      + 'display:flex;align-items:center;justify-content:center;height:100vh">'
      + 'Preparing the statement of account…</body>'
    );
    tab.document.close();
  }

  let blobUrl = '';
  try {
    const response = await bookingApi.getStatementPdf(bookingId);
    blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  } catch (error) {
    if (tab) tab.close();
    return { ok: false, error: await messageFromBlobError(error, 'Failed to generate the statement of account') };
  }

  if (tab && !tab.closed) {
    tab.location.href = blobUrl;
  } else {
    // Popup blocked (or the user closed the tab) - hand over a file instead of
    // silently dropping a document the user asked for.
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Statement_of_Account_${(bookingNumber || bookingId).replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // Revoke late - the tab still has to load the blob.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return { ok: true };
};

export default openBookingStatement;
