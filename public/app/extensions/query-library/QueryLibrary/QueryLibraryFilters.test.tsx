import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { QueryLibraryFilters, QueryLibraryFiltersProps } from './QueryLibraryFilters';

const SEARCH_PLACEHOLDER = 'Search by data source, query content, title, or description';
const DATASOURCE_PLACEHOLDER = 'Filter by data source';
const USER_PLACEHOLDER = 'Filter by user name';
const TAG_PLACEHOLDER = 'Filter by tag';
const SORT_PLACEHOLDER = 'Sort';

describe('QueryLibraryFilters', () => {
  const mockOnChangeDatasourceFilters = jest.fn();
  const mockOnChangeSearchQuery = jest.fn();
  const mockOnChangeSortingOption = jest.fn();
  const mockOnChangeUserFilters = jest.fn();
  const mockOnChangeTagFilters = jest.fn();

  const defaultProps: QueryLibraryFiltersProps = {
    datasourceFilterOptions: [{ label: 'Datasource 1', value: 'ds1' }],
    datasourceFilters: [],
    disabled: false,
    onChangeDatasourceFilters: mockOnChangeDatasourceFilters,
    onChangeSearchQuery: mockOnChangeSearchQuery,
    onChangeUserFilters: mockOnChangeUserFilters,
    onChangeSortingOption: mockOnChangeSortingOption,
    sortingOption: undefined,
    onChangeTagFilters: mockOnChangeTagFilters,
    searchQuery: '',
    userFilterOptions: [{ label: 'User 1', value: 'user1' }],
    userFilters: [],
    tagFilters: [],
    getTagOptions: async () => [{ term: 'tag1', count: 1 }],
  };

  it('calls onChangeSearchQuery when search input changes', async () => {
    render(<QueryLibraryFilters {...defaultProps} />);
    const searchInput = await waitFor(() => screen.getByPlaceholderText(SEARCH_PLACEHOLDER));
    expect(searchInput).toBeInTheDocument();
    await userEvent.type(searchInput, 'f');
    expect(mockOnChangeSearchQuery).toHaveBeenCalledWith('f');
  });

  it('calls onChangeDatasourceFilters when datasource filter changes', async () => {
    render(<QueryLibraryFilters {...defaultProps} />);
    const datasourceSelect = screen.getByText(DATASOURCE_PLACEHOLDER);
    await userEvent.click(datasourceSelect);
    await userEvent.click(screen.getByText('Datasource 1'));
    expect(mockOnChangeDatasourceFilters).toHaveBeenCalledWith([
      {
        label: 'Datasource 1',
        value: 'ds1',
      },
    ]);
  });

  it('calls onChangeUserFilters when user filter changes', async () => {
    render(<QueryLibraryFilters {...defaultProps} />);
    const userSelect = screen.getByText(USER_PLACEHOLDER);
    await userEvent.click(userSelect);
    await userEvent.click(screen.getByText('User 1'));
    expect(defaultProps.onChangeUserFilters).toHaveBeenCalledWith([
      {
        label: 'User 1',
        value: 'user1',
      },
    ]);
  });

  it('calls onChangeSortingOption when sorting option changes', async () => {
    const { user } = render(<QueryLibraryFilters {...defaultProps} />);

    const sortingSelect = await waitFor(() => screen.getByText(SORT_PLACEHOLDER));
    expect(sortingSelect).toBeVisible();
    await user.click(sortingSelect);
    const descOption = await screen.findByRole('option', { name: 'Alphabetically (Z–A)' });
    await user.click(descOption);
    expect(mockOnChangeSortingOption).toHaveBeenCalledWith({
      label: 'Alphabetically (Z–A)',
      value: 'desc',
      sort: expect.any(Function),
    });
  });

  it('calls onChangeTagFilters when tag filter changes', async () => {
    render(<QueryLibraryFilters {...defaultProps} />);
    const tagFilter = screen.getByText(TAG_PLACEHOLDER);

    // Click on the TagFilter to open the dropdown
    await userEvent.click(tagFilter!);

    // Wait for the dropdown to load and click on the tag option
    const tagOption = await screen.findByText('tag1');
    await userEvent.click(tagOption);

    // TagFilter calls onChange with an array of strings
    expect(mockOnChangeTagFilters).toHaveBeenCalledWith(['tag1']);
  });

  it('disables inputs when disabled prop is true', async () => {
    render(<QueryLibraryFilters {...defaultProps} disabled={true} />);
    await waitFor(() => expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toBeDisabled());

    const datasourceSelect = screen.getByLabelText(DATASOURCE_PLACEHOLDER);
    const userSelect = screen.getByLabelText(USER_PLACEHOLDER);

    expect(datasourceSelect).toBeDisabled();
    expect(userSelect).toBeDisabled();

    // Note: TagFilter doesn't support disabled prop, so it remains enabled
    // This is expected behavior until TagFilter component is updated to support disabled state
  });
});
