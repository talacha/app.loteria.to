import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './app/theme/tokens.css';
import { StartupGate } from './app/startup/StartupGate';

async function loadApplication() {
  // Both imports may reach content parsing, so contain failures from either one.
  await import('./app/i18n');
  return import('./app/App');
}

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StartupGate load={loadApplication} onRetry={() => window.location.reload()} />
  </StrictMode>,
);
