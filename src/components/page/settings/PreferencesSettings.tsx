import AutoEndProcessSettings from './AutoEndProcessSettings';
import PowerShellSettings from './PowerShellSettings';
import ScoopUpdateSettings from './ScoopUpdateSettings';

function PreferencesSettings() {
  return (
    <>
      <ScoopUpdateSettings />
      <AutoEndProcessSettings />
      <PowerShellSettings />
    </>
  );
}

export default PreferencesSettings;
