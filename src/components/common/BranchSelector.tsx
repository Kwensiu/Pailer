import { createSignal, onMount, Show, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { toast } from './ToastAlert';
import { t } from '../../i18n';

interface BranchSelectorProps {
  bucketName: string;
  currentBranch: string | undefined;
  onBranchChanged?: (newBranch: string) => void;
  class?: string;
}

function BranchSelector(props: BranchSelectorProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [branches, setBranches] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [switching, setSwitching] = createSignal(false);
  const [currentOperationId, setCurrentOperationId] = createSignal<string | null>(null);
  let containerRef: HTMLDivElement | undefined;

  const fetchBranches = async () => {
    if (branches().length > 0) return;

    setLoading(true);
    try {
      const branchList = await invoke<string[]>('get_bucket_branches', {
        bucketName: props.bucketName,
      });
      setBranches(branchList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error(t('bucket.errors.fetchBranchesFailed', { error: errorMessage }));
      console.error('Failed to fetch branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSwitch = async (branchName: string) => {
    if (branchName === props.currentBranch) {
      setIsOpen(false);
      return;
    }

    // Generate unique operation ID
    const operationId = `switch-${Date.now()}-${Math.random()}`;
    setCurrentOperationId(operationId);
    setSwitching(true);

    try {
      const result = await invoke<string>('switch_bucket_branch', {
        bucketName: props.bucketName,
        branchName: branchName,
      });

      // Check if operation is still valid
      if (currentOperationId() !== operationId) {
        return; // Operation replaced by new operation
      }

      if (result.startsWith('Switched to branch')) {
        const branchMatch = result.match(/Switched to branch '(.+)'/);
        if (branchMatch) {
          toast.success(t('bucket.errors.switchBranchSuccess', { branch: branchMatch[1] }));
        } else {
          toast.success(result);
        }
      } else {
        toast.success(result);
      }
      props.onBranchChanged?.(branchName);
      setIsOpen(false);
    } catch (err) {
      // Check if operation is still valid
      if (currentOperationId() !== operationId) {
        return; // Operation replaced by new operation
      }

      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage === 'UNCOMMITTED_CHANGES') {
        toast.error(t('bucket.errors.uncommittedChanges'));
      } else if (errorMessage === 'NETWORK_ERROR' || errorMessage.includes('network')) {
        toast.error(t('bucket.errors.networkError'));
      } else if (errorMessage === 'PERMISSION_DENIED') {
        toast.error(t('bucket.errors.permissionDenied'));
      } else {
        toast.error(t('bucket.errors.switchBranchFailed', { error: errorMessage }));
      }
    } finally {
      // Reset state only if this is the current operation
      if (currentOperationId() === operationId) {
        setSwitching(false);
        setCurrentOperationId(null);
      }
    }
  };

  const toggleDropdown = () => {
    if (!isOpen()) {
      fetchBranches();
    }
    setIsOpen(!isOpen());
  };

  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef && !containerRef.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  return (
    <div ref={containerRef} class={`branch-selector ${props.class || ''}`}>
      <div class="relative">
        <button
          class="badge badge-soft badge-sm border-primary/50 bg-primary/15 hover:bg-primary/25 min-w-16 cursor-pointer border backdrop-blur-sm transition-all duration-200"
          onClick={toggleDropdown}
          title={`Current branch: ${props.currentBranch || 'unknown'}. Click to switch branches.`}
        >
          <span>{props.currentBranch || 'unknown'}</span>
        </button>

        {/* Expandable branch list - appears below the badge */}
        <Show when={isOpen()}>
          <div class="bg-base-100 border-base-300 absolute top-full right-0 z-50 mt-1 min-w-16 overflow-hidden rounded-lg border shadow-lg">
            <Show when={loading()}>
              <div class="text-base-content/70 flex items-center justify-center p-2 text-xs">
                <span class="loading loading-spinner loading-xs mr-1"></span>
                Loading...
              </div>
            </Show>

            <Show when={!loading() && branches().length > 0}>
              <div class="max-h-48 overflow-y-auto">
                <For each={branches()}>
                  {(branch) => (
                    <button
                      class={`hover:bg-base-200 flex w-full items-center justify-between px-2 py-1 text-left text-xs whitespace-nowrap transition-colors ${
                        branch === props.currentBranch
                          ? 'bg-primary/10 text-primary font-medium'
                          : switching()
                            ? 'text-base-content/30 cursor-not-allowed'
                            : 'text-base-content'
                      }`}
                      onClick={() => handleBranchSwitch(branch)}
                      disabled={branch === props.currentBranch || switching()}
                    >
                      <span class="truncate">{branch}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <Show when={!loading() && branches().length === 0}>
              <div class="text-base-content/50 p-2 text-center text-xs">No branches found</div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default BranchSelector;
