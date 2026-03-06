import { reportInteraction } from '@grafana/runtime';

import { QueryLibraryInteractions } from './QueryLibraryAnalyticsEvents';

jest.mock('@grafana/runtime', () => ({
  reportInteraction: jest.fn(),
}));

describe('QueryLibraryAnalyticsEvents', () => {
  it('calls reportInteraction with correct event name', () => {
    QueryLibraryInteractions.queryLibraryOpened();
    expect(reportInteraction).toHaveBeenCalledWith('query_library-opened', undefined);
  });

  it('passes properties through to reportInteraction', () => {
    QueryLibraryInteractions.saveQuerySuccess({ datasourceType: 'prometheus', custom: 'x' });
    expect(reportInteraction).toHaveBeenCalledWith(
      'query_library-save_query_success',
      expect.objectContaining({ datasourceType: 'prometheus', custom: 'x' })
    );
  });
});
