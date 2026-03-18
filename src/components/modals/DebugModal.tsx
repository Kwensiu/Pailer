import { createSignal, Show, createMemo } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { info, warn, error } from '@tauri-apps/plugin-log';
import settingsStore from '../../stores/settings';
import Modal from '../common/Modal';
import OperationModal from './OperationModal';
import { useOperations } from '../../stores/operations';
import { toast } from '../common/ToastAlert';
import { OperationStatus } from '../../types/operations';

interface DebugInfo {
  timestamp: string;
  scoop_path: string;
  apps_dir_exists: boolean;
  app_count: number;
  cache_info: {
    cached_count: number;
    fingerprint: string | null;
  };
}

const DebugModal = () => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [debugInfo, setDebugInfo] = createSignal<DebugInfo | null>(null);
  const [appLogs, setAppLogs] = createSignal<string>('');
  const [logFileContent, setLogFileContent] = createSignal<string>('');
  const [activeTab, setActiveTab] = createSignal<'info' | 'logs' | 'tool'>('info');
  const [isLoading, setIsLoading] = createSignal(false);

  // Development-only state for tool tab
  const [operationId, setOperationId] = createSignal<string | undefined>(undefined);
  const { addOperation, generateOperationId } = useOperations();

  // Memoized tab checks for performance
  const isInfoTab = createMemo(() => activeTab() === 'info');
  const isLogsTab = createMemo(() => activeTab() === 'logs');
  const isToolTab = createMemo(() => activeTab() === 'tool');

  const refreshDebugInfo = async () => {
    setIsLoading(true);
    try {
      const debugData = await invoke<DebugInfo>('get_debug_info');
      setDebugInfo(debugData);

      const logs = await invoke<string>('get_app_logs');
      setAppLogs(logs);

      const logFile = await invoke<string>('read_app_log_file');
      setLogFileContent(logFile);
    } catch (e) {
      error(`Failed to fetch debug info: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      info('Debug information copied to clipboard');
    } catch (e) {
      warn(`Failed to copy to clipboard: ${e}`);
    }
  };

  const exportDebugData = async () => {
    if (!debugInfo()) {
      warn('Attempted to export debug data before it was loaded.');
      return;
    }

    const data = {
      timestamp: new Date().toISOString(),
      debugInfo: debugInfo(),
      appLogs: appLogs(),
      logFileContent: logFileContent(),
    };

    await copyToClipboard(JSON.stringify(data, null, 2));
    info('Full debug data copied to clipboard');
  };

  return (
    <>
      {/* Debug button in header - positioned as a floating button */}
      <Show when={settingsStore.settings.debug.enabled}>
        <button
          class="btn btn-sm btn-outline fixed right-4 bottom-4 z-40 gap-2"
          onClick={() => {
            setIsOpen(true);
            refreshDebugInfo();
          }}
          title="Open Debug Information"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Debug
        </button>
      </Show>

      {/* Debug Modal */}
      <Modal
        isOpen={isOpen()}
        onClose={() => setIsOpen(false)}
        title="Debug Information"
        size="full"
        animation="scale"
        footer={
          <div class="flex w-full justify-end gap-2">
            <button class="btn btn-accent btn-sm" onClick={refreshDebugInfo} disabled={isLoading()}>
              {isLoading() ? 'Loading...' : 'Refresh'}
            </button>
            <button
              class="btn btn-sm btn-primary"
              onClick={exportDebugData}
              disabled={isLoading() || !debugInfo()}
            >
              Copy All Data
            </button>
            <Show when={isLogsTab() && logFileContent()}>
              <button class="btn btn-sm btn-info" onClick={() => copyToClipboard(logFileContent())}>
                Copy Logs
              </button>
            </Show>
            <button class="btn btn-sm btn-outline" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {/* Tabs */}
        <div class="tabs tabs-boxed mb-4">
          <button
            class="tab"
            classList={{ 'tab-active': isInfoTab() }}
            onClick={() => setActiveTab('info')}
          >
            System Info
          </button>
          <button
            class="tab"
            classList={{ 'tab-active': isLogsTab() }}
            onClick={() => setActiveTab('logs')}
          >
            Logs
          </button>
          {/* Tool tab only in development */}
          <Show when={import.meta.env.DEV}>
            <button
              class="tab"
              classList={{ 'tab-active': isToolTab() }}
              onClick={() => setActiveTab('tool')}
            >
              Tool
            </button>
          </Show>
        </div>

        {/* Tab Content */}
        <div class="bg-base-100 mb-4 flex-1 overflow-y-auto rounded border p-4">
          {/* Info Tab */}
          <Show when={activeTab() === 'info'}>
            <Show when={debugInfo()}>
              {(info) => (
                <div class="space-y-3 font-mono text-sm">
                  <div class="bg-base-200 rounded p-2">
                    <strong>Timestamp:</strong> {info().timestamp}
                  </div>
                  <div class="bg-base-200 rounded p-2">
                    <strong>Scoop Path:</strong> {info().scoop_path}
                  </div>
                  <div class="bg-base-200 rounded p-2">
                    <strong>Apps Directory Exists:</strong>{' '}
                    {info().apps_dir_exists ? '✓ Yes' : '✗ No'}
                  </div>
                  <div class="bg-base-200 rounded p-2">
                    <strong>App Count in Directory:</strong> {info().app_count}
                  </div>
                  <div class="bg-base-200 rounded p-2">
                    <strong>Cache State:</strong>
                    <div class="mt-2 ml-4">
                      <div>Cached Apps: {info().cache_info.cached_count}</div>
                      <div class="text-xs break-all">
                        Fingerprint: {info().cache_info.fingerprint || 'None'}
                      </div>
                    </div>
                  </div>

                  {info().app_count === 0 && info().apps_dir_exists && (
                    <div class="bg-warning text-warning-content rounded p-3">
                      ⚠️ <strong>Alert:</strong> Apps directory exists but is empty. This could
                      indicate:
                      <ul class="mt-2 ml-4 list-disc">
                        <li>Scoop installation issue</li>
                        <li>Path resolution problem on MSI first-run</li>
                        <li>Permission issue accessing apps</li>
                      </ul>
                    </div>
                  )}

                  {!info().apps_dir_exists && (
                    <div class="bg-error text-error-content rounded p-3">
                      ✗ <strong>Error:</strong> Apps directory not found at {info().scoop_path}.
                      Scoop may not be properly installed.
                    </div>
                  )}
                </div>
              )}
            </Show>
            <Show when={!debugInfo() && !isLoading()}>
              <p class="text-base-content/50 text-center">Click "Refresh" to load debug info</p>
            </Show>
          </Show>

          {/* Logs Tab */}
          <Show when={activeTab() === 'logs'}>
            <pre class="max-h-full overflow-auto text-xs wrap-break-word whitespace-pre-wrap">
              {logFileContent() || (appLogs() ? 'Loading log file...' : 'No logs available')}
            </pre>
          </Show>

          {/* Tool Tab - Development Only */}
          <Show when={import.meta.env.DEV && activeTab() === 'tool'}>
            <div class="space-y-4">
              <div class="space-y-2">
                <h4 class="font-medium">Operation Modal Test</h4>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    class="btn btn-primary"
                    onClick={() => {
                      const id = generateOperationId('test');
                      setOperationId(id);
                      addOperation({
                        id: id,
                        title: 'Test Operation',
                        status: OperationStatus.InProgress,
                        isMinimized: false,
                        output: [],
                        isScan: true,
                      });
                    }}
                  >
                    Open Operation Modal
                  </button>
                  <button
                    class="btn btn-secondary"
                    onClick={() => {
                      const { addOperationOutput, setOperationStatus } = useOperations();
                      const id = generateOperationId('scroll-test');
                      setOperationId(id);
                      addOperation({
                        id: id,
                        title: 'Auto-scroll Test',
                        status: OperationStatus.InProgress,
                        isMinimized: false,
                        output: [],
                        isScan: true,
                      });

                      // Simulate continuous output for testing auto-scroll
                      let counter = 0;
                      const interval = setInterval(() => {
                        counter++;
                        addOperationOutput(id, {
                          operationId: id,
                          line: `[${counter}] Test line for auto-scroll testing. This is line number ${counter} of the continuous output test.`,
                          source: 'stdout',
                        });

                        // Stop after 50 lines
                        if (counter >= 60) {
                          clearInterval(interval);
                          setOperationStatus(id, OperationStatus.Success);
                        }
                      }, 100);
                    }}
                  >
                    Test Auto-scroll
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                <h4 class="font-medium">Toast Notifications Test</h4>
                <div class="grid grid-cols-4 gap-2">
                  <button
                    class="btn btn-success"
                    onClick={() => {
                      toast.success('This is a success message!', {
                        duration: 3000,
                      });
                    }}
                  >
                    Success
                  </button>
                  <button
                    class="btn btn-error"
                    onClick={() => {
                      toast.error('This is an error message!', {
                        persistent: true,
                      });
                    }}
                  >
                    Error
                  </button>
                  <button
                    class="btn btn-warning"
                    onClick={() => {
                      toast.warning('This is a warning message!', {
                        duration: 4000,
                      });
                    }}
                  >
                    Warning
                  </button>
                  <button
                    class="btn btn-info"
                    onClick={() => {
                      toast.info('This is an info message!', {
                        duration: 2000,
                      });
                    }}
                  >
                    Info
                  </button>
                </div>
                <button
                  class="btn btn-outline btn-sm"
                  onClick={() => {
                    toast.clear();
                  }}
                >
                  Clear All Toasts
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Modal>

      {/* Operation Modal for testing - Development Only */}
      <Show when={import.meta.env.DEV && operationId()}>
        <OperationModal
          operationId={operationId()}
          title="Test Operation"
          onClose={() => {
            setOperationId(undefined);
          }}
        />
      </Show>
    </>
  );
};

export default DebugModal;
