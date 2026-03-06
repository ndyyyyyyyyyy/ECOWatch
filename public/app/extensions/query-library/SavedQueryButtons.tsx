import { useLocalStorage } from 'react-use';

import { CoreApp, FeatureState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Button, FeatureBadge } from '@grafana/ui';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { QUERY_LIBRARY_LOCAL_STORAGE_KEYS } from './QueryLibraryDrawer';
import { selectors } from './e2e-selectors/selectors';
import { useQueryLibrarySave } from './hooks/useQueryLibrarySave';

interface Props {
  query: DataQuery;
  app?: CoreApp;
  onUpdateSuccess?: () => void;
  onSelectQuery?: (query: DataQuery) => void;
  datasourceFilters: string[];
}

export function SavedQueryButtons({ query, app, onSelectQuery, datasourceFilters }: Props) {
  const isLargeScreen = useMediaQueryMinWidth('lg');
  const { saveNewQuery } = useQueryLibrarySave();
  const { openDrawer } = useQueryLibraryContext();

  const [showQueryLibraryBadgeButton, setShowQueryLibraryBadgeButton] = useLocalStorage(
    QUERY_LIBRARY_LOCAL_STORAGE_KEYS.explore.newButton,
    true
  );

  const onSaveNewQueryClick = () => {
    saveNewQuery(query, onSelectQuery, { context: app });
    setShowQueryLibraryBadgeButton(false);
  };

  const onReplaceQueryClick = () => {
    openDrawer({ datasourceFilters, onSelectQuery, options: { isReplacingQuery: true, context: app } });
    setShowQueryLibraryBadgeButton(false);
  };

  return (
    <>
      {showQueryLibraryBadgeButton && isLargeScreen && <FeatureBadge featureState={FeatureState.new} />}
      {contextSrv.hasRole('Viewer') ? null : (
        <Button
          data-testid={selectors.components.saveQueryButton.button}
          icon="save"
          onClick={onSaveNewQueryClick}
          variant="primary"
          size="sm"
          fill="text"
        >
          {isLargeScreen && t('query-operation.header.save-to-query-library', 'Save query')}
        </Button>
      )}
      <Button icon="book" onClick={onReplaceQueryClick} variant="primary" size="sm" fill="text">
        {isLargeScreen && t('query-operation.header.replace-query-from-library', 'Replace with saved query')}
      </Button>
    </>
  );
}
