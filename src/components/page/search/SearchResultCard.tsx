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
}

function SearchResultCard(props: SearchResultCardProps) {
  const isInstalled = () => props.pkg.is_installed;
  
  const [copiedCommand, setCopiedCommand] = createSignal<string | null>(null);

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

  return (
    <div class="group mb-4 overflow-hidden rounded-2xl border border-base-200 bg-base-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-base-300 hover:shadow-lg">
      <div class="border-b border-base-200/80 bg-base-100/30 px-5 py-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/10">
              <Package class="h-4 w-4" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3
                  class="cursor-pointer truncate text-base font-semibold tracking-tight text-base-content"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onViewInfo(props.pkg);
                  }}
                >
                  <HighlightText text={props.pkg.name} query={props.searchTerm} />
                </h3>
                <span class="text-sm text-base-content/60">in</span>
                <span class="font-medium text-primary/80">
                  <HighlightText text={props.pkg.source} query={props.searchTerm} />
                </span>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <Show when={isInstalled()}>
              <span class="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success ring-1 ring-inset ring-success/10">
                {t('search.results.installed')}
              </span>
            </Show>
            <div class="flex items-center gap-2 rounded-full bg-base-200/60 px-2 py-1 text-xs text-base-content/60">
              <Show when={props.pkg.updated}>
                <span>{getRelativeTime(props.pkg.updated)}</span>
              </Show>
              <span class="text-base-content/30">|</span>
              <span>v{props.pkg.version}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 px-5 py-4 lg:grid-cols-5 lg:gap-4">
        <div class="space-y-3 lg:col-span-3">
          <Show when={props.pkg.info}>
            <p class="max-w-2xl text-sm leading-relaxed text-base-content/75 line-clamp-3">
              {props.pkg.info}
            </p>
          </Show>

          <div class="space-y-2 text-sm text-base-content/70">
            <Show when={props.pkg.homepage}>
              <div class="flex items-start gap-2 break-all">
                <Home class="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <span>{props.pkg.homepage}</span>
              </div>
            </Show>

            <Show when={props.pkg.license}>
              <div class="flex items-start gap-2 break-all">
                <BadgeInfo class="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <span>{props.pkg.license}</span>
              </div>
            </Show>

            <Show when={props.pkg.notes && props.pkg.notes.trim().length > 0}>
              <div class="flex items-start gap-2 break-all">
                <FileText class="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <span>{props.pkg.notes}</span>
              </div>
            </Show>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs">
            <Show when={props.pkg.installation_type === 'versioned'}>
              <span class="rounded-full bg-info/10 px-2.5 py-1 font-medium text-info ring-1 ring-inset ring-info/10">
                {t('search.results.versionedSupport')}
              </span>
            </Show>
            <Show when={props.pkg.installation_type === 'custom'}>
              <span class="rounded-full bg-warning/10 px-2.5 py-1 font-medium text-warning ring-1 ring-inset ring-warning/10">
                {t('search.results.customInstall')}
              </span>
            </Show>
            <Show when={props.pkg.has_multiple_versions}>
              <span class="rounded-full bg-secondary/10 px-2.5 py-1 font-medium text-secondary-content ring-1 ring-inset ring-secondary/10">
                {t('search.results.multipleVersionsInstalled')}
              </span>
            </Show>
          </div>
        </div>

        <div class="lg:col-span-2">
          <div class="space-y-3 rounded-2xl border border-base-200/80 bg-base-100/50 p-3">
            <div class="flex items-center gap-2 rounded-xl border border-base-200 bg-base-200/60 px-3 py-2">
              <span class="shrink-0 font-mono text-xs text-base-content/50">&gt;</span>
              <input
                type="text"
                readonly
                value={installCommand()}
                class="min-w-0 flex-1 bg-transparent font-mono text-xs text-base-content outline-none"
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
                  <Check class="h-4 w-4 text-success" />
                </Show>
              </button>
            </div>

            <Show when={!isInstalled()}>
              <button
                class="btn btn-primary btn-sm w-full rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onInstall(props.pkg);
                }}
              >
                <Download class="mr-1 h-4 w-4" />
                {t('search.results.quickInstall')}
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchResultCard;
