import { Show, createSignal } from 'solid-js';
import { Download, Copy, Check, Home, BadgeInfo, FileText, Package } from 'lucide-solid';
import { ScoopPackage } from '../../../types/scoop';
import { t } from '../../../i18n';
import HighlightText from '../../common/HighlightText';

interface SearchResultCardProps {
  pkg: ScoopPackage;
  searchTerm: string;
  onViewInfo: (pkg: ScoopPackage) => void;
  onInstall: (pkg: ScoopPackage) => void;
  onViewBucket?: (bucketName: string) => void;
  bucketGitUrl?: string;
}

function SearchResultCard(props: SearchResultCardProps) {
  const isInstalled = () => props.pkg.is_installed;

  const [copiedCommand, setCopiedCommand] = createSignal<string | null>(null);
  const [isExpanded, setIsExpanded] = createSignal(false);

  const copyToClipboard = async (text: string, commandId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(commandId);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const installCommand = () => `scoop install ${props.pkg.source}/${props.pkg.name}`;
  const bucketAddCommand = () => {
    return props.bucketGitUrl ? `scoop bucket add ${props.pkg.source} ${props.bucketGitUrl}` : '';
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

  return (
    <div class="group bg-base-card hover:border-base-300 mb-4 overflow-hidden rounded-2xl shadow-sm transition-all duration-200 hover:shadow-lg">
      <div
        class="border-base-200/80 bg-base-100/30 hover:bg-base-100/50 cursor-pointer rounded-2xl border px-5 py-4 transition-colors"
        onClick={(e) => {
          // Only expand/collapse when clicking non-interactive elements
          if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) {
            return;
          }
          toggleExpanded(e);
        }}
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="bg-primary/10 text-primary ring-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset">
              <Package class="h-4 w-4" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3
                  class="text-base-content cursor-pointer truncate text-lg font-bold tracking-tight"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onViewInfo(props.pkg);
                  }}
                >
                  <HighlightText text={props.pkg.name} query={props.searchTerm} />
                </h3>
                <span class="text-base-content/60 text-base">in</span>
                <span
                  class="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer rounded-lg px-2 py-1 font-semibold transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onViewBucket?.(props.pkg.source);
                  }}
                  title={t('search.results.viewBucket')}
                >
                  <HighlightText text={props.pkg.source} query={props.searchTerm} />
                </span>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <Show when={isInstalled()}>
              <span class="bg-success/10 text-success ring-success/10 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
                {t('search.results.installed')}
              </span>
            </Show>
            <div class="bg-base-200/60 text-base-content/60 flex items-center gap-2 rounded-full px-2 py-1 text-xs">
              <Show when={props.pkg.updated}>
                <span>{getRelativeTime(props.pkg.updated)}</span>
              </Show>
              <span class="text-base-content/30">|</span>
              <span>v{props.pkg.version}</span>
            </div>
            <Show when={!isInstalled()}>
              <button
                class="btn btn-primary btn-square btn-sm rounded-xl"
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
        class="grid transition-all duration-300 ease-in-out"
        style={{
          'grid-template-rows': isExpanded() ? '1fr' : '0fr',
          opacity: isExpanded() ? '1' : '0',
        }}
      >
        <div class="min-h-0 overflow-hidden">
          <div class="grid grid-cols-1 px-5 py-4 lg:grid-cols-5 lg:gap-4">
            <div class="space-y-3 lg:col-span-3">
              <Show when={props.pkg.info}>
                <p class="text-base-content/75 line-clamp-3 max-w-2xl text-sm leading-relaxed">
                  {props.pkg.info}
                </p>
              </Show>

              <div class="text-base-content/70 space-y-2 text-sm">
                <Show when={props.pkg.homepage}>
                  <div class="flex items-start gap-2 break-all">
                    <Home class="text-primary/70 mt-0.5 h-4 w-4 shrink-0" />
                    <a
                      href={props.pkg.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary hover:text-primary/80 cursor-pointer transition-colors hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {props.pkg.homepage}
                    </a>
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
                        fallback={<Copy class="h-4 w-4" />}
                      >
                        <Check class="text-success h-4 w-4" />
                      </Show>
                    </button>
                  </div>
                </Show>

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
                    <Show when={copiedCommand() === 'install'} fallback={<Copy class="h-4 w-4" />}>
                      <Check class="text-success h-4 w-4" />
                    </Show>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchResultCard;
