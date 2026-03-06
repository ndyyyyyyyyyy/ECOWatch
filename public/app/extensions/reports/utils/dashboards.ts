import { VariableHide, dateTime, rangeUtil } from '@grafana/data';
import { sceneUtils, SceneVariables, VariableValue } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { ReportDashboard } from '../../types';
import { parseRange } from '../../utils/time';
import { SelectDashboardScene } from '../ReportFormV2/sections/SelectDashboards/SelectDashboardScene';

import { convertAdHocVariableToDTO, hasValueProperty } from './variables';

export const dashboardsInvalid = (dashboards?: ReportDashboard[]) => {
  if (!dashboards?.length) {
    return true;
  }

  return !dashboards.some((db) => !!db.dashboard?.uid);
};

export const dashboardsInvalidV2 = (dashboards?: SelectDashboardScene[]) => {
  if (!dashboards?.length) {
    return true;
  }

  return !dashboards.some((db) => !!db.state.uid);
};

export const getTemplateVariables = (variables?: SceneVariables): Record<string, string[]> => {
  return (
    variables?.state.variables.reduce((acc: Record<string, string[]>, variable) => {
      if (variable.state.hide !== VariableHide.hideVariable) {
        let value: VariableValue | undefined | null;
        if (sceneUtils.isAdHocVariable(variable)) {
          value = convertAdHocVariableToDTO(variable.state.filters);
        } else if (hasValueProperty(variable)) {
          value = variable.state.value;
          if (Array.isArray(value) && value.includes(ALL_VARIABLE_VALUE)) {
            value = ALL_VARIABLE_TEXT;
          }
        } else {
          throw new Error(`Reporting: Unsupported variable type ${variable.state.type}`);
        }

        acc[variable.state.name] = Array.isArray(value) ? value.map(String) : [String(value ?? '')];
      }
      return acc;
    }, {}) ?? {}
  );
};

export const getDashboardsDTO = (dashboards: SelectDashboardScene[]): ReportDashboard[] => {
  return dashboards.map((d) => {
    const { state } = d;

    const isRelative = rangeUtil.isRelativeTimeRange({
      from: state.$timeRange?.state.from ?? '',
      to: state.$timeRange?.state.to ?? '',
    });

    const timeRangeValue = {
      from:
        state.$timeRange?.state.from && isRelative
          ? state.$timeRange?.state.from
          : dateTime(state.$timeRange?.state.from),
      to: state.$timeRange?.state.to && isRelative ? state.$timeRange?.state.to : dateTime(state.$timeRange?.state.to),
    };

    return {
      dashboard: {
        uid: state.uid ?? '',
        name: state.title,
      },
      reportVariables: getTemplateVariables(d.state.$variables),
      timeRange: parseRange(timeRangeValue),
    };
  });
};
