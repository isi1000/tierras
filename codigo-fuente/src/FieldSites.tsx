import { DOCUMENT_FILES } from './lib/documentFiles';
import { DocumentDownload } from './ResearchDocuments';
import { useEffect, useState } from 'react';
import { Bookmark, ExternalLink, FileText, MapPin, RefreshCw, ShieldCheck } from 'lucide-react';
import { ligUrl, lookupProtection, type HeritageSite } from './lib/fieldSites';
import { featuredSite } from './lib/featuredSites';
import { localDetail, TERRAIN_RESOURCES } from './lib/localDetails';
import type { Point } from './lib/types';

const protectionCache = new Map<string, Awaited<ReturnType<typeof lookupProtection>>>();
export function ProtectionPointInfo({ point }: { point: Point }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof lookupProtection>> | null>(null), [busy, setBusy] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setResult(null); setBusy(true);
    const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    const timer = setTimeout(async () => {
      const saved = retry === 0 ? protectionCache.get(key) : null;
      const value = saved || await lookupProtection(point, controller.signal);
      if (controller.signal.aborted) return;
      if (!value.failed.length) { if (protectionCache.size >= 120) protectionCache.delete(protectionCache.keys().next().value!); protectionCache.set(key, value); }
      setResult(value); setBusy(false);
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [point.lat, point.lng, retry]);
  return <details className={'protection-info ' + (result?.matches.length ? 'has-protection' : '')} open={!!result?.matches.length}>
    <summary><ShieldCheck size={15} />Protección · Castilla-La Mancha{busy ? ' · consultando…' : result?.matches.length ? ` · ${result.matches.length}` : ''}</summary>
    {!busy && result && <>
      {result.matches.map(match => <div className="protection-match" key={match.id}><b>{match.name}</b><span>{match.figure || match.source}</span><small>{match.source}</small>{match.url && <a href={match.url} target="_blank" rel="noopener noreferrer">Documento oficial <ExternalLink size={12} /></a>}</div>)}
      {!result.matches.length && !result.failed.length && <p>No hay coincidencias en las tres capas consultadas de Castilla-La Mancha. Esto no confirma que el lugar carezca de otras protecciones.</p>}
      {!!result.failed.length && <p className="field-query-error" role="status">Consulta incompleta: {result.failed.join(', ')}.<button className="text-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={13} />Reintentar protección</button></p>}
      <p>Fuente: JCCM. ENP, Red Natura 2000 y zonas periféricas de protección. Comprueba las condiciones de visita y recogida en la normativa del espacio; la cartografía no concede permisos.</p>
    </>}
  </details>;
}
export function HeritageContent({ site, onVisit, onMap }: { site: HeritageSite; onVisit: () => void; onMap: () => void }) {
  const detail = localDetail(site.code), featured = featuredSite(site.code);
  return <div className="form-body heritage-content">
    <span className="eyebrow">IELIG · IGME-CSIC · {site.code}</span><h3>{site.name}</h3>
    {site.interest && <p className="heritage-interest">{site.interest}</p>}
    {featured && <div className="featured-site-summary"><p>{featured.material}</p><p className="featured-site-note">{featured.note}</p></div>}{site.description && <details className="heritage-description"><summary>Descripción del inventario</summary><p>{site.description}</p></details>}
    <p className="meta">{site.referenceOnly ? 'El pin representa el centro de la delimitación, no un afloramiento ni un acceso.' : 'El pin es la ubicación de referencia del inventario; consulta los afloramientos y accesos en la ficha.'}</p>
    <div className="field-actions"><button className="button primary" onClick={onVisit}><Bookmark size={16} />Guardar este lugar para visitar</button><button className="button secondary" onClick={onMap}><MapPin size={16} />Ver delimitación en mapa</button></div>
    {detail && <details className="detail-documents local-detail">
      <summary><FileText size={18} /><span>Detalle local<small>{detail.area}</small></span></summary>
      <p>{detail.description}</p>
      {detail.documents.map(document => <div className="local-document-item" key={document.url}><a className="detail-document" href={document.url} target="_blank" rel="noopener noreferrer">{document.type === 'image' ? <img src={DOCUMENT_FILES[document.url] ? './' + DOCUMENT_FILES[document.url].path : document.url} alt={document.title} loading="lazy" /> : <span className="document-file-icon"><FileText size={36} />{document.type === 'pdf' ? 'PDF · fuente original' : 'Artículo · fuente original'}</span>}<span><b>{document.title}</b><small>{document.detail}</small><span>Abrir documento original <ExternalLink size={12} /></span></span></a><DocumentDownload document={document} /></div>)}
      <p className="meta">Estos documentos complementan MAGNA. El pin y la consulta de litología siguen usando las fuentes del mapa; los esquemas no se han georreferenciado como capas. La precisión del GPS no mejora la precisión de la cartografía.</p>
      <details className="terrain-resources"><summary>Ortofotos y relieve para esta visita</summary><p>En Capas puedes seleccionar Ortofotos · PNOA como fondo del mapa.</p>{TERRAIN_RESOURCES.map(document => <a className="terrain-resource" key={document.url} href={document.url} target="_blank" rel="noopener noreferrer"><b>{document.title} <ExternalLink size={12} /></b><small>{document.detail}</small></a>)}</details>
      {site.code.toUpperCase() === 'TM142' && <p className="meta">La ficha menciona protección como Refugio de Fauna Campo de Calatrava. Consulta sus condiciones vigentes antes de planificar una recogida.</p>}
    </details>}
    <a className="text-button" href={ligUrl(site.code)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />Ficha completa, fotografías y referencias</a>
    <p className="meta">IELIG es un inventario de patrimonio geológico; su inclusión no significa que la recogida de materiales esté autorizada.</p>
  </div>;
}
