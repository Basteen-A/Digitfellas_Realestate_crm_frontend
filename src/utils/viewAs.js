// ============================================================
// ROLE WORKSPACES - "view as" state
// A Super Admin / Admin viewing a team member's portal, read-only.
// ============================================================
//
// Held in sessionStorage, not localStorage, on purpose: an impersonation flag
// should die with the tab rather than linger on the machine. The server is the
// authority (see applyViewAs in server/src/middleware/auth.js) - this is only
// what the client needs to send the header and draw the banner.

const KEY = 'recrm_view_as';

export const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/** @returns {{id:string,name:string,roleCode:string,roleName:string}|null} */
export const getViewAs = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.id ? parsed : null;
  } catch {
    return null;
  }
};

export const setViewAs = (target) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(target));
  } catch {
    /* private mode - the header simply won't be sent */
  }
};

export const clearViewAs = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
};

export const isViewingAs = () => getViewAs() !== null;

// Session mechanics always act on the REAL signed-in admin - logging out or
// refreshing a token has nothing to do with the person being viewed, so these
// must not carry the header or be blocked as writes. Mirrors the same list in
// server/src/middleware/auth.js. change-password is intentionally absent: it is
// a write and should be refused like any other while viewing.
export const isSessionPath = (url = '') =>
  /\/auth\/(logout|refresh|login|forgot-password|reset-password)$/.test(String(url).split('?')[0]);
