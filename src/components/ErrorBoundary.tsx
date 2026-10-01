import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

const RELOAD_FLAG = 'dgc_chunk_reload_once';

function isChunkLoadError(err: Error | null): boolean {
  const msg = String(err?.message || '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg)
  );
}

/**
 * Catches any render-time crash so the citizen never sees an empty white page.
 * A stale chunk after a new deployment triggers one automatic reload.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    if (isChunkLoadError(error)) {
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
        }
      } catch {
        /* storage unavailable */
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#020617',
          color: '#f1f5f9',
          fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 460 }}>
          <h1 style={{ fontSize: 22, color: '#fbbf24', margin: '0 0 8px' }}>ይቅርታ፣ ገጹ ላይ ችግር ተፈጥሯል</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#cbd5e1', margin: '0 0 16px' }}>
            እባክዎ ገጹን እንደገና ይጫኑ። ችግሩ ከቀጠለ የብራውዘር የትርጉም (Translate) አገልግሎትን ያጥፉ። (Something went wrong. Please reload.)
          </p>
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem(RELOAD_FLAG);
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
            style={{
              padding: '10px 22px',
              border: 0,
              borderRadius: 12,
              background: '#f59e0b',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            እንደገና ጫን (Reload)
          </button>
        </div>
      </div>
    );
  }
}
