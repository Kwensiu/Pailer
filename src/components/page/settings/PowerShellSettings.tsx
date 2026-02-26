import { Terminal } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import Card from '../../common/Card';
import { createSignal, createEffect, onMount, createResource, Show } from 'solid-js';
import { t } from '../../../i18n';
import { invoke } from '@tauri-apps/api/core';

function PowerShellSettings() {
  const { settings, setPowershellSettings } = settingsStore;
  const [options] = createResource(() => invoke<string[]>('get_available_powershell_executables'));
  const [selected, setSelected] = createSignal(settings.powershell.executable);

  onMount(() => {
    setPowershellSettings({ executable: settings.powershell.executable });
  });

  const getLabel = (exe: string) => {
    switch (exe) {
      case 'auto':
        return t('settings.powershell.autoDetect');
      case 'pwsh':
        return t('settings.powershell.pwsh');
      case 'powershell':
        return t('settings.powershell.windows');
      default:
        return exe;
    }
  };

  // Keep selected in sync with settings
  createEffect(() => {
    setSelected(settings.powershell.executable);
  });

  return (
    <Card
      title={t('settings.powershell.title')}
      icon={Terminal}
      description={t('settings.powershell.description')}
      headerAction={
        <Show when={options()}>
          <select
            class="select select-bordered select-sm min-w-35"
            value={selected()}
            onChange={async (e) => {
              const newExe = e.target.value as 'auto' | 'pwsh' | 'powershell';
              setSelected(newExe);
              setPowershellSettings({ executable: newExe });
            }}
          >
            {options()!.map((exe: string) => (
              <option value={exe}>{getLabel(exe)}</option>
            ))}
          </select>
        </Show>
      }
    ></Card>
  );
}

export default PowerShellSettings;
