import { CircleQuestionMark, WandSparkles } from 'lucide-solid';
import settingsStore from '../../../stores/settings';
import SettingsToggle from '../../common/SettingsToggle';
import Card from '../../common/Card';
import { t } from '../../../i18n';

function AutoTrayConfigMigrationSettings() {
  const { settings, setAutomationSettings } = settingsStore;

  return (
    <Card
      title={
        <span class="flex items-center gap-2">
          <span>{t('settings.trayConfigMigration.title')}</span>
          <span
            class="tooltip tooltip-bottom inline-flex"
            data-tip={t('settings.trayConfigMigration.tooltip')}
          >
            <CircleQuestionMark class="text-base-content/50 h-4 w-4 cursor-help" />
          </span>
        </span>
      }
      icon={WandSparkles}
      description={t('settings.trayConfigMigration.description')}
      headerAction={
        <SettingsToggle
          checked={settings.automation.autoTrayConfigMigration}
          onChange={async (checked) =>
            await setAutomationSettings({ autoTrayConfigMigration: checked })
          }
          showStatusLabel={true}
          className="gap-3"
        />
      }
      conditionalContent={{
        condition: settings.automation.autoTrayConfigMigration,
        children: (
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-sm font-medium">
                {t('settings.trayConfigMigration.preserveVersioned')}
              </h3>
              <p class="text-base-content/60 mt-1 text-xs">
                {t('settings.trayConfigMigration.preserveVersionedDescription')}
              </p>
            </div>
            <input
              type="checkbox"
              class="toggle toggle-primary"
              checked={settings.automation.preserveTrayEntriesForVersionedInstalls}
              onChange={async (e) =>
                await setAutomationSettings({
                  preserveTrayEntriesForVersionedInstalls: e.currentTarget.checked,
                })
              }
            />
          </div>
        ),
      }}
    />
  );
}

export default AutoTrayConfigMigrationSettings;
