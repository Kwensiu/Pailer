import { For, createEffect, createSignal, onCleanup } from 'solid-js';
import { Terminal, ChevronUp, ChevronDown } from 'lucide-solid';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { ansiToHtml, hasAnsiCodes, stripAnsi } from '../../../utils/ansiUtils';
import Card from '../../common/Card';
import { t } from '../../../i18n';
import { useOperations } from '../../../stores/operations';

// Constants
const SCROLL_THRESHOLD = 100;

function CommandInputField() {
  const {
    commandExecution,
    setCommand,
    setCommandRunning,
    toggleScoopPrefix,
    addCommandOutput,
    clearCommandOutput,
  } = useOperations();

  const exec = commandExecution();
  let scrollRef: HTMLDivElement | undefined;
  let currentUnlisteners: UnlistenFn[] = [];

  // State for clear output confirmation
  const [clearConfirm, setClearConfirm] = createSignal(false);
  const [clearTimer, setClearTimer] = createSignal<number | null>(null);

  onCleanup(() => {
    currentUnlisteners.forEach((unlisten) => unlisten());
    currentUnlisteners = [];

    // Clear clear output timer if exists
    if (clearTimer()) {
      window.clearTimeout(clearTimer()!);
      setClearTimer(null);
    }
  });

  createEffect(() => {
    if (exec.output.length > 0 && scrollRef) {
      const isNearBottom =
        scrollRef.scrollHeight - scrollRef.scrollTop <= scrollRef.clientHeight + SCROLL_THRESHOLD;
      if (isNearBottom) {
        scrollRef.scrollTop = scrollRef.scrollHeight;
      }
    }
  });

  const fixEncoding = (str: string): string => {
    try {
      if (/[\x80-\xFF]/.test(str)) {
        const latin1Str = str.replace(/[\x80-\xFF]/g, (match) =>
          String.fromCharCode(match.charCodeAt(0) & 0xff)
        );
        return decodeURIComponent(escape(latin1Str));
      }
    } catch (e) {
      console.debug('Failed to fix encoding:', e);
    }
    return str;
  };

  const handleRunCommand = async () => {
    if (!exec.command.trim() || exec.isRunning) return;

    try {
      const fullCommand = exec.useScoopPrefix ? `scoop ${exec.command}` : exec.command;

      addCommandOutput({
        operationId: 'command-execution',
        line: `> ${fullCommand}`,
        source: 'command',
        timestamp: Date.now(),
      });
      setCommandRunning(true);

      const unlisten: UnlistenFn = await listen('operation-output', (event: any) => {
        const cleanLine = {
          operationId: 'command-execution',
          line: fixEncoding(event.payload.line),
          source: event.payload.source,
          timestamp: Date.now(),
        };
        addCommandOutput(cleanLine);
      });

      let unlistenFinished: UnlistenFn;
      unlistenFinished = await listen('operation-finished', (event: any) => {
        unlisten();
        unlistenFinished();
        currentUnlisteners = currentUnlisteners.filter(
          (u) => u !== unlisten && u !== unlistenFinished
        );
        setCommandRunning(false);

        // For scoop commands, if we got output, consider it successful even if there are some errors
        const hasOutput = exec.output.length > 0;
        const isSuccess = hasOutput && exec.useScoopPrefix;
        const message = event.payload.message
          ? fixEncoding(stripAnsi(event.payload.message))
          : 'Command completed';

        addCommandOutput({
          operationId: 'command-execution',
          line: message,
          source: isSuccess ? 'success' : 'error',
          timestamp: Date.now(),
        });
      });

      currentUnlisteners.push(unlisten, unlistenFinished);

      if (exec.useScoopPrefix) {
        await invoke('run_scoop_command', { command: exec.command });
      } else {
        await invoke('run_powershell_command', { command: exec.command });
      }
    } catch (error: any) {
      const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';

      // Only log as error if it's a real exception, not just command failure
      if (typeof error === 'string' && error.includes('failed')) {
        console.log('Command execution completed with some failures:', errorMessage);
      } else {
        console.error('Failed to execute command:', error);
      }

      setCommandRunning(false);
      currentUnlisteners.forEach((unlisten) => unlisten());
      currentUnlisteners = [];

      // Only add error if we don't already have output
      if (exec.output.length === 0) {
        addCommandOutput({
          operationId: 'command-execution',
          line: 'Error: ' + errorMessage,
          source: 'error',
          timestamp: Date.now(),
        });
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRunCommand();
    }
  };

  const handleClearOutput = () => {
    if (clearConfirm()) {
      // Execute clear
      if (clearTimer()) {
        window.clearTimeout(clearTimer()!);
        setClearTimer(null);
      }
      setClearConfirm(false);
      clearCommandOutput();
    } else {
      // First click - show confirmation
      setClearConfirm(true);
      const timer = window.setTimeout(() => {
        setClearConfirm(false);
        setClearTimer(null);
      }, 3000);
      setClearTimer(timer);
    }
  };

  const handleToggleScoopPrefix = () => {
    toggleScoopPrefix();
  };

  const handleScrollToTop = () => {
    if (scrollRef) {
      scrollRef.scrollTop = 0;
    }
  };

  const handleScrollToBottom = () => {
    if (scrollRef) {
      scrollRef.scrollTop = scrollRef.scrollHeight;
    }
  };

  return (
    <Card
      title={t('doctor.commandInput.title')}
      icon={Terminal}
      contentContainer={false}
      additionalContent={t('doctor.commandInput.switchInputMode')}
    >
      <div class="join w-full">
        <span
          class={`btn join-item cursor-pointer transition-all duration-300 ${
            exec.useScoopPrefix ? 'btn-success' : 'bg-gray-500 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={handleToggleScoopPrefix}
          style={{
            'text-decoration': exec.useScoopPrefix ? 'none' : 'line-through',
          }}
          title={
            exec.useScoopPrefix
              ? t('doctor.commandInput.scoopPrefixEnabled')
              : t('doctor.commandInput.scoopPrefixDisabled')
          }
        >
          scoop
        </span>
        <input
          type="text"
          placeholder={
            exec.useScoopPrefix
              ? t('doctor.commandInput.enterCommand')
              : t('doctor.commandInput.enterFullCommand')
          }
          class="input input-bordered join-item flex-1"
          value={exec.command}
          onInput={(e) => setCommand(e.currentTarget.value)}
          onKeyPress={handleKeyPress}
          disabled={exec.isRunning}
        />
        <button class="btn btn-info join-item" onClick={handleRunCommand} disabled={exec.isRunning}>
          {exec.isRunning ? (
            <>
              <span class="loading loading-spinner loading-xs"></span>
              {t('doctor.commandInput.running')}
            </>
          ) : (
            <>
              <Terminal class="h-4 w-4" />
              {t('doctor.commandInput.run')}
            </>
          )}
        </button>
      </div>

      {/* Terminal output display */}
      <div class="mt-4">
        <div
          ref={(el) => (scrollRef = el)}
          class="max-h-60 overflow-y-auto rounded-lg bg-black/80 p-3 text-sm"
          style="white-space: pre; font-family: 'Consolas', 'Monaco', 'Courier New', monospace;"
        >
          <For each={exec.output}>
            {(line) => (
              <div
                style="white-space: pre;"
                class={
                  line.source === 'stderr' || line.source === 'error'
                    ? 'text-red-500'
                    : line.source === 'command'
                      ? 'text-blue-400'
                      : line.source === 'success'
                        ? 'text-green-500'
                        : 'text-white'
                }
              >
                {hasAnsiCodes(line.line) ? (
                  <span class="font-mono" innerHTML={ansiToHtml(line.line)} />
                ) : (
                  line.line
                )}
              </div>
            )}
          </For>
          {exec.output.length === 0 && !exec.isRunning && (
            <div class="text-gray-500">{t('doctor.commandInput.waitingForCommands')}</div>
          )}
          {exec.isRunning && (
            <div style="white-space: pre-wrap; word-break: break-all; font-family: 'Consolas', 'Monaco', 'Courier New', monospace;">
              <span class="loading loading-spinner loading-xs mr-2"></span>
              {t('doctor.commandInput.executingCommand')}
            </div>
          )}
          {/* Spacer element to ensure scrolling to bottom */}
          <div />
        </div>
        <div class="mt-2 flex justify-end gap-1">
          <button
            class="btn btn-xs btn-circle btn-soft"
            onClick={handleScrollToTop}
            title="Scroll to top"
          >
            <ChevronUp class="h-3 w-3" />
          </button>
          <button
            class="btn btn-xs btn-circle btn-soft"
            onClick={handleScrollToBottom}
            title="Scroll to bottom"
          >
            <ChevronDown class="h-3 w-3" />
          </button>
          <button
            classList={{
              btn: true,
              'btn-xs': true,
              'btn-soft': true,
              'btn-warning': clearConfirm(),
              'w-16': true,
            }}
            onClick={handleClearOutput}
          >
            {clearConfirm() ? t('buttons.sure') : t('doctor.commandInput.clearOutput')}
          </button>
        </div>
      </div>
    </Card>
  );
}

export default CommandInputField;
