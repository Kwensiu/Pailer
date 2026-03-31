import { Show, createSignal, onCleanup } from 'solid-js';
import { Download, Copy, Check, Home, BadgeInfo, FileText, Package } from 'lucide-solid';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ScoopPackage } from '../../../types/scoop';
import { t } from '../../../i18n';
import HighlightText from '../../common/HighlightText';
import { toast } from '../../common/ToastAlert';
import {
  buildManifestFileUrl,
  buildManifestCommitUrl,
  detectDefaultBranch,
} from '../../../utils/manifestUrl';
import { normalizeExternalUrl } from '../../../utils/format';

interface SearchResultCardProps {
  pkg: ScoopPackage;
  searchTerm: string;
  onViewInfo: (pkg: ScoopPackage) => void;
  onViewManifest?: (pkg: ScoopPackage) => void;
  onInstall: (pkg: ScoopPackage) => void;
  onContextMenuOpen?: (pkg: ScoopPackage, x: number, y: number) => void;
  onViewBucket?: (bucketName: string) => void;
  bucketGitUrl?: string;
  bucketGitBranch?: string | null;
}

function SearchResultCard(props: SearchResultCardProps) {
  const isInstalled = () => props.pkg.is_installed;
  const isInstalledFromCurrentBucket = () => props.pkg.is_installed_from_current_bucket !== false;

  const [copiedCommand, setCopiedCommand] = createSignal<string | null>(null);
  const [isExpanded, setIsExpanded] = createSignal(false);
  let copiedResetTimeout: number | undefined;

  onCleanup(() => {
    if (copiedResetTimeout !== undefined) {
      window.clearTimeout(copiedResetTimeout);
      copiedResetTimeout = undefined;
    }
  });

  const manifestBranch = () => detectDefaultBranch(props.bucketGitBranch);

  const manifestFileUrl = () =>
    buildManifestFileUrl(props.bucketGitUrl, props.pkg.name, manifestBranch());

  const manifestCommitUrl = () =>
    buildManifestCommitUrl(props.bucketGitUrl, props.pkg.name, manifestBranch());
  const homepageUrl = () => normalizeExternalUrl(props.pkg.homepage);

  const openCommitUrl = async () => {
    const url = manifestCommitUrl();
    if (!url) return;

    try {
      await openUrl(url);
    } catch (error) {
      console.error('Failed to open commit URL:', error);
    }
  };

  const openHomepageUrl = async () => {
    const url = homepageUrl();
    if (!url) return;

    try {
      await openUrl(url);
    } catch (error) {
      console.error('Failed to open homepage URL:', error);
    }
  };

  const copyToClipboard = async (text: string, commandId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(commandId);
      toast.success(t('search.results.copied'));
      if (copiedResetTimeout !== undefined) {
        window.clearTimeout(copiedResetTimeout);
      }
      copiedResetTimeout = window.setTimeout(() => {
        copiedResetTimeout = undefined;
        setCopiedCommand(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const installCommand = () => `scoop install ${props.pkg.source}/${props.pkg.name}`;
  const bucketAddCommand = () => {
    return props.bucketGitUrl ? `scoop bucket add ${props.pkg.source} ${props.bucketGitUrl}` : '';
  };

  const combinedCommands = () => {
    const commands = [bucketAddCommand(), installCommand()].filter(Boolean);
    return commands.join('\n');
  };

  const getRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return t('common.time.today');
      if (diffDays === 1) return t('common.time.yesterday');
      if (diffDays < 30) return t('common.time.daysAgo', { days: diffDays });
      if (diffDays < 365) return t('common.time.monthsAgo', { months: Math.floor(diffDays / 30) });
      return t('common.time.yearsAgo', { years: Math.floor(diffDays / 365) });
    } catch {
      return dateString;
    }
  };

  const toggleExpanded = (e: MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded());
  };

  const toggleExpandedFromKeyboard = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded(!isExpanded());
    }
  };

  return (
    <div
      class="group bg-base-card hover:border-base-300 mb-4 overflow-hidden rounded-2xl shadow-sm transition-all duration-200 hover:shadow-lg"
      data-contextmenu-allow="true"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onContextMenuOpen?.(props.pkg, e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          props.onContextMenuOpen?.(
            props.pkg,
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
        }
      }}
      tabIndex={0}
      aria-label={`${props.pkg.name} package actions`}
    >
      <div
        class="border-base-200/80 bg-base-100/30 hover:bg-base-100/50 focus-visible:ring-primary/40 cursor-pointer rounded-2xl border px-5 py-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded()}
        aria-label={t('search.results.toggleDetails')}
        onClick={(e) => {
          // Only expand/collapse when clicking non-interactive elements
          if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) {
            return;
          }
          toggleExpanded(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpandedFromKeyboard(e);
          }
        }}
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="bg-primary/10 text-primary ring-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset">
              <Package class="h-4 w-4" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  class="text-base-content hover:bg-base-content/10 hover:text-primary focus-visible:ring-primary/40 cursor-pointer truncate rounded-md px-2 py-0.5 text-lg font-bold tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onViewInfo(props.pkg);
                  }}
                  title={props.pkg.name}
                >
                  <HighlightText text={props.pkg.name} query={props.searchTerm} />
                </button>
                <button
                  type="button"
                  class="bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-primary/40 cursor-pointer rounded-lg px-2 py-1 font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onViewBucket?.(props.pkg.source);
                  }}
                  title={t('search.results.viewBucket')}
                >
                  <HighlightText text={props.pkg.source} query={props.searchTerm} />
                </button>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <Show when={isInstalled()}>
              <span
                class={`${isInstalledFromCurrentBucket() ? '' : 'tooltip tooltip-bottom'} inline-flex`}
                data-tip={
                  isInstalledFromCurrentBucket()
                    ? undefined
                    : t('search.results.installedDifferentBucketTooltip')
                }
              >
                <span
                  class={
                    isInstalledFromCurrentBucket()
                      ? 'bg-success/10 text-success ring-success/10 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset'
                      : 'bg-base-200/80 text-base-content/80 ring-base-300 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset'
                  }
                >
                  {t('search.results.installed')}
                </span>
              </span>
            </Show>
            <div class="bg-base-200/60 text-base-content/60 flex items-center gap-2 rounded-full px-2 py-1 text-xs">
              <Show when={props.pkg.updated}>
                <button
                  type="button"
                  class="hover:text-primary cursor-pointer transition-colors hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void openCommitUrl();
                  }}
                  title={manifestCommitUrl() ? t('search.results.viewCommits') : undefined}
                >
                  {getRelativeTime(props.pkg.updated)}
                </button>
              </Show>
              <span class="text-base-content/30">|</span>
              <button
                type="button"
                class="hover:text-primary cursor-pointer transition-colors hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onViewManifest?.(props.pkg);
                }}
                title={manifestFileUrl() ? t('search.results.viewManifest') : undefined}
              >
                v{props.pkg.version}
              </button>
            </div>
            <Show when={!isInstalled()}>
              <button
                class="btn btn-primary btn-square btn-sm rounded-xl"
                aria-label={t('search.results.install')}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onInstall(props.pkg);
                }}
              >
                <Download class="h-4 w-4" />
              </button>
            </Show>
          </div>
        </div>
      </div>

      <div
        class="grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-in-out"
        style={{
          'grid-template-rows': isExpanded() ? '1fr' : '0fr',
          opacity: isExpanded() ? '1' : '0',
        }}
      >
        <div class="min-h-0 overflow-hidden" aria-hidden={!isExpanded()} inert={!isExpanded()}>
          <div class="grid grid-cols-1 px-5 py-4 lg:grid-cols-5 lg:gap-4">
            <div class="space-y-3 lg:col-span-3">
              <Show when={props.pkg.info}>
                <p class="text-base-content/75 line-clamp-3 max-w-2xl text-sm leading-relaxed">
                  {props.pkg.info}
                </p>
              </Show>

              <div class="text-base-content/70 space-y-2 text-sm">
                <Show when={homepageUrl()}>
                  <div class="flex items-start gap-2 break-all">
                    <Home class="text-primary/70 mt-0.5 h-4 w-4 shrink-0" />
                    <button
                      type="button"
                      class="text-primary hover:text-primary/80 cursor-pointer transition-colors hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openHomepageUrl();
                      }}
                    >
                      {homepageUrl()}
                    </button>
                  </div>
                </Show>

                <Show when={props.pkg.license}>
                  <div class="flex items-start gap-2 break-all">
                    <BadgeInfo class="text-primary/70 mt-0.5 h-4 w-4 shrink-0" />
                    <span>{props.pkg.license}</span>
                  </div>
                </Show>

                <Show when={props.pkg.notes && props.pkg.notes.trim().length > 0}>
                  <div class="flex items-start gap-2 break-all">
                    <FileText class="text-primary/70 mt-0.5 h-4 w-4 shrink-0" />
                    <span>{props.pkg.notes}</span>
                  </div>
                </Show>
              </div>

              <div class="flex flex-wrap items-center gap-2 text-xs">
                <Show when={props.pkg.installation_type === 'versioned'}>
                  <span class="bg-info/10 text-info ring-info/10 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset">
                    {t('search.results.versionedSupport')}
                  </span>
                </Show>
                <Show when={props.pkg.installation_type === 'custom'}>
                  <span class="bg-warning/10 text-warning ring-warning/10 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset">
                    {t('search.results.customInstall')}
                  </span>
                </Show>
                <Show when={props.pkg.has_multiple_versions}>
                  <span class="bg-secondary/10 text-secondary-content ring-secondary/10 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset">
                    {t('search.results.multipleVersionsInstalled')}
                  </span>
                </Show>
              </div>
            </div>

            <div class="lg:col-span-2">
              <div class="border-base-200/80 bg-base-100/50 space-y-3 rounded-2xl border p-3">
                <Show when={bucketAddCommand()}>
                  <div class="grid grid-cols-[1fr_auto] items-stretch gap-x-3 gap-y-0">
                    <div class="space-y-3">
                      <div class="border-base-200 bg-base-200/60 flex items-center gap-2 rounded-xl border px-3 py-2">
                        <span class="text-base-content/50 shrink-0 font-mono text-xs">&gt;</span>
                        <input
                          type="text"
                          readonly
                          value={bucketAddCommand()}
                          class="text-base-content min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          class="btn btn-ghost btn-xs btn-square shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(bucketAddCommand(), 'bucket-add');
                          }}
                          title={t('search.results.copyCommand')}
                        >
                          <Show
                            when={copiedCommand() === 'bucket-add'}
                            fallback={<Copy class="h-4 w-4 shrink-0" />}
                          >
                            <Check class="text-success h-4 w-4 shrink-0" />
                          </Show>
                        </button>
                      </div>

                      <div class="border-base-200 bg-base-200/60 flex items-center gap-2 rounded-xl border px-3 py-2">
                        <span class="text-base-content/50 shrink-0 font-mono text-xs">&gt;</span>
                        <input
                          type="text"
                          readonly
                          value={installCommand()}
                          class="text-base-content min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          class="btn btn-ghost btn-xs btn-square shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(installCommand(), 'install');
                          }}
                          title={t('search.results.copyCommand')}
                        >
                          <Show
                            when={copiedCommand() === 'install'}
                            fallback={<Copy class="h-4 w-4 shrink-0" />}
                          >
                            <Check class="text-success h-4 w-4 shrink-0" />
                          </Show>
                        </button>
                      </div>
                    </div>

                    <button
                      class="btn btn-ghost btn-sm hover:bg-base-200 border-base-200 bg-base-200/60 row-span-2 h-full min-h-0 w-9 self-stretch rounded-xl border"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(combinedCommands(), 'all');
                      }}
                      title={t('search.results.copyCommand')}
                    >
                      <Show
                        when={copiedCommand() === 'all'}
                        fallback={<Copy class="h-4 w-4 shrink-0" />}
                      >
                        <Check class="text-success h-4 w-4 shrink-0" />
                      </Show>
                    </button>
                  </div>
                </Show>

                <Show when={!bucketAddCommand()}>
                  <div class="grid grid-cols-[1fr_auto] gap-3">
                    <div class="border-base-200 bg-base-200/60 flex items-center gap-2 rounded-xl border px-3 py-2">
                      <span class="text-base-content/50 shrink-0 font-mono text-xs">&gt;</span>
                      <input
                        type="text"
                        readonly
                        value={installCommand()}
                        class="text-base-content min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <button
                      class="btn btn-ghost btn-sm h-full min-h-[3.1rem] w-10 self-stretch rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(installCommand(), 'install');
                      }}
                      title={t('search.results.copyCommand')}
                    >
                      <Show
                        when={copiedCommand() === 'install'}
                        fallback={<Copy class="h-4 w-4" />}
                      >
                        <Check class="text-success h-4 w-4" />
                      </Show>
                    </button>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchResultCard;
