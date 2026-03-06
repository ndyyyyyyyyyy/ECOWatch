import { act, render, screen, waitFor } from '@testing-library/react';

import { OrgRole } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { contextSrv } from 'app/core/services/context_srv';
import { QueryLibraryContextType, useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { QueryLibraryInteractions } from './QueryLibraryAnalyticsEvents';
import { QueryLibraryContextProvider } from './QueryLibraryContextProvider';
import { QueryLibraryEventsPropertyMap } from './types';
import { QueryTemplate } from './utils/types';

// Bit of mocking here mainly so we don't have to mock too much of the API calls here and keep this test focused on the
// context state management and correct rendering.

jest.mock('./QueryLibraryDrawer', () => ({
  __esModule: true,
  QueryLibraryDrawer: (props: {
    isOpen: boolean;
    activeDatasources: string[] | undefined;
    highlightedQuery?: string;
    onSelectQuery: (query: any) => void;
    triggerAnalyticsEvent: (handleAnalyticEvent: (properties?: QueryLibraryEventsPropertyMap) => void) => void;
    newQuery?: QueryTemplate;
  }) =>
    props.isOpen && (
      <div>
        QUERY_DRAWER {JSON.stringify(props.activeDatasources)}{' '}
        {props.highlightedQuery ? `HIGHLIGHT:${props.highlightedQuery}` : ''}
        {props.newQuery ? `NEW_QUERY:${JSON.stringify(props.newQuery)}` : ''}
      </div>
    ),
}));

function setup() {
  let ctx: { current: QueryLibraryContextType | undefined } = { current: undefined };
  function TestComp() {
    ctx.current = useQueryLibraryContext();
    return <div></div>;
  }
  // rendering instead of just using renderHook so we can check if the modal and drawer actually render.
  const renderResult = render(
    <QueryLibraryContextProvider>
      <TestComp />
    </QueryLibraryContextProvider>
  );

  return { ctx, renderResult };
}

describe('QueryLibraryContext', () => {
  it('should not render drawer by default', () => {
    setup();
    expect(screen.queryByText(/QUERY_DRAWER/i)).not.toBeInTheDocument();
  });

  it('should be able to open drawer with a new query', async () => {
    const { ctx } = setup();
    act(() => {
      ctx.current!.openDrawer({ query: { refId: 'A', expr: 'http_requests_total{job="test"}' } as PromQuery });
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).toBeInTheDocument();
      expect(screen.queryByText(/http_requests_total\{job=\\"test\\"}/i)).toBeInTheDocument();
    });
  });

  it('should not be able to open drawer with a new query when user is a viewer', async () => {
    contextSrv.user.orgRole = OrgRole.Viewer;
    const { ctx } = setup();
    act(() => {
      ctx.current!.openDrawer({ query: { refId: 'A', expr: 'http_requests_total{job="test"}' } as PromQuery });
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).not.toBeInTheDocument();
    });
  });

  it('should be able to open drawer', async () => {
    const { ctx } = setup();
    act(() => {
      ctx.current!.openDrawer({ datasourceFilters: ['PROM_TEST_DS'], onSelectQuery: () => {} });
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).toBeInTheDocument();
      expect(screen.queryByText(/PROM_TEST_DS/i)).toBeInTheDocument();
    });
  });

  it('should be able to open drawer with highlightQuery option', async () => {
    const { ctx } = setup();
    act(() => {
      ctx.current!.openDrawer({ datasourceFilters: ['PROM_TEST_DS'], options: { highlightQuery: 'query-uid-123' } });
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).toBeInTheDocument();
      expect(screen.queryByText(/PROM_TEST_DS/i)).toBeInTheDocument();
      expect(screen.queryByText(/HIGHLIGHT:query-uid-123/i)).toBeInTheDocument();
    });
  });

  it('should be able to open drawer with all options', async () => {
    const { ctx } = setup();
    act(() => {
      ctx.current!.openDrawer({
        datasourceFilters: ['PROM_TEST_DS'],
        options: {
          isReplacingQuery: true,
          context: 'test-context',
          highlightQuery: 'query-uid-456',
        },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).toBeInTheDocument();
      expect(screen.queryByText(/PROM_TEST_DS/i)).toBeInTheDocument();
      expect(screen.queryByText(/HIGHLIGHT:query-uid-456/i)).toBeInTheDocument();
    });
  });

  it('should clear highlightQuery when drawer is closed', async () => {
    const { ctx } = setup();

    // Open drawer with highlight
    act(() => {
      ctx.current!.openDrawer({ datasourceFilters: ['PROM_TEST_DS'], options: { highlightQuery: 'query-uid-789' } });
    });

    await waitFor(() => {
      expect(screen.queryByText(/HIGHLIGHT:query-uid-789/i)).toBeInTheDocument();
    });

    // Close drawer
    act(() => {
      ctx.current!.closeDrawer();
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).not.toBeInTheDocument();
    });

    // Reopen without highlight - should not show previous highlight
    act(() => {
      ctx.current!.openDrawer({ datasourceFilters: ['PROM_TEST_DS'], onSelectQuery: () => {} });
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).toBeInTheDocument();
      expect(screen.queryByText(/HIGHLIGHT:/i)).not.toBeInTheDocument();
    });
  });

  it('should maintain backward compatibility - openDrawer without options', async () => {
    const { ctx } = setup();

    // Test original API still works
    act(() => {
      ctx.current!.openDrawer({ datasourceFilters: ['PROM_TEST_DS'], onSelectQuery: () => {} });
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).toBeInTheDocument();
      expect(screen.queryByText(/PROM_TEST_DS/i)).toBeInTheDocument();
      expect(screen.queryByText(/HIGHLIGHT:/i)).not.toBeInTheDocument();
    });
  });

  it('should maintain backward compatibility - openDrawer with existing options only', async () => {
    const { ctx } = setup();

    // Test existing options still work
    act(() => {
      ctx.current!.openDrawer({
        datasourceFilters: ['PROM_TEST_DS'],
        options: {
          isReplacingQuery: true,
          context: 'explore',
        },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText(/QUERY_DRAWER/i)).toBeInTheDocument();
      expect(screen.queryByText(/PROM_TEST_DS/i)).toBeInTheDocument();
      expect(screen.queryByText(/HIGHLIGHT:/i)).not.toBeInTheDocument();
    });
  });

  it('should trigger analytics events with correct context', async () => {
    const { ctx } = setup();
    const analyticsEventSpy = jest.spyOn(QueryLibraryInteractions, 'queryLibraryOpened');

    act(() => {
      ctx.current!.openDrawer({
        datasourceFilters: ['PROM_TEST_DS'],
        onSelectQuery: () => {},
        options: { context: 'test-context' },
      });
    });

    await waitFor(() => {
      expect(analyticsEventSpy).toHaveBeenCalledWith({ app: 'test-context', mode: 'add' });
    });
  });
});
