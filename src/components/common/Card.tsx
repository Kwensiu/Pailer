import { Component, JSX, Show, children, createSignal, onMount } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { RefreshCw, Folder } from 'lucide-solid';
import { t } from '../../i18n';
import Dropdown from '../common/Dropdown';

interface CardProps {
  // Structure
  title: string | JSX.Element;
  icon?: Component<{ class?: string }>;
  description?: string | JSX.Element;
  additionalContent?: JSX.Element;
  contentContainer?: boolean;
  children?: JSX.Element | JSX.Element[];
  conditionalContent?: { condition: boolean; children: JSX.Element };
  class?: string;

  // Header actions
  headerAction?: JSX.Element;
  headerSelect?: {
    value: string;
    onChange: (e: Event) => void;
    options: { value: string; label: string; icon?: Component<{ class?: string }> }[];
  };

  // Refresh / busy state
  onRefresh?: () => void | Promise<void>;
  loading?: boolean;
  loadingLabel?: string;
  loadingPlaceholder?: JSX.Element;
  showLoadingPlaceholder?: boolean;
  staleWhileRefreshing?: boolean;
  dimContentWhenBusy?: boolean;
  lockContentWhenBusy?: boolean;
  refreshTooltip?: string;
  /**
   * Optional error handler for refresh failures.
   * If not provided, errors will only be logged to console.
   * This is intentional - refresh failures should not crash the UI.
   */
  onError?: (error: unknown) => void;

  // Path action
  onOpenPath?: () => void;
  openPathTooltip?: string;
}

export default function Card(props: CardProps) {
  const [transitionEnabled, setTransitionEnabled] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const resolvedChildren = children(() => props.children);
  const hasChildren = () => {
    const value = resolvedChildren();
    return Array.isArray(value) ? value.length > 0 : !!value;
  };
  const contentContainer = () => props.contentContainer ?? true;
  const isBusy = () => refreshing() || !!props.loading;
  const dimContentWhenBusy = () => props.dimContentWhenBusy ?? true;
  const lockContentWhenBusy = () => props.lockContentWhenBusy ?? true;
  const shouldShowLoadingPlaceholder = () =>
    (props.showLoadingPlaceholder ?? !!props.loading) && isBusy();
  const staleWhileRefreshing = () => props.staleWhileRefreshing ?? true;
  const hasBodyContent = () => !!props.additionalContent || hasChildren();
  const shouldReplaceWithLoading = () =>
    shouldShowLoadingPlaceholder() && !(staleWhileRefreshing() && hasBodyContent());
  const renderLoadingPlaceholder = () =>
    props.loadingPlaceholder || (
      <div class="flex min-h-28 items-center justify-center">
        <div class="text-base-content/70 flex items-center gap-2 text-sm">
          <span class="loading loading-spinner loading-md"></span>
          <span>{props.loadingLabel || t('messages.loading')}</span>
        </div>
      </div>
    );

  const handleRefresh = async () => {
    if (!props.onRefresh || refreshing()) {
      return;
    }

    setRefreshing(true);
    const startTime = Date.now();

    try {
      await props.onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
      // Call error handler if provided
      // Note: Errors are intentionally not re-thrown to avoid unhandled promise rejections
      // and to prevent refresh failures from crashing the UI
      props.onError?.(error);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 300 - elapsed);

      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }

      setRefreshing(false);
    }
  };

  const headerSelectSelectedLabel = () => {
    const headerSelect = props.headerSelect;
    if (!headerSelect) return 'Select';

    return headerSelect.options.find((o) => o.value === headerSelect.value)?.label || 'Select';
  };

  const headerSelectItems = () => {
    const headerSelect = props.headerSelect;
    if (!headerSelect) return [];

    return headerSelect.options.map((option) => ({
      label: option.label,
      icon: option.icon,
      onClick: () => {
        const event = new Event('change', { bubbles: true });
        Object.defineProperty(event, 'currentTarget', {
          value: { value: option.value },
          writable: false,
        });
        headerSelect.onChange(event);
      },
    }));
  };

  onMount(() => {
    // Defer transitions until after first paint so initially expanded cards
    // do not animate open during reload or hydration.
    requestAnimationFrame(() => {
      setTransitionEnabled(true);
    });
  });

  const descriptionId =
    typeof props.title === 'string' && props.description
      ? `card-desc-${props.title.replace(/\s+/g, '-').toLowerCase()}`
      : undefined;

  const additionalContentId =
    typeof props.title === 'string' && props.additionalContent
      ? `card-additional-${props.title.replace(/\s+/g, '-').toLowerCase()}`
      : undefined;

  return (
    <section
      class={`card bg-base-100 shadow-md ${props.class ?? ''}`}
      aria-describedby={descriptionId}
    >
      <div class="card-body p-4">
        {/* Card Header */}
        <div class="flex items-center justify-between">
          {/* Card Title */}
          <h2 class="card-title flex items-center pt-0.5 text-xl">
            {props.icon && <Dynamic component={props.icon} class="icon mr-2 h-6 w-6" />}
            {props.title}
          </h2>
          {/* Header Actions */}
          <div class="flex items-center gap-2">
            <Show when={props.headerSelect}>
              {/* Select Dropdown */}
              <Dropdown
                items={headerSelectItems()}
                position="end"
                trigger={headerSelectSelectedLabel()}
                triggerClass="select select-bordered select-sm min-w-35 text-start border border-base-300 bg-base-200/50"
                selectMode={true}
              />
            </Show>
            <Show when={props.headerAction && !props.headerSelect}>
              {/* Custom Action */}
              <div class="form-control">{props.headerAction}</div>
            </Show>
            <Show when={props.onRefresh}>
              {/* Refresh Button */}
              <button
                class="btn btn-ghost btn-sm tooltip tooltip-bottom"
                data-tip={props.refreshTooltip || t('buttons.refresh')}
                onClick={handleRefresh}
                disabled={isBusy()}
              >
                <RefreshCw class={`h-5 w-5 ${isBusy() ? 'animate-spin' : ''}`} />
              </button>
            </Show>
            <Show when={props.onOpenPath}>
              {/* Open Path Button */}
              <button
                class="btn btn-ghost btn-circle btn-sm tooltip tooltip-bottom"
                data-tip={props.openPathTooltip || t('buttons.openPath')}
                onClick={props.onOpenPath}
              >
                <Folder class="h-5 w-5" />
              </button>
            </Show>
          </div>
        </div>

        {/* Card Description */}
        <Show when={props.description}>
          <div class={'text-base-content/60 whitespace-pre-line'} id={descriptionId}>
            {props.description}
          </div>
        </Show>
        <Show when={props.additionalContent || hasChildren()}>
          <div
            classList={{
              'opacity-60': isBusy() && dimContentWhenBusy(),
              'pointer-events-none select-none': isBusy() && lockContentWhenBusy(),
              'transition-opacity duration-200': true,
            }}
            aria-busy={isBusy()}
          >
            <Show
              when={contentContainer()}
              fallback={
                <>
                  <Show when={shouldReplaceWithLoading()}>{renderLoadingPlaceholder()}</Show>
                  <Show when={props.additionalContent}>
                    <div id={additionalContentId} class="text text-base-content/50">
                      {props.additionalContent}
                    </div>
                  </Show>
                  <Show when={!shouldReplaceWithLoading() && hasChildren()}>
                    {resolvedChildren()}
                  </Show>
                </>
              }
            >
              <div class="border-base-200 bg-base-200/30 mt-1 rounded-xl border p-3">
                <Show when={shouldReplaceWithLoading()}>{renderLoadingPlaceholder()}</Show>
                {/* Additional Content */}
                <Show when={props.additionalContent}>
                  <div id={additionalContentId} class="text text-base-content/50">
                    {props.additionalContent}
                  </div>
                </Show>

                {/* Main Content */}
                <Show when={!shouldReplaceWithLoading() && hasChildren()}>
                  {resolvedChildren()}
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={props.conditionalContent}>
          {/* Conditional Content Container */}
          <div
            role="region"
            aria-expanded={props.conditionalContent!.condition}
            aria-hidden={!props.conditionalContent!.condition}
            inert={!props.conditionalContent!.condition}
            class="-mt-2 grid overflow-hidden"
            style={{
              'grid-template-rows': props.conditionalContent!.condition ? '1fr' : '0fr',
              opacity: props.conditionalContent!.condition ? '1' : '0',
              'pointer-events': props.conditionalContent!.condition ? 'auto' : 'none',
              transition: transitionEnabled()
                ? 'grid-template-rows 0.3s ease-in-out, opacity 0.2s ease-in-out 0.1s'
                : 'none',
            }}
          >
            <div class="min-h-0 overflow-hidden">
              {/* Conditional Content Inner */}
              <div class="bg-base-200 border-base-300 mt-2 rounded-lg border p-4 shadow-sm">
                {props.conditionalContent!.children}
              </div>
            </div>
          </div>
        </Show>
      </div>
    </section>
  );
}
