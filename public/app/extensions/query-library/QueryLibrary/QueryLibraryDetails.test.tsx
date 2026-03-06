import { screen } from '@testing-library/react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { generatedAPI } from 'app/extensions/api/clients/queries/v1beta1/endpoints.gen';
import { addExtraMiddleware, addRootReducer } from 'app/store/configureStore';

import { render } from '../../../../test/test-utils';
import { selectors } from '../e2e-selectors/selectors';
import { canEditQuery } from '../utils/identity';
import { mockQueryTemplateRow } from '../utils/mocks';
import { useDatasource } from '../utils/useDatasource';

import { QueryLibraryDetails, QueryDetails, QueryDetailsProps } from './QueryLibraryDetails';

// Mock the canEditQuery function
jest.mock('../utils/identity', () => ({
  canEditQuery: jest.fn(),
}));

// Mock the useDatasource hook to avoid async state updates
jest.mock('../utils/useDatasource', () => ({
  useDatasource: jest.fn(),
}));

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: jest.fn(() => ({
    context: 'explore',
    triggerAnalyticsEvent: jest.fn(),
  })),
}));

const mockCanEditQuery = canEditQuery as jest.MockedFunction<typeof canEditQuery>;
const mockUseDatasource = useDatasource as jest.MockedFunction<typeof useDatasource>;
// Mock useDatasource to return a consistent datasource object
mockUseDatasource.mockReturnValue({
  value: {
    meta: {
      info: {
        logos: {
          small: 'foo/icn-prometheus.svg',
        },
      },
    },
    type: 'prometheus',
  },
  loading: false,
} as any);

beforeAll(() => {
  addRootReducer({
    [generatedAPI.reducerPath]: generatedAPI.reducer,
  });
  addExtraMiddleware(generatedAPI.middleware);
});

const QueryLibraryDetailsWrapper = (props: Partial<QueryDetailsProps>) => {
  const methods = useForm<QueryDetails>({
    defaultValues: {
      title: props.query?.title ?? '',
      description: props.query?.description ?? '',
      tags: props.query?.tags ?? [],
      isVisible: props.query?.isVisible ?? true,
    },
  });
  const [editingQuery, setEditingQuery] = useState(false);

  return (
    <FormProvider {...methods}>
      <QueryLibraryDetails
        editingQuery={editingQuery}
        setEditingQuery={setEditingQuery}
        {...props}
        query={props.query ?? mockQueryTemplateRow}
        onEditQuerySuccess={jest.fn()}
      />
    </FormProvider>
  );
};

describe('QueryLibraryDetails', () => {
  beforeEach(() => {
    mockCanEditQuery.mockReturnValue(true);
  });

  it('should render datasource logo and query title', async () => {
    render(<QueryLibraryDetailsWrapper query={mockQueryTemplateRow} />);

    const logo = await screen.findByRole('img', { name: 'prometheus' });
    expect(logo).toHaveAttribute('src', 'foo/icn-prometheus.svg');

    const title = await screen.findByText(mockQueryTemplateRow.title!);
    expect(title).toBeInTheDocument();
  });

  it('should render other query details', async () => {
    render(<QueryLibraryDetailsWrapper query={mockQueryTemplateRow} />);

    const query = await screen.findByText(mockQueryTemplateRow.queryText!);
    expect(query).toBeInTheDocument();
    expect(screen.queryByTestId('query-editor-box')).not.toBeInTheDocument();

    expect(screen.getByLabelText('Data source')).toHaveValue(mockQueryTemplateRow.datasourceName);
    expect(screen.getByLabelText('Description')).toHaveValue(mockQueryTemplateRow.description);
    expect(screen.getByLabelText('Author')).toHaveValue(mockQueryTemplateRow.user?.displayName);
    expect(screen.getByLabelText('Share query with all users')).toBeChecked();
  });

  it('should render query editor when query has no queryText', async () => {
    mockUseDatasource.mockReturnValue({
      value: {
        meta: {
          info: {
            logos: {
              small: 'foo/icn-prometheus.svg',
            },
          },
        },
        type: 'prometheus',
        components: {
          QueryEditor: () => <div data-testid="query-editor-box">QueryEditor</div>,
        },
      },
      loading: false,
    } as any);

    render(
      <QueryLibraryDetailsWrapper
        query={{ ...mockQueryTemplateRow, queryText: undefined }}
        editingQuery={false}
        setEditingQuery={jest.fn()}
      />
    );
    const queryEditorBox = await screen.findByTestId('query-editor-box');
    expect(queryEditorBox).toBeInTheDocument();
    expect(screen.getByLabelText('Data source')).toHaveValue(mockQueryTemplateRow.datasourceName);
    expect(screen.getByLabelText('Description')).toHaveValue(mockQueryTemplateRow.description);
    expect(screen.getByLabelText('Author')).toHaveValue(mockQueryTemplateRow.user?.displayName);
    expect(screen.getByLabelText('Share query with all users')).toBeChecked();
  });

  it('should make form editable when clicking edit button', async () => {
    const { user, rerender } = render(<QueryLibraryDetailsWrapper query={mockQueryTemplateRow} />);
    const editButton = screen.getByRole('button', { name: 'Edit query' });

    await user.click(editButton);
    expect(editButton).not.toBeInTheDocument();

    const input = await screen.getByTestId(selectors.components.queryLibraryDrawer.titleInput);
    expect(input).toBeInTheDocument();

    await user.type(input, 't');

    rerender(<QueryLibraryDetailsWrapper query={mockQueryTemplateRow} editingQuery={false} />);

    const newEditButton = screen.getByRole('button', { name: 'Edit query' });
    expect(newEditButton).toBeInTheDocument();
  });

  it('edit button should be disabled when query is locked', async () => {
    render(
      <QueryLibraryDetailsWrapper
        query={{ ...mockQueryTemplateRow, isLocked: true }}
        editingQuery={false}
        setEditingQuery={jest.fn()}
      />
    );

    const editButton = await screen.findByRole('button', { name: 'Edit query' });
    expect(editButton).toBeDisabled();
  });

  it('edit button should be disabled when user does not have privileges', async () => {
    mockCanEditQuery.mockReturnValue(false);
    render(
      <QueryLibraryDetailsWrapper query={mockQueryTemplateRow} editingQuery={false} setEditingQuery={jest.fn()} />
    );

    const editButton = screen.getByRole('button', { name: 'Edit query' });
    expect(editButton).toBeDisabled();
  });

  it('should show Edit in Explore button when user can edit query', async () => {
    render(
      <QueryLibraryDetailsWrapper query={mockQueryTemplateRow} editingQuery={false} setEditingQuery={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Edit in Explore' })).toBeInTheDocument();
  });

  it('should hide Edit in Explore button when user cannot edit query', async () => {
    mockCanEditQuery.mockReturnValue(false);
    render(
      <QueryLibraryDetailsWrapper query={mockQueryTemplateRow} editingQuery={false} setEditingQuery={jest.fn()} />
    );

    expect(screen.queryByRole('button', { name: 'Edit in Explore' })).not.toBeInTheDocument();
  });

  it('should hide irrelevant elements when using history', async () => {
    render(
      <QueryLibraryDetailsWrapper
        query={mockQueryTemplateRow}
        editingQuery={false}
        setEditingQuery={jest.fn()}
        usingHistory={true}
      />
    );

    const tagsInput = screen.queryByLabelText('Tags');
    expect(tagsInput).not.toBeInTheDocument();

    const shareQueryWithAllUsers = screen.queryByLabelText('Share query with all users');
    expect(shareQueryWithAllUsers).not.toBeInTheDocument();

    const saveButton = screen.queryByRole('button', { name: 'Save' });
    expect(saveButton).not.toBeInTheDocument();

    const editButton = screen.queryByRole('button', { name: 'Edit query' });
    expect(editButton).not.toBeInTheDocument();

    const author = screen.queryByLabelText('Author');
    expect(author).not.toBeInTheDocument();

    const menuActions = screen.queryByRole('button', { name: 'Saved query actions' });
    expect(menuActions).not.toBeInTheDocument();
  });
});
