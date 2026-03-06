// Mock dependencies before importing the module
const mockGetRichHistory = jest.fn();
const mockGetDataSourceSrv = jest.fn();
const mockGet = jest.fn();
const mockT = jest.fn();
const mockGetQueryDisplayText = jest.fn();

jest.mock('app/core/utils/richHistory', () => ({
  getRichHistory: mockGetRichHistory,
  getQueryDisplayText: mockGetQueryDisplayText,
  SortOrder: {
    Descending: 'Descending',
  },
}));

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: mockGetDataSourceSrv,
}));

jest.mock('@grafana/i18n', () => ({
  t: mockT,
}));

import { RichHistoryQuery } from 'app/types/explore';

import { fetchQueryHistory } from './fetchQueryHistory';

describe('fetchQueryHistory', () => {
  const mockDataSourceApi = {
    type: 'prometheus',
    getQueryDisplayText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDataSourceSrv.mockReturnValue({
      get: mockGet,
    });
    mockGet.mockResolvedValue(mockDataSourceApi);
    mockT.mockImplementation((key: string, defaultText: string) => defaultText);
    mockGetQueryDisplayText.mockReturnValue('SELECT * FROM table');
  });

  it('should fetch and transform query history successfully', async () => {
    const mockRichHistoryItem: RichHistoryQuery = {
      id: 'query-1',
      createdAt: 1234567890000,
      datasourceUid: 'ds-uid',
      datasourceName: 'Test Datasource',
      starred: false,
      comment: 'Test comment',
      queries: [
        {
          refId: 'A',
          datasource: { uid: 'ds-uid', type: 'prometheus' },
        },
      ],
    };

    const mockRichHistoryResults = {
      richHistory: [mockRichHistoryItem],
      total: 1,
    };

    mockGetRichHistory.mockResolvedValue(mockRichHistoryResults);
    mockDataSourceApi.getQueryDisplayText.mockReturnValue('up');

    const result = await fetchQueryHistory();

    expect(mockGetRichHistory).toHaveBeenCalledWith({
      search: '',
      datasourceFilters: [],
      sortOrder: 'Descending',
      starred: false,
    });
    expect(mockGet).toHaveBeenCalledWith({ uid: 'ds-uid', type: 'prometheus' });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ...mockRichHistoryItem,
      createdAtTimestamp: mockRichHistoryItem.createdAt,
      datasourceType: 'prometheus',
      datasource: mockDataSourceApi,
      datasourceRef: { uid: 'ds-uid', type: 'prometheus' },
      description: 'This is one of your recent queries',
      title: 'SELECT * FROM table',
      tags: [],
      isLocked: false,
      isVisible: false,
      query: mockRichHistoryItem.queries[0],
      queryText: 'up',
      uid: 'query-1',
      index: '0',
      user: {
        uid: 'recent-user-uid',
        displayName: 'recent-user-display-name',
        avatarUrl: 'recent-user-avatar-url',
      },
    });
  });

  it('should limit results to MAX_QUERY_HISTORY_ITEMS (20)', async () => {
    const mockRichHistoryItems = Array.from({ length: 25 }, (_, index) => ({
      id: `query-${index}`,
      createdAt: 1234567890000 + index,
      datasourceUid: 'ds-uid',
      datasourceName: 'Test Datasource',
      starred: false,
      comment: '',
      queries: [
        {
          refId: 'A',
          datasource: { uid: 'ds-uid', type: 'prometheus' },
        },
      ],
    }));

    const mockRichHistoryResults = {
      richHistory: mockRichHistoryItems,
      total: 25,
    };

    mockGetRichHistory.mockResolvedValue(mockRichHistoryResults);

    const result = await fetchQueryHistory();

    expect(result).toHaveLength(20); // Should be limited to MAX_QUERY_HISTORY_ITEMS
    expect(result[0].uid).toBe('query-0');
    expect(result[19].uid).toBe('query-19');
  });

  it('should handle fallback title when getQueryDisplayText returns empty', async () => {
    const mockRichHistoryItem: RichHistoryQuery = {
      id: 'query-1',
      createdAt: 1234567890000,
      datasourceUid: 'ds-uid',
      datasourceName: 'Test Datasource',
      starred: false,
      comment: '',
      queries: [
        {
          refId: 'A',
          datasource: { uid: 'ds-uid', type: 'prometheus' },
        },
      ],
    };

    const mockRichHistoryResults = {
      richHistory: [mockRichHistoryItem],
      total: 1,
    };

    mockGetRichHistory.mockResolvedValue(mockRichHistoryResults);
    mockGetQueryDisplayText.mockReturnValue(''); // Empty string

    const result = await fetchQueryHistory();

    expect(result[0].title).toContain('Recent example'); // Fallback title
  });

  it('should handle getRichHistory promise rejection', async () => {
    mockGetRichHistory.mockRejectedValue(new Error('Rich history fetch error'));

    await expect(fetchQueryHistory()).rejects.toThrow('Rich history fetch error');
    expect(mockGetRichHistory).toHaveBeenCalledWith({
      search: '',
      datasourceFilters: [],
      sortOrder: 'Descending',
      starred: false,
    });
  });

  it('should handle datasource service get method rejection', async () => {
    const mockRichHistoryItem: RichHistoryQuery = {
      id: 'query-1',
      createdAt: 1234567890000,
      datasourceUid: 'ds-uid',
      datasourceName: 'Test Datasource',
      starred: false,
      comment: '',
      queries: [
        {
          refId: 'A',
          datasource: { uid: 'ds-uid', type: 'prometheus' },
        },
      ],
    };

    const mockRichHistoryResults = {
      richHistory: [mockRichHistoryItem],
      total: 1,
    };

    mockGetRichHistory.mockResolvedValue(mockRichHistoryResults);
    mockGet.mockRejectedValue(new Error('Datasource fetch error'));

    await expect(fetchQueryHistory()).rejects.toThrow('Datasource fetch error');
  });
});
