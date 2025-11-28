import { createSignal, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { Globe } from "lucide-solid";
import Card from "../../common/Card";

function ScoopProxySettings() {
    const [proxyValue, setProxyValue] = createSignal("");
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [successMessage, setSuccessMessage] = createSignal<string | null>(null);

    // Load proxy setting from Scoop config on mount
    onMount(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const proxy = await invoke<string | null>("get_scoop_proxy");
            setProxyValue(proxy ?? "");
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error("Failed to fetch scoop proxy:", errorMsg);
            setError("Could not load Scoop proxy setting.");
        } finally {
            setIsLoading(false);
        }
    });

    const saveProxySetting = async (proxy: string, successMsg: string) => {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await invoke("set_scoop_proxy", { proxy });
            setSuccessMessage(successMsg);
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error("Failed to save scoop proxy:", errorMsg);
            setError(`Failed to save Scoop proxy: ${errorMsg}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProxy = async () => {
        await saveProxySetting(proxyValue(), "Scoop proxy saved successfully!");
    };

    const handleClearProxy = async () => {
        setProxyValue("");
        await saveProxySetting("", "Scoop proxy cleared successfully!");
    };

    return (
        <Card
            title="Scoop Proxy"
            icon={Globe}
            description="Set the Scoop proxy's address. Not the Rscoop GUI."
        >
            <div class="form-control w-full max-w-lg">
                <label class="label">
                    <span class="label-text font-semibold">
                        Proxy Address
                    </span>
                </label>

                <div class="mt-2">
                    <div class="join">
                        <input 
                            type="text"
                            placeholder={isLoading() ? "Loading..." : "username:password@proxy:8080"}
                            class="input input-bordered join-item flex-1 min-w-70" 
                            value={proxyValue()}
                            onInput={(e) => setProxyValue(e.currentTarget.value)}
                            disabled={isLoading() || isSaving()}
                        />
                        <button 
                            class="btn btn-primary join-item" 
                            onClick={handleSaveProxy}
                            disabled={isLoading() || isSaving()}
                        >
                            Save
                        </button>
                        <button 
                            class="btn join-item bg-orange-500 hover:bg-orange-600 border-none" 
                            onClick={handleClearProxy}
                            disabled={isLoading() || isSaving() || !proxyValue()}
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {error() && <div class="alert alert-error mt-4 text-sm">{error()}</div>}
                {successMessage() && <div class="alert alert-success mt-4 text-sm">{successMessage()}</div>}
            </div>
        </Card>
    );
}

export default ScoopProxySettings;