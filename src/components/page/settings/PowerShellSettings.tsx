import { Terminal } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import Card from '../../common/Card';
import { createSignal, createEffect, onMount } from 'solid-js';
import { t } from '../../../i18n';
import { createPowerShellCache } from '../../../hooks/useSessionStorage';

function PowerShellSettings() {
  const { settings, setPowershellSettings } = settingsStore;
  const { data: executables, error, initialize } = createPowerShellCache();
  const [selected, setSelected] = createSignal(settings.powershell.executable);

  onMount(() => {
    setPowershellSettings({ executable: settings.powershell.executable });
    // Initialize PowerShell detection cache
    initialize();
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

  // Get current available options, provide default options during loading
  const currentOptions = () => {
    // If there's an error, return default options
    if (error()) {
      return ['auto', 'pwsh', 'powershell'];
    }

    const currentExecutables = executables();
    if (currentExecutables && currentExecutables.length > 0) {
      return currentExecutables;
    }
    // Provide default options during loading to prevent selector from disappearing
    return ['auto', 'pwsh', 'powershell'];
  };

  return (
    <Card
      title={t('settings.powershell.title')}
      icon={Terminal}
      description={t('settings.powershell.description')}
      headerAction={
        <select
          class="select select-bordered select-sm min-w-35"
          value={selected()}
          onChange={async (e) => {
            const newExe = e.target.value;
            // Validate input value is a valid option
            const validOptions = ['auto', 'pwsh', 'powershell'];
            if (validOptions.includes(newExe)) {
              setSelected(newExe as 'auto' | 'pwsh' | 'powershell');
              setPowershellSettings({ executable: newExe as 'auto' | 'pwsh' | 'powershell' });
            }
          }}
        >
          {currentOptions().map((exe: string) => (
            <option value={exe}>{getLabel(exe)}</option>
          ))}
        </select>
      }
    ></Card>
  );
}

export default PowerShellSettings;
