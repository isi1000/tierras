import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { filterBdminPoints, lookupBdmin, soilLayerName, soilService, type BdminPoint, type MapSources } from './lib/mapSources';
import type { Point } from './lib/types';

type Props = { map: Leaflet.Map | null; library: typeof Leaflet | null; ready: boolean; sources: MapSources; onPoint: (point: Point) => void };
const popupOptions = (map: Leaflet.Map): Leaflet.PopupOptions => ({
  maxWidth: 300, maxHeight: Math.max(160, Math.min(420, map.getSize().y - 235)),
  autoPanPaddingTopLeft: [16, 108], autoPanPaddingBottomRight: [64, 120],
});
function popup(entry: BdminPoint, select: () => void) {
  const box = document.createElement('div'); box.className = 'bdmin-popup';
  const kicker = document.createElement('small'); kicker.textContent = 'BDMIN · IGME-CSIC'; box.append(kicker);
  const title = document.createElement('h3'); title.textContent = entry.substance; box.append(title);
  for (const [label, value] of [['Municipio', [entry.municipality, entry.province].filter(Boolean).join(' · ')], ['Uso registrado', entry.uses], ['Estado en el inventario', entry.status], ['Código de referencia', entry.code]]) {
    if (!value) continue;
    const line = document.createElement('p'), bold = document.createElement('b'); bold.textContent = label + ': '; line.append(bold, document.createTextNode(value)); box.append(line);
  }
  const note = document.createElement('p'); note.className = 'bdmin-popup-note';
  note.textContent = `${entry.records > 1 ? entry.records + ' fichas en esta ubicación. ' : ''}Ubicación del inventario: confirma la ficha, el acceso y el permiso de recogida.`; box.append(note);
  const button = document.createElement('button'); button.type = 'button'; button.className = 'button primary'; button.textContent = 'Consultar tierra aquí'; button.addEventListener('click', select); box.append(button);
  const link = document.createElement('a'); link.href = 'https://info.igme.es/BDmin/'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Abrir inventario BDMIN'; box.append(link);
  return box;
}

export function useMapSources({ map, library, ready, sources, onPoint }: Props) {
  const [points, setPoints] = useState<BdminPoint[]>([]), [bdminBusy, setBusy] = useState(false), [bdminError, setError] = useState(''), [truncated, setTruncated] = useState(false), [zoomHint, setZoomHint] = useState(false), [soilError, setSoilError] = useState(false), [retry, setRetry] = useState(0);
  const soilLayer = useRef<Leaflet.TileLayer.WMS | null>(null), select = useRef(onPoint); select.current = onPoint;
  const visible = useMemo(() => filterBdminPoints(points, sources.bdminFilter), [points, sources.bdminFilter]);
  function openBdmin(entry: BdminPoint) {
    if (!map || !library || !map.getContainer().clientWidth) return;
    map.invalidateSize({ pan: false });
    map.setView([entry.lat, entry.lng], Math.max(14, map.getZoom()), { animate: false });
    map.openPopup(popup(entry, () => { select.current({ lat: entry.lat, lng: entry.lng }); map.closePopup(); }), [entry.lat, entry.lng], popupOptions(map));
  }
  useEffect(() => {
    if (!ready || !map || !sources.bdmin) { setPoints([]); setBusy(false); setError(''); return; }
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
    async function load() {
      if (disposed || !map || !map.getContainer().clientWidth) return;
      controller?.abort(); controller = new AbortController(); const request = controller;
      const needsZoom = map.getZoom() < 8; setZoomHint(needsZoom);
      if (needsZoom) { setPoints([]); setBusy(false); setError(''); return; }
      const bounds = map.getBounds(); setBusy(true); setError(''); setTruncated(false); setPoints([]);
      try {
        const result = await lookupBdmin({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() }, request.signal);
        if (!disposed && !request.signal.aborted) { setPoints(result.points); setTruncated(result.truncated); }
      } catch {
        if (!disposed && !request.signal.aborted) setError('BDMIN no responde ahora. Puedes reintentar.');
      } finally { if (!disposed && !request.signal.aborted) setBusy(false); }
    }
    function schedule() { clearTimeout(timer); controller?.abort(); setBusy(true); timer = setTimeout(() => void load(), 350); }
    map.on('moveend resize', schedule); schedule();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); map.off('moveend resize', schedule); };
  }, [map, ready, sources.bdmin, retry]);
  useEffect(() => {
    if (!ready || !map || !library || !sources.bdmin) return;
    const group = library.layerGroup().addTo(map);
    for (const entry of visible) {
      const icon = library.divIcon({ className: 'bdmin-marker-wrap', html: '<span class="bdmin-marker"></span>', iconSize: [26, 26], iconAnchor: [13, 13] });
      const marker = library.marker([entry.lat, entry.lng], { icon, title: `BDMIN · ${entry.substance}`, keyboard: true, zIndexOffset: -100 }).addTo(group);
      const label = document.createElement('span'); label.textContent = entry.substance + (entry.municipality ? ' · ' + entry.municipality : ''); marker.bindTooltip(label);
      marker.on('click', () => { map.openPopup(popup(entry, () => { select.current({ lat: entry.lat, lng: entry.lng }); map.closePopup(); }), [entry.lat, entry.lng], popupOptions(map)); });
    }
    return () => { group.remove(); };
  }, [map, library, ready, visible, sources.bdmin]);
  useEffect(() => {
    if (!ready || !map || !library || !sources.soil) { setSoilError(false); return; }
    setSoilError(false);
    const layer = library.tileLayer.wms(soilService(sources.soilProperty), { layers: soilLayerName(sources.soilProperty, sources.soilDepth), styles: 'default', version: '1.1.1', format: 'image/png', transparent: true, opacity: sources.soilOpacity, maxZoom: 19, zIndex: 5,
      attribution: '<a href="https://isric.org/explore/soilgrids" target="_blank" rel="noopener noreferrer">ISRIC · SoilGrids 250 m</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>' });
    layer.on('tileerror', () => setSoilError(true)); layer.on('tileload', () => setSoilError(false));
    layer.addTo(map); soilLayer.current = layer;
    return () => { layer.remove(); if (soilLayer.current === layer) soilLayer.current = null; };
  }, [map, library, ready, sources.soil, sources.soilProperty, sources.soilDepth]);
  useEffect(() => { soilLayer.current?.setOpacity(sources.soilOpacity); }, [sources.soilOpacity]);
  return { visible, bdminBusy, bdminError, truncated, zoomHint, soilError, reloadBdmin: () => setRetry(value => value + 1), openBdmin };
}
export type MapSourceState = ReturnType<typeof useMapSources>;
