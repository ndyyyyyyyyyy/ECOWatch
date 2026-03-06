import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { Drawer, Icon, Stack, Text, Tooltip, Tab, TabsBar } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { QueryTemplate } from '../../features/explore/QueryLibrary/types';

import { QueryLibrary } from './QueryLibrary/QueryLibrary';
import { getUserStorageFavorites, setUserStorageFavorites } from './utils/favorites';

export enum QueryLibraryTab {
  ALL = 'all',
  FAVORITES = 'favorites',
  RECENT = 'history',
}

type Props = {
  isOpen: boolean;
  // List of datasource names to filter query templates by
  activeDatasources: string[];
  close: () => void;
  // Enhanced drawer options
  highlightedQuery?: string;
  newQuery?: QueryTemplate;
};

export const QUERY_LIBRARY_LOCAL_STORAGE_KEYS = {
  explore: {
    newButton: 'grafana.explore.query-library.newButton',
  },
};

/**
 * Drawer with query library feature. Handles its own state and should be included in some top level component.
 */
export function QueryLibraryDrawer({ isOpen, activeDatasources, close, highlightedQuery, newQuery }: Props) {
  const [activeTab, setActiveTab] = useState(QueryLibraryTab.ALL);
  const [userFavorites, setUserFavorites] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    getUserStorageFavorites().then((value) => setUserFavorites(value));
  }, []);

  useEffect(() => {
    // Update tab to All if editing a new query
    if (newQuery && activeTab !== QueryLibraryTab.ALL) {
      setActiveTab(QueryLibraryTab.ALL);
    }
  }, [newQuery, activeTab]);

  const onFavorite = async (uid: string) => {
    const prevFavorites = { ...userFavorites };

    const newUserFavorites = { ...prevFavorites, [uid]: true };
    try {
      setUserFavorites(newUserFavorites);
      await setUserStorageFavorites(newUserFavorites);
    } catch (e) {
      setUserFavorites(prevFavorites);
    }
  };

  const onUnfavorite = async (uid: string) => {
    const prevFavorites = { ...userFavorites };

    const newUserFavorites = { ...prevFavorites };
    delete newUserFavorites[uid];
    try {
      setUserFavorites(newUserFavorites);
      await setUserStorageFavorites(newUserFavorites);
    } catch (e) {
      setUserFavorites(prevFavorites);
    }
  };

  return (
    isOpen && (
      <Drawer
        title={
          <Stack alignItems="center">
            <Text element="h3">{t('query-library.drawer.title', 'Saved queries')}</Text>
            <Tooltip
              placement="right"
              content={t(`query-library.drawer.tooltip`, 'Right now, each organization can save up to 1000 queries')}
            >
              <Icon name="info-circle" />
            </Tooltip>
          </Stack>
        }
        onClose={close}
        scrollableContent={false}
        tabs={
          <TabsBar>
            <Tab
              label={t('query-library.tabs.all', 'All')}
              active={activeTab === QueryLibraryTab.ALL}
              onChangeTab={() => setActiveTab(QueryLibraryTab.ALL)}
            />
            <Tab
              label={t('query-library.tabs.favorites', 'Favorites')}
              active={activeTab === QueryLibraryTab.FAVORITES}
              onChangeTab={() => setActiveTab(QueryLibraryTab.FAVORITES)}
              disabled={!!newQuery}
            />
            {!contextSrv.hasRole('Viewer') && (
              <Tab
                label={t('query-library.tabs.recent', 'Recent')}
                active={activeTab === QueryLibraryTab.RECENT}
                onChangeTab={() => setActiveTab(QueryLibraryTab.RECENT)}
                disabled={!!newQuery}
              />
            )}
          </TabsBar>
        }
      >
        <QueryLibrary
          activeDatasources={activeDatasources}
          activeTab={activeTab}
          userFavorites={userFavorites}
          onFavorite={onFavorite}
          onUnfavorite={onUnfavorite}
          highlightedQuery={highlightedQuery}
          newQuery={newQuery}
        />
      </Drawer>
    )
  );
}
