import { useEffect, useState, type FormEvent } from 'react';
import { Layers, Check, LoaderCircle, LogIn } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { appBase, configurationError, notebookMode, supabase } from './lib/config';
import TierrasApp from './TierrasApp';

function authMessage(error: { code?: string; message?: string }): string {
  const messages: Record<string, string> = {
    invalid_credentials: 'El correo o la contraseña no son correctos.',
    email_not_confirmed: 'Confirma tu correo con el enlace que te hemos enviado.',
    over_email_send_rate_limit: 'Se ha alcanzado el límite de correos. Espera un momento y vuelve a intentarlo.',
    over_request_rate_limit: 'Hay demasiados intentos. Espera un momento y vuelve a intentarlo.',
    email_address_not_authorized: 'El administrador debe configurar el envío de correos para permitir nuevas cuentas.',
    email_address_invalid: 'Revisa la dirección de correo.',
    signup_disabled: 'Las nuevas cuentas están desactivadas. Contacta con el administrador de esta web.',
    weak_password: 'Elige una contraseña más larga y difícil de adivinar.',
  };
  return messages[error.code || ''] || error.message || 'No se pudo acceder a tu cuenta. Revisa la conexión.';
}
function AccountForm({ recovery = false, onRecovered }: { recovery?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    const form = new FormData(event.currentTarget), email = String(form.get('email') || '').trim(), password = String(form.get('password') || '');
    setBusy(true); setError(''); setMessage('');
    try {
      if (recovery) {
        if (password !== form.get('confirmPassword')) throw new Error('Las contraseñas no coinciden.');
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        history.replaceState(null, '', appBase.href); onRecovered?.();
      } else if (mode === 'login') {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      } else if (mode === 'signup') {
        const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appBase.href } });
        if (result.error) throw result.error;
        if (!result.data.session) setMessage('Revisa tu correo para confirmar la cuenta. Después podrás abrir tu cuaderno.');
      } else {
        const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appBase.href });
        if (result.error) throw result.error;
        setMessage('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.');
      }
    } catch (e) { setError(authMessage(e as { code?: string; message?: string })); }
    finally { setBusy(false); }
  }
  return <main className="account-page"><div className="account-card"><span className="account-logo"><Layers size={32} /></span>
    <span className="eyebrow">TU CUADERNO DE ARCILLAS</span><h1>tierras</h1>
    <p>El mapa es para todos. Tus muestras, fotos y cocciones quedan en tu cuenta privada.</p>
    <h2>{recovery ? 'Nueva contraseña' : mode === 'signup' ? 'Crear cuenta' : mode === 'reset' ? 'Recuperar acceso' : 'Abre tu cuaderno'}</h2>
    {!recovery && mode !== 'reset' && <div className="account-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Entrar</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Crear cuenta</button></div>}
    <form className="form-body" onSubmit={submit}>
      {!recovery && <label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
      {(recovery || mode !== 'reset') && <label>Contraseña<input name="password" type="password" autoComplete={recovery || mode === 'signup' ? 'new-password' : 'current-password'} required minLength={recovery || mode === 'signup' ? 8 : 1} maxLength={128} /></label>}
      {recovery && <label>Repetir contraseña<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>}
      {error && <div className="form-error" role="alert">{error}</div>}{message && <p className="account-success" role="status"><Check size={18} />{message}</p>}
      <button className="button primary full-width" disabled={busy} type="submit">{busy ? <LoaderCircle size={18} className="spin" /> : <LogIn size={18} />}{busy ? 'Un momento…' : recovery ? 'Guardar contraseña' : mode === 'signup' ? 'Crear mi cuenta' : mode === 'reset' ? 'Enviar enlace' : 'Entrar'}</button>
    </form>
    {!recovery && <button className="text-button" onClick={() => { setMode(mode === 'reset' ? 'login' : 'reset'); setMessage(''); setError(''); }}>{mode === 'reset' ? 'Volver a entrar' : 'He olvidado la contraseña'}</button>}
    <p className="meta">Puedes instalar esta web desde Safari: Compartir → Añadir a pantalla de inicio.</p>
  </div></main>;
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null), [loading, setLoading] = useState(notebookMode === 'cloud');
  const [recovery, setRecovery] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next); setLoading(false); setError('');
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setError(authMessage(error));
      setSession(data.session); setLoading(false);
    }).catch(() => { if (active) { setError('No se pudo abrir la sesión. Recarga la web para intentarlo de nuevo.'); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (configurationError) return <main className="account-page"><div className="account-card"><h1>Tierras</h1><h2>Configuración pendiente</h2><p>{configurationError}</p><p>El propietario de esta web tiene los pasos en LEEME.md.</p></div></main>;
  if (notebookMode === 'local') return <TierrasApp />;
  if (loading) return <main className="account-page"><p><LoaderCircle className="spin" /> Abriendo tu cuenta…</p></main>;
  if (error) return <main className="account-page"><div className="account-card"><p role="alert">{error}</p><button className="button primary" onClick={() => location.reload()}>Reintentar</button></div></main>;
  if (recovery && session) return <AccountForm recovery onRecovered={() => setRecovery(false)} />;
  if (!session) return <AccountForm />;
  return <TierrasApp key={session.user.id} email={session.user.email} onSignOut={async () => {
    const { error } = await supabase!.auth.signOut({ scope: 'local' }); if (error) throw new Error(authMessage(error));
  }} />;
}
