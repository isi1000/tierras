'use client';
import { useEffect, useRef, useState } from 'react';
import { Layers, LocateFixed, Plus, Minus, Check, X, MapPin } from 'lucide-react';
import type * as Leaflet from 'leaflet';
import type { Point, Sample } from '@/lib/types';
type Props = { samples: Sample[]; point: Point | null; onPoint: (point: Point) => void; onSample: (id: string) => void; locateTarget: Point | null; onLocate: () => void; locating: boolean };
export default function MapView({ samples, point, onPoint, onSample, locateTarget, onLocate, locating }: Props) {
  const el = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), library = useRef<typeof Leaflet | null>(null), markers = useRef<Leaflet.LayerGroup | null>(null), selection = useRef<Leaflet.CircleMarker | null>(null), geology = useRef<Leaflet.TileLayer.WMS | null>(null);
  const callbacks = useRef({ onPoint, onSample }); callbacks.current = { onPoint, onSample };
  const [ready, setReady] = useState(false), [layersOpen, setLayersOpen] = useState(false), [magna, setMagna] = useState(true), [opacity, setOpacity] = useState(.7), [tileError, setTileError] = useState(false), [mapError, setMapError] = useState('');
  useEffect(() => {
    let disposed = false;
    import('leaflet').then(L => {
      if (disposed || !el.current) return;
      library.current = L;
      const instance = L.map(el.current, { zoomControl: false, center: [39.018, -3.80], zoom: window.innerWidth < 700 ? 11 : 12, minZoom: 5, maxZoom: 19 });
      map.current = instance;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>', maxZoom: 19 }).addTo(instance);
      const overlay = L.tileLayer.wms('https://mapas.igme.es/gis/services/Cartografia_Geologica/IGME_MAGNA_50/MapServer/WMSServer', { layers: '0,1,2', format: 'image/png', transparent: true, version: '1.1.1', opacity: .7, attribution: '<a href="https://info.igme.es/cartografiadigital/geologica/Magna50.aspx" target="_blank" rel="noopener noreferrer">IGME-CSIC · MAGNA 50</a>', maxZoom: 19 });
      overlay.on('tileerror', () => setTileError(true));
      overlay.on('tileload', () => setTileError(false));
      overlay.addTo(instance); geology.current = overlay;
      markers.current = L.layerGroup().addTo(instance);
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(instance);
      instance.on('click', (event: Leaflet.LeafletMouseEvent) => callbacks.current.onPoint({ lat: event.latlng.lat, lng: event.latlng.lng }));
      const resize = new ResizeObserver(() => instance.invalidateSize()); resize.observe(el.current);
      (instance as Leaflet.Map & { cleanup?: () => void }).cleanup = () => resize.disconnect();
      setReady(true);
    }).catch(() => setMapError('No se pudo abrir el mapa. Recarga la página para intentarlo de nuevo.'));
    return () => { disposed = true; const instance = map.current as (Leaflet.Map & { cleanup?: () => void }) | null; instance?.cleanup?.(); instance?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !markers.current || !library.current) return;
    markers.current.clearLayers(); const L = library.current;
    for (const sample of samples) {
      const icon = L.divIcon({ className: 'sample-marker-wrap', html: `<span class="sample-marker ${sample.firings.length ? 'fired' : ''}"><span></span></span>`, iconSize: [32, 40], iconAnchor: [16, 40] });
      const pin = L.marker([sample.lat, sample.lng], { icon, title: sample.name, alt: sample.name, keyboard: true }).addTo(markers.current);
      const label = document.createElement('span'); label.textContent = sample.name;
      pin.bindTooltip(label, { direction: 'top', offset: [0, -30] });
      pin.on('click', () => callbacks.current.onSample(sample.id));
    }
  }, [samples, ready]);
  useEffect(() => {
    if (!ready || !map.current || !library.current) return;
    selection.current?.remove(); selection.current = null;
    if (point) selection.current = library.current.circleMarker([point.lat, point.lng], { radius: 10, color: '#af4728', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(map.current);
  }, [point, ready]);
  useEffect(() => {
    if (!locateTarget || !map.current) return;
    const instance = map.current;
    const frame = requestAnimationFrame(() => {
      if (map.current !== instance) return;
      // Al salir de una ficha, Leaflet puede conservar el tamaño cero del mapa oculto.
      // Actualizarlo antes de centrar evita coordenadas NaN durante la transición.
      instance.invalidateSize({ pan: false });
      instance.setView([locateTarget.lat, locateTarget.lng], 15, { animate: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [locateTarget, ready]);
  useEffect(() => { if (map.current && geology.current) { if (magna) geology.current.addTo(map.current); else geology.current.remove(); } }, [magna, ready]);
  useEffect(() => { geology.current?.setOpacity(opacity); }, [opacity, ready]);
  return <div className="map-canvas-wrap">
    <div ref={el} className="map-canvas" aria-label="Mapa geológico interactivo de MAGNA. Toca un lugar para consultar su litología." />
    {!ready && <div className="map-loading">{mapError || 'Abriendo el mapa geológico…'}</div>}
    <div className="map-topline"><span className="map-source"><Layers size={15} />{magna ? 'MAGNA 50 · Litología' : 'Mapa base'}<span className="map-scale-label">1:50.000</span></span></div>
    <div className="map-controls">
      <button className={'map-control ' + (layersOpen ? 'active' : '')} aria-label="Capas del mapa" aria-expanded={layersOpen} onClick={() => setLayersOpen(!layersOpen)}><Layers size={20} /></button>
      <button className="map-control" aria-label="Usar mi ubicación" onClick={onLocate} disabled={locating}><LocateFixed size={20} className={locating ? 'spin' : ''} /></button>
      <div className="zoom-group"><button className="map-control" aria-label="Acercar mapa" onClick={() => map.current?.zoomIn()}><Plus size={20} /></button><button className="map-control" aria-label="Alejar mapa" onClick={() => map.current?.zoomOut()}><Minus size={20} /></button></div>
    </div>
    {layersOpen && <div className="layers-panel"><div className="small-heading">Capas del mapa<button className="icon-button" aria-label="Cerrar capas" onClick={() => setLayersOpen(false)}><X size={17} /></button></div><button className="layer-toggle" onClick={() => setMagna(!magna)}><span className={'checkbox ' + (magna ? 'checked' : '')}>{magna && <Check size={14} />}</span><span><b>Litología MAGNA</b><small>Cartografía oficial del IGME-CSIC</small></span></button><label className="opacity-label">Transparencia de la capa<input type="range" min=".15" max="1" step=".05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label><p className="meta">Amplía el mapa para ver las unidades geológicas.</p></div>}
    {tileError && magna && <div className="map-service-error">MAGNA no está cargando. Puedes seguir viendo el mapa base y guardar ubicaciones.</div>}
    <div className="map-region"><MapPin size={13} /> Ciudad Real · Daimiel</div>
  </div>;
}
