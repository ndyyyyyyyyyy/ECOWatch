import { screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';

import { EventBusSrv } from '@grafana/data';
import { generatedAPI } from 'app/extensions/api/clients/queries/v1beta1/endpoints.gen';
import { addExtraMiddleware, addRootReducer } from 'app/store/configureStore';

import { render } from '../../../../test/test-utils';
import { convertAddQueryTemplateCommandToDataQuerySpec } from '../utils/mappers';
import { mockQueryTemplateRow } from '../utils/mocks';
import { useDatasource } from '../utils/useDatasource';

import { QueryDetails } from './QueryLibraryDetails';
import { QueryLibraryForm, QueryLibraryFormProps } from './QueryLibraryForm';

const testEventBus = new EventBusSrv();
testEventBus.publish = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => testEventBus,
}));

const mockOnSave = jest.fn();
const mockTriggerAnalyticsEvent = jest.fn();

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({
    onSave: mockOnSave,
    triggerAnalyticsEvent: mockTriggerAnalyticsEvent,
  }),
}));

const mockCreateQueryMutation = jest.fn().mockReturnValue({
  unwrap: jest.fn().mockResolvedValue({ metadata: { name: 'new-query-id' } }),
});
const mockUpdateQueryMutation = jest.fn().mockReturnValue({
  unwrap: jest.fn().mockResolvedValue({}),
});
jest.mock('app/extensions/api/clients/queries/v1beta1', () => ({
  useCreateQueryMutation: () => [mockCreateQueryMutation, { isLoading: false }],
  useUpdateQueryMutation: () => [mockUpdateQueryMutation, { isLoading: false }],
  useDeleteQueryMutation: () => [jest.fn(), { isLoading: false }],
}));

jest.mock('../utils/identity', () => ({
  canEditQuery: jest.fn().mockReturnValue(true),
}));

// Mock the useDatasource hook to avoid async state updates
jest.mock('../utils/useDatasource', () => ({
  useDatasource: jest.fn(),
}));

const mockUseDatasource = useDatasource as jest.MockedFunction<typeof useDatasource>;
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

const mockOnEditQuerySuccess = jest.fn();
const defaultProps: QueryLibraryFormProps = {
  selectedQueryRow: mockQueryTemplateRow,
  isEditingQuery: true,
  setIsEditingQuery: jest.fn(),
  onEditQuerySuccess: mockOnEditQuerySuccess,
};

beforeAll(() => {
  addRootReducer({
    [generatedAPI.reducerPath]: generatedAPI.reducer,
  });
  addExtraMiddleware(generatedAPI.middleware);
});

afterAll(() => {
  jest.restoreAllMocks();
});

const QueryLibraryFormWrapper = (props: QueryLibraryFormProps) => {
  const methods = useForm<QueryDetails>({
    defaultValues: {
      title: props.selectedQueryRow?.title ?? '',
      description: props.selectedQueryRow?.description ?? '',
      tags: props.selectedQueryRow?.tags ?? [],
      isVisible: props.selectedQueryRow?.isVisible ?? true,
    },
  });

  return (
    <FormProvider {...methods}>
      <QueryLibraryForm {...props} />
    </FormProvider>
  );
};

describe('QueryLibraryForm', () => {
  it('should call update query template mutation when save button is clicked', async () => {
    const { user } = render(<QueryLibraryFormWrapper {...defaultProps} />);
    const titleInput = await screen.findByRole('textbox', { name: /title/i });

    await user.type(titleInput, ' with title extended');
    const saveButton = await screen.findByRole('button', { name: 'Save' });

    await user.click(saveButton);

    expect(mockUpdateQueryMutation).toHaveBeenCalledWith({
      name: mockQueryTemplateRow.uid,
      patch: {
        spec: {
          title: `${mockQueryTemplateRow.title} with title extended`,
          description: 'template0-desc',
          tags: ['tag1', 'tag2'],
          isVisible: true,
        },
      },
    });

    expect(mockOnEditQuerySuccess).toHaveBeenCalledWith(mockQueryTemplateRow.uid);
  });
  it('should call create query template mutation when save button is clicked and query is new', async () => {
    const { user } = render(
      <QueryLibraryFormWrapper
        {...defaultProps}
        selectedQueryRow={{ ...mockQueryTemplateRow, title: undefined, uid: undefined }}
      />
    );
    const titleInput = await screen.findByRole('textbox', { name: /title/i });

    await user.type(titleInput, 'New query title');
    const saveButton = await screen.findByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    expect(mockCreateQueryMutation).toHaveBeenCalledWith({
      query: {
        ...convertAddQueryTemplateCommandToDataQuerySpec({
          title: 'New query title',
          description: 'template0-desc',
          tags: ['tag1', 'tag2'],
          isVisible: true,
          targets: [mockQueryTemplateRow.query],
          isLocked: true,
        }),
        metadata: {
          generateName: expect.any(String),
        },
      },
    });

    expect(testEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alert-success',
        payload: ['Query successfully saved to the library'],
      })
    );

    expect(mockOnEditQuerySuccess).toHaveBeenCalledWith('new-query-id', true);
  });
});
