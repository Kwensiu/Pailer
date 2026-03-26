import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ScoopPackage, ScoopInfo } from '../../types/scoop';

interface UsePackageInfoReturn {
  selectedPackage: () => ScoopPackage | null;
  info: () => ScoopInfo | null;
  loading: () => boolean;
  error: () => string | null;
  fetchPackageInfo: (pkg: ScoopPackage) => Promise<void>;
  closeModal: () => void;
  updateSelectedPackage: (pkg: ScoopPackage) => void;
}

export function usePackageInfo(): UsePackageInfoReturn {
  const [selectedPackage, setSelectedPackage] = createSignal<ScoopPackage | null>(null);
  const [info, setInfo] = createSignal<ScoopInfo | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const packageKey = (pkg: ScoopPackage | null) => (pkg ? `${pkg.name}::${pkg.source}` : null);

  const fetchPackageInfo = async (pkg: ScoopPackage) => {
    if (packageKey(selectedPackage()) === packageKey(pkg)) {
      closeModal();
      return;
    }

    setSelectedPackage(pkg);
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const infoResponse = await invoke<ScoopInfo>('get_package_info', {
        packageName: pkg.name,
        bucket: pkg.source,
      });
      setInfo(infoResponse);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedPackage(null);
    setInfo(null);
    setLoading(false);
    setError(null);
  };

  const updateSelectedPackage = (pkg: ScoopPackage) => {
    // Only update if it's the same package (by name + bucket)
    if (packageKey(selectedPackage()) === packageKey(pkg)) {
      setSelectedPackage(pkg);
    }
  };

  return {
    selectedPackage,
    info,
    loading,
    error,
    fetchPackageInfo,
    closeModal,
    updateSelectedPackage,
  };
}
