import { contextSrv } from 'app/core/core';

import { QueryLibraryTab } from '../QueryLibraryDrawer';
import { newestSortingOption } from '../QueryLibrarySortingOptions';
import { QueryTemplateRow } from '../types';

import { searchQueryLibrary } from './search';

// Mock contextSrv
jest.mock('app/core/core', () => ({
  contextSrv: {
    user: {
      uid: 'user123',
    },
  },
}));

const mockContextSrv = jest.mocked(contextSrv);

const mockAscSortFunction = (a: QueryTemplateRow, b: QueryTemplateRow) => {
  const aTitle = a.title ?? '';
  const bTitle = b.title ?? '';
  return aTitle.localeCompare(bTitle);
};

const mockDescSortFunction = (a: QueryTemplateRow, b: QueryTemplateRow) => {
  const aTitle = a.title ?? '';
  const bTitle = b.title ?? '';
  return bTitle.localeCompare(aTitle);
};

describe('searchQueryLibrary', () => {
  const prometheusQLItem = {
    index: '1',
    uid: '1',
    datasourceName: 'Prometheus Main',
    datasourceType: 'prometheus',
    title: 'HTTP Requests',
    description: 'Monitor HTTP requests per second',
    queryText: 'http_requests_total{job="api"}',
    tags: ['monitoring', 'http'],
    isVisible: true,
    user: {
      uid: 'user:john',
      displayName: 'John Doe',
    },
    query: {
      refId: 'A',
      datasource: { type: 'prometheus', uid: 'prom1' },
    },
  };
  const grafanaQLItem = {
    index: '2',
    uid: '2',
    datasourceName: 'Grafana Testdata',
    datasourceType: 'testdata',
    title: 'CPU Usage',
    description: 'Track CPU utilization',
    queryText: 'cpu_usage_percent',
    tags: ['consumption', 'cpu'],
    isVisible: false,
    user: {
      uid: 'user:jane',
      displayName: 'Jane Smith',
    },
    query: {
      refId: 'B',
      datasource: { type: 'testdata', uid: 'testdata1' },
    },
  };
  const influxQLItem = {
    index: '3',
    uid: '3',
    datasourceName: 'InfluxDB',
    datasourceType: 'influxdb',
    title: 'Memory Usage',
    description: 'Memory consumption metrics',
    queryText: 'memory_usage_bytes',
    tags: ['system', 'memory'],
    isVisible: true,
    user: {
      uid: 'user:user123',
      displayName: 'Current User',
    },
    query: {
      refId: 'C',
      datasource: { type: 'influxdb', uid: 'influx1' },
    },
    createdAtTimestamp: 1716796800000,
  };

  const prometheusSecondaryQLItem = {
    index: '4',
    uid: '4',
    datasourceName: 'Prometheus Secondary',
    datasourceType: 'prometheus',
    title: 'Database Connections',
    description: 'Active database connections',
    queryText: 'db_connections_active',
    tags: ['database', 'connections'],
    isVisible: true,
    user: {
      uid: 'user:bob',
      displayName: 'Bob Wilson',
    },
    query: {
      refId: 'D',
      datasource: { type: 'prometheus', uid: 'prom2' },
    },
  };

  const mockQueryLibrary: QueryTemplateRow[] = [
    prometheusQLItem,
    grafanaQLItem,
    influxQLItem,
    prometheusSecondaryQLItem,
  ];

  beforeEach(() => {
    (mockContextSrv.user as any) = { uid: 'user123' };
  });

  describe('query text filtering', () => {
    it('should filter by datasource name', () => {
      const result = searchQueryLibrary(mockQueryLibrary, 'prometheus', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(2);
      expect(result[0].datasourceName).toBe('Prometheus Main');
      expect(result[1].datasourceName).toBe('Prometheus Secondary');
    });

    it('should filter by datasource type', () => {
      const result = searchQueryLibrary(mockQueryLibrary, 'testdata', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1); // testdata query is not visible but user is author
    });

    it('should filter by title positive match', () => {
      const result = searchQueryLibrary(mockQueryLibrary, 'Memory', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
    });

    it('should filter by title positive match but no visibility', () => {
      const result = searchQueryLibrary(mockQueryLibrary, 'cpu', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1); // CPU query is not visible and but user is author
    });

    it('should filter by description', () => {
      const result = searchQueryLibrary(mockQueryLibrary, 'monitor', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('HTTP Requests');
    });

    it('should filter by query text', () => {
      const result = searchQueryLibrary(mockQueryLibrary, 'http_requests_total', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('HTTP Requests');
    });

    it('should filter by tags', () => {
      const result = searchQueryLibrary(mockQueryLibrary, 'monitoring', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('HTTP Requests');
    });

    it('should be case insensitive', () => {
      const result = searchQueryLibrary(mockQueryLibrary, 'PROMETHEUS', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no matches found', () => {
      const result = searchQueryLibrary(mockQueryLibrary, 'nonexistent', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(0);
    });
  });

  describe('datasource filtering', () => {
    it('should filter by datasource when dsFilters provided', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', ['prometheus'], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(2);
      expect(result.every((item) => item.datasourceName?.toLowerCase().includes('prometheus'))).toBe(true);
    });

    it('should return all items when dsFilters is empty', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(4);
    });

    it('should handle multiple datasource filters', () => {
      const result = searchQueryLibrary(
        mockQueryLibrary,
        '',
        ['prometheus', 'influx'],
        [],
        [],
        QueryLibraryTab.ALL,
        {}
      );
      expect(result).toHaveLength(3);
    });

    it('should be case insensitive for datasource filters', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', ['PROMETHEUS'], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(2);
    });
  });

  describe('user name filtering', () => {
    it('should filter by user display name', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', [], ['John Doe'], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
      expect(result[0].user?.displayName).toBe('John Doe');
    });

    it('should return all items when userNameFilters is empty', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(4);
    });

    it('should handle multiple user name filters', () => {
      const result = searchQueryLibrary(
        mockQueryLibrary,
        '',
        [],
        ['John Doe', 'Current User'],
        [],
        QueryLibraryTab.ALL,
        {}
      );
      expect(result).toHaveLength(2);
    });

    it('should handle users without display name', () => {
      const queryWithoutDisplayName: QueryTemplateRow = {
        ...mockQueryLibrary[0],
        index: '5',
        uid: '5',
        user: { uid: 'user:noname' },
      };
      const result = searchQueryLibrary([queryWithoutDisplayName], '', [], [''], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
    });
  });

  describe('tag filtering', () => {
    it('should filter by single tag', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', [], [], ['monitoring'], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
      expect(result[0].tags).toContain('monitoring');
    });

    it('should filter by multiple tags (AND logic)', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', [], [], ['system', 'memory'], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Memory Usage');
    });

    it('should return empty when tag combination not found', () => {
      const result = searchQueryLibrary(
        mockQueryLibrary,
        '',
        [],
        [],
        ['monitoring', 'database'],
        QueryLibraryTab.ALL,
        {}
      );
      expect(result).toHaveLength(0);
    });

    it('should be case insensitive for tag filtering', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', [], [], ['MONITORING'], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
    });

    it('should return all items when tagFilters is empty', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(4);
    });

    it('should handle partial tag matches', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', [], [], ['sys'], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Memory Usage');
    });
  });

  describe('combined filtering', () => {
    it('should apply all filters together', () => {
      const result = searchQueryLibrary(
        mockQueryLibrary,
        'prometheus',
        ['prometheus'],
        ['John Doe'],
        ['monitoring'],
        QueryLibraryTab.ALL,
        {}
      );
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('HTTP Requests');
    });

    it('should return empty when combined filters have no matches', () => {
      const result = searchQueryLibrary(
        mockQueryLibrary,
        'influx',
        ['prometheus'],
        ['John Doe'],
        ['monitoring'],
        QueryLibraryTab.ALL,
        {}
      );
      expect(result).toHaveLength(0);
    });

    it('should handle empty query with filters', () => {
      const result = searchQueryLibrary(
        mockQueryLibrary,
        '',
        ['prometheus'],
        [],
        ['monitoring'],
        QueryLibraryTab.ALL,
        {}
      );
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('HTTP Requests');
    });
  });

  describe('sorting', () => {
    it('should sort by title in descending order', () => {
      const result = searchQueryLibrary(
        mockQueryLibrary,
        '',
        [],
        [],
        [],
        QueryLibraryTab.ALL,
        {},
        mockDescSortFunction
      );
      expect(result).toHaveLength(4);
      expect(result[0].title).toBe('Memory Usage');
      expect(result[1].title).toBe('HTTP Requests');
      expect(result[2].title).toBe('Database Connections');
      expect(result[3].title).toBe('CPU Usage');
    });

    it('should sort by title in ascending order', () => {
      const result = searchQueryLibrary(mockQueryLibrary, '', [], [], [], QueryLibraryTab.ALL, {}, mockAscSortFunction);
      expect(result).toHaveLength(4);
      expect(result[0].title).toBe('CPU Usage');
      expect(result[1].title).toBe('Database Connections');
      expect(result[2].title).toBe('HTTP Requests');
      expect(result[3].title).toBe('Memory Usage');
    });

    it('should sort by createdAtTimestamp in descending order', () => {
      const firstCreatedQLItem = { ...grafanaQLItem, isVisible: true, createdAtTimestamp: 1716796800001 };
      const secondCreatedQLItem = { ...prometheusQLItem, createdAtTimestamp: 1716796800002 };
      const thirdCreatedQLItem = {
        ...influxQLItem,
        createdAtTimestamp: 1716796800003,
      };
      const result = searchQueryLibrary(
        [secondCreatedQLItem, firstCreatedQLItem, thirdCreatedQLItem],
        '',
        [],
        [],
        [],
        QueryLibraryTab.ALL,
        {},
        newestSortingOption().sort
      );
      expect(result).toHaveLength(3);
      expect(result).toEqual([thirdCreatedQLItem, secondCreatedQLItem, firstCreatedQLItem]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty saved queries', () => {
      const result = searchQueryLibrary([], 'test', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(0);
    });

    it('should handle undefined/null values in query items', () => {
      const queryWithNulls: QueryTemplateRow = {
        index: '7',
        uid: '7',
        datasourceName: undefined,
        datasourceType: undefined,
        title: undefined,
        description: undefined,
        queryText: undefined,
        tags: undefined,
        isVisible: true,
        user: {
          uid: 'user:test',
          displayName: 'Test User',
        },
        query: {
          refId: 'A',
          datasource: { type: 'test', uid: 'test1' },
        },
      };
      const result = searchQueryLibrary([queryWithNulls], 'test', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(0); // No matches since all searchable fields are undefined
    });

    it('should handle user uid with and without "user:" prefix', () => {
      (mockContextSrv.user as any) = { uid: 'user123' };
      const queryWithPrefixedUid: QueryTemplateRow = {
        ...mockQueryLibrary[0],
        index: '8',
        uid: '8',
        user: {
          uid: 'user:user123',
          displayName: 'Prefixed User',
        },
        isVisible: false,
      };
      const result = searchQueryLibrary([queryWithPrefixedUid], '', [], [], [], QueryLibraryTab.ALL, {});
      expect(result).toHaveLength(1); // Should be included because user is the author
    });
  });
});
