import { Check, RefreshCw, MapPin } from 'lucide-react';
import { BDMIN_FILTERS, SOIL_DEPTHS, SOIL_PROPERTIES, depthLabel, soilLegendUrl, type BdminFilter, type MapSources, type SoilDepth, type SoilProperty } from './lib/mapSources';
import type { MapSourceState } from './useMapSources';

export default function MapSourceControls({ sources, onChange, state }: { sources: MapSources; onChange: (next: MapSources) => void; state: MapSourceState }) {
  const update = (next: Partial<MapSources>) => onChange({ ...sources, ...next });
  return <div className="integrated-source-controls">
    <button className="layer-toggle" aria-pressed={sources.bdmin} onClick={() => update({ bdmin: !sources.bdmin })}><span className={'checkbox ' + (sources.bdmin ? 'checked' : '')}>{sources.bdmin && <Check size={14} />}</span><span><b>Materias primas · BDMIN</b><small>Indicios y explotaciones · IGME-CSIC</small></span></button>
    {sources.bdmin && <div className="source-layer-settings">
      <label>Material de BDMIN<select aria-label="Material de BDMIN" value={sources.bdminFilter} onChange={event => update({ bdminFilter: event.target.value as BdminFilter })}>{BDMIN_FILTERS.map(filter => <option key={filter.id} value={filter.id}>{filter.label}</option>)}</select></label>
      <p className="source-query-status" role="status">{state.bdminBusy ? 'Consultando esta zona…' : state.zoomHint ? 'Acerca el mapa para consultar ubicaciones.' : state.bdminError || `${state.visible.length} ubicaciones en esta zona.`}</p>
      {state.truncated && <p className="meta">Hay más fichas. Acerca el mapa para completar la consulta.</p>}
      {state.bdminError && <button className="text-button" onClick={state.reloadBdmin}><RefreshCw size={13} />Reintentar BDMIN</button>}
      {state.visible.length > 0 && <details className="bdmin-locations"><summary>Ver ubicaciones</summary><div>{state.visible.slice(0, 30).map(entry => <button key={entry.id} onClick={() => state.openBdmin(entry)}><MapPin size={13} /><span><b>{entry.substance}</b><small>{entry.municipality || entry.province || 'Ubicación inventariada'}</small></span></button>)}</div>{state.visible.length > 30 && <p className="meta">Primeras 30 ubicaciones. Acerca el mapa para consultar una zona menor.</p>}</details>}
      <p className="meta">Los círculos verdes son ubicaciones del inventario, distintas de tus muestras. Tócalos para ver sus datos.</p>
    </div>}

    <button className="layer-toggle" aria-pressed={sources.soil} onClick={() => update({ soil: !sources.soil })}><span className={'checkbox ' + (sources.soil ? 'checked' : '')}>{sources.soil && <Check size={14} />}</span><span><b>Suelo · SoilGrids</b><small>Arcilla, limo y arena estimados · ISRIC</small></span></button>
    {sources.soil && <div className="source-layer-settings">
      <label>Fracción del suelo<select aria-label="Fracción del suelo" value={sources.soilProperty} onChange={event => update({ soilProperty: event.target.value as SoilProperty })}>{SOIL_PROPERTIES.map(property => <option key={property.id} value={property.id}>{property.label}</option>)}</select></label>
      <label>Profundidad del suelo<select aria-label="Profundidad del suelo" value={sources.soilDepth} onChange={event => update({ soilDepth: event.target.value as SoilDepth })}>{SOIL_DEPTHS.map(depth => <option key={depth} value={depth}>{depthLabel(depth)}</option>)}</select></label>
      <label className="opacity-label">Opacidad de SoilGrids<input type="range" min=".15" max="1" step=".05" value={sources.soilOpacity} onChange={event => update({ soilOpacity: Number(event.target.value) })} /></label>
      <details className="soil-legend"><summary>Leyenda de SoilGrids</summary><p>Escala original en g/kg: 10 g/kg equivalen al 1 %.</p><div><img src={soilLegendUrl(sources.soilProperty, sources.soilDepth)} alt="Leyenda original de colores y valores de SoilGrids en gramos por kilogramo" /></div></details>
      <p className="meta">Toca el mapa para consultar porcentajes estimados. Píxeles de 250 m: no identifican una arcilla cerámica concreta.</p>
    </div>}
  </div>;
}
