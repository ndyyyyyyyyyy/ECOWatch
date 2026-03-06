import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents, locationService } from '@grafana/runtime';
import { getExploreUrl } from 'app/core/utils/explore';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { updateQueryLibraryRefAction } from 'app/features/explore/state/explorePane';
import { store, dispatch } from 'app/store/store';
import { ShowConfirmModalEvent } from 'app/types/events';

import { QueryTemplateRow } from '../types';

const PANE_SETUP_DELAY = 200;

export const onOpenInExplore = async (
  query: QueryTemplateRow,
  onCloseDrawer?: (isSelectingQuery?: boolean, isEditingQuery?: boolean) => void
) => {
  if (!query.query || !query.datasourceRef) {
    console.error('Missing required query or datasource reference');
    return;
  }

  // Get current explore state
  const { exploreState, currentPaneIds } = getCurrentExploreState();

  // Check if we should show the warning modal
  const currentQueries = currentPaneIds.flatMap((id) => exploreState[id]?.queries);
  if (currentQueries.length > 1) {
    // Show modal for multiple queries
    showMultipleQueriesModal(query, onCloseDrawer);
  } else {
    await performDirectNavigation(query, onCloseDrawer);
  }
};

// Helper functions

const getCurrentExploreState = () => {
  const exploreState = store.getState().explore.panes;
  const currentPaneIds = Object.keys(exploreState).filter((id) => exploreState[id] !== undefined);
  return { exploreState, currentPaneIds };
};

const performDirectNavigation = async (
  query: QueryTemplateRow,
  onCloseDrawer?: (isSelectingQuery?: boolean, isEditingQuery?: boolean) => void
) => {
  try {
    const timeRange = getTimeSrv().timeRange();
    const exploreUrl = await getExploreUrl({
      queries: [query.query],
      dsRef: query.datasourceRef,
      timeRange,
      scopedVars: undefined,
    });

    if (!exploreUrl) {
      console.error('Failed to generate explore URL');
      return;
    }

    const url = new URL(exploreUrl, window.location.origin);
    const panesParam = url.searchParams.get('panes');

    if (!panesParam) {
      console.error('No panes parameter found in explore URL');
      return;
    }

    let panes;
    try {
      panes = JSON.parse(panesParam);
    } catch (parseError) {
      console.error('Failed to parse panes parameter:', parseError);
      return;
    }

    const newPaneId = Object.keys(panes)[0];
    if (!newPaneId) {
      console.error('No pane ID found in parsed panes');
      return;
    }

    // Navigate to explore
    locationService.push(locationUtil.stripBaseFromUrl(exploreUrl));

    // Set queryLibraryRef after navigation
    setTimeout(() => {
      try {
        dispatch(
          updateQueryLibraryRefAction({
            exploreId: newPaneId,
            queryLibraryRef: query.uid,
          })
        );
      } catch (dispatchError) {
        console.error('Failed to set query library reference:', dispatchError);
      }
    }, PANE_SETUP_DELAY);

    // Close the drawer
    onCloseDrawer?.(false, true);
  } catch (error) {
    console.error('Failed to open in explore:', error);
  }
};

const showMultipleQueriesModal = (
  query: QueryTemplateRow,
  onCloseDrawer?: (isSelectingQuery?: boolean, isEditingQuery?: boolean) => void
) => {
  const modalConfig = buildModalConfig(query, onCloseDrawer);
  getAppEvents().publish(new ShowConfirmModalEvent(modalConfig));
};

// Helper function to build modal configuration
const buildModalConfig = (
  query: QueryTemplateRow,
  onCloseDrawer?: (isSelectingQuery?: boolean, isEditingQuery?: boolean) => void
) => {
  const warningText = t(
    'query-library.explore-modal.warning',
    'You have multiple queries in Explore. Editing this saved query will replace all existing queries. Do you want to continue?'
  );

  return {
    title: t('query-library.explore-modal.title', 'Replace existing queries?'),
    text: warningText,
    yesText: t('query-library.explore-modal.confirm-button', 'Replace queries'),
    noText: t('query-library.explore-modal.cancel-button', 'Cancel'),
    icon: 'exclamation-triangle' as const,
    onConfirm: () => performDirectNavigation(query, onCloseDrawer),
  };
};
