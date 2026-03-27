import { Accessor, Setter } from 'solid-js';
import { t } from '../../../i18n';

interface SearchResultsTabsProps {
  activeTab: Accessor<'packages' | 'includes'>;
  setActiveTab: Setter<'packages' | 'includes'>;
  packageCount: number;
  includesCount: number;
}

function SearchResultsTabs(props: SearchResultsTabsProps) {
  return (
    <div role="tablist" aria-label="Search Result Tabs" class="tabs tabs-border">
      <button
        type="button"
        class="tab"
        classList={{ 'tab-active': props.activeTab() === 'packages' }}
        onClick={() => props.setActiveTab('packages')}
        role="tab"
        aria-selected={props.activeTab() === 'packages'}
        tabindex={0}
      >
        {t('search.tabs.packages')} ({props.packageCount})
      </button>
      <button
        type="button"
        class="tab"
        classList={{ 'tab-active': props.activeTab() === 'includes' }}
        onClick={() => props.setActiveTab('includes')}
        role="tab"
        aria-selected={props.activeTab() === 'includes'}
        tabindex={0}
      >
        {t('search.tabs.includes')} ({props.includesCount})
      </button>
    </div>
  );
}

export default SearchResultsTabs;
