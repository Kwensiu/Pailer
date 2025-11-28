import { createSignal, onMount, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

interface ScoopConfig {
    [key: string]: any;
}

export interface ScoopInfoProps {
    onOpenDirectory?: () => void;
}

function ScoopInfo(props: ScoopInfoProps) {
    const [scoopPath, setScoopPath] = createSignal<string | null>(null);
    const [scoopConfig, setScoopConfig] = createSignal<ScoopConfig | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);

    onMount(async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            // Get Scoop path
            const path = await invoke<string | null>("get_scoop_path");
            setScoopPath(path);
            
            // Get Scoop configuration
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
        <>
            <Card
                title="Scoop Configuration"
                icon={Settings}
                headerAction={
                    <div class="flex items-center gap-2">
                        <Show when={props.onOpenDirectory && scoopPath()}>
                            <button
                                class="btn btn-ghost btn-sm"
                                onClick={props.onOpenDirectory}
                                title="Open Scoop Directory"
                            >
                                <Folder class="w-5 h-5" />
                            </button>
                        </Show>
                        <Show when={scoopConfig()}>
                            <button
                                class="btn btn-ghost btn-sm"
                                onClick={openEditModal}
                                title="Edit Configuration"
                            >
                                <Edit class="w-5 h-5" />
                            </button>
                        </Show>
                        <button
                            class="btn btn-ghost btn-sm"
                            onClick={fetchScoopInfo}
                            disabled={isLoading()}
                        >
                            <RefreshCw class="w-5 h-5" classList={{ "animate-spin": isLoading() }} />
                        </button>
                    </div>
                }
            >
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