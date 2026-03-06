import { screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { render } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { mockQueryTemplateRow } from '../utils/mocks';

import { QueryLibraryActions, QueryLibraryActionsProps } from './QueryLibraryActions';
import { QueryDetails } from './QueryLibraryDetails';

const mockSetNewQuery = jest.fn();
let mockContext = 'explore';
const mockCloseDrawer = jest.fn();
const mockOnSelectQuery = jest.fn();
jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({
    triggerAnalyticsEvent: jest.fn(),
    setNewQuery: mockSetNewQuery,
    context: mockContext,
    closeDrawer: mockCloseDrawer,
    onSelectQuery: mockOnSelectQuery,
  }),
}));

describe('QueryLibraryActions', () => {
  const defaultProps: QueryLibraryActionsProps = {
    selectedQueryRow: mockQueryTemplateRow,
    isEditingQuery: false,
    setIsEditingQuery: jest.fn(),
    isSavingLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = 'explore';
  });

  const QueryLibraryActionsWrapper = (props: QueryLibraryActionsProps) => {
    const methods = useForm<QueryDetails>();

    return (
      <FormProvider {...methods}>
        <QueryLibraryActions {...props} />
      </FormProvider>
    );
  };

  it('should render all action buttons not related to editing', () => {
    render(<QueryLibraryActionsWrapper {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Select query' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('should not render update and select actions when query is new', () => {
    render(
      <QueryLibraryActionsWrapper {...defaultProps} selectedQueryRow={{ ...mockQueryTemplateRow, uid: undefined }} />
    );
    expect(screen.queryByRole('button', { name: 'Select query' })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should render editing buttons when is editing query', () => {
    render(<QueryLibraryActionsWrapper {...defaultProps} isEditingQuery={true} />);
    expect(screen.queryByRole('button', { name: 'Select query' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should call onSelectQuery when the select button is clicked', async () => {
    const { user } = render(<QueryLibraryActionsWrapper {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Select query' }));
    expect(mockOnSelectQuery).toHaveBeenCalledWith(mockQueryTemplateRow.query);
  });

  it('should only render save recent query button when using history', () => {
    render(<QueryLibraryActionsWrapper {...defaultProps} usingHistory={true} />);
    expect(screen.getByRole('button', { name: 'Save query' })).toBeInTheDocument();
  });

  it('should not render save recent query button when not using history', () => {
    render(<QueryLibraryActionsWrapper {...defaultProps} usingHistory={false} />);
    expect(screen.queryByRole('button', { name: 'Save query' })).not.toBeInTheDocument();
  });

  it('should render save and close button when context is unknown', () => {
    mockContext = 'unknown';
    render(
      <QueryLibraryActionsWrapper {...defaultProps} selectedQueryRow={{ ...mockQueryTemplateRow, uid: undefined }} />
    );
    expect(screen.getByRole('button', { name: 'Save and close' })).toBeInTheDocument();
  });

  it('should call closeDrawer when context is unknown', async () => {
    mockContext = 'unknown';
    const { user } = render(
      <QueryLibraryActionsWrapper {...defaultProps} selectedQueryRow={{ ...mockQueryTemplateRow, uid: undefined }} />
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockCloseDrawer).toHaveBeenCalled();
  });

  it('should disable save button when user is a viewer, even though they are the author', () => {
    contextSrv.user.uid = 'viewer:JohnDoe';
    contextSrv.user.orgRole = OrgRole.Viewer;
    render(<QueryLibraryActionsWrapper {...defaultProps} isEditingQuery={true} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
