import { useEffect, useState } from 'react';
import fieldTrackingApi from '../../../api/fieldTrackingApi';
import { drawParcels } from './parcelOverlays';

// ============================================================
// useParcelLayer - every named land parcel, drawn as a context layer on any
// field-tracking map (Dashboard, Live Map, Locations, the pin picker).
//
// Everyone who can see a map sees all the named land. The layer lives in its
// own effect, so a 60-second pin refresh never tears the polygons down.
//
// GOTCHA: call this AFTER the effect that creates mapRef.current. Effects run
// in declaration order within a commit, so calling it earlier finds no map on
// the render where the SDK arrives and the parcels never appear.
//
// fitWhenAlone: frame the parcels when the caller drew nothing of its own
// (e.g. nobody is punched in), instead of leaving a default city view.
// clickable: false on a map whose own click drops a pin, or the polygon eats it.
// ============================================================

const useParcelLayer = (maps, mapRef, {
  hasOwnContent = true, fitWhenAlone = false, ready = true, clickable = true,
} = {}) => {
  const [parcels, setParcels] = useState([]);

  useEffect(() => {
    let alive = true;
    // Optional context: no access or an unmigrated db just means no layer.
    fieldTrackingApi.listParcels()
      .then((r) => { if (alive) setParcels(r.data || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map || !ready || !parcels.length) return undefined;
    const info = clickable ? new maps.InfoWindow() : null;
    const bounds = fitWhenAlone && !hasOwnContent ? new maps.LatLngBounds() : null;
    const overlays = drawParcels(maps, map, parcels, { info, bounds, clickable });
    if (bounds && !bounds.isEmpty()) map.fitBounds(bounds, 60);
    return () => {
      overlays.forEach((o) => o.setMap(null));
      info?.close();
    };
  }, [maps, mapRef, ready, parcels, hasOwnContent, fitWhenAlone, clickable]);

  return parcels;
};

export default useParcelLayer;
