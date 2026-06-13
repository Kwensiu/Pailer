import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { Search, Settings, ShieldCheck, X, Plus, RotateCcw, Package } from 'lucide-solid';
import installedPackagesStore, {
  type DisplayPackage,
} from '../../../stores/installedPackagesStore';
import settingsStore from '../../../stores/settings';
import SettingsToggle from '../../common/SettingsToggle';
import Modal from '../../common/Modal';
import Card from '../../common/Card';
import { t } from '../../../i18n';
import { usePackageIcons } from '../../../hooks';

type PackageOption = Pick<DisplayPackage, 'name' | 'source'>;

function AutoEndProcessSettings() {
  const { settings, setScoopSettings } = settingsStore;
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');

  onMount(() => {
    void installedPackagesStore.fetch();
  });

  const normalizePackageName = (name: string) => name.trim().toLowerCase();

  const packageOptions = createMemo<PackageOption[]>(() =>
    installedPackagesStore
      .packages()
      .map((pkg) => ({ name: pkg.name, source: pkg.source }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  const allowlistNames = createMemo(() => {
    const knownNames = new Map(
      packageOptions().map((pkg) => [normalizePackageName(pkg.name), pkg.name] as const)
    );

    return settings.scoop.autoEndProcessPackageAllowlist
      .map((name) => knownNames.get(normalizePackageName(name)) ?? name)
      .filter((name, index, names) => {
        const normalized = normalizePackageName(name);
        return (
          normalized &&
          names.findIndex((item) => normalizePackageName(item) === normalized) === index
        );
      })
      .sort((a, b) => a.localeCompare(b));
  });

  const allowlistSet = createMemo(
    () => new Set(allowlistNames().map((name) => normalizePackageName(name)))
  );

  const availablePackages = createMemo(() => {
    const query = searchQuery().trim().toLowerCase();
    return packageOptions()
      .filter((pkg) => !allowlistSet().has(normalizePackageName(pkg.name)))
      .filter(
        (pkg) =>
          !query ||
          pkg.name.toLowerCase().includes(query) ||
          pkg.source.toLowerCase().includes(query)
      );
  });

  const selectedPackages = createMemo(() => {
    const packageMap = new Map(
      packageOptions().map((pkg) => [normalizePackageName(pkg.name), pkg])
    );
    return allowlistNames()
      .map((name) => packageMap.get(normalizePackageName(name)))
      .filter((pkg): pkg is PackageOption => !!pkg);
  });

  const { icons: packageIcons } = usePackageIcons({
    packageNames: createMemo(() => packageOptions().map((pkg) => pkg.name)),
  });

  const saveAllowlist = async (names: string[]) => {
    await setScoopSettings({
      autoEndProcessPackageAllowlist: names
        .map((name) => name.trim())
        .filter(
          (name, index, list) =>
            name &&
            list.findIndex((item) => normalizePackageName(item) === normalizePackageName(name)) ===
              index
        )
        .sort((a, b) => a.localeCompare(b)),
    });
  };

  const addPackage = (pkg: PackageOption) => {
    void saveAllowlist([...allowlistNames(), pkg.name]);
  };

  const removePackage = (packageName: string) => {
    void saveAllowlist(
      allowlistNames().filter(
        (name) => normalizePackageName(name) !== normalizePackageName(packageName)
      )
    );
  };

  const resetAllowlist = () => {
    void saveAllowlist([]);
  };

  const setAutoEndMode = async (mode: 'safe' | 'force') => {
    if (settings.scoop.autoEndProcessMode === mode) {
      return;
    }

    await setScoopSettings({ autoEndProcessMode: mode });
  };

  return (
    <>
      <Card
        title={t('settings.autoEndProcess.title')}
        icon={ShieldCheck}
        description={t('settings.autoEndProcess.description')}
        headerAction={
          <SettingsToggle
            checked={settings.scoop.autoEndRunningProcesses}
            onChange={async (checked) =>
              await setScoopSettings({ autoEndRunningProcesses: checked })
            }
            showStatusLabel={true}
          />
        }
        conditionalContent={{
          condition: settings.scoop.autoEndRunningProcesses,
          children: (
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <h4 class="text-base-content font-medium">
                    {t('settings.autoEndProcess.modeTitle')}
                  </h4>
                  <p class="text-base-content/70 text-sm">
                    {t('settings.autoEndProcess.defaultMode')}
                  </p>
                </div>
                <div
                  class="bg-base-200 border-base-300 relative grid h-8 w-40 grid-cols-2 rounded-full border p-0.5"
                  role="radiogroup"
                  aria-label={t('settings.autoEndProcess.modeTitle')}
                >
                  <div
                    class="bg-base-100 absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full shadow-sm transition-transform duration-200"
                    classList={{
                      'translate-x-full': settings.scoop.autoEndProcessMode === 'force',
                    }}
                  />
                  <button
                    type="button"
                    class="relative z-1 rounded-full px-2 text-xs font-medium transition-colors"
                    classList={{
                      'text-base-content': settings.scoop.autoEndProcessMode === 'safe',
                      'text-base-content/60': settings.scoop.autoEndProcessMode !== 'safe',
                    }}
                    role="radio"
                    aria-checked={settings.scoop.autoEndProcessMode === 'safe'}
                    onClick={() => void setAutoEndMode('safe')}
                  >
                    {t('settings.autoEndProcess.modeSafe')}
                  </button>
                  <button
                    type="button"
                    class="relative z-1 rounded-full px-2 text-xs font-medium transition-colors"
                    classList={{
                      'text-base-content': settings.scoop.autoEndProcessMode === 'force',
                      'text-base-content/60': settings.scoop.autoEndProcessMode !== 'force',
                    }}
                    role="radio"
                    aria-checked={settings.scoop.autoEndProcessMode === 'force'}
                    onClick={() => void setAutoEndMode('force')}
                  >
                    {t('settings.autoEndProcess.modeForce')}
                  </button>
                </div>
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <h4 class="text-base-content font-medium">
                    {t('settings.autoEndProcess.manageAllowlist')}
                  </h4>
                  <p class="text-base-content/70 text-sm">
                    {t('settings.autoEndProcess.allowlistDescription')}
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-outline btn-sm shrink-0"
                  onClick={() => setIsModalOpen(true)}
                >
                  <Settings size={16} />
                  {t('settings.autoEndProcess.configure')}
                </button>
              </div>
            </div>
          ),
        }}
      />

      <Modal
        isOpen={isModalOpen()}
        onClose={() => setIsModalOpen(false)}
        title={t('settings.autoEndProcess.modalTitle')}
        size="large"
        animation="scale"
      >
        <div class="flex h-[min(34rem,calc(90vh-7rem))] min-h-0 flex-col gap-4 overflow-hidden">
          <div class="grid h-full min-h-0 grid-cols-1 grid-rows-2 gap-4 overflow-hidden lg:grid-cols-2 lg:grid-rows-1">
            <section class="border-base-300 bg-base-200 flex min-h-0 flex-col overflow-hidden rounded-lg border">
              <div class="border-base-300 flex min-h-16 items-start justify-between gap-3 border-b p-3">
                <div class="min-w-0">
                  <h5 class="text-base-content text-sm font-semibold">
                    {t('settings.autoEndProcess.availablePackages')}
                  </h5>
                  <p class="text-base-content/60 truncate text-xs">
                    {t('settings.autoEndProcess.availablePackagesDescription')}
                  </p>
                </div>
                <label class="input input-bordered bg-base-100 flex h-9 max-w-56 min-w-0 flex-1 items-center gap-2 sm:w-56 sm:flex-none">
                  <Search class="text-base-content/50 h-4 w-4 shrink-0" />
                  <input
                    type="text"
                    class="min-w-0 grow"
                    placeholder={t('settings.autoEndProcess.searchPlaceholder')}
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  />
                </label>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto p-2">
                <Show when={!installedPackagesStore.loading()} fallback={<div>{t('loading')}</div>}>
                  <For each={availablePackages()}>
                    {(pkg) => (
                      <PackageListRow
                        pkg={pkg}
                        iconDataUrl={packageIcons()[pkg.name] ?? null}
                        actionLabel={t('settings.autoEndProcess.addToAllowlist')}
                        onAction={() => addPackage(pkg)}
                        icon={Plus}
                      />
                    )}
                  </For>
                  <Show when={availablePackages().length === 0}>
                    <p class="text-base-content/50 bg-base-100 rounded-lg border p-3 text-sm">
                      {searchQuery()
                        ? t('settings.autoEndProcess.noSearchResults')
                        : t('settings.autoEndProcess.noAvailablePackages')}
                    </p>
                  </Show>
                </Show>
              </div>
            </section>

            <section class="border-base-300 bg-base-200 flex min-h-0 flex-col overflow-hidden rounded-lg border">
              <div class="border-base-300 flex min-h-16 items-center justify-between gap-3 border-b p-3">
                <div class="min-w-0">
                  <h5 class="text-base-content text-sm font-semibold">
                    {t('settings.autoEndProcess.allowlistedPackages')}
                  </h5>
                  <p class="text-base-content/60 truncate text-xs">
                    {t('settings.autoEndProcess.allowlistedPackagesDescription')}
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm shrink-0"
                  disabled={selectedPackages().length === 0}
                  onClick={resetAllowlist}
                >
                  <RotateCcw class="h-4 w-4" />
                  {t('settings.autoEndProcess.reset')}
                </button>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto p-2">
                <Show
                  when={selectedPackages().length > 0}
                  fallback={
                    <div class="text-base-content/50 flex min-h-40 items-center justify-center text-sm">
                      {t('settings.autoEndProcess.noAllowlistedPackages')}
                    </div>
                  }
                >
                  <For each={selectedPackages()}>
                    {(pkg) => (
                      <PackageListRow
                        pkg={pkg}
                        iconDataUrl={packageIcons()[pkg.name] ?? null}
                        actionLabel={t('settings.autoEndProcess.removeFromAllowlist')}
                        onAction={() => removePackage(pkg.name)}
                        icon={X}
                        actionTone="error"
                      />
                    )}
                  </For>
                </Show>
              </div>
            </section>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PackageListRow(props: {
  pkg: PackageOption;
  iconDataUrl?: string | null;
  actionLabel: string;
  onAction: () => void;
  icon: typeof Plus;
  actionTone?: 'error';
}) {
  const Icon = props.icon;

  return (
    <div
      class="hover:bg-base-100 flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5"
      onDblClick={props.onAction}
    >
      <Show
        when={props.iconDataUrl}
        fallback={
          <div class="bg-primary text-primary-content grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-bold">
            <Package class="h-4 w-4" />
          </div>
        }
      >
        <img
          src={props.iconDataUrl ?? undefined}
          alt=""
          class="h-7 w-7 shrink-0 rounded object-contain"
          loading="lazy"
        />
      </Show>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium">{props.pkg.name}</div>
        <Show when={props.pkg.source}>
          <div class="text-base-content/50 truncate text-xs">{props.pkg.source}</div>
        </Show>
      </div>
      <button
        type="button"
        class="btn btn-square btn-ghost btn-sm"
        classList={{ 'text-error': props.actionTone === 'error' }}
        title={props.actionLabel}
        aria-label={props.actionLabel}
        onClick={props.onAction}
      >
        <Icon class="h-4 w-4" />
      </button>
    </div>
  );
}

export default AutoEndProcessSettings;
