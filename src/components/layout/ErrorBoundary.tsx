import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { isConnectionLostError, recoverConnection } from '../../db/recovery';

declare global {
  interface Window {
    /** Defined by the boot watchdog in index.html. */
    __ntShowBootError?: (detail?: string) => void;
    __ntRepair?: () => void;
  }
}

interface State {
  error: Error | null;
  /** Bumped after a recovery so the whole tree (and its live queries) remounts. */
  generation: number;
}

/**
 * Last line of defence: without this, any error thrown while rendering
 * unmounts the whole app and leaves a blank screen.
 *
 * A lost IndexedDB connection (common on iOS after the app was in the
 * background) is recovered silently by reopening the database and remounting.
 * Anything else hands over to the recovery screen from index.html, which shows
 * the error and offers a cache repair that never touches saved data.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, generation: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error);
    if (isConnectionLostError(error)) {
      void recoverConnection().then((step) => {
        if (step === 'reopen') this.setState((s) => ({ error: null, generation: s.generation + 1 }));
        else this.showError(error, info);
      });
      return;
    }
    this.showError(error, info);
  }

  private showError(error: Error, info: ErrorInfo) {
    const where = info.componentStack?.trim().split('\n').slice(0, 4).join('\n') ?? '';
    window.__ntShowBootError?.(`${error.name}: ${error.message}\n${where}\nVersion ${__APP_VERSION__}`);
  }

  render() {
    const { error, generation } = this.state;
    if (!error) return <Fragment key={generation}>{this.props.children}</Fragment>;
    // Reconnecting: keep a placeholder in the page (the boot watchdog treats an empty root as a failed start).
    if (isConnectionLostError(error)) return <div className="min-h-dvh" />;
    // The recovery screen from index.html has taken over.
    if (window.__ntShowBootError) return null;
    return (
      <div role="alert" style={{ padding: 32, textAlign: 'center' }}>
        <p>Something went wrong. Your saved data is safe.</p>
        <button type="button" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
