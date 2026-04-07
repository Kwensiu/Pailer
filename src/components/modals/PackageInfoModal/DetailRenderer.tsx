import { Show, Switch, Match, createEffect, createMemo, For } from 'solid-js';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import {
  ExternalLink,
  Globe,
  FolderOpen,
  Package as PackageIcon,
  CloudDownload,
  ArrowRightLeft,
  FileText,
} from 'lucide-solid';
import { t } from '../../../i18n';
import { normalizeExternalUrl, sanitizeExternalUrlText } from '../../../utils/format';
import { highlightJson } from '../../../utils/jsonHighlight';
import settingsStore from '../../../stores/settings';
import type { ScoopPackage, VersionedPackageInfo } from '../../../types/scoop';

interface DetailRendererProps {
  key: string;
  value: string;
  label?: string;
  description?: string;
  latestVersion?: string;
  pkg?: ScoopPackage | null;
  iconSrc?: string;
  versionInfo?: VersionedPackageInfo | null;
  onBucketClick?: (bucketName: string) => void;
  onChangeBucket?: (pkg: ScoopPackage) => void;
  onManifestClick?: (pkg: ScoopPackage) => void;
  onVersionSwitch?: () => void;
  onVersionClick?: (version: string) => void;
  disableBucketClick?: boolean;
  disableVersionActions?: boolean;
}

function DetailValue(props: { value: string }) {
  const parsed = createMemo(() => {
    try {
      const parsed = JSON.parse(props.value);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          isJson: true,
          formatted: highlightJson(
            parsed,
            settingsStore.effectiveTheme() === 'dark' ? 'dark' : 'light'
          ),
        };
      }
    } catch {
      // Not JSON, return as-is
    }
    return {
      isJson: false,
      formatted: props.value,
    };
  });

  let codeRef: HTMLElement | undefined;
  createEffect(() => {
    if (parsed() && codeRef) {
      if (parsed().isJson) {
        codeRef.innerHTML = parsed().formatted;
      } else {
        codeRef.textContent = parsed().formatted;
      }
    }

    return () => {
      if (codeRef && codeRef.firstChild) {
        while (codeRef.firstChild) {
          codeRef.removeChild(codeRef.firstChild);
        }
      }
    };
  });

  return (
    <Show when={parsed()}>
      <code ref={codeRef} class="bg-transparent! text-sm" />
    </Show>
  );
}

function IncludesValue(props: { value: string }) {
  const items = createMemo(() => props.value.split(/,\s*/).filter((s) => s.length > 0));
  return (
    <div class="flex flex-wrap gap-2">
      <For each={items()}>
        {(item) => (
          <span class="bg-base-100 border-base-content/10 inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-medium break-all shadow-sm">
            {item}
          </span>
        )}
      </For>
    </div>
  );
}

function LicenseValue(props: { value: string }) {
  const license = createMemo(() => {
    try {
      const p = JSON.parse(props.value);
      if (p && typeof p === 'object' && p.identifier) {
        return {
          identifier: p.identifier as string,
          url: p.url as string | undefined,
        };
      }
    } catch (e) {
      // Not a JSON object string
    }
    return null;
  });

  return (
    <Show when={license()} fallback={<DetailValue value={props.value} />}>
      <Switch>
        <Match when={license()?.url}>
          <a
            href={license()?.url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-base-content/80 hover:text-primary inline-flex w-fit items-center gap-1 text-sm leading-6 transition-colors"
          >
            <span>{license()?.identifier}</span>
            <ExternalLink class="h-3.5 w-3.5 shrink-0" />
          </a>
        </Match>
        <Match when={!license()?.url}>
          <span class="text-base-content/80 min-w-0 text-sm leading-6">
            {license()?.identifier}
          </span>
        </Match>
      </Switch>
    </Show>
  );
}

function NameValue(props: {
  value: string;
  iconSrc?: string;
  pkg?: ScoopPackage | null;
  description?: string;
}) {
  return (
    <div class="border-base-200 bg-base-100 mb-4 -ml-1 flex items-center gap-3 rounded-2xl border px-3 py-3">
      <Show when={props.iconSrc} fallback={<PackageIcon class="text-base-content/45 h-6 w-6" />}>
        <img src={props.iconSrc} alt="" class="h-12 w-12 object-contain" loading="lazy" />
      </Show>

      <div class="min-w-0 flex-1">
        <div class="truncate text-base leading-tight font-semibold">{props.value}</div>
        <Show when={props.description}>
          <div class="text-base-content/55 mt-0.5 text-sm leading-snug">{props.description}</div>
        </Show>
      </div>
    </div>
  );
}

function DescriptionValue(props: { value: string; label?: string }) {
  return (
    <div class="flex flex-col gap-1">
      <Show when={props.label}>
        <span class="detail-label-text">{props.label}</span>
      </Show>
      <p class="text-base-content/85 text-sm leading-6">{props.value}</p>
    </div>
  );
}

function InteractiveButton(props: {
  onClick?: () => void;
  children: any;
  class?: string;
  title?: string;
  tooltip?: string;
  label?: string;
}) {
  return (
    <div class="flex flex-col gap-1">
      <Show when={props.label}>
        <span class="detail-label-text">{props.label}</span>
      </Show>
      <button
        type="button"
        title={props.title}
        class={`detail-button text-primary max-w-full flex-1 ${props.class || ''}`}
        data-tip={props.tooltip}
        onClick={props.onClick}
      >
        {props.children}
      </button>
    </div>
  );
}

export default function DetailRenderer(props: DetailRendererProps) {
  const isVersionRelated = (key: string) => {
    return ['Version', 'Installed Version'].includes(key);
  };

  return (
    <Switch
      fallback={
        <div class="flex flex-col gap-1">
          <Show when={props.label}>
            <span class="detail-label-text">{props.label}</span>
          </Show>

          <DetailValue value={props.value} />
        </div>
      }
    >
      <Match when={props.key === 'Name'}>
        <NameValue
          value={props.value}
          iconSrc={props.iconSrc}
          pkg={props.pkg}
          description={props.description}
        />
      </Match>
      <Match when={props.key === 'Description'}>
        <DescriptionValue value={props.value} label={props.label} />
      </Match>
      <Match when={props.key === 'Homepage'}>
        <Show
          when={normalizeExternalUrl(props.value)}
          fallback={
            <div class="flex flex-col gap-1">
              <Show when={props.label}>
                <span class="detail-label-text">{props.label}</span>
              </Show>
              <div class="py-1">
                <DetailValue value={sanitizeExternalUrlText(props.value)} />
              </div>
            </div>
          }
        >
          {(normalizedUrl) => (
            <InteractiveButton
              title={normalizedUrl()}
              class="max-w-full"
              label={props.label}
              onClick={() => {
                void openUrl(normalizedUrl()).catch((error) => {
                  console.error('Failed to open homepage URL:', error);
                });
              }}
            >
              <Globe class="h-4 w-4 shrink-0" />
              <span class="break-all">{normalizedUrl()}</span>
            </InteractiveButton>
          )}
        </Show>
      </Match>

      <Match when={props.key === 'Bucket'}>
        <div class="flex flex-col gap-1">
          <Show when={props.label}>
            <span class="detail-label-text">{props.label}</span>
          </Show>
          <div class="flex items-center gap-2">
            <button
              type="button"
              disabled={props.disableBucketClick}
              title={
                props.disableBucketClick ? t('packageInfo.bucket') : t('packageInfo.viewBucketInfo')
              }
              class={`detail-button text-primary flex-1 ${
                props.disableBucketClick ? 'cursor-default opacity-70 grayscale-[0.3]' : ''
              }`}
              onClick={() => !props.disableBucketClick && props.onBucketClick?.(props.value)}
            >
              <PackageIcon class="h-4 w-4 shrink-0" />
              <span class="break-all">{props.value}</span>
            </button>
            <Show when={props.pkg && props.onManifestClick}>
              <button
                type="button"
                class="detail-button btn-info min-h-10"
                title={t('packageInfo.viewManifest')}
                onClick={() => props.pkg && props.onManifestClick?.(props.pkg)}
              >
                <FileText class="h-4 w-4 shrink-0" />
                Manifest
              </button>
            </Show>
            <Show when={props.pkg?.is_installed && props.onChangeBucket}>
              <button
                type="button"
                class="detail-button btn-info min-h-10"
                onClick={() => props.pkg && props.onChangeBucket?.(props.pkg)}
              >
                <ArrowRightLeft class="h-4 w-4 shrink-0" />
              </button>
            </Show>
          </div>
        </div>
      </Match>

      <Match when={props.key === 'License'}>
        <div class="flex min-w-0 flex-col gap-1">
          <Show when={props.label}>
            <span class="detail-label-text">{props.label}</span>
          </Show>
          <LicenseValue value={props.value} />
        </div>
      </Match>

      <Match when={props.key === 'Install Date' || props.key === 'Update Date'}>
        <div class="flex min-w-0 flex-col gap-1">
          <Show when={props.label}>
            <span class="detail-label-text">{props.label}</span>
          </Show>
          <span class="text-base-content/80 min-w-0 text-sm leading-6">{props.value}</span>
        </div>
      </Match>

      <Match when={props.key === 'Includes'}>
        <div class="flex flex-col gap-1">
          <Show when={props.label}>
            <span class="detail-label-text">{props.label}</span>
          </Show>
          <IncludesValue value={props.value} />
        </div>
      </Match>

      <Match when={isVersionRelated(props.key)}>
        <div class="flex flex-col gap-1">
          <Show when={props.label}>
            <span class="detail-label-text">{props.label}</span>
          </Show>
          <div class="flex flex-wrap items-center gap-2">
            <Show when={props.versionInfo?.available_versions?.length}>
              {(() => {
                const latest = props.latestVersion || props.versionInfo?.current_version;
                const current = props.versionInfo?.current_version;
                const hasUpdate = latest !== current;
                const sortedVersions = props.versionInfo?.available_versions
                  ?.slice()
                  .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
                const latestExistsInAvailable =
                  !!latest && !!sortedVersions?.some((v) => v.version === latest);
                const latestIsLocal = latestExistsInAvailable;
                const showCloud = hasUpdate && !latestIsLocal;

                return (
                  <>
                    <Show
                      when={showCloud}
                      fallback={
                        <Show when={latest}>
                          <button
                            type="button"
                            class={`${latest === current ? 'version-button-active' : 'version-button-inactive'} ${
                              props.disableVersionActions
                                ? 'cursor-not-allowed opacity-60 hover:border-inherit hover:text-inherit'
                                : ''
                            }`}
                            disabled={props.disableVersionActions}
                            onClick={() => latest && props.onVersionClick?.(latest)}
                          >
                            {latest}
                          </button>
                        </Show>
                      }
                    >
                      <span class="version-tag-base bg-base-200 text-base-content/70 border-base-content/10 gap-1.5">
                        {latest}
                        <CloudDownload class="h-4 w-4" />
                      </span>
                    </Show>
                    <Show when={sortedVersions && sortedVersions.length > 0}>
                      <span class="text-base-content/30 text-xs">|</span>
                      <For each={sortedVersions!.filter((v) => v.version !== latest)}>
                        {(v) => (
                          <button
                            type="button"
                            class={`${v.version === current ? 'version-button-active' : 'version-button-inactive'} ${
                              props.disableVersionActions
                                ? 'cursor-not-allowed opacity-60 hover:border-inherit hover:text-inherit'
                                : ''
                            }`}
                            disabled={props.disableVersionActions}
                            onClick={() => props.onVersionClick?.(v.version)}
                          >
                            {v.version}
                          </button>
                        )}
                      </For>
                    </Show>
                  </>
                );
              })()}
            </Show>
            <Show when={!props.versionInfo?.available_versions?.length}>
              <span class="bg-base-200 inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm">
                {props.value}
              </span>
            </Show>
            <Show when={props.pkg?.is_installed}>
              <button
                class={`btn btn-xs btn-primary rounded-full ${
                  props.disableVersionActions ? 'opacity-70' : ''
                }`}
                disabled={props.disableVersionActions}
                onClick={props.onVersionSwitch}
              >
                {t('buttons.switch')}
              </button>
            </Show>
          </div>
        </div>
      </Match>

      <Match when={props.key === 'Installed'}>
        <InteractiveButton
          title={t('packageInfo.openFolder')}
          class="max-w-full"
          label={props.label}
          onClick={() => {
            void openPath(props.value).catch((error) => {
              console.error('Failed to open installed path:', error);
            });
          }}
        >
          <FolderOpen class="h-4 w-4 shrink-0" />
          <span class="break-all">{props.value}</span>
        </InteractiveButton>
      </Match>
    </Switch>
  );
}
