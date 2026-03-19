/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';

render(
  () => (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  ),
  document.getElementById('root')!
);
