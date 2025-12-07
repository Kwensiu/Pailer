import { createSignal, For, createEffect } from "solid-js";
import { Terminal } from "lucide-solid";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { stripAnsi } from "../../../utils/ansiUtils";
import Card from "../../common/Card";
import { t } from "../../../i18n";

interface OperationOutput {
    line: string;
    source: string;
}

function CommandInputField() {
    const [command, setCommand] = createSignal("");
    const [output, setOutput] = createSignal<OperationOutput[]>([]);
    const [isRunning, setIsRunning] = createSignal(false);
    const [useScoopPrefix, setUseScoopPrefix] = createSignal(true);
    let scrollRef: HTMLDivElement | undefined;

    createEffect(() => {
        if (output().length > 0 && scrollRef) {
            const isNearBottom = scrollRef.scrollHeight - scrollRef.scrollTop <= scrollRef.clientHeight + 100;
            if (isNearBottom) {
                scrollRef.scrollTop = scrollRef.scrollHeight;
            }
        }
    });

    // 尝试修复可能的UTF-8编码问题
    const fixEncoding = (str: string): string => {
        // 检测并修复常见的编码问题
        try {
            // 如果字符串包含乱码特征，尝试重新解码
            if (/[\x80-\xFF]/.test(str)) {
                // 尝试将字符串作为latin1编码解释，然后转换为UTF-8
                const latin1Str = str.replace(/[\x80-\xFF]/g, (match) => 
                    String.fromCharCode(match.charCodeAt(0) & 0xFF)
                );
                return decodeURIComponent(escape(latin1Str));
            }
        } catch (e) {
            // 如果修复失败，返回原始字符串
            console.debug("Failed to fix encoding:", e);
        }
        return str;
    };

    const handleRunCommand = async () => {
        if (!command().trim() || isRunning()) return;

        try {
            const fullCommand = useScoopPrefix() ? `scoop ${command()}` : command();

            setOutput(prev => [...prev, { line: `> ${fullCommand}`, source: 'command' }]);
            setIsRunning(true);

            const unlisten: UnlistenFn = await listen('operation-output', (event: any) => {
                const cleanLine = {
                    line: fixEncoding(stripAnsi(event.payload.line)),
                    source: event.payload.source
                };
                setOutput(prev => [...prev, cleanLine]);
            });

            const unlistenFinished: UnlistenFn = await listen('operation-finished', (event: any) => {
                unlisten();
                unlistenFinished();
                setIsRunning(false);
                setOutput(prev => [...prev, { line: fixEncoding(stripAnsi(event.payload.message)), source: event.payload.success ? 'success' : 'error' }]);
            });

            if (useScoopPrefix()) {
                await invoke("run_scoop_command", { command: command() });
            } else {
                await invoke("run_powershell_command", { command: command() });
            }
        } catch (error: any) {
            console.error("Failed to execute command:", error);
            setIsRunning(false);
            setOutput(prev => [...prev, { line: "Error: " + error.message, source: 'error' }]);
        }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
            handleRunCommand();
        }
    };

    const handleClearOutput = () => {
        setOutput([]);
    };

    const toggleScoopPrefix = () => {
        setUseScoopPrefix(!useScoopPrefix());
    };

    return (
        <Card
            title={t('doctor.command_input.title')}
            icon={Terminal}
            // description={t('doctor.command_input.description')}
            additionalContent={t('doctor.command_input.switch_input_mode')}
        >
            <div class="form-control">
                <div class="join w-full">
                    <span
                        class={`btn join-item transition-all duration-300 cursor-pointer ${useScoopPrefix()
                                ? 'btn-success'
                                : 'bg-gray-500 text-gray-300 hover:bg-gray-600'
                            }`}
                        onClick={toggleScoopPrefix}
                        style={{
                            "text-decoration": useScoopPrefix() ? "none" : "line-through"
                        }}
                        title={useScoopPrefix() ? t('doctor.command_input.scoop_prefix_enabled') : t('doctor.command_input.scoop_prefix_disabled')}
                    >
                        scoop
                    </span>
                    <input
                        type="text"
                        placeholder={useScoopPrefix() ? t('doctor.command_input.enter_command') : t('doctor.command_input.enter_full_command')}
                        class="input input-bordered join-item flex-1"
                        value={command()}
                        onInput={(e) => setCommand(e.currentTarget.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isRunning()}
                    />
                    <button class="btn btn-primary join-item" onClick={handleRunCommand} disabled={isRunning()}>
                        {isRunning() ? (
                            <>
                                <span class="loading loading-spinner loading-xs"></span>
                                {t('doctor.command_input.running')}
                            </>
                        ) : (
                            <>
                                <Terminal class="w-4 h-4" />
                                {t('doctor.command_input.run')}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 终端模拟显示框 */}
            <div class="mt-4">
                <div ref={el => scrollRef = el} class="bg-black rounded-lg p-3 font-mono text-sm max-h-60 overflow-y-auto">
                    <For each={output()}>
                        {(line) => (
                            <div class={
                                line.source === 'stderr' || line.source === 'error' ? 'text-red-500' :
                                    line.source === 'command' ? 'text-blue-400' :
                                        line.source === 'success' ? 'text-green-500' :
                                            'text-white'
                            }>
                                {line.line}
                            </div>
                        )}
                    </For>
                    {output().length === 0 && !isRunning() && (
                        <div class="text-gray-500">
                            {t('doctor.command_input.waiting_for_commands')}
                        </div>
                    )}
                    {isRunning() && (
                        <div class="flex items-center text-white">
                            <span class="loading loading-spinner loading-xs mr-2"></span>
                            {t('doctor.command_input.executing_command')}
                        </div>
                    )}
                    {/* 占位元素，用于确保滚动到底部 */}
                    <div />
                </div>
                <div class="mt-2 flex justify-end">
                    <button class="btn btn-xs btn-ghost" onClick={handleClearOutput}>{t('doctor.command_input.clear_output')}</button>
                </div>
            </div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div class="bg-info/10 p-2 rounded">
                    <p><strong>{t('doctor.command_input.package_management')}:</strong> install, uninstall, update, info</p>
                </div>
                <div class="bg-info/10 p-2 rounded">
                    <p><strong>{t('doctor.command_input.information')}:</strong> list, status, checkup</p>
                </div>
                <div class="bg-info/10 p-2 rounded">
                    <p><strong>{t('doctor.command_input.search')}:</strong> search, show, cat</p>
                </div>
                <div class="bg-info/10 p-2 rounded">
                    <p><strong>{t('doctor.command_input.maintenance')}:</strong> cleanup, cache, reset</p>
                </div>
            </div>
        </Card>
    );
}

export default CommandInputField;