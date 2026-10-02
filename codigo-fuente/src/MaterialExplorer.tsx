import ResearchDocuments from './ResearchDocuments';
import { useEffect, useState } from 'react';
import { Compass, ExternalLink, FlaskConical, Layers, MapPin, Search, Satellite } from 'lucide-react';
import { GOALS, MAP_RESOURCES, MATERIALS, matchingMaterials, type CeramicGoal, type MaterialGuide } from './lib/materials';
import type { Geology, Point } from './lib/types';
import { FEATURED_SITES } from './lib/featuredSites';
import { ligUrl } from './lib/fieldSites';
import { localDetail } from './lib/localDetails';
import type { MapSourceAction } from './lib/mapSources';

export function CeramicIdeas({ lithology }: { lithology: string | null }) {
  const materials = matchingMaterials(lithology);
  if (!materials.length) return null;
  return <div className="ceramic-ideas">
    <div className="small-heading"><FlaskConical size={17} />Ideas para probar</div>
    <p className="meta">Sugerencias por palabras de la litología. No son recetas ni resultados previstos.</p>
    {materials.map(material => <details key={material.id}>
      <summary>{material.name}</summary>
      <p>{material.uses}</p>
      <p><b>Primera prueba:</b> {material.trial}</p>
      <p className="material-caution">{material.caution}</p>
      <a href={material.source.url} target="_blank" rel="noopener noreferrer" className="text-button"><ExternalLink size={14} />Fuente y lectura</a>
    </details>)}
  </div>;
}

function MaterialCard({ material }: { material: MaterialGuide }) {
  return <article className="material-card" style={{ borderTopColor: material.color }}>
    <div className="material-title"><span style={{ background: material.color }} /><h3>{material.name}</h3></div>
    <div className="material-tags">{material.goals.map(goal => <span key={goal}>{GOALS.find(item => item.id === goal)?.label}</span>)}</div>
    <dl>
      <dt><Search size={15} />Dónde buscar</dt><dd>{material.where}</dd>
      <dt><FlaskConical size={15} />Qué podrías hacer</dt><dd>{material.uses}</dd>
      <dt>Primera prueba</dt><dd>{material.trial}</dd>
    </dl>
    <p className="material-caution">{material.caution}</p>
    <p className="material-keywords"><b>Palabras para buscar:</b> {material.keywords}</p>
    <a href={material.source.url} target="_blank" rel="noopener noreferrer" className="text-button material-source"><ExternalLink size={14} />{material.source.label}</a>
  </article>;
}

export default function MaterialExplorer({ point, geology, loading, onMap, onHigueruela, detailBusy, onFeaturedSite }: {
  point: Point | null;
  geology: Geology | null;
  loading: boolean;
  onMap: (source?: MapSourceAction) => void;
  onHigueruela: () => void;
  detailBusy: boolean;
  onFeaturedSite: (code: string) => void;
}) {
  const [goal, setGoal] = useState<CeramicGoal>('all');
  const [query, setQuery] = useState('');
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  useEffect(() => {
    if (!jumpTo) return;
    document.getElementById(`material-${jumpTo}`)?.scrollIntoView({ block: 'start' });
    setJumpTo(null);
  }, [jumpTo, goal, query]);
  const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const visible = MATERIALS.filter(material => {
    const text = `${material.name} ${material.keywords} ${material.uses}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return (goal === 'all' || material.goals.includes(goal)) && (!normalizedQuery || text.includes(normalizedQuery));
  });
  const pointMatches = matchingMaterials(geology?.lithology || null);
  return <div className="explore-page">
    <div className="explore-heading">
      <div><span className="eyebrow">DEL PAISAJE A LA PRUEBA</span><h1><Compass size={29} />Dónde buscar</h1><p>Materiales, posibles usos y mapas para elegir tu próxima exploración.</p></div>
      <button className="button secondary" onClick={() => onMap()}><MapPin size={17} />Ir al mapa</button>
    </div>

    <section className="explore-point" aria-label="Ideas para el punto seleccionado">
      <div className="small-heading"><Layers size={17} />{point ? 'El punto que has seleccionado' : 'Empieza por un lugar'}</div>
      {point ? <>
        <p className="explore-coordinate">{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>
        {loading ? <p>Consultando MAGNA…</p> : geology?.lithology ? <>
          <h2>{geology.lithology.toLocaleLowerCase('es-ES')}</h2>
          <p>Estas palabras de la unidad dan pistas para explorar; no confirman qué minerales contiene la muestra.</p>
          {pointMatches.length ? <div className="point-materials">{pointMatches.map(material => <a key={material.id} href={`#material-${material.id}`} onClick={event => { event.preventDefault(); setGoal('all'); setQuery(''); setJumpTo(material.id); }}>{material.name}</a>)}</div> : <p className="meta">No hay una sugerencia específica para esta litología. Puedes consultar la guía general de abajo.</p>}
        </> : <p>{geology?.status === 'unavailable' ? 'MAGNA no está disponible ahora. Puedes consultar la guía y los mapas complementarios.' : 'No hay una litología consultada para este punto. Usa la guía como orientación y comprueba el terreno.'}</p>}
        <button className="text-button" onClick={() => onMap()}><MapPin size={16} />Volver a este punto</button>
      </> : <><p>Toca el mapa para consultar una litología. Aquí verás ideas relacionadas con esa unidad.</p><button className="text-button" onClick={() => onMap()}><MapPin size={16} />Elegir un punto</button></>}
    </section>

    <section aria-labelledby="material-guide-heading">
      <div className="explore-section-head"><h2 id="material-guide-heading">¿Qué te gustaría probar?</h2><span className="meta">Guía orientativa</span></div>
      <div className="goal-filters" role="group" aria-label="Filtrar por uso cerámico">{GOALS.map(item => <button key={item.id} aria-pressed={goal === item.id} className={goal === item.id ? 'active' : ''} onClick={() => setGoal(item.id)}>{item.label}</button>)}</div>
      <label className="material-search"><Search size={18} /><span className="visually-hidden">Buscar un material</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Arcilla, basalto, feldespato…" /></label>
      <p className="meta" aria-live="polite">{visible.length} {visible.length === 1 ? 'material' : 'materiales'}</p>
      <div className="material-grid">{visible.map(material => <div key={material.id} id={`material-${material.id}`}><MaterialCard material={material} /></div>)}</div>
      {!visible.length && <div className="material-empty"><p>No hay materiales con esa búsqueda y ese uso.</p><button className="text-button" onClick={() => { setGoal('all'); setQuery(''); }}>Ver todos los materiales</button></div>}
    </section>

    <section className="featured-sites" aria-labelledby="featured-sites-heading">
      <div className="explore-section-head"><h2 id="featured-sites-heading">Lugares geológicos destacados</h2><span className="meta">Ciudad Real · IELIG</span></div>
      <p className="meta">Materiales documentados para investigar y observar. La ficha no garantiza aptitud cerámica ni autoriza la recogida.</p>
      <div className="featured-sites-grid">{FEATURED_SITES.map(site => <article className="featured-site-card" key={site.code}>
        <span className="eyebrow">{site.code}{site.priority ? ' · ' + site.priority : ''}</span><h3>{site.name}</h3><p className="meta">{site.area}</p><p>{site.material}</p><p className="featured-site-note">{site.note}</p>
        {localDetail(site.code) && <span className="local-detail-badge">Detalle local disponible en la ficha</span>}
        <div className="field-actions"><button className="button secondary" disabled={detailBusy} onClick={() => onFeaturedSite(site.code)}><MapPin size={15} />Abrir en el mapa</button><a className="text-button" href={ligUrl(site.code)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Ficha oficial</a></div>
      </article>)}</div>
    </section>

    <ResearchDocuments onFeaturedSite={onFeaturedSite} busy={detailBusy} />

    <section className="explore-maps" aria-labelledby="explore-maps-heading">
      <div className="explore-section-head"><h2 id="explore-maps-heading">Mapas que complementan MAGNA</h2></div>
      <div className="resource-grid">{MAP_RESOURCES.map(resource => <article key={resource.id} className="map-resource">
        <span className="eyebrow">{resource.publisher}</span><h3>{resource.name}</h3>
        <p>{resource.useful}</p><p className="resource-limitation">{resource.limitation}</p>
        <div className="resource-links"><a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-button"><ExternalLink size={15} />{resource.link}</a>
          {resource.id === 'ielig' && <><button className="text-button" onClick={() => onMap('ielig')}>Ver IELIG en Tierras</button><button className="text-button" disabled={detailBusy} onClick={onHigueruela}>Cañada–Villar: mapas de detalle</button></>}{resource.id === 'protected' && <button className="text-button" onClick={() => onMap('protected')}>Ver espacios protegidos en Tierras</button>}{resource.id === 'bdmin' && <button className="text-button" onClick={() => onMap('bdmin')}><MapPin size={16} />Ver BDMIN en Tierras</button>}{resource.id === 'soilgrids' && <button className="text-button" onClick={() => onMap('soil')}><Layers size={16} />Ver SoilGrids en Tierras</button>}{resource.id === 'pnoa' && <button className="text-button" onClick={() => onMap('pnoa')}><Satellite size={16} />Ver ortofotos en Tierras</button>}</div>
      </article>)}</div>
    </section>

    <div className="explore-testing"><FlaskConical size={23} /><div><h2>Convierte las pistas en pruebas</h2><p>Guarda cada muestra, la preparación y la proporción de la mezcla. En cada cocción registra temperatura, atmósfera, resultado y fotos para comparar. Usa probetas y una bandeja recolectora para los materiales que puedan fundir. Un ensayo visual no demuestra aptitud para contacto con alimentos.</p><p className="meta">Los mapas orientan la búsqueda. Comprueba el acceso y el permiso de recogida; evita residuos mineros y materiales sin identificar. Prepara los minerales en húmedo para reducir polvo.</p></div></div>
  </div>;
}
