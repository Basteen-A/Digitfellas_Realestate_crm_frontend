import React, { useEffect, useState } from 'react';
import { getAuthedBlobUrl, isAuthedApiUrl, resolveLegacyHref } from '../utils/authedFile';

// Attributes that strip the browser's own download affordance from an <audio>
// element. Chrome/Edge put "Download" behind the ⋮ overflow menu on the native
// player; `controlsList="nodownload"` removes it, and blocking the context menu
// removes the right-click route to the same thing.
//
// Call recordings and voice notes are customer records - they are meant to be
// LISTENED to inside the CRM, not saved to a laptop - so this applies to every
// audio element in the app, not just the authenticated ones. Raw <audio> tags
// (local blob previews, which cannot go through AuthedAudio) spread this too.
//
// Not a security control: the audio still streams over the wire, so anyone
// determined can capture it. It removes the one-click invitation, nothing more.
export const NO_DOWNLOAD_AUDIO_PROPS = {
  controlsList: 'nodownload noplaybackrate',
  disablePictureInPicture: true,
  onContextMenu: (e) => e.preventDefault(),
};

// Drop-in <audio> replacement for API-served voice clips. A plain <audio src>
// can't send an Authorization header, so API-relative clip URLs are fetched
// through axios (token attached) and played from a local blob. Legacy
// /uploads and absolute URLs pass straight through.
export default function AuthedAudio({ src, ...rest }) {
  const needsAuth = isAuthedApiUrl(src);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!needsAuth || !src) return undefined;
    let alive = true;
    let created = null;
    getAuthedBlobUrl(src)
      .then((u) => {
        if (alive) { created = u; setBlobUrl(u); }
        else URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
      setBlobUrl(null);
    };
  }, [src, needsAuth]);

  const finalSrc = needsAuth ? blobUrl : (src ? resolveLegacyHref(src) : null);
  // Spread the caller's props LAST so an explicit override still wins.
  return <audio {...NO_DOWNLOAD_AUDIO_PROPS} {...rest} src={finalSrc || undefined} />;
}
