import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles/index.css';
import { App } from './App';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { isConnectionLostError, recoverConnection } from './db/recovery';

// A write that fails because iOS dropped the IndexedDB connection (e.g. adding
// water right after reopening the app) should reconnect, not leave the app stuck.
window.addEventListener('unhandledrejection', (event) => {
  if (isConnectionLostError(event.reason)) void recoverConnection();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);
