import { Component, JSX, Show, createSignal, createEffect } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { RefreshCw } from 'lucide-solid';

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
  children?: JSX.Element | JSX.Element[];
  conditionalContent?: { condition: boolean; children: JSX.Element };
  class?: string;
}

export default function Card(props: CardProps) {
  const [contentHeight, setContentHeight] = createSignal(0);
  let contentRef: HTMLDivElement | undefined;

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
      // Wait for content to render before measuring
      setTimeout(() => {
        if (contentRef) {
          // Include the margin height from my-2 (0.5rem top + 0.5rem bottom = 16px)
          setContentHeight(contentRef.scrollHeight + 16);
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
        <div class="flex items-center justify-between">
          <h2 class="card-title flex items-center text-xl">
            {props.icon && <Dynamic component={props.icon} class="icon mr-2 h-6 w-6" />}

            {props.title}
          </h2>
          <div class="flex items-center gap-2">
            <Show when={props.headerSelect}>
              <div class="dropdown">
                <div tabindex="0" role="button" class="select select-bordered select-sm min-w-35">
                  {props.headerSelect!.options.find((o) => o.value === props.headerSelect!.value)
                    ?.label || 'Select'}
                </div>
                <ul
                  tabindex="0"
                  class="dropdown-content menu bg-base-100 rounded-box border-base-300 z-1 mt-1.5 w-full border p-2 shadow"
                >
                  {props.headerSelect!.options.map((option) => (
                    <li>
                      <a
                        onClick={() =>
                          props.headerSelect!.onChange({
                            currentTarget: { value: option.value },
                          } as any)
                        }
                      >
                        {option.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </Show>
            <Show when={props.headerAction && !props.headerSelect}>
              <div class="form-control">{props.headerAction}</div>
            </Show>
            <Show when={props.onRefresh}>
              <button
                class="btn btn-ghost btn-sm tooltip tooltip-bottom"
                data-tip={props.refreshTooltip || 'Refresh'}
                onClick={props.onRefresh}
              >
                <RefreshCw class="h-5 w-5" />
              </button>
            </Show>
          </div>
        </div>

        <Show when={props.description}>
          <div id={descriptionId}>{props.description}</div>
        </Show>

        <Show when={props.additionalContent}>
          <div id={additionalContentId} class="text text-base-content/50">
            {props.additionalContent}
          </div>
        </Show>

        {props.children}

        <Show when={props.conditionalContent}>
          <div
            role="region"
            aria-expanded={props.conditionalContent!.condition}
            style={{
              'max-height': `${contentHeight()}px`,
              opacity: props.conditionalContent!.condition ? '1' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out 0.1s',
            }}
          >
            <div class="my-2"></div>
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
