import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { QueryLibraryEditingHeader } from './QueryLibraryEditingHeader';

// Mock @grafana/i18n
jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (key: string, defaultValue: string) => defaultValue,
}));

// Mock the useQueryLibrarySave hook
const mockUpdateQuery = jest.fn();
const mockSaveNewQuery = jest.fn();
const mockIsEnabled = jest.fn(() => true);

jest.mock('./hooks/useQueryLibrarySave', () => ({
  useQueryLibrarySave: () => ({
    updateQuery: mockUpdateQuery,
    saveNewQuery: mockSaveNewQuery,
    isEnabled: mockIsEnabled,
  }),
}));

const defaultProps = {
  query: { refId: 'A', datasource: { type: 'prometheus', uid: 'uid' } } as DataQuery,
  app: CoreApp.Explore,
  queryLibraryRef: 'test-query-ref',
  onCancelEdit: jest.fn(),
  onUpdateSuccess: jest.fn(),
  onSelectQuery: jest.fn(),
};

const renderComponent = (props = {}) => {
  const { user } = render(<QueryLibraryEditingHeader {...defaultProps} {...props} />);
  return { user };
};

describe('QueryLibraryEditingHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEnabled.mockReturnValue(true);
  });

  describe('Conditional rendering', () => {
    it('should render blue wrapper when editing a query from library', () => {
      renderComponent();

      expect(screen.getByText('Editing from saved queries')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save and return to saved queries' })).toBeInTheDocument();
    });

    it('should not render when queryLibraryRef is undefined', () => {
      renderComponent({ queryLibraryRef: undefined });

      expect(screen.queryByText('Editing from saved queries')).not.toBeInTheDocument();
    });

    it('should not render when query library is disabled', () => {
      mockIsEnabled.mockReturnValue(false);

      renderComponent();

      expect(screen.queryByText('Editing from saved queries')).not.toBeInTheDocument();
    });
  });

  describe('Button interactions', () => {
    it('should call onCancelEdit when Discard button is clicked', async () => {
      const onCancelEdit = jest.fn();

      const { user } = renderComponent({ onCancelEdit });

      await user.click(screen.getByRole('button', { name: 'Discard' }));

      expect(onCancelEdit).toHaveBeenCalledTimes(1);
    });

    it('should call updateQuery when Save button is clicked', async () => {
      const { user } = renderComponent();
      await user.click(screen.getByRole('button', { name: 'Save and return to saved queries' }));

      expect(mockUpdateQuery).toHaveBeenCalledWith(
        defaultProps.query,
        {
          context: defaultProps.app,
          queryLibraryRef: defaultProps.queryLibraryRef,
        },
        defaultProps.onUpdateSuccess,
        defaultProps.onSelectQuery
      );
    });

    it('should pass correct context when called from different apps', async () => {
      const { user } = renderComponent({ app: CoreApp.Dashboard });
      await user.click(screen.getByRole('button', { name: 'Save and return to saved queries' }));

      expect(mockUpdateQuery).toHaveBeenCalledWith(
        defaultProps.query,
        {
          context: CoreApp.Dashboard,
          queryLibraryRef: defaultProps.queryLibraryRef,
        },
        defaultProps.onUpdateSuccess,
        defaultProps.onSelectQuery
      );
    });
  });
});
