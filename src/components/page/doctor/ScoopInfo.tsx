import { createSignal, onMount, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface ScoopConfig {
    [key: string]: any;
}

function ScoopInfo() {
    const [scoopPath, setScoopPath] = createSignal<string | null>(null);
    const [scoopConfig, setScoopConfig] = createSignal<ScoopConfig | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);

    onMount(async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            // 获取Scoop路径
            const path = await invoke<string | null>("get_scoop_path");
            setScoopPath(path);
            
            // 获取Scoop配置
            const config = await invoke<ScoopConfig | null>("get_scoop_config");
            setScoopConfig(config);
            
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error("Failed to fetch scoop info:", errorMsg);
            setError("Could not load Scoop information.");
        } finally {
            setIsLoading(false);
        }
    });

    return (
        <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
                <h3 class="card-title text-xl">
                    Configuration
                </h3>
                {isLoading() ? (
                    <div class="flex justify-center items-center h-32">
                        <div class="loading loading-spinner loading-md"></div>
                    </div>
                ) : error() ? (
                    <div class="alert alert-error">
                        <span>{error()}</span>
                    </div>
                ) : (
                    <div class="space-y-4">
                        <div>
                            {scoopConfig() ? (
                                <div class="bg-base-300 p-4 rounded-lg overflow-x-auto text-sm">
                                    <For each={Object.entries(scoopConfig()!)}>
                                        {([key, value]) => (
                                            <div class="flex py-1 border-b border-base-100 last:border-0">
                                                <span class="font-mono font-bold text-primary mr-2 min-w-[150px]">{key}:</span>
                                                <span class="font-mono">
                                                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                                </span>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            ) : (
                                <p class="ml-2">No configuration found</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ScoopInfo;