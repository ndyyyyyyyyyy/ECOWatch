import {
  QueryVariableModel,
  AdHocVariableModel,
  TypedVariableModel,
  VariableRefresh,
  VariableSort,
  CustomVariableModel,
  DataSourceVariableModel,
  IntervalVariableModel,
  ConstantVariableModel,
  TextBoxVariableModel,
  GroupByVariableModel,
  SnapshotVariableModel,
  SystemVariable,
  LoadingState,
} from '@grafana/data';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { applyDefaultVariablesV2 } from './variables';

describe('applyDefaultVariablesV2', () => {
  const queryVariable: QueryVariableModel = {
    name: 'A',
    type: 'query',
    query: 'A.*',
    current: { value: 'A.AA', text: 'A text', selected: true },
    options: [],
    id: 'A',
    rootStateKey: null,
    global: false,
    hide: 0,
    skipUrlSync: false,
    index: 0,
    state: LoadingState.Done,
    error: null,
    description: null,
    datasource: null,
    definition: 'A.*',
    sort: VariableSort.disabled,
    regex: '',
    refresh: VariableRefresh.never,
    multi: false,
    includeAll: false,
  };

  const adhocVariable: AdHocVariableModel = {
    name: 'B',
    type: 'adhoc',
    filters: [{ key: 'B', operator: '=', value: 'B.BB' }],
    id: 'B',
    rootStateKey: null,
    global: false,
    hide: 0,
    skipUrlSync: false,
    index: 1,
    state: LoadingState.Done,
    error: null,
    description: null,
    datasource: null,
  };

  const customVariable: CustomVariableModel = {
    name: 'C',
    type: 'custom',
    query: 'C.*',
    current: { value: 'C.CC', text: 'C text', selected: true },
    options: [],
    id: 'C',
    rootStateKey: null,
    global: false,
    hide: 0,
    skipUrlSync: false,
    index: 2,
    state: LoadingState.Done,
    error: null,
    description: null,
    multi: false,
    includeAll: false,
  };

  const datasourceVariable: DataSourceVariableModel = {
    name: 'D',
    type: 'datasource',
    query: 'D.*',
    current: { value: 'D.DD', text: 'D text', selected: true },
    options: [],
    id: 'D',
    rootStateKey: null,
    global: false,
    hide: 0,
    skipUrlSync: false,
    index: 3,
    state: LoadingState.Done,
    error: null,
    description: null,
    regex: '',
    refresh: VariableRefresh.never,
    multi: false,
    includeAll: false,
  };

  const intervalVariable: IntervalVariableModel = {
    name: 'E',
    type: 'interval',
    query: 'E.*',
    current: { value: 'E.EE', text: 'E text', selected: true },
    options: [],
    id: 'E',
    rootStateKey: null,
    global: false,
    hide: 0,
    skipUrlSync: false,
    index: 4,
    state: LoadingState.Done,
    error: null,
    description: null,
    auto: false,
    auto_min: '',
    auto_count: 0,
    refresh: VariableRefresh.never,
  };

  const constantVariable: ConstantVariableModel = {
    name: 'F',
    type: 'constant',
    query: 'F.*',
    current: { value: 'F.FF', text: 'F text', selected: true },
    options: [],
    id: 'F',
    rootStateKey: null,
    global: false,
    hide: 0,
    skipUrlSync: false,
    index: 5,
    state: LoadingState.Done,
    error: null,
    description: null,
  };

  const textBoxVariable: TextBoxVariableModel = {
    name: 'G',
    type: 'textbox',
    query: 'G.*',
    current: { value: 'G.GG', text: 'G text', selected: true },
    options: [],
    id: 'G',
    rootStateKey: null,
    global: false,
    hide: 0,
    skipUrlSync: false,
    index: 6,
    state: LoadingState.Done,
    error: null,
    description: null,
    originalQuery: null,
  };

  const groupByVariable: GroupByVariableModel = {
    name: 'H',
    type: 'groupby',
    query: 'H.*',
    current: { value: 'H.HH', text: 'H text', selected: true },
    options: [],
    id: 'H',
    rootStateKey: null,
    global: false,
    hide: 0,
    skipUrlSync: false,
    index: 7,
    state: LoadingState.Done,
    error: null,
    description: null,
    datasource: null,
    multi: true,
    allowCustomValue: false,
  };

  const variables: TypedVariableModel[] = [
    queryVariable,
    adhocVariable,
    customVariable,
    datasourceVariable,
    intervalVariable,
    constantVariable,
    textBoxVariable,
    groupByVariable,
  ];

  it('should return the same variables if no report variables are provided', () => {
    const result = applyDefaultVariablesV2(variables);
    expect(result).toEqual(variables);
  });

  it('should apply default variables', () => {
    const reportVariables = {
      A: ['A different value'],
      B: ['B|=|B different value'],
      C: ['C different value'],
      D: ['D different value'],
      E: ['E different value'],
      F: ['F different value'],
      G: ['G different value'],
      H: ['H different value'],
    };
    const result = applyDefaultVariablesV2(variables, reportVariables);
    expect(result).toEqual([
      {
        ...variables[0],
        current: { value: 'A different value', text: 'A different value', selected: true },
      },
      { ...variables[1], filters: [{ key: 'B', operator: '=', value: 'B different value' }] },
      {
        ...variables[2],
        current: { value: 'C different value', text: 'C different value', selected: true },
      },
      {
        ...variables[3],
        current: { value: 'D different value', text: 'D different value', selected: true },
      },
      {
        ...variables[4],
        current: { value: 'E different value', text: 'E different value', selected: true },
      },
      {
        ...variables[5],
        current: { value: 'F different value', text: 'F different value', selected: true },
      },
      {
        ...variables[6],
        current: { value: 'G different value', text: 'G different value', selected: true },
      },
      {
        ...variables[7],
        current: { value: ['H different value'], text: ['H different value'], selected: true },
      },
    ]);
  });

  it('should correclty manage ALL case', () => {
    const queryVariable: QueryVariableModel = {
      name: 'A',
      type: 'query',
      query: 'A.*',
      current: { value: [ALL_VARIABLE_VALUE], text: ALL_VARIABLE_TEXT, selected: true },
      options: [],
      id: 'A',
      rootStateKey: null,
      global: false,
      hide: 0,
      skipUrlSync: false,
      index: 0,
      state: LoadingState.Done,
      error: null,
      description: null,
      datasource: null,
      definition: 'A.*',
      sort: VariableSort.disabled,
      regex: '',
      refresh: VariableRefresh.never,
      multi: true,
      includeAll: false,
    };

    const reportVariables = {
      A: [ALL_VARIABLE_TEXT],
    };
    const result = applyDefaultVariablesV2([queryVariable], reportVariables);
    expect(result).toEqual([
      {
        ...queryVariable,
        current: { value: [ALL_VARIABLE_VALUE], text: [ALL_VARIABLE_TEXT], selected: true },
      },
    ]);
  });

  it('should throw an error for snapshot variable type', () => {
    const variables: SnapshotVariableModel[] = [
      {
        name: 'X',
        type: 'snapshot',
        query: 'X.*',
        current: { value: 'X.XX', text: 'X text', selected: true },
        options: [],
        id: 'X',
        rootStateKey: null,
        global: false,
        hide: 0,
        skipUrlSync: false,
        index: 0,
        state: LoadingState.Done,
        error: null,
        description: null,
      },
    ];

    const reportVariable = {
      X: ['X.XX'],
    };

    expect(() => applyDefaultVariablesV2(variables, reportVariable)).toThrow(
      'Reporting: Unsupported variable type snapshot'
    );
  });

  it('should throw an error for system variable type', () => {
    const variables: Array<SystemVariable<{ name: string; id: number; toString: () => string }>> = [
      {
        name: 'X',
        type: 'system',
        current: { value: { name: 'X', id: 1, toString: () => 'X' } },
        id: 'X',
        rootStateKey: null,
        global: false,
        hide: 0,
        skipUrlSync: false,
        index: 0,
        state: LoadingState.Done,
        error: null,
        description: null,
      },
    ];

    const reportVariable = {
      X: ['X.XX'],
    };

    expect(() => applyDefaultVariablesV2(variables, reportVariable)).toThrow(
      'Reporting: Unsupported variable type system'
    );
  });
});
