import React, { useEffect, useState } from 'react';
import { getAuthedBlobUrl, isAuthedApiUrl, resolveLegacyHref } from '../utils/authedFile';

// Drop-in <img> replacement for API-served files (thumbnails of uploaded
// images). Plain <img src> can't send an Authorization header, so
// API-relative URLs are fetched through axios and rendered from a blob.
export default function AuthedImage({ src, alt = '', ...rest }) {
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
  if (!finalSrc) return null;
  return <img {...rest} alt={alt} src={finalSrc} />;
}
