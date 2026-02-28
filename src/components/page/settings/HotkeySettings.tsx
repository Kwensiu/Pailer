import { Keyboard } from 'lucide-solid';
import SettingsToggle from '../../common/SettingsToggle';
import Card from '../../common/Card';
import { t } from '../../../i18n';
import { createTauriSignal } from '../../../hooks/createTauriSignal';

export default function HotkeySettings() {
  const [isGlobalHotkeyEnabled, setIsGlobalHotkeyEnabled] = createTauriSignal<boolean>(
    'globalHotkeyEnabled',
    true
  );

  const toggleGlobalHotkey = async () => {
    const newState = !isGlobalHotkeyEnabled();
    setIsGlobalHotkeyEnabled(newState);
  };

  return (
    <Card
      title={t('settings.hotkey.title')}
      icon={Keyboard}
      description={t('settings.hotkey.description')}
      headerAction={
        <SettingsToggle
          checked={isGlobalHotkeyEnabled()}
          onChange={toggleGlobalHotkey}
          showStatusLabel={true}
        />
      }
      conditionalContent={{
        condition: true,
        children: (
          <div class="text-base-content/60 text-[11px]">
            {t('settings.hotkey.note')}
          </div>
        ),
      }}
    />
  );
}
