import { useState, type FormEvent } from 'react';
import { Bookmark, Check, ExternalLink, LoaderCircle, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from './lib/api';
import type { Geology, Point, Visit } from './lib/types';
import { ProtectionPointInfo } from './FieldSites';

export type VisitDraft = { point: Point; geology: Geology | null; visit?: Visit; name?: string; sourceUrl?: string; sourceTitle?: string };
export function VisitForm({ draft, onSave, onClose, onDelete, onMap }: { draft: VisitDraft; onSave: (visit: Visit) => void; onClose: () => void; onDelete: (id: string) => void; onMap: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmDelete, setConfirmDelete] = useState(false);
  const { point, visit, geology } = draft;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget);
    const data = { name: String(form.get('name')), notes: String(form.get('notes') || ''), plannedDate: form.get('plannedDate') || null, visitStatus: form.get('visitStatus'), sourceUrl: String(form.get('sourceUrl') || '') || null, sourceTitle: String(form.get('sourceUrl') || '') === (visit?.sourceUrl || draft.sourceUrl || '') ? (draft.sourceTitle || visit?.sourceTitle || null) : null };
    try { onSave(await api<Visit>(visit ? `/api/visits/${visit.id}` : '/api/visits', { method: visit ? 'PATCH' : 'POST', body: JSON.stringify(visit ? data : { ...data, ...point, geologySnapshot: geology ? { ...point, geology } : undefined }) })); }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar el lugar.'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!visit) return; setBusy(true); setError('');
    try { await api(`/api/visits/${visit.id}`, { method: 'DELETE' }); onDelete(visit.id); }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo eliminar.'); } finally { setBusy(false); }
  }
  return <form className="form-body visit-form" onSubmit={submit}>
    <p className="point-coordinate"><MapPin size={16} />{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>
    <label>Nombre del lugar<input aria-label="Nombre del lugar" name="name" required maxLength={120} defaultValue={visit?.name || draft.name?.slice(0, 120) || ''} placeholder="Ej. Tierra para explorar junto al camino" autoFocus /></label>
    <div className="form-grid"><label>Fecha prevista · opcional<input aria-label="Fecha prevista" name="plannedDate" type="date" defaultValue={visit?.plannedDate || ''} /></label><label>Estado de la visita<select aria-label="Estado de la visita" name="visitStatus" defaultValue={visit?.visitStatus || 'pending'}><option value="pending">Pendiente</option><option value="visited">Visitado</option></select></label></div>
    <label>Notas para la visita<textarea aria-label="Notas para la visita" name="notes" maxLength={20000} rows={4} defaultValue={visit?.notes || ''} placeholder="Qué mirar, acceso, materiales de interés, dudas…" /></label>
    <label>Enlace de referencia · opcional<input aria-label="Enlace de referencia" name="sourceUrl" type="url" maxLength={2000} defaultValue={visit?.sourceUrl || draft.sourceUrl || ''} placeholder="https://…" /></label>
    <ProtectionPointInfo point={point} />
    <p className="meta">Este pin planifica una visita. Las tierras que recojas se registran después como muestras.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="form-footer"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="button primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{busy ? 'Guardando…' : 'Guardar lugar'}</button></div>
    {visit && <div className="visit-edit-actions"><button type="button" className="text-button" disabled={busy} onClick={onMap}><MapPin size={15} />Consultar en mapa</button><button type="button" className="text-button danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Eliminar lugar</button>{confirmDelete && <div className="visit-delete-confirm"><p>¿Eliminar «{visit.name}» de tus visitas?</p><button type="button" className="button secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>Conservar</button><button type="button" className="button danger-button" disabled={busy} onClick={() => void remove()}>Confirmar eliminación</button></div>}</div>}
  </form>;
}
export default function VisitsPage({ visits, loading, error, onAdd, onEdit, onMap, onRetry }: { visits: Visit[]; loading: boolean; error: string; onAdd: () => void; onEdit: (visit: Visit) => void; onMap: (visit: Visit) => void; onRetry: () => void }) {
  const [filter, setFilter] = useState('pending'), [search, setSearch] = useState('');
  const visible = visits.filter(visit => (filter === 'all' || visit.visitStatus === filter) && `${visit.name} ${visit.notes}`.toLocaleLowerCase('es-ES').includes(search.toLocaleLowerCase('es-ES')));
  return <div className="collection-page visits-page"><div className="collection-heading"><div><span className="eyebrow">PRÓXIMAS SALIDAS</span><h1>Mis visitas <span>{visits.length}</span></h1><p>Guarda lugares, prepara qué observar y marca los que ya has visitado.</p></div><button className="button primary" onClick={onAdd}><Plus size={17} />Añadir lugar para visitar</button></div>
    <div className="visit-filters"><label className="visually-hidden" htmlFor="visit-search">Buscar en mis visitas</label><input id="visit-search" type="search" placeholder="Buscar un lugar o una nota…" value={search} onChange={event => setSearch(event.target.value)} /><div>{[['pending', 'Pendientes'], ['visited', 'Visitados'], ['all', 'Todos']].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div></div>
    {loading ? <p className="load-message">Abriendo tus visitas…</p> : error ? <div className="load-error"><p>{error}</p><button className="button secondary" onClick={onRetry}>Reintentar cuaderno</button></div> : visible.length ? <div className="visits-grid">{visible.map(visit => <article className="visit-card" key={visit.id}><span className="visit-card-status"><Bookmark size={15} />{visit.visitStatus === 'pending' ? 'Pendiente' : 'Visitado'}</span><h2>{visit.name}</h2><p className="point-coordinate"><MapPin size={13} />{visit.lat.toFixed(5)}, {visit.lng.toFixed(5)}</p>{visit.plannedDate && <p className="meta">Fecha prevista: {new Date(visit.plannedDate + 'T12:00:00').toLocaleDateString('es-ES')}</p>}{visit.notes && <p className="pre-line visit-notes">{visit.notes}</p>}{visit.sourceUrl && <a className="text-button" href={visit.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />{visit.sourceTitle || 'Referencia del lugar'}</a>}<div className="field-actions"><button className="button secondary" onClick={() => onMap(visit)}><MapPin size={15} />Ver lugar en mapa</button><button className="text-button" onClick={() => onEdit(visit)}><Pencil size={15} />Editar visita</button></div></article>)}</div> : <div className="collection-empty"><Bookmark size={38} /><h2>{visits.length ? 'No hay visitas con este filtro' : 'Lugares por descubrir'}</h2><p>Toca un punto del mapa y elige «Guardar para visitar». También puedes guardar lugares de IELIG desde sus fichas.</p><button className="button primary" onClick={onAdd}>Elegir un lugar en el mapa</button></div>}
  </div>;
}
