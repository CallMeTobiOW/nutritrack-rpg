import { Component, type ErrorInfo, type ReactNode } from 'react';

declare global {
  interface Window {
    /** Defined by the boot watchdog in index.html. */
    __ntShowBootError?: (detail?: string) => void;
    __ntRepair?: () => void;
  }
}

/**
 * Last line of defence: without this, any error thrown while rendering
 * unmounts the whole app and leaves a blank screen. Instead we hand over to
 * the recovery screen from index.html, which shows the error and offers a
 * cache repair that never touches saved data.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const where = info.componentStack?.trim().split('\n').slice(0, 4).join('\n') ?? '';
    const detail = `${error.name}: ${error.message}\n${where}\nVersion ${__APP_VERSION__}`;
    console.error(error);
    window.__ntShowBootError?.(detail);
  }

  render() {
    if (!this.state.error) return this.props.children;
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
