import { useState } from 'react';
import { Download, ExternalLink, FileText, MapPin, Search } from 'lucide-react';
import { LOCAL_STUDIES, type LocalDocument } from './lib/localDetails';
import { RESEARCH_DOCUMENTS, type ResearchGroup } from './lib/researchDocuments';
import { DOCUMENT_FILES } from './lib/documentFiles';

export function DocumentDownload({ document }: { document: LocalDocument }) {
  const file = DOCUMENT_FILES[document.url];
  return file ? <a className="text-button document-download" href={'./' + file.path} target="_blank" rel="noopener noreferrer"><Download size={15} />Abrir copia incluida · {(file.bytes / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB</a> : null;
}

const GROUPS: ResearchGroup[] = [
  ...LOCAL_STUDIES.map(study => ({ id: study.code, code: study.code, title: study.area, publisher: 'IELIG · IGME-CSIC', description: study.description, documents: study.documents })),
  ...RESEARCH_DOCUMENTS,
];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export default function ResearchDocuments({ onFeaturedSite, busy }: { onFeaturedSite: (code: string) => void; busy: boolean }) {
  const [query, setQuery] = useState('');
  const groups = GROUPS.filter(group => normalize([group.title, group.description, ...group.documents.map(d => d.title + ' ' + d.detail)].join(' ')).includes(normalize(query.trim())));
  return <section className="research-library" aria-labelledby="research-heading">
    <div className="explore-section-head"><h2 id="research-heading"><FileText size={22} />Documentos y análisis</h2></div>
    <p>Estudios de detalle, mapas de muestras y análisis para contrastar lo que encuentras en campo.</p>
    <label className="material-search"><Search size={18} /><span className="visually-hidden">Buscar documentos</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Fontanarejo, rayos X, Daimiel, fósforo…" /></label>
    <p className="meta">Las copias incluidas se abren desde esta web. Necesitan conexión; puedes guardarlas en Archivos para consultarlas durante una visita. Los documentos de gran tamaño se consultan en la fuente original.</p>
    <div className="research-groups">{groups.map(group => <details className="research-group" key={group.id}>
      <summary><span><b>{group.title}</b><small>{group.publisher} · {group.documents.length} documentos</small></span></summary>
      <div className="research-group-body"><p>{group.description}</p>
      {group.code && <button className="text-button" disabled={busy} onClick={() => onFeaturedSite(group.code!)}><MapPin size={15} />Abrir lugar en el mapa</button>}
      {group.documents.map(document => <article className="research-document" key={document.url}><h3>{document.title}</h3><p>{document.detail}</p><div className="resource-links"><DocumentDownload document={document} /><a className="text-button" href={document.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Fuente original</a></div></article>)}
      {group.id === 'lucas' && <p className="resource-limitation">ESDAC exige registro para determinados datos y restringe su redistribución y la publicación de ubicaciones identificables. Aquí se enlazan las fuentes oficiales; no se publican muestras individuales ni una capa LUCAS.</p>}
      </div>
    </details>)}</div>
    {!groups.length && <p>No hay documentos con esa búsqueda.</p>}
  </section>;
}
