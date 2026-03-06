import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '../e2e-selectors/selectors';
import { mockQueryTemplateRow } from '../utils/mocks';

import { QueryLibraryItem } from './QueryLibraryItem';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: () => ({
      meta: {
        info: {
          logos: {
            small: 'foo/icn-prometheus.svg',
          },
        },
      },
      type: 'prometheus',
    }),
  }),
  getTemplateSrv: () => ({
    replace: (value: string) => value,
  }),
}));

describe('QueryLibraryItem', () => {
  const mockOnSelectQueryRow = jest.fn();
  const defaultProps = {
    queryRow: mockQueryTemplateRow,
    onSelectQueryRow: mockOnSelectQueryRow,
    isSelected: false,
    onFavorite: jest.fn(),
    onUnfavorite: jest.fn(),
    isFavorite: false,
    favoritesEnabled: true,
  };

  it('renders query title', async () => {
    render(<QueryLibraryItem {...defaultProps} />);
    expect(await screen.findByText(mockQueryTemplateRow.title!)).toBeInTheDocument();
  });

  it('renders query title with new badge when isNew is true', async () => {
    render(<QueryLibraryItem {...defaultProps} isNew={true} />);
    expect(await screen.findByText(mockQueryTemplateRow.title!)).toBeInTheDocument();
    expect(await screen.findByTestId(selectors.components.queryLibraryDrawer.newBadge)).toBeInTheDocument();
  });

  it('renders datasource logo', async () => {
    render(<QueryLibraryItem {...defaultProps} />);
    const logo = await screen.findByRole('img');
    expect(logo).toHaveAttribute('src', 'foo/icn-prometheus.svg');
    expect(logo).toHaveAttribute('alt', 'prometheus');
  });

  it('calls onSelectQueryRow when clicking the item', async () => {
    render(<QueryLibraryItem {...defaultProps} />);
    await userEvent.click(screen.getByRole('radio'));
    expect(mockOnSelectQueryRow).toHaveBeenCalledWith(mockQueryTemplateRow);
  });

  it('renders checked radio when selected', async () => {
    render(<QueryLibraryItem {...defaultProps} isSelected={true} />);
    expect(await screen.findByRole('radio')).toBeChecked();
  });

  it('renders unchecked radio when not selected', async () => {
    render(<QueryLibraryItem {...defaultProps} isSelected={false} />);
    expect(await screen.findByRole('radio')).not.toBeChecked();
  });

  it('renders unfavorite button when isFavorite is true', async () => {
    render(<QueryLibraryItem {...defaultProps} isFavorite={true} />);
    expect(await screen.findByRole('button', { name: 'Unfavorite' })).toBeInTheDocument();
  });

  it('renders favorite button when isFavorite is false', async () => {
    render(<QueryLibraryItem {...defaultProps} isFavorite={false} />);
    expect(await screen.findByRole('button', { name: 'Favorite' })).toBeInTheDocument();
  });

  it('calls onFavorite when clicking the favorite button', async () => {
    render(<QueryLibraryItem {...defaultProps} isFavorite={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Favorite' }));
    expect(defaultProps.onFavorite).toHaveBeenCalled();
  });

  it('calls onUnfavorite when clicking the unfavorite button', async () => {
    render(<QueryLibraryItem {...defaultProps} isFavorite={true} />);
    await userEvent.click(screen.getByRole('button', { name: 'Unfavorite' }));
    expect(defaultProps.onUnfavorite).toHaveBeenCalled();
  });

  it('should not render unfavorite button when favoritesEnabled is false', async () => {
    await act(async () => {
      render(<QueryLibraryItem {...defaultProps} favoritesEnabled={false} isFavorite={true} />);
    });
    expect(await screen.queryByRole('button', { name: 'Unfavorite' })).not.toBeInTheDocument();
  });

  it('should not render favorite button when favoritesEnabled is false', async () => {
    await act(async () => {
      render(<QueryLibraryItem {...defaultProps} favoritesEnabled={false} />);
    });
    expect(await screen.queryByRole('button', { name: 'Favorite' })).not.toBeInTheDocument();
  });
});
