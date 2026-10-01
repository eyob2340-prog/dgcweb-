import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import './index.css';

// A new deployment replaces hashed chunk files; an old open tab then fails to load them.
// Reload once to pick up the fresh index.html.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    if (!sessionStorage.getItem('dgc_chunk_reload_once')) {
      sessionStorage.setItem('dgc_chunk_reload_once', '1');
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

try {
  (window as unknown as { __dgc_mounted?: boolean }).__dgc_mounted = true;
  window.dispatchEvent(new Event('dgc-mounted'));
} catch {}

