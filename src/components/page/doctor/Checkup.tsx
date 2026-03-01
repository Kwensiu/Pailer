import { For, Show } from 'solid-js';
import { CircleCheckBig, CircleX, TriangleAlert, Download } from 'lucide-solid';
import Card from '../../common/Card';
import { t } from '../../../i18n';

export interface CheckupItem {
  id: string | null;
  status: boolean;
  key: string;
  params: any;
  suggestion_key: string | null;
  suggestion_params: any;
}

interface CheckupProps {
  checkupResult: CheckupItem[];
  isLoading: boolean;
  isRetrying?: boolean;
  error: string | null;
  onRerun: () => void;
  onInstallHelper: (helperId: string) => void;
  installingHelper: string | null;
}

function Checkup(props: CheckupProps) {
  return (
    <Card
      title={t('doctor.checkup.title')}
      icon={CircleCheckBig}
      onRefresh={props.onRerun}
      description={t('doctor.checkup.description')}
    >
      <Show when={props.isLoading}>
        <div class="flex justify-center p-8">
          <span class="loading loading-dots loading-lg"></span>
        </div>
      </Show>

      <Show when={props.error}>
        <div class="alert alert-error text-sm">
          <TriangleAlert class="h-5 w-5" />
          <span>{props.error}</span>
        </div>
      </Show>

      <Show when={!props.isLoading && !props.error && props.checkupResult.length === 0}>
        <div class="alert alert-success text-sm">
          <CircleCheckBig class="h-5 w-5" />
          <span>{t('doctor.checkup.noIssues')}</span>
        </div>
      </Show>
      <Show when={!props.isLoading && !props.error && props.checkupResult.length > 0}>
        <ul class="space-y-3">
          <For each={props.checkupResult}>
            {(item) => (
              <li class="bg-base-200 rounded-lg p-3">
                <div class="flex items-center">
                  <Show when={item.status} fallback={<CircleX class="text-error mr-3 h-5 w-5" />}>
                    <CircleCheckBig class="text-success mr-3 h-5 w-5" />
                  </Show>
                  <span class="grow">
                    {(() => {
                      const displayKey =
                        item.key === 'helperInstalled' && !item.status
                          ? 'helperNotInstalled'
                          : item.key;
                      return t(`doctor.checkup.items.${displayKey}`, item.params || {});
                    })()}
                  </span>
                  <Show when={item.id && !item.status}>
                    <button
                      class="btn btn-xs btn-outline btn-primary"
                      onClick={() => item.id && props.onInstallHelper(item.id)}
                      disabled={!!props.installingHelper}
                    >
                      <Show
                        when={props.installingHelper === item.id}
                        fallback={
                          <>
                            <Download class="mr-1 h-3 w-3" />
                            {t('doctor.checkup.install')}
                          </>
                        }
                      >
                        <span class="loading loading-spinner loading-xs"></span>
                        {t('doctor.checkup.installing')}
                      </Show>
                    </button>
                  </Show>
                </div>
                <Show when={item.suggestion_key}>
                  <div class="bg-base-300 mt-2 ml-8 rounded-md p-2 text-sm">
                    <p class="mb-1 font-semibold">{t('doctor.checkup.suggestion')}</p>
                    <code class="font-mono">
                      {item.suggestion_key
                        ? t(
                            `doctor.checkup.items.${item.suggestion_key}`,
                            item.suggestion_params || {}
                          )
                        : ''}
                    </code>
                  </div>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Card>
  );
}

export default Checkup;
