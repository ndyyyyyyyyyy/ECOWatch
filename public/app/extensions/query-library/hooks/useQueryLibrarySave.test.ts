import { renderHook } from '@testing-library/react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { useUpdateQueryMutation } from 'app/extensions/api/clients/queries/v1beta1';

import { QueryLibraryInteractions } from '../QueryLibraryAnalyticsEvents';

import { useQueryLibrarySave } from './useQueryLibrarySave';

const mockQueryLibraryContext = {
  queryLibraryEnabled: true,
  openDrawer: jest.fn(),
  closeDrawer: jest.fn(),
  renderSaveQueryButton: jest.fn(),
  renderQueryLibraryEditingHeader: jest.fn(),
  isDrawerOpen: false,
  closeAddQueryModal: jest.fn(),
  context: 'test',
  triggerAnalyticsEvent: jest.fn(),
};

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => mockQueryLibraryContext,
}));

jest.mock('app/extensions/api/clients/queries/v1beta1', () => ({
  useUpdateQueryMutation: jest.fn(),
}));

jest.mock('../QueryLibraryAnalyticsEvents', () => ({
  QueryLibraryInteractions: {
    updateQueryFromExploreCompleted: jest.fn(),
  },
}));

const mockUseUpdateQueryTemplateMutation = useUpdateQueryMutation as jest.MockedFunction<typeof useUpdateQueryMutation>;

describe('useQueryLibrarySave', () => {
  const mockUpdateQueryTemplate = jest.fn();
  const mockUnwrap = jest.fn();

  const mockQuery: DataQuery = {
    refId: 'A',
    datasource: {
      type: 'prometheus',
      uid: 'test-uid',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mock context to defaults
    Object.assign(mockQueryLibraryContext, {
      queryLibraryEnabled: true,
      openDrawer: jest.fn(),
      closeDrawer: jest.fn(),
      renderSaveQueryButton: jest.fn(),
      renderQueryLibraryEditingHeader: jest.fn(),
      isDrawerOpen: false,
      closeAddQueryModal: jest.fn(),
      context: 'test',
    });

    mockUpdateQueryTemplate.mockReturnValue({
      unwrap: mockUnwrap,
    });

    const mockMutationResult = [
      mockUpdateQueryTemplate,
      {
        isLoading: false,
        isSuccess: false,
        isError: false,
        data: undefined,
        error: undefined,
      },
    ] as unknown as ReturnType<typeof useUpdateQueryMutation>;

    mockUseUpdateQueryTemplateMutation.mockReturnValue(mockMutationResult);
    mockUnwrap.mockResolvedValue({});
  });

  describe('saveNewQuery', () => {
    it('should call openDrawer when enabled', () => {
      const { result } = renderHook(() => useQueryLibrarySave());

      const mockOnSelectQuery = jest.fn();

      result.current.saveNewQuery(mockQuery, mockOnSelectQuery, { context: CoreApp.Explore });

      expect(mockQueryLibraryContext.openDrawer).toHaveBeenCalledWith({
        onSelectQuery: mockOnSelectQuery,
        options: { context: CoreApp.Explore },
        query: { ...mockQuery },
      });
    });

    it('should call openDrawer without app context', () => {
      const { result } = renderHook(() => useQueryLibrarySave());

      result.current.saveNewQuery(mockQuery);

      expect(mockQueryLibraryContext.openDrawer).toHaveBeenCalledWith({
        onSelectQuery: undefined,
        options: undefined,
        query: { ...mockQuery },
      });
    });

    it('should not call openDrawer when disabled', () => {
      mockQueryLibraryContext.queryLibraryEnabled = false;

      const { result } = renderHook(() => useQueryLibrarySave());

      const mockOnSelectQuery = jest.fn();

      result.current.saveNewQuery(mockQuery, mockOnSelectQuery, { context: CoreApp.Explore });

      expect(mockQueryLibraryContext.openDrawer).not.toHaveBeenCalled();
    });
  });

  describe('updateQuery', () => {
    const queryLibraryRef = 'test-query-ref';
    const onUpdateSuccess = jest.fn();

    it('should successfully update query', async () => {
      const { result } = renderHook(() => useQueryLibrarySave());

      await result.current.updateQuery(mockQuery, { context: CoreApp.Explore, queryLibraryRef }, onUpdateSuccess);

      expect(mockUpdateQueryTemplate).toHaveBeenCalledWith({
        name: queryLibraryRef,
        patch: {
          spec: {
            targets: [
              {
                properties: {
                  ...mockQuery,
                  datasource: {
                    ...mockQuery.datasource,
                    type: 'prometheus',
                  },
                },
                variables: {},
              },
            ],
          },
        },
      });

      expect(mockUnwrap).toHaveBeenCalled();
      expect(mockQueryLibraryContext.triggerAnalyticsEvent).toHaveBeenCalledWith(
        QueryLibraryInteractions.updateQueryFromExploreCompleted,
        {
          datasourceType: 'prometheus',
        }
      );
      expect(onUpdateSuccess).toHaveBeenCalled();
      expect(mockQueryLibraryContext.openDrawer).toHaveBeenCalledWith({
        datasourceFilters: [],
        onSelectQuery: undefined,
        options: { context: CoreApp.Explore, highlightQuery: 'test-query-ref' },
      });
    });

    it('should handle missing queryLibraryRef', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useQueryLibrarySave());

      await result.current.updateQuery(mockQuery, { queryLibraryRef: '', context: CoreApp.Explore }, onUpdateSuccess);

      expect(consoleSpy).toHaveBeenCalledWith('Invalid query update attempt:', {
        queryLibraryRef: false,
        query: true,
        datasourceType: 'prometheus',
      });
      expect(mockUpdateQueryTemplate).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle missing query', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useQueryLibrarySave());

      await result.current.updateQuery(
        undefined as unknown as DataQuery,
        { context: CoreApp.Explore, queryLibraryRef },
        onUpdateSuccess
      );

      expect(consoleSpy).toHaveBeenCalledWith('Invalid query update attempt:', {
        queryLibraryRef: true,
        query: false,
        datasourceType: undefined,
      });
      expect(mockUpdateQueryTemplate).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle missing datasource type', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useQueryLibrarySave());

      const queryWithoutDatasourceType = {
        ...mockQuery,
        datasource: { uid: 'test-uid' },
      };

      await result.current.updateQuery(
        queryWithoutDatasourceType,
        { queryLibraryRef, context: CoreApp.Explore },
        onUpdateSuccess
      );
      expect(consoleSpy).toHaveBeenCalledWith('Invalid query update attempt:', {
        queryLibraryRef: true,
        datasourceType: undefined,
        query: true,
      });
      expect(mockUpdateQueryTemplate).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle API errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const apiError = new Error('API Error');
      mockUnwrap.mockRejectedValue(apiError);

      const { result } = renderHook(() => useQueryLibrarySave());

      await result.current.updateQuery(mockQuery, { queryLibraryRef, context: CoreApp.Explore }, onUpdateSuccess);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to update query in library:', apiError);
      expect(onUpdateSuccess).not.toHaveBeenCalled();
      expect(mockQueryLibraryContext.openDrawer).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should work without app context', async () => {
      const { result } = renderHook(() => useQueryLibrarySave());

      await result.current.updateQuery(mockQuery, { queryLibraryRef, context: undefined }, onUpdateSuccess);

      expect(mockQueryLibraryContext.openDrawer).toHaveBeenCalledWith({
        datasourceFilters: [],
        onSelectQuery: undefined,
        options: { context: 'unknown', highlightQuery: queryLibraryRef },
      });
    });

    it('should work without onUpdateSuccess callback', async () => {
      const { result } = renderHook(() => useQueryLibrarySave());

      await result.current.updateQuery(mockQuery, { queryLibraryRef, context: CoreApp.Explore });

      expect(mockUpdateQueryTemplate).toHaveBeenCalled();
      expect(mockUnwrap).toHaveBeenCalled();
      // Should not throw error when onUpdateSuccess is undefined
    });

    it('should pass onSelectQuery callback to openDrawer after successful update', async () => {
      const { result } = renderHook(() => useQueryLibrarySave());
      const mockOnSelectQuery = jest.fn();

      await result.current.updateQuery(
        mockQuery,
        { queryLibraryRef, context: CoreApp.Explore },
        onUpdateSuccess,
        mockOnSelectQuery
      );

      expect(mockQueryLibraryContext.openDrawer).toHaveBeenCalledWith({
        datasourceFilters: [],
        onSelectQuery: mockOnSelectQuery,
        options: { context: CoreApp.Explore, highlightQuery: queryLibraryRef },
      });
    });

    it('should handle undefined onSelectQuery callback gracefully', async () => {
      const { result } = renderHook(() => useQueryLibrarySave());

      await result.current.updateQuery(
        mockQuery,
        { queryLibraryRef, context: CoreApp.Explore },
        onUpdateSuccess,
        undefined
      );

      expect(mockQueryLibraryContext.openDrawer).toHaveBeenCalledWith({
        datasourceFilters: [],
        onSelectQuery: undefined,
        options: { context: CoreApp.Explore, highlightQuery: queryLibraryRef },
      });
    });

    it('should not call onSelectQuery when update fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const apiError = new Error('API Error');
      mockUnwrap.mockRejectedValue(apiError);
      const mockOnSelectQuery = jest.fn();

      const { result } = renderHook(() => useQueryLibrarySave());

      await result.current.updateQuery(
        mockQuery,
        { queryLibraryRef, context: CoreApp.Explore },
        onUpdateSuccess,
        mockOnSelectQuery
      );

      expect(mockQueryLibraryContext.openDrawer).not.toHaveBeenCalled();
      expect(mockOnSelectQuery).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('isEnabled', () => {
    it('should return true when saved queries is enabled', () => {
      const { result } = renderHook(() => useQueryLibrarySave());

      expect(result.current.isEnabled()).toBe(true);
    });

    it('should return false when saved queries is disabled', () => {
      mockQueryLibraryContext.queryLibraryEnabled = false;

      const { result } = renderHook(() => useQueryLibrarySave());

      expect(result.current.isEnabled()).toBe(false);
    });
  });
});
