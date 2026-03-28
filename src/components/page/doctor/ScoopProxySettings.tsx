import { createSignal, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Globe } from 'lucide-solid';
import Card from '../../common/Card';
import { t } from '../../../i18n';
import { toast } from '../../common/ToastAlert';

function ScoopProxySettings() {
  const [proxyValue, setProxyValue] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSaving, setIsSaving] = createSignal(false);

  // Load proxy setting from Scoop config on mount
  onMount(async () => {
    setIsLoading(true);
    try {
      const proxy = await invoke<string | null>('get_scoop_proxy');
      setProxyValue(proxy ?? '');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch scoop proxy:', errorMsg);
      toast.error(t('doctor.proxySettings.loadError'));
    } finally {
      setIsLoading(false);
    }
  });

  const saveProxySetting = async (proxy: string, successMsg: string) => {
    setIsSaving(true);
    try {
      await invoke('set_scoop_proxy', { proxy });
      setProxyValue(proxy);
      toast.success(successMsg);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to save scoop proxy:', errorMsg);
      toast.error(t('doctor.proxySettings.saveError') + ' ' + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProxy = async () => {
    await saveProxySetting(proxyValue(), t('doctor.proxySettings.saveSuccess'));
  };

  const handleClearProxy = async () => {
    setProxyValue('');
    await saveProxySetting('', t('doctor.proxySettings.clearSuccess'));
  };

  return (
    <Card
      title={t('doctor.proxySettings.title')}
      icon={Globe}
      description={t('doctor.proxySettings.description')}
    >
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text font-semibold">{t('doctor.proxySettings.proxyAddress')}</span>
        </label>

        <div class="mt-2">
          <div class="join w-full">
            <input
              type="text"
              placeholder={
                isLoading()
                  ? t('doctor.proxySettings.loading')
                  : t('doctor.proxySettings.proxyPlaceholder')
              }
              class="input input-bordered join-item min-w-70 flex-1"
              value={proxyValue()}
              onInput={(e) => setProxyValue(e.currentTarget.value)}
              disabled={isLoading() || isSaving()}
            />
            <button
              class="btn btn-info join-item"
              onClick={handleSaveProxy}
              disabled={isLoading() || isSaving()}
            >
              {t('buttons.save')}
            </button>
            <button
              class="btn btn-warning join-item"
              onClick={handleClearProxy}
              disabled={isLoading() || isSaving() || !proxyValue()}
            >
              {t('buttons.clear')}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ScoopProxySettings;
