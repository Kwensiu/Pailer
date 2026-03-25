/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';

// Disable Tauri default context menu for specific areas, but allow input fields
document.addEventListener('contextmenu', (e) => {
  const target = e.target as HTMLElement;
  // Allow context menu for input fields, textareas, and contenteditable elements
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }
  e.preventDefault();
});

render(
  () => (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  ),
  document.getElementById('root')!
);
