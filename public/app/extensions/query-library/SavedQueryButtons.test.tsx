import { screen } from '@testing-library/react';
import { useLocalStorage } from 'react-use';
import { render } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { SavedQueryButtons } from './SavedQueryButtons';
import { mockQuery } from './utils/mocks';

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useLocalStorage: jest.fn(),
}));

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: jest.fn(() => true),
}));

const mockUseLocalStorage = useLocalStorage as jest.Mock;

describe('SaveQueryButton', () => {
  it('should render badge for the first time', () => {
    mockUseLocalStorage.mockReturnValue([true, jest.fn()]);

    render(<SavedQueryButtons query={mockQuery} datasourceFilters={[]} />);
    expect(screen.getByText('New!')).toBeInTheDocument();
  });

  it('should render save and replace buttons after the first time', () => {
    mockUseLocalStorage.mockReturnValue([false, jest.fn()]);
    render(<SavedQueryButtons query={mockQuery} datasourceFilters={[]} />);
    expect(screen.getByRole('button', { name: 'Save query' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace with saved query' })).toBeInTheDocument();
  });

  it('should not render save button for viewer but render replace button', () => {
    mockUseLocalStorage.mockReturnValue([true, jest.fn()]);
    contextSrv.user.orgRole = OrgRole.Viewer;
    render(<SavedQueryButtons query={mockQuery} datasourceFilters={[]} />);

    expect(screen.queryByRole('button', { name: 'Save query' })).not.toBeInTheDocument();

    expect(screen.getByText('New!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace with saved query' })).toBeInTheDocument();
  });
});
