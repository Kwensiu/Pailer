import { ErrorBoundary as SolidErrorBoundary, JSX } from 'solid-js';
import { error as logError } from '@tauri-apps/plugin-log';

interface ErrorBoundaryProps {
  children: JSX.Element;
  fallback?: (error: Error, reset: () => void) => JSX.Element;
}

export default function ErrorBoundary(props: ErrorBoundaryProps) {
  const fallback = (error: Error, reset: () => void) => {
    // Log the error
    console.error('ErrorBoundary caught error:', error);
    logError(`Frontend error caught by ErrorBoundary: ${error.message}\nStack: ${error.stack}`);

    // Use custom fallback if provided, otherwise use default
    if (props.fallback) {
      return props.fallback(error, reset);
    }

    // Default fallback UI
    return (
      <div class="bg-base-100 flex h-screen flex-col items-center justify-center p-8">
        <div class="bg-error/10 max-w-2xl rounded-lg p-6 text-center">
          <h1 class="text-error mb-4 text-2xl font-bold">Application Error</h1>
          <p class="text-base-content mb-4">
            An unexpected error occurred. Please try restarting the application.
          </p>
          <details class="mb-4 text-left">
            <summary class="cursor-pointer font-semibold">Error Details</summary>
            <pre class="bg-base-200 mt-2 overflow-auto rounded p-4 text-sm">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
          <button
            class="btn btn-primary"
            onClick={() => {
              reset();
              window.location.reload();
            }}
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  };

  return <SolidErrorBoundary fallback={fallback}>{props.children}</SolidErrorBoundary>;
}
