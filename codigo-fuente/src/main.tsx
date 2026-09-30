import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { appBase } from './lib/config';
import './styles.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('Tierras:', error); }
  render() { return this.state.failed ? <main className="account-page"><div className="account-card"><h1>Tierras</h1><p>No se pudo abrir la pantalla. Tus datos guardados se conservan.</p><button className="button primary" onClick={() => location.reload()}>Volver a abrir</button></div></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', appBase).href, { scope: appBase.pathname }).catch(error => console.warn('No se pudo preparar el acceso sin conexión.', error));
  });
}
