import { Component, JSX, Show, createSignal, onMount } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { RefreshCw, Folder } from 'lucide-solid';
import { t } from '../../i18n';
import Dropdown from '../common/Dropdown';

interface CardProps {
  title: string | JSX.Element;
  icon?: Component<{ class?: string }>;
  description?: string | JSX.Element;
  additionalContent?: JSX.Element;
  headerAction?: JSX.Element;
  headerSelect?: {
    value: string;
    onChange: (e: Event) => void;
    options: { value: string; label: string; icon?: Component<{ class?: string }> }[];
  };
  onRefresh?: () => void;
  refreshTooltip?: string;
  onOpenPath?: () => void;
  openPathTooltip?: string;
  children?: JSX.Element | JSX.Element[];
  conditionalContent?: { condition: boolean; children: JSX.Element };
  class?: string;
}

export default function Card(props: CardProps) {
  const [transitionEnabled, setTransitionEnabled] = createSignal(false);

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
      class={`card bg-base-100 shadow-sm ${props.class ?? ''}`}
      aria-describedby={descriptionId}
    >
      <div class="card-body p-4">
        {/* Card Header */}
        <div class="flex items-center justify-between">
          {/* Card Title */}
          <h2 class="card-title flex items-center text-xl">
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
                onClick={props.onRefresh}
              >
                <RefreshCw class="h-5 w-5" />
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
          <div id={descriptionId}>{props.description}</div>
        </Show>

        {/* Additional Content */}
        <Show when={props.additionalContent}>
          <div id={additionalContentId} class="text text-base-content/50">
            {props.additionalContent}
          </div>
        </Show>

        {/* Main Content */}
        {props.children}

        <Show when={props.conditionalContent}>
          {/* Conditional Content Container */}
          <div
            role="region"
            aria-expanded={props.conditionalContent!.condition}
            aria-hidden={!props.conditionalContent!.condition}
            inert={!props.conditionalContent!.condition}
            class="grid overflow-hidden"
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
              <div class="my-2"></div>
              {/* Conditional Content Inner */}
              <div class="bg-base-200 border-base-300 rounded-lg border p-4 shadow-sm">
                {props.conditionalContent!.children}
              </div>
            </div>
          </div>
        </Show>
      </div>
    </section>
  );
}
