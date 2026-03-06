import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { mockQueryTemplateRow } from '../utils/mocks';

import { QueryLibraryMenuActions, QueryLibraryMenuActionsProps } from './QueryLibraryMenuActions';

const mockSetNewQuery = jest.fn();
const mockTriggerAnalyticsEvent = jest.fn();
const mockSetIsEditingQuery = jest.fn();
const mockOnEditQuerySuccess = jest.fn();

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({
    setNewQuery: mockSetNewQuery,
    triggerAnalyticsEvent: mockTriggerAnalyticsEvent,
  }),
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    user: { uid: 'test-user' },
    hasRole: jest.fn(() => true),
  },
}));

describe('QueryLibraryMenuActions', () => {
  const defaultProps: QueryLibraryMenuActionsProps = {
    selectedQueryRow: mockQueryTemplateRow,
    setIsEditingQuery: mockSetIsEditingQuery,
    onEditQuerySuccess: mockOnEditQuerySuccess,
  };

  const lockedQueryTemplateRow = {
    ...mockQueryTemplateRow,
    isLocked: true,
  };

  const newQueryTemplateRow = {
    ...mockQueryTemplateRow,
    uid: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should disable menu button when query has no uid', () => {
    render(<QueryLibraryMenuActions {...defaultProps} selectedQueryRow={newQueryTemplateRow} />);
    const button = screen.getByRole('button', { name: 'Saved query actions' });
    expect(button).toBeDisabled();
  });

  it('should disable menu button when user cannot edit query', () => {
    jest.mocked(require('app/core/core').contextSrv.hasRole).mockReturnValue(false);

    render(<QueryLibraryMenuActions {...defaultProps} />);
    const button = screen.getByRole('button', { name: 'Saved query actions' });
    expect(button).toBeDisabled();
  });

  it('should open menu when button is clicked', async () => {
    jest.mocked(require('app/core/core').contextSrv.hasRole).mockReturnValue(true);

    const { user } = render(<QueryLibraryMenuActions {...defaultProps} />);
    const button = screen.getByRole('button', { name: 'Saved query actions' });
    expect(button).not.toBeDisabled();

    await user.click(button);

    expect(screen.getByText('Duplicate query')).toBeInTheDocument();
    expect(screen.getByText('Lock query')).toBeInTheDocument();
    expect(screen.getByText('Delete query')).toBeInTheDocument();
  });

  it('should show lock button when query is not locked', async () => {
    const { user } = render(<QueryLibraryMenuActions {...defaultProps} />);
    const button = screen.getByRole('button', { name: 'Saved query actions' });

    await user.click(button);

    expect(screen.getByText('Lock query')).toBeInTheDocument();
    expect(screen.queryByText('Unlock query')).not.toBeInTheDocument();
  });

  it('should show unlock button when query is locked', async () => {
    const { user } = render(<QueryLibraryMenuActions {...defaultProps} selectedQueryRow={lockedQueryTemplateRow} />);
    const button = screen.getByRole('button', { name: 'Saved query actions' });

    await user.click(button);

    expect(screen.getByText('Unlock query')).toBeInTheDocument();
    expect(screen.queryByText('Lock query')).not.toBeInTheDocument();
  });

  it('should disable delete button when query is locked', async () => {
    const { user } = render(<QueryLibraryMenuActions {...defaultProps} selectedQueryRow={lockedQueryTemplateRow} />);
    const button = screen.getByRole('button', { name: 'Saved query actions' });

    await user.click(button);

    const deleteButton = screen.getByText('Delete query');
    expect(deleteButton.closest('button')).toBeDisabled();
  });

  it('should enable delete button when query is not locked', async () => {
    const { user } = render(<QueryLibraryMenuActions {...defaultProps} />);
    const button = screen.getByRole('button', { name: 'Saved query actions' });

    await user.click(button);

    const deleteButton = screen.getByText('Delete query');
    expect(deleteButton.closest('button')).not.toBeDisabled();
  });

  it('should disable duplicate and delete button when user is a viewer, even though they are the author', () => {
    contextSrv.user.uid = 'viewer:JohnDoe';
    contextSrv.user.orgRole = OrgRole.Viewer;
    render(<QueryLibraryMenuActions {...defaultProps} />);

    expect(screen.queryByRole('button', { name: 'Delete query' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicate query' })).not.toBeInTheDocument();
  });
});
