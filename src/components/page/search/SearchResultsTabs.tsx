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
    <div class="tabs tabs-border mt-4">
      <a
        class="tab"
        classList={{ 'tab-active': props.activeTab() === 'packages' }}
        onClick={() => props.setActiveTab('packages')}
      >
        {t('search.tabs.packages')} ({props.packageCount})
      </a>
      <a
        class="tab"
        classList={{ 'tab-active': props.activeTab() === 'includes' }}
        onClick={() => props.setActiveTab('includes')}
      >
        {t('search.tabs.includes')} ({props.includesCount})
      </a>
    </div>
  );
}

export default SearchResultsTabs;
