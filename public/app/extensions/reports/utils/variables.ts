import { isArray, isString } from 'lodash';

import {
  AdHocVariableFilter,
  TypedVariableModel,
  UrlQueryValue,
  VariableRefresh,
  VariableType,
  VariableWithOptions,
} from '@grafana/data';
import { sceneUtils, SceneVariable } from '@grafana/scenes';
import { variableAdapters } from 'app/features/variables/adapters';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { hasCurrent, hasOptions, isQuery } from 'app/features/variables/guard';
import { getVariablesByKey } from 'app/features/variables/state/selectors';
import { VariableModel } from 'app/features/variables/types';
import { getVariablesFromUrl } from 'app/features/variables/utils';

import { Report } from '../../types';

/**
 * Convert variable values to a map like:
 * { "myVar": ["var1", "var2"] }
 * @param variables
 */
export const toReportVariables = (variables?: VariableModel[]): Record<string, string[]> => {
  if (!variables?.length) {
    return {};
  }

  return Object.fromEntries(
    variables.map((variable) => {
      const { getValueForUrl } = variableAdapters.get(variable.type);
      const value = getValueForUrl(variable);
      return [variable.name, Array.isArray(value) ? value : [value]];
    })
  );
};

export const toReportSceneVariables = (variables?: SceneVariable[]): Record<string, string[]> => {
  if (!variables?.length) {
    return {};
  }

  const variablesFromUrl = getVariablesFromUrl();

  return Object.fromEntries(
    variables.map((variable) => {
      const { name } = variable.state;
      const queryValue = variablesFromUrl[name];
      const queryValueArray = (Array.isArray(queryValue) ? queryValue : [queryValue]).map((q) => q?.toString() ?? '');
      return [name, queryValueArray];
    })
  );
};

export const applyDefaultVariablesV2 = (
  variables: TypedVariableModel[],
  reportVariables?: Report['templateVars']
): TypedVariableModel[] => {
  if (!reportVariables || !Object.keys(reportVariables).length) {
    return variables;
  }

  return variables.map((variable) => {
    const reportVariable = reportVariables[variable.name];
    if (!reportVariable) {
      return variable;
    }

    if (variable.type === 'adhoc') {
      return {
        ...variable,
        filters: toFilters(reportVariable),
      };
    }

    if (isVariableWithOptions(variable)) {
      return applyDefaultVariableWithOptions(variable, reportVariable);
    }

    throw new Error(`Reporting: Unsupported variable type ${variable.type}`);
  });
};

function isVariableWithOptions(variable: TypedVariableModel): variable is TypedVariableModel & VariableWithOptions {
  return ['custom', 'query', 'datasource', 'interval', 'constant', 'textbox', 'groupby'].includes(variable.type);
}

const applyDefaultVariableWithOptions = <T extends VariableWithOptions>(variable: T, reportVariable: string[]): T => {
  const values = reportVariable
    .map((str) => variable.options?.find((opt) => opt.value === str) || { text: str, value: str })
    .filter(Boolean);

  const isMultiVariable = 'multi' in variable && variable.multi;
  const current =
    'current' in variable
      ? {
          current: {
            ...variable.current,
            text: isMultiVariable ? values.map((val) => val?.text) : values[0].text,
            value: isMultiVariable
              ? values.map((val) => (val?.value === ALL_VARIABLE_TEXT ? ALL_VARIABLE_VALUE : val?.value))
              : values[0].value,
          },
        }
      : undefined;

  return {
    ...variable,
    ...current,
    options: variable.options.map((option) => ({
      ...option,
      selected: typeof option.value === 'string' && reportVariable.includes(option.value),
    })),
  };
};

export const applyDefaultVariables = (
  variables: VariableModel[],
  reportVariables?: Report['templateVars'],
  repeatValuesSet?: Set<string>
): VariableWithOptions[] | VariableModel[] => {
  if (!reportVariables || !Object.keys(reportVariables).length) {
    return variables.map((v) => ({ ...v, usedInRepeat: repeatValuesSet?.has(v.name) }));
  }

  return variables.map((variable) => {
    const reportVariable = reportVariables[variable.name];
    if (!reportVariable || !hasOptions(variable)) {
      return variable;
    }
    const values = reportVariable
      .map((str) => variable.options.find((opt) => opt.value === str) || { text: str, value: str })
      .filter(Boolean);

    const isMultiVariable = 'multi' in variable && variable.multi;
    return {
      ...variable,
      usedInRepeat: repeatValuesSet?.has(variable.name),
      current: {
        ...variable.current,
        text: isMultiVariable ? values.map((val) => val?.text) : values[0].text,
        value: isMultiVariable ? values.map((val) => val?.value) : values[0].value,
      },
      options: variable.options.map((option) => ({
        ...option,
        selected: typeof option.value === 'string' && reportVariable.includes(option.value),
      })),
    };
  });
};

export const collectVariables = () => {
  const variablePrefix = 'var-';
  const urlParams = new URLSearchParams(window.location.search);
  const variables: Record<string, string[]> = {};

  for (const [key, value] of urlParams.entries()) {
    if (key.startsWith(variablePrefix)) {
      const newKey = key.replace(variablePrefix, '');
      variables[newKey] = [...(variables[newKey] || []), value];
    }
  }

  return variables;
};

export const refreshOnTimeRange = (variables: VariableModel[]) => {
  return variables.some((variable) => isQuery(variable) && variable.refresh === VariableRefresh.onTimeRangeChanged);
};

export const isSelectedVariableInRepeatingPanels = (
  name: string,
  type: VariableType,
  variables: TypedVariableModel[]
) => {
  const selectedVariable = getSelectedVariable(name, type, variables);
  return selectedVariable && selectedVariable.usedInRepeat;
};

export const getSelectedVariable = (
  name: string,
  type: VariableType,
  variables: TypedVariableModel[]
): VariableModel | VariableWithOptions | undefined => {
  return variables.find((variable: VariableWithOptions | VariableModel) => {
    if ('current' in variable && variable.current.value) {
      const isSelected = variable.current.value.length === 1 && variable.current.value[0] === name;
      return isSelected && variable.type === type;
    }
    return false;
  });
};

export const getPreviewVariables = (
  reportVariables?: Record<string, string[]>,
  dashboardUid?: string
): Array<[string, string[]]> => {
  if (!reportVariables) {
    return [];
  }

  const dashboardVariables = dashboardUid ? getVariablesByKey(dashboardUid) : [];
  const defaultVariables = applyDefaultVariables(dashboardVariables, reportVariables);

  return Object.entries(reportVariables).map(([key, value]) => {
    let currentValue = value;
    const variable = defaultVariables.find((v) => v.name === key);
    if (variable && hasCurrent(variable)) {
      currentValue = Array.isArray(variable.current.text) ? variable.current.text : [variable.current.text];
    }
    return [key, currentValue];
  });
};

export const hasValueProperty = (variable: SceneVariable) => {
  return (
    sceneUtils.isCustomVariable(variable) ||
    sceneUtils.isQueryVariable(variable) ||
    sceneUtils.isDataSourceVariable(variable) ||
    sceneUtils.isIntervalVariable(variable) ||
    sceneUtils.isConstantVariable(variable) ||
    sceneUtils.isTextBoxVariable(variable) ||
    sceneUtils.isGroupByVariable(variable)
  );
};

// this logic is extracted from adhoc adapter so we can correctly persist the variable as the backend needs
// public/app/features/variables/adhoc/urlParser.ts
export const convertAdHocVariableToDTO = (filters: AdHocVariableFilter[]): string[] => {
  return filters.map((filter) => toArray(filter).map(escapeDelimiter).join('|'));
};

export const toFilters = (value: UrlQueryValue): AdHocVariableFilter[] => {
  if (isArray(value)) {
    const values = value;
    return values.map(toFilter).filter(isFilter);
  }

  const filter = toFilter(value);
  return filter === null ? [] : [filter];
};

function escapeDelimiter(value: string | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return /\|/g[Symbol.replace](value, '__gfp__');
}

function unescapeDelimiter(value: string | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return /__gfp__/g[Symbol.replace](value, '|');
}

function toArray(filter: AdHocVariableFilter): string[] {
  return [filter.key, filter.operator, filter.value];
}

function toFilter(value: string | number | boolean | undefined | null): AdHocVariableFilter | null {
  if (!isString(value) || value.length === 0) {
    return null;
  }

  const parts = value.split('|').map(unescapeDelimiter);

  return {
    key: parts[0],
    operator: parts[1],
    value: parts[2],
  };
}

function isFilter(filter: AdHocVariableFilter | null): filter is AdHocVariableFilter {
  return filter !== null && isString(filter.value);
}
