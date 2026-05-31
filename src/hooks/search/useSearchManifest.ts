import { createSignal, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface ManifestPackage {
  name: string;
  source: string;
}

export function useSearchManifest() {
  const [manifestPackage, setManifestPackage] = createSignal<string | null>(null);
  const [manifestSource, setManifestSource] = createSignal<string | null>(null);
  const [manifestContent, setManifestContent] = createSignal<string | null>(null);
  const [manifestLoading, setManifestLoading] = createSignal(false);
  const [manifestError, setManifestError] = createSignal<string | null>(null);

  let currentManifestController: AbortController | null = null;

  const abortManifestRequest = () => {
    if (currentManifestController) {
      currentManifestController.abort();
      currentManifestController = null;
    }
  };

  const closeManifestModal = () => {
    abortManifestRequest();
    setManifestPackage(null);
    setManifestSource(null);
    setManifestContent(null);
    setManifestLoading(false);
    setManifestError(null);
  };

  const handleViewManifest = async (pkg: ManifestPackage) => {
    abortManifestRequest();

    setManifestPackage(pkg.name);
    setManifestSource(pkg.source);
    setManifestLoading(true);
    setManifestError(null);
    setManifestContent(null);

    currentManifestController = new AbortController();
    const { signal } = currentManifestController;

    try {
      const result = await invoke<string>('get_package_manifest', {
        packageName: pkg.name,
        bucket: pkg.source,
      });
      if (signal.aborted) return;

      setManifestContent(result);
    } catch (error) {
      if (signal.aborted) return;
      const errorMsg = error instanceof Error ? error.message : String(error);
      setManifestError(errorMsg);
      console.error(`Failed to fetch manifest for ${pkg.name}:`, errorMsg);
    } finally {
      if (!signal.aborted) {
        setManifestLoading(false);
        currentManifestController = null;
      }
    }
  };

  onCleanup(abortManifestRequest);

  return {
    manifestPackage,
    manifestSource,
    manifestContent,
    manifestLoading,
    manifestError,
    closeManifestModal,
    handleViewManifest,
  };
}
