import React, { useEffect, useState } from 'react';
import { getAuthedBlobUrl, isAuthedApiUrl, resolveLegacyHref } from '../utils/authedFile';

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
  return <audio {...rest} src={finalSrc || undefined} />;
}
