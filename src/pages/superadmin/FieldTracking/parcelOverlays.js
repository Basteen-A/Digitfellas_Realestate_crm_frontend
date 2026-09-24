// ============================================================
// Land parcel overlays - shared by the Land Parcels tab and RouteMap.
//
// Each parcel is a filled polygon plus a name label at its centroid. Returns
// the created overlays so the caller can tear them down with setMap(null) on
// its next redraw (Google objects are not React-managed).
// ============================================================

export const PARCEL_COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
export const DEFAULT_PARCEL_COLOR = PARCEL_COLORS[0];
export const SQ_M_PER_ACRE = 4046.8564224;

export const fmtArea = (sqM) => {
  const m = Number(sqM) || 0;
  const acres = m / SQ_M_PER_ACRE;
  return `${acres.toFixed(acres < 10 ? 3 : 2)} acres · ${Math.round(m).toLocaleString('en-IN')} m²`;
};

export const fmtLength = (m) => {
  const v = Number(m) || 0;
  return v < 1000 ? `${v.toFixed(1)} m` : `${(v / 1000).toFixed(2)} km`;
};

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * @param {object} maps       google.maps
 * @param {object} map        the Map
 * @param {Array}  parcels    from GET /field-tracking/land/parcels
 * @param {object} opts       { selectedId, hiddenId, onClick, info (InfoWindow), bounds }
 */
// White names over satellite imagery need a shadow to stay readable.
const ensureLabelStyle = () => {
  if (typeof document === 'undefined' || document.getElementById('land-parcel-label-style')) return;
  const style = document.createElement('style');
  style.id = 'land-parcel-label-style';
  style.textContent = '.land-parcel-label{text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.9);}';
  document.head.appendChild(style);
};

export const drawParcels = (maps, map, parcels = [], opts = {}) => {
  ensureLabelStyle();
  const { selectedId = null, hiddenId = null, onClick = null, info = null, bounds = null } = opts;
  const overlays = [];

  parcels.forEach((p) => {
    // The parcel being edited is drawn by the editor itself, not twice.
    if (p.id === hiddenId || !Array.isArray(p.boundary) || p.boundary.length < 3) return;
    const color = p.color || DEFAULT_PARCEL_COLOR;
    const on = p.id === selectedId;

    const poly = new maps.Polygon({
      map,
      paths: p.boundary,
      strokeColor: color,
      strokeOpacity: 0.95,
      strokeWeight: on ? 3 : 2,
      fillColor: color,
      fillOpacity: on ? 0.32 : 0.18,
      zIndex: on ? 20 : 10,
    });

    const label = new maps.Marker({
      map,
      position: p.centroid,
      icon: { path: maps.SymbolPath.CIRCLE, scale: 0 },
      label: {
        text: p.name,
        color: '#fff',
        fontSize: '12px',
        fontWeight: '700',
        className: 'land-parcel-label',
      },
      clickable: false,
      zIndex: 30,
    });

    poly.addListener('click', (e) => {
      if (onClick) onClick(p);
      if (info) {
        info.setContent(`
          <div style="font-family:inherit;min-width:200px;max-width:280px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${escapeHtml(p.name)}</div>
            <div style="font-size:12px;color:#555">${escapeHtml(fmtArea(p.areaSqM))}</div>
            <div style="font-size:12px;color:#555">Perimeter ${escapeHtml(fmtLength(p.perimeterM))} · ${p.vertexCount} corners</div>
            ${p.surveyNumber ? `<div style="font-size:12px;color:#555;margin-top:4px">Survey No. ${escapeHtml(p.surveyNumber)}${p.surveyAreaAcres != null ? ` · ${escapeHtml(p.surveyAreaAcres)} acres on document` : ''}</div>` : ''}
            ${p.description ? `<div style="font-size:12px;color:#555;margin-top:4px">${escapeHtml(p.description)}</div>` : ''}
            ${p.createdByName ? `<div style="font-size:11px;color:#888;margin-top:6px">Drawn by ${escapeHtml(p.createdByName)}</div>` : ''}
          </div>`);
        info.setPosition(e.latLng);
        info.open({ map });
      }
    });

    overlays.push(poly, label);
    if (bounds) p.boundary.forEach((pt) => bounds.extend(pt));
  });

  return overlays;
};
