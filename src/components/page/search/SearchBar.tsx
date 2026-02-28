import { Accessor, Setter, Show, createSignal } from 'solid-js';
import { CircleQuestionMark, Search, X } from 'lucide-solid';
import { t } from '../../../i18n';
import { useGlobalSearchHotkey } from '../../../hooks/useGlobalHotkey';
import ConfirmationModal from '../../ConfirmationModal';

interface SearchBarProps {
  searchTerm: Accessor<string>;
  setSearchTerm: Setter<string>;
}

function SearchBar(props: SearchBarProps) {
  let searchInputRef: HTMLInputElement | undefined;

  // Modal state for search format help
  const [showHelpModal, setShowHelpModal] = createSignal(false);

  useGlobalSearchHotkey({
    shouldClear: () => props.searchTerm().length > 0,
    onSearchStart: (char: string) => {
      // If there is already text, append the character; otherwise replace
      if (props.searchTerm().length > 0) {
        props.setSearchTerm(props.searchTerm() + char);
      } else {
        props.setSearchTerm(char);
      }
    },
    onClearSearch: () => {
      props.setSearchTerm('');
    },
    onFocusInput: () => {
      setTimeout(() => searchInputRef?.focus(), 0);
    },
  });

  return (
    <>
      <div class="relative w-full">
        <span class="absolute inset-y-0 left-0 z-10 flex items-center pl-3">
          <Search class="h-5 w-5 text-gray-400" />
        </span>

        <input
          ref={searchInputRef}
          type="text"
          placeholder={t('search.bar.placeholder')}
          class="input bg-base-100 input-bordered relative w-full pr-16 pl-10"
          value={props.searchTerm()}
          onInput={(e) => props.setSearchTerm(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              searchInputRef?.blur();
            }
          }}
        />
        <div class="absolute inset-y-0 right-0 flex items-center space-x-2 pr-3">
          <Show when={props.searchTerm().length > 0}>
            <button
              onClick={() => props.setSearchTerm('')}
              class="hover:text-base-700 mr-1 rounded-full p-1 text-gray-500 hover:bg-gray-200 focus:outline-none dark:hover:bg-gray-700"
              aria-label={t('search.bar.clearSearch')}
            >
              <X class="h-5 w-5" />
            </button>
          </Show>
          <button
            onClick={() => setShowHelpModal(true)}
            class="hover:text-base-700 rounded-full p-1 text-gray-400 hover:bg-gray-200 focus:outline-none dark:hover:bg-gray-700"
            aria-label={t('search.bar.searchHelp')}
            type="button"
          >
            <CircleQuestionMark size={16} />
          </button>
        </div>
      </div>

      {/* Search Help Modal */}
      <ConfirmationModal
        isOpen={showHelpModal()}
        title={t('search.help.title')}
        onConfirm={() => setShowHelpModal(false)}
        onCancel={() => setShowHelpModal(false)}
        confirmText={t('buttons.ok')}
        cancelText=""
      >
        <div class="space-y-4">
          <div class="text-md text-base-content/70">{t('search.help.description')}</div>

          <div class="space-y-3">
            <div class="text-base-content font-semibold">{t('search.help.examples')}</div>

            <div class="space-y-2 text-sm">
              <div class="bg-base-200 rounded-lg p-3">
                <div class="text-primary font-mono">7zip</div>
                <div class="text-base-content/70">{t('search.help.normalSearch')}</div>
              </div>

              <div class="bg-base-200 rounded-lg p-3">
                <div class="text-primary font-mono">7zip/main</div>
                <div class="text-base-content/70">{t('search.help.bucketSearch')}</div>
              </div>

              <div class="bg-base-200 rounded-lg p-3">
                <div class="text-primary font-mono">7zip/</div>
                <div class="text-base-content/70">{t('search.help.allBuckets')}</div>
              </div>

              <div class="bg-base-200 rounded-lg p-3">
                <div class="text-primary font-mono">'7zip'/'main'</div>
                <div class="text-base-content/70">{t('search.help.exactMatch')}</div>
              </div>
            </div>
          </div>

          <div class="text-base-content/50 border-t pt-3 text-xs">{t('search.help.note')}</div>
        </div>
      </ConfirmationModal>
    </>
  );
}

export default SearchBar;
