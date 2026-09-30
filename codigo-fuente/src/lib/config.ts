import { createClient } from '@supabase/supabase-js';
declare global { interface Window { TIERRAS_CONFIG?: { supabaseUrl?: string; supabasePublishableKey?: string } } }
const raw = typeof window === 'undefined' ? {} : window.TIERRAS_CONFIG || {};
const url = raw.supabaseUrl?.trim() || '', key = raw.supabasePublishableKey?.trim() || '';
export const notebookMode: 'local' | 'cloud' = url || key ? 'cloud' : 'local';
export const appBase = typeof document === 'undefined' ? new URL('http://localhost/') : new URL('./', document.baseURI);
function checkConfiguration(): string | null {
  if (notebookMode === 'local') return null;
  if (!url || !key) return 'Completa la URL y la clave publicable de Supabase en config.js.';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
      return 'La URL de Supabase debe usar HTTPS.';
  } catch { return 'La URL de Supabase no es válida. Revisa config.js.'; }
  if (key.startsWith('sb_secret_')) return 'Usa la clave publicable de Supabase; la clave secreta no puede estar en esta web.';
  if (key.includes('.')) {
    try {
      const segment = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(segment));
      if (payload.role !== 'anon') return 'Solo se admite la clave publicable o anon. Nunca service_role.';
    } catch { return 'La clave de Supabase no es válida. Revisa config.js.'; }
  } else if (!key.startsWith('sb_publishable_')) return 'Pega la clave publicable (sb_publishable_…) o anon de Supabase.';
  return null;
}
export const configurationError = checkConfiguration();
export const supabase = notebookMode === 'cloud' && !configurationError
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
      storageKey: 'tierras-auth-' + appBase.pathname } }) : null;
