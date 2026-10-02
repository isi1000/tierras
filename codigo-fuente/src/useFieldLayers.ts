import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import type { MapSources } from './lib/mapSources';
import { lookupHeritage, PROTECTION_SOURCES, protectionTileUrl, type HeritageSite } from './lib/fieldSites';

export function useFieldLayers({ map, library, ready, sources, onHeritage }: { map: Leaflet.Map | null; library: typeof Leaflet | null; ready: boolean; sources: MapSources; onHeritage: (site: HeritageSite) => void }) {
  const [sites, setSites] = useState<HeritageSite[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [zoomHint, setZoomHint] = useState(false), [truncated, setTruncated] = useState(false), [retry, setRetry] = useState(0), [protectionError, setProtectionError] = useState(false);
  const callback = useRef(onHeritage); callback.current = onHeritage;
  const protectedLayers = useRef<Leaflet.TileLayer[]>([]);
  useEffect(() => {
    if (!map || !ready || !sources.ielig) { setSites([]); setBusy(false); setError(''); return; }
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
    async function load() {
      if (disposed || !map || !map.getContainer().clientWidth) return;
      controller = new AbortController(); const request = controller;
      const smallZoom = map.getZoom() < 8; setZoomHint(smallZoom); setSites([]); setError(''); setTruncated(false);
      if (smallZoom) { setBusy(false); return; }
      const bounds = map.getBounds();
      try {
        const result = await lookupHeritage({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() }, request.signal);
        if (!disposed && !request.signal.aborted) { setSites(result.sites); setTruncated(result.truncated); }
      } catch { if (!disposed && !request.signal.aborted) setError('IELIG no responde ahora. Puedes reintentar.'); }
      finally { if (!disposed && !request.signal.aborted) setBusy(false); }
    }
    function schedule() { clearTimeout(timer); controller?.abort(); setBusy(true); timer = setTimeout(() => void load(), 350); }
    map.on('moveend resize', schedule); schedule();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); map.off('moveend resize', schedule); };
  }, [map, ready, sources.ielig, retry]);
  useEffect(() => {
    if (!map || !library || !ready || !sources.ielig) return;
    const group = library.layerGroup().addTo(map), renderer = library.canvas({ padding: .3 });
    for (const site of sites) {
      if (site.rings.length && site.rings.flat().length <= 20000) {
        const polygon = library.polygon(site.rings.map(ring => ring.map(([lng, lat]) => [lat, lng] as [number, number])), { color: '#78569a', weight: 2, fillColor: '#78569a', fillOpacity: .08, renderer }).addTo(group);
        const tooltip = document.createElement('span'); tooltip.textContent = `${site.code} · ${site.name}`; polygon.bindTooltip(tooltip); polygon.on('click', () => callback.current(site));
      }
      const marker = library.marker([site.lat, site.lng], { title: `IELIG · ${site.code} · ${site.name}`, icon: library.divIcon({ className: 'heritage-marker-wrap', html: '<span class="heritage-marker"></span>', iconSize: [30, 30], iconAnchor: [15, 15] }), keyboard: true }).addTo(group);
      marker.on('click', () => callback.current(site));
    }
    return () => { group.remove(); renderer.remove(); };
  }, [map, library, ready, sites, sources.ielig]);
  useEffect(() => {
    if (!map || !library || !ready || !sources.protected) { setProtectionError(false); return; }
    setProtectionError(false);
    const failed = new Set<string>();
    const layers = PROTECTION_SOURCES.map(source => {
      const layer = library.tileLayer('', { opacity: sources.protectedOpacity, maxZoom: 19, zIndex: 8, bounds: [[37.8, -5.9], [41.7, -.6]], attribution: '<a href="https://geoservicios.castillalamancha.es/" target="_blank" rel="noopener noreferrer">Protección · JCCM · CLM</a>' });
      layer.getTileUrl = coords => {
        const size = layer.getTileSize(), northWest = library.CRS.EPSG3857.project(map.unproject(coords.scaleBy(size), coords.z)), southEast = library.CRS.EPSG3857.project(map.unproject(coords.add([1, 1]).scaleBy(size), coords.z));
        return protectionTileUrl(source, `${northWest.x},${southEast.y},${southEast.x},${northWest.y}`, size.x);
      };
      layer.on('tileerror', () => { failed.add(source.id); setProtectionError(true); });
      layer.addTo(map); return layer;
    });
    protectedLayers.current = layers;
    return () => { layers.forEach(layer => layer.remove()); protectedLayers.current = []; };
  }, [map, library, ready, sources.protected]);
  useEffect(() => { protectedLayers.current.forEach(layer => layer.setOpacity(sources.protectedOpacity)); }, [sources.protectedOpacity]);
  return { sites, busy, error, zoomHint, truncated, protectionError, reload: () => setRetry(value => value + 1), open: (site: HeritageSite) => callback.current(site) };
}
