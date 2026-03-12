import { Component, JSX, Show, createSignal, createEffect, onMount } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { RefreshCw, Folder } from 'lucide-solid';
import { t } from '../../i18n';

interface CardProps {
  title: string | JSX.Element;
  icon?: Component<{ class?: string }>;
  description?: string | JSX.Element;
  additionalContent?: JSX.Element;
  headerAction?: JSX.Element;
  headerSelect?: {
    value: string;
    onChange: (e: Event) => void;
    options: { value: string; label: string }[];
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
  const [contentHeight, setContentHeight] = createSignal(0);
  const [transitionEnabled, setTransitionEnabled] = createSignal(false);
  let contentRef: HTMLDivElement | undefined;

  onMount(() => {
    if (props.conditionalContent?.condition && contentRef) {
      const prevSibling = contentRef.previousElementSibling as HTMLElement;
      const marginTop = parseFloat(getComputedStyle(prevSibling).marginTop) || 0;
      const marginBottom = parseFloat(getComputedStyle(prevSibling).marginBottom) || 0;
      setContentHeight(contentRef.scrollHeight + marginTop + marginBottom);
      setTimeout(() => setTransitionEnabled(true), 0);
    } else {
      setTransitionEnabled(true);
    }
  });

  const descriptionId =
    typeof props.title === 'string' && props.description
      ? `card-desc-${props.title.replace(/\s+/g, '-').toLowerCase()}`
      : undefined;

  const additionalContentId =
    typeof props.title === 'string' && props.additionalContent
      ? `card-additional-${props.title.replace(/\s+/g, '-').toLowerCase()}`
      : undefined;

  createEffect(() => {
    if (props.conditionalContent?.condition) {
      setTimeout(() => {
        if (contentRef) {
          const updateHeight = () => {
            const prevSibling = contentRef.previousElementSibling as HTMLElement;
            const marginTop = parseFloat(getComputedStyle(prevSibling).marginTop) || 0;
            const marginBottom = parseFloat(getComputedStyle(prevSibling).marginBottom) || 0;
            setContentHeight(contentRef.scrollHeight + marginTop + marginBottom);
          };
          updateHeight();
          const observer = new ResizeObserver(updateHeight);
          observer.observe(contentRef);
          return () => observer.disconnect();
        }
      }, 10);
    } else {
      setContentHeight(0);
    }
  });

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
              {/* Dropdown Select */}
              <div class="dropdown">
                <div tabindex="0" role="button" class="select select-bordered select-sm min-w-35">
                  {props.headerSelect!.options.find((o) => o.value === props.headerSelect!.value)
                    ?.label || 'Select'}
                </div>
                <ul
                  tabindex="0"
                  class="dropdown-content menu bg-base-100 rounded-box border-base-300 z-1 mt-1.5 w-full border p-2"
                >
                  {props.headerSelect!.options.map((option) => (
                    <li>
                      <a
                        onClick={() => {
                          const event = new Event('change', { bubbles: true });
                          Object.defineProperty(event, 'currentTarget', {
                            value: { value: option.value },
                            writable: false,
                          });
                          props.headerSelect!.onChange(event);
                        }}
                      >
                        {option.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
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
            style={{
              'max-height': `${contentHeight()}px`,
              opacity: props.conditionalContent!.condition ? '1' : '0',
              overflow: 'hidden',
              transition: transitionEnabled()
                ? 'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out 0.1s'
                : 'none',
            }}
          >
            <div class="my-2"></div>
            {/* Conditional Content Inner */}
            <div
              ref={contentRef}
              class="bg-base-200 border-base-300 rounded-lg border p-4 shadow-sm"
            >
              {props.conditionalContent!.children}
            </div>
          </div>
        </Show>
      </div>
    </section>
  );
}
