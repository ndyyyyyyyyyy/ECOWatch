import { locationService, getAppEvents } from '@grafana/runtime';
import { getExploreUrl } from 'app/core/utils/explore';
import { makeExplorePaneState } from 'app/features/explore/state/utils';
import { store } from 'app/store/store';
import { ShowConfirmModalEvent } from 'app/types/events';
import { StoreState } from 'app/types/store';

import { QueryTemplateRow } from '../types';

import { onOpenInExplore } from './navigation';

jest.mock('app/features/dashboard/services/TimeSrv', () => {
  const original = jest.requireActual('app/features/dashboard/services/TimeSrv');
  return {
    ...original,
    getTimeSrv: () => ({
      ...original.getTimeSrv(),
      timeRange: jest.fn().mockReturnValue(undefined),
    }),
  };
});

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    locationService: {
      getLocation: jest.fn(),
      push: jest.fn(),
    },
    getAppEvents: jest.fn(),
  };
});

jest.mock('app/core/utils/explore');
jest.mock('app/features/explore/state/explorePane');
jest.mock('app/store/store', () => ({
  store: {
    getState: jest.fn(),
  },
  dispatch: jest.fn(),
}));

const mockLocationService = jest.mocked(locationService);
const mockGetAppEvents = jest.mocked(getAppEvents);
const mockGetExploreUrl = jest.mocked(getExploreUrl);
const mockStore = jest.mocked(store);

describe('onOpenInExplore', () => {
  const mockQuery: QueryTemplateRow = {
    uid: 'query-123',
    index: '0',
    title: 'Test Query',
    query: {
      refId: 'A',
      datasource: { type: 'prometheus', uid: 'prom1' },
    },
    datasourceRef: { type: 'prometheus', uid: 'prom1' },
  };

  const mockOnCloseDrawer = jest.fn();
  const mockAppEvents = {
    publish: jest.fn(),
    getStream: jest.fn(),
    subscribe: jest.fn(),
    removeAllListeners: jest.fn(),
    newScopedBus: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetAppEvents.mockReturnValue(mockAppEvents);
    mockGetExploreUrl.mockResolvedValue('/explore?panes={"left":{"datasource":"prom1","queries":[{"refId":"A"}]}}');
    mockLocationService.getLocation.mockReturnValue({
      pathname: '/explore',
      search: '',
      state: undefined,
      hash: '',
    });
  });

  describe('basic validation', () => {
    it('should return early if query is missing', async () => {
      const invalidQuery = { ...mockQuery, query: undefined };

      await onOpenInExplore(invalidQuery as unknown as QueryTemplateRow, mockOnCloseDrawer);

      expect(mockGetExploreUrl).not.toHaveBeenCalled();
      expect(mockAppEvents.publish).not.toHaveBeenCalled();
    });

    it('should return early if datasourceRef is missing', async () => {
      const invalidQuery = { ...mockQuery, datasourceRef: undefined };

      await onOpenInExplore(invalidQuery, mockOnCloseDrawer);

      expect(mockGetExploreUrl).not.toHaveBeenCalled();
      expect(mockAppEvents.publish).not.toHaveBeenCalled();
    });
  });

  describe('modal warning scenarios', () => {
    it('should show modal when multiple queries exist', async () => {
      mockStore.getState.mockReturnValue({
        explore: {
          syncedTimes: false,
          richHistory: [],
          richHistoryStorageFull: false,
          richHistoryLimitExceededWarningShown: false,
          panes: {
            left: makeExplorePaneState({
              queries: [{ refId: 'A' }, { refId: 'B' }],
            }),
          },
        },
      } as unknown as StoreState);

      await onOpenInExplore(mockQuery, mockOnCloseDrawer);

      expect(mockAppEvents.publish).toHaveBeenCalledWith(expect.any(ShowConfirmModalEvent));

      const modalEvent = mockAppEvents.publish.mock.calls[0][0];
      expect(modalEvent.payload.title).toBe('Replace existing queries?');
      expect(modalEvent.payload.yesText).toBe('Replace queries');
      expect(modalEvent.payload.noText).toBe('Cancel');
    });

    it('should not show modal when only one query exists', async () => {
      mockStore.getState.mockReturnValue({
        explore: {
          syncedTimes: false,
          richHistory: [],
          richHistoryStorageFull: false,
          richHistoryLimitExceededWarningShown: false,
          panes: {
            left: makeExplorePaneState({
              queries: [{ refId: 'A' }],
            }),
          },
        },
      } as unknown as StoreState);

      await onOpenInExplore(mockQuery, mockOnCloseDrawer);

      expect(mockAppEvents.publish).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
