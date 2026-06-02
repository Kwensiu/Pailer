import { createSignal, Show } from 'solid-js';
import { CircleArrowUp, CircleX, LoaderCircle } from 'lucide-solid';
import { t } from '../../../i18n';
import type { ScoopPackage } from '../../../types/scoop';
import { useRunningUpdateOperation } from '../../../hooks/packages/useRunningUpdateOperation';

interface PackageUpdateActionProps {
  pkg: ScoopPackage;
  onUpdate: (pkg: ScoopPackage) => void;
  tooltip?: string;
  tooltipClass?: string;
  class?: string;
  iconClass?: string;
  stopPropagation?: boolean;
}

export default function PackageUpdateAction(props: PackageUpdateActionProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const updateOperation = useRunningUpdateOperation({
    packageName: () => props.pkg.name,
    logPrefix: 'PackageUpdateAction',
  });

  const handleClick = (e: MouseEvent) => {
    if (props.stopPropagation !== false) {
      e.stopPropagation();
    }

    if (updateOperation.isActive()) {
      updateOperation.requestCancel();
      return;
    }

    props.onUpdate(props.pkg);
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  return (
    <div
      class={`tooltip inline-flex h-4 w-4 items-center justify-center align-middle leading-none ${
        props.tooltipClass ?? ''
      } ${props.class ?? ''}`}
      data-tip={
        updateOperation.isActive()
          ? t('buttons.cancel')
          : (props.tooltip ?? t('installed.list.update'))
      }
    >
      <button
        type="button"
        class={`inline-flex h-4 w-4 cursor-pointer items-center justify-center p-0 leading-none transition-transform hover:scale-125 ${
          updateOperation.isActive() ? 'text-info hover:text-error' : 'text-primary'
        }`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={
          updateOperation.isActive()
            ? t('buttons.cancel')
            : (props.tooltip ?? t('installed.list.update'))
        }
      >
        <Show
          when={updateOperation.isActive()}
          fallback={<CircleArrowUp class={`h-4 w-4 ${props.iconClass ?? ''}`} />}
        >
          <Show
            when={isHovered()}
            fallback={<LoaderCircle class={`h-4 w-4 animate-spin ${props.iconClass ?? ''}`} />}
          >
            <CircleX class={`h-4 w-4 ${props.iconClass ?? ''}`} />
          </Show>
        </Show>
      </button>
    </div>
  );
}
