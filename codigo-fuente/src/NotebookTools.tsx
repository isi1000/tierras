import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { BookOpen, Download, Upload, LogOut, X, LoaderCircle, RefreshCw } from 'lucide-react';
import { getRepository, notebookMode } from './lib/api';
export function NotebookTools({ onImport, onSignOut, email }: {
  onImport: () => Promise<void>; onSignOut?: () => Promise<void>; email?: string;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function exportCopy() {
    setBusy('export'); setError(''); setMessage('');
    try {
      const backup = await getRepository().exportBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `tierras-cuaderno-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage(`Copia preparada: ${backup.samples.length} muestras y ${backup.photos.length} fotos. Guárdala en Archivos o en otro lugar seguro.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo exportar la copia.'); }
    finally { setBusy(''); }
  }
  async function importCopy(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setBusy('import'); setError(''); setMessage('');
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('La copia debe ocupar menos de 100 MB.');
      const result = await getRepository().importBackup(JSON.parse(await file.text()));
      await onImport(); setMessage(`${result.imported} muestras añadidas. ${result.skipped} ya estaban en el cuaderno y se conservaron.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo importar. Elige una copia exportada por Tierras.'); }
    finally { setBusy(''); }
  }
  async function logout() {
    setBusy('logout'); setError('');
    try { await onSignOut?.(); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cerrar la sesión.'); }
    finally { setBusy(''); }
  }
  return <>
    <button className="install-button notebook-tools-button" onClick={() => setOpen(true)} aria-label="Abrir opciones del cuaderno"><BookOpen size={18} /><span>Cuaderno</span></button>
    <dialog ref={dialog} className="dialog notebook-dialog" aria-labelledby="notebook-options-title" onCancel={event => { event.preventDefault(); if (!busy) setOpen(false); }}>
      <div className="dialog-head"><h2 id="notebook-options-title">Mi cuaderno</h2><button className="icon-button" disabled={!!busy} aria-label="Cerrar opciones del cuaderno" onClick={() => setOpen(false)}><X size={22} /></button></div>
      <div className="form-body">
        <span className="eyebrow">{notebookMode === 'local' ? 'EN ESTE DISPOSITIVO' : 'EN TU CUENTA'}</span>
        <p>{notebookMode === 'local' ? 'Las notas y fotos se guardan en este navegador o app instalada. No se sincronizan con otros dispositivos. Si borras sus datos, perderás el cuaderno: exporta una copia regularmente.' : `Tu cuaderno está vinculado a ${email || 'tu cuenta'}. Solo tú puedes abrirlo desde la app. El administrador del servicio puede gestionar la base de datos.`}</p>
        <button className="button primary full-width" disabled={!!busy} onClick={() => void exportCopy()}>{busy === 'export' ? <LoaderCircle size={18} className="spin" /> : <Download size={18} />}Exportar cuaderno con fotos</button>
        <button className="button secondary full-width" disabled={!!busy} onClick={() => input.current?.click()}>{busy === 'import' ? <LoaderCircle size={18} className="spin" /> : <Upload size={18} />}Importar una copia</button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={event => void importCopy(event)} />
        <p className="meta">La importación añade las fichas de tu copia y conserva las que ya existen. La copia incluye tus ubicaciones, notas y fotos: compártela solo si quieres compartir esos datos.</p>
        <button className="text-button" disabled={!!busy} onClick={async () => { setBusy('refresh'); await onImport(); setBusy(''); setOpen(false); }}><RefreshCw size={17} />Actualizar cuaderno</button>
        {error && <div className="form-error" role="alert">{error}</div>}{message && <p className="account-success" role="status">{message}</p>}
        {onSignOut && <button className="text-button danger" disabled={!!busy} onClick={() => void logout()}><LogOut size={17} />Cerrar sesión</button>}
      </div>
    </dialog>
  </>;
}
