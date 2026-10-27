import { useEffect, useState, type ComponentType } from 'react';
import styles from './StartupGate.module.css';

export type AppModule = { default: ComponentType };
export type AppLoader = () => Promise<AppModule>;

function failingPaths(error: unknown): string[] {
  if (!error || typeof error !== 'object' || !('issues' in error)) return [];
  const issues = (error as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];
  return issues.flatMap((issue: unknown) => {
    if (!issue || typeof issue !== 'object' || !('path' in issue)) return [];
    const path = (issue as { path?: unknown }).path;
    return Array.isArray(path) && path.length ? [path.map(String).join('.')] : [];
  });
}

export function StartupGate({ load, onRetry }: { load: AppLoader; onRetry: () => void }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; Application: ComponentType }
  >({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void load()
      .then((module) => {
        if (active) setState({ status: 'ready', Application: module.default });
      })
      .catch((cause: unknown) => {
        const paths = failingPaths(cause);
        if (paths.length) {
          console.error('Application startup failed. Invalid content paths:', paths, cause);
        } else {
          console.error('Application startup failed:', cause);
        }
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [attempt, load]);

  if (state.status === 'ready') return <state.Application />;
  if (state.status === 'error') {
    return (
      <main className={styles.message} role="alert">
        <h1>
          <span lang="es">La app no pudo iniciar</span> /{' '}
          <span lang="en">The app could not start</span>
        </h1>
        <p>
          <span lang="es">Ocurrió un problema al cargar el juego. Inténtalo de nuevo.</span> /{' '}
          <span lang="en">Something went wrong while loading the game. Please try again.</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((value) => value + 1);
            onRetry();
          }}
        >
          <span lang="es">Intentar de nuevo</span> / <span lang="en">Try again</span>
        </button>
      </main>
    );
  }
  return (
    <main className={styles.message} aria-live="polite">
      <span lang="es">Cargando…</span> / <span lang="en">Loading…</span>
    </main>
  );
}
