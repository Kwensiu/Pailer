import { createSignal, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { ShieldCheck } from 'lucide-solid';
import Card from '../../common/Card';
import Modal from '../../common/Modal';
import { t } from '../../../i18n';
import { toast } from '../../common/ToastAlert';

interface NotifyIconDedupePair {
  identity: string;
  keep_subkey: string;
  keep_path: string;
  drop_subkey: string;
  drop_path: string;
  propagated_is_promoted?: number;
}

interface NotifyIconDedupeResult {
  candidates: number;
  deduped: number;
  dropped: number;
  propagated: number;
  failed: string[];
  pairs: NotifyIconDedupePair[];
}

interface ApplySingleDedupeResult {
  keep_subkey: string;
  drop_subkey: string;
  propagated: boolean;
  dropped: boolean;
}

function NotifyIconSettingsCleanup() {
  const [isDedupePreviewing, setIsDedupePreviewing] = createSignal(false);
  const [isDeduping, setIsDeduping] = createSignal(false);
  const [lastDedupeResult, setLastDedupeResult] = createSignal<NotifyIconDedupeResult | null>(null);
  const [isDedupeDetailsOpen, setIsDedupeDetailsOpen] = createSignal(false);
  const [resolvingDropSubkey, setResolvingDropSubkey] = createSignal<string | null>(null);

  const isBusy = () => isDedupePreviewing() || isDeduping() || resolvingDropSubkey() !== null;

  const handlePreviewDedupe = async () => {
    setIsDedupePreviewing(true);
    try {
      if (import.meta.env.DEV) {
        console.log('[NotifyIconSettingsCleanup] preview_dedupe_notify_icon_settings invoked');
      }
      const result = await invoke<NotifyIconDedupeResult>('preview_dedupe_notify_icon_settings');
      setLastDedupeResult(result);
      if (import.meta.env.DEV) {
        console.log('[NotifyIconSettingsCleanup] dedupe preview result:', result);
      }
      if (result.candidates > 0) {
        toast.success(t('doctor.notifyIconSettingsCleanup.dedupePreviewFound', { count: result.candidates }));
      } else {
        toast.success(t('doctor.notifyIconSettingsCleanup.dedupePreviewNoChanges'));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(t('doctor.notifyIconSettingsCleanup.failed', { error: errorMsg }));
    } finally {
      setIsDedupePreviewing(false);
    }
  };

  const handleApplyDedupe = async () => {
    setIsDeduping(true);
    try {
      const result = await invoke<NotifyIconDedupeResult>('apply_dedupe_notify_icon_settings');
      setLastDedupeResult(result);
      toast.success(
        t('doctor.notifyIconSettingsCleanup.dedupeApplied', {
          deduped: result.deduped,
          dropped: result.dropped,
          propagated: result.propagated,
        })
      );
      if (result.failed.length > 0) {
        toast.error(t('doctor.notifyIconSettingsCleanup.partialFailure', { count: result.failed.length }));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(t('doctor.notifyIconSettingsCleanup.failed', { error: errorMsg }));
    } finally {
      setIsDeduping(false);
    }
  };

  const handleResolveSingleDedupe = async (pair: NotifyIconDedupePair) => {
    setResolvingDropSubkey(pair.drop_subkey);
    try {
      await invoke<ApplySingleDedupeResult>('apply_single_dedupe_notify_icon_pair', {
        args: {
          keep_subkey: pair.keep_subkey,
          drop_subkey: pair.drop_subkey,
          propagated_is_promoted: pair.propagated_is_promoted ?? null,
        },
      });

      const prev = lastDedupeResult();
      if (prev) {
        const nextPairs = prev.pairs.filter((p) => p.drop_subkey !== pair.drop_subkey);
        const sameIdentityRemaining = nextPairs.some((p) => p.identity === pair.identity);
        setLastDedupeResult({
          ...prev,
          pairs: nextPairs,
          candidates: Math.max(0, prev.candidates - 1),
          deduped: sameIdentityRemaining ? prev.deduped : prev.deduped + 1,
          dropped: prev.dropped + 1,
          propagated:
            pair.propagated_is_promoted != null ? prev.propagated + 1 : prev.propagated,
        });
      }

      toast.success(t('doctor.notifyIconSettingsCleanup.singleDedupeApplied'));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(t('doctor.notifyIconSettingsCleanup.failed', { error: errorMsg }));
    } finally {
      setResolvingDropSubkey(null);
    }
  };

  return (
    <Card
      title={t('doctor.notifyIconSettingsCleanup.title')}
      icon={ShieldCheck}
      description={t('doctor.notifyIconSettingsCleanup.dedupeCardDescription')}
    >
      <div class="space-y-3">
        <div class="text-sm opacity-80">{t('doctor.notifyIconSettingsCleanup.tip')}</div>
        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-outline btn-secondary"
            onClick={handlePreviewDedupe}
            disabled={isBusy()}
          >
            {isDedupePreviewing()
              ? t('doctor.notifyIconSettingsCleanup.dedupePreviewing')
              : t('doctor.notifyIconSettingsCleanup.dedupePreview')}
          </button>
          <button class="btn btn-secondary" onClick={handleApplyDedupe} disabled={isBusy()}>
            {isDeduping()
              ? t('doctor.notifyIconSettingsCleanup.deduping')
              : t('doctor.notifyIconSettingsCleanup.dedupeApply')}
          </button>
          <button
            class="btn btn-ghost"
            disabled={!lastDedupeResult() || lastDedupeResult()!.pairs.length === 0}
            onClick={() => setIsDedupeDetailsOpen(true)}
          >
            {t('doctor.notifyIconSettingsCleanup.viewDedupeDetails')}
          </button>
        </div>

        {lastDedupeResult() && (
          <div class="text-base-content/70 text-sm">
            {t('doctor.notifyIconSettingsCleanup.dedupeSummary', {
              candidates: lastDedupeResult()!.candidates,
              deduped: lastDedupeResult()!.deduped,
              dropped: lastDedupeResult()!.dropped,
              propagated: lastDedupeResult()!.propagated,
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isDedupeDetailsOpen()}
        onClose={() => setIsDedupeDetailsOpen(false)}
        title={t('doctor.notifyIconSettingsCleanup.dedupeDetailsTitle')}
        size="large"
        animation="scale"
      >
        <div class="space-y-3">
          <div class="text-base-content/70 text-sm">
            {t('doctor.notifyIconSettingsCleanup.dedupeDetailsDescription')}
          </div>
          <div class="max-h-[55vh] overflow-auto">
            <table class="table table-zebra table-sm w-full">
              <thead>
                <tr>
                  <th>{t('doctor.notifyIconSettingsCleanup.identity')}</th>
                  <th>{t('doctor.notifyIconSettingsCleanup.keepRegistryEntryPath')}</th>
                  <th>{t('doctor.notifyIconSettingsCleanup.dropRegistryEntryPath')}</th>
                  <th style="width: 120px;">{t('doctor.notifyIconSettingsCleanup.actions')}</th>
                </tr>
              </thead>
              <tbody>
                <For each={lastDedupeResult()?.pairs || []}>
                  {(pair) => (
                  <tr>
                    <td class="font-mono text-xs">{pair.identity}</td>
                    <td class="font-mono text-xs break-all">{pair.keep_path}</td>
                    <td class="font-mono text-xs break-all">{pair.drop_path}</td>
                    <td>
                      <button
                        class="btn btn-xs btn-secondary"
                        disabled={resolvingDropSubkey() !== null}
                        onClick={() => handleResolveSingleDedupe(pair)}
                      >
                        {resolvingDropSubkey() === pair.drop_subkey
                          ? t('doctor.notifyIconSettingsCleanup.resolving')
                          : t('doctor.notifyIconSettingsCleanup.resolveSingle')}
                      </button>
                    </td>
                  </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

export default NotifyIconSettingsCleanup;
