'use client';
import { useEffect, useRef, useState } from 'react';
import { Layers, LocateFixed, Plus, Minus, Check, X, MapPin, Satellite } from 'lucide-react';
import type * as Leaflet from 'leaflet';
import type { Point, Sample } from '@/lib/types';
import MapSourceControls from './MapSourceControls';
import { useMapSources } from './useMapSources';
import { SOIL_PROPERTIES, depthLabel, type MapSources } from './lib/mapSources';
type Props = { samples: Sample[]; point: Point | null; onPoint: (point: Point) => void; onSample: (id: string) => void; locateTarget: Point | null; onLocate: () => void; locating: boolean; baseLayer: 'osm' | 'pnoa'; onBaseLayer: (layer: 'osm' | 'pnoa') => void; sources: MapSources; onSources: (sources: MapSources) => void };
export default function MapView({ samples, point, onPoint, onSample, locateTarget, onLocate, locating, baseLayer, onBaseLayer, sources, onSources }: Props) {
  const el = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), library = useRef<typeof Leaflet | null>(null), markers = useRef<Leaflet.LayerGroup | null>(null), selection = useRef<Leaflet.CircleMarker | null>(null), geology = useRef<Leaflet.TileLayer.WMS | null>(null), basemap = useRef<Leaflet.TileLayer | null>(null);
  const callbacks = useRef({ onPoint, onSample }); callbacks.current = { onPoint, onSample };
  const [ready, setReady] = useState(false), [layersOpen, setLayersOpen] = useState(false), [magna, setMagna] = useState(true), [opacity, setOpacity] = useState(.7), [tileError, setTileError] = useState(false), [baseError, setBaseError] = useState(false), [mapError, setMapError] = useState('');
  const integrated = useMapSources({ map: map.current, library: library.current, ready, sources, onPoint });
  useEffect(() => { if (sources.soil) setMagna(false); }, [sources.soil]);
  useEffect(() => {
    let disposed = false;
    import('leaflet').then(L => {
      if (disposed || !el.current) return;
      library.current = L;
      const instance = L.map(el.current, { zoomControl: false, center: [39.018, -3.80], zoom: window.innerWidth < 700 ? 11 : 12, minZoom: 5, maxZoom: 19 });
      map.current = instance;
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
    if (!ready || !map.current || !library.current) return;
    const L = library.current, instance = map.current;
    basemap.current?.remove();
    setBaseError(false);
    const layer = baseLayer === 'pnoa'
      ? L.tileLayer.wms('https://www.ign.es/wms-inspire/pnoa-ma', { layers: 'OI.OrthoimageCoverage', format: 'image/jpeg', transparent: false, version: '1.1.1', maxZoom: 19, attribution: '&copy; <a href="https://pnoa.ign.es/pnoa-imagen/visualizadores-y-servicios-web" target="_blank" rel="noopener noreferrer">IGN / CNIG · PNOA</a>' })
      : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>', maxZoom: 19 });
    layer.on('tileerror', () => setBaseError(true));
    layer.on('tileload', () => setBaseError(false));
    layer.addTo(instance).bringToBack(); basemap.current = layer;
    return () => { layer.remove(); if (basemap.current === layer) basemap.current = null; };
  }, [baseLayer, ready]);
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
    <div ref={el} className="map-canvas" aria-label="Mapa con MAGNA, materias primas BDMIN y suelo SoilGrids. Toca un punto para consultarlo." />
    {!ready && <div className="map-loading">{mapError || 'Abriendo el mapa geológico…'}</div>}
    <div className="map-topline"><span className="map-source">{magna || sources.soil ? <Layers size={15} /> : baseLayer === 'pnoa' ? <Satellite size={15} /> : <MapPin size={15} />}{sources.soil ? `${SOIL_PROPERTIES.find(property => property.id === sources.soilProperty)?.label} · ${depthLabel(sources.soilDepth)}` : magna ? 'MAGNA 50 · Litología' : baseLayer === 'pnoa' ? 'Ortofotos PNOA · IGN' : 'OpenStreetMap'}{sources.soil ? <span className="map-scale-label">250 m</span> : magna && <span className="map-scale-label">1:50.000</span>}</span></div>
    {sources.bdmin && <div className="bdmin-map-status" role="status"><span className="bdmin-dot" />{integrated.bdminBusy ? 'Consultando BDMIN…' : integrated.zoomHint ? 'BDMIN · acerca el mapa' : integrated.bdminError ? 'BDMIN no disponible' : `BDMIN · ${integrated.visible.length} ubicaciones`}</div>}
    <div className="map-controls">
      <button className={'map-control ' + (layersOpen ? 'active' : '')} aria-label="Capas del mapa" aria-expanded={layersOpen} onClick={() => setLayersOpen(!layersOpen)}><Layers size={20} /></button>
      <button className="map-control" aria-label="Usar mi ubicación" onClick={onLocate} disabled={locating}><LocateFixed size={20} className={locating ? 'spin' : ''} /></button>
      <div className="zoom-group"><button className="map-control" aria-label="Acercar mapa" onClick={() => map.current?.zoomIn()}><Plus size={20} /></button><button className="map-control" aria-label="Alejar mapa" onClick={() => map.current?.zoomOut()}><Minus size={20} /></button></div>
    </div>
    {layersOpen && <div className="layers-panel"><div className="small-heading">Capas del mapa<button className="icon-button" aria-label="Cerrar capas" onClick={() => setLayersOpen(false)}><X size={17} /></button></div><button className="layer-toggle" aria-pressed={magna} onClick={() => { if (!magna && sources.soil) onSources({ ...sources, soil: false }); setMagna(!magna); }}><span className={'checkbox ' + (magna ? 'checked' : '')}>{magna && <Check size={14} />}</span><span><b>Litología MAGNA</b><small>Cartografía oficial del IGME-CSIC</small></span></button><label className="opacity-label">Opacidad de MAGNA<input type="range" min=".15" max="1" step=".05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label><MapSourceControls sources={sources} onChange={onSources} state={{ ...integrated, openBdmin: entry => { setLayersOpen(false); integrated.openBdmin(entry); } }} /><div className="base-layer-options" role="group" aria-label="Elegir mapa base"><button className="layer-toggle" aria-pressed={baseLayer === 'osm'} onClick={() => onBaseLayer('osm')}><span className={'checkbox ' + (baseLayer === 'osm' ? 'checked' : '')}>{baseLayer === 'osm' && <Check size={14} />}</span><span><b>Caminos · OpenStreetMap</b></span></button><button className="layer-toggle" aria-pressed={baseLayer === 'pnoa'} onClick={() => onBaseLayer('pnoa')}><span className={'checkbox ' + (baseLayer === 'pnoa' ? 'checked' : '')}>{baseLayer === 'pnoa' && <Check size={14} />}</span><span><b>Ortofotos · PNOA</b><small>Imágenes aéreas del IGN / CNIG</small></span></button></div><p className="meta">MAGNA y SoilGrids se muestran por separado para distinguir sus colores. BDMIN puede verse sobre ambas capas.</p></div>}
    {(tileError && magna || baseError) && <div className="map-service-error">{baseError ? (baseLayer === 'pnoa' ? 'Las ortofotos no están cargando. Cambia a OpenStreetMap desde Capas.' : 'El mapa base no está cargando. Prueba las ortofotos desde Capas.') : 'MAGNA no está cargando. Puedes seguir viendo el mapa base y guardar ubicaciones.'}</div>}
    {sources.soil && integrated.soilError && <div className="soil-map-error" role="status">SoilGrids no está cargando. Puedes seguir usando el mapa y consultar otros servicios.</div>}
    <div className="map-region"><MapPin size={13} /> Ciudad Real · Daimiel</div>
  </div>;
}
