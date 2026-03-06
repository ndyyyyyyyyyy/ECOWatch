import { useState } from 'react';
import { UseFormSetValue } from 'react-hook-form';
import { useAsync } from 'react-use';

import { dateTime, getDefaultTimeRange } from '@grafana/data';
import {
  SceneDataLayerControls,
  SceneTimeRange,
  SceneTimeRangeLike,
  SceneVariables,
  VariableValueSelectors,
} from '@grafana/scenes';
import { isWeekStart } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { applyDefaultVariablesV2 } from 'app/extensions/reports/utils/variables';
import { ReportFormDashboard, ReportFormV2, ReportV2 } from 'app/extensions/types/reports';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { createVariablesForDashboard } from 'app/features/dashboard-scene/utils/variables';
import { useDispatch } from 'app/types/store';

import { SelectDashboardScene } from './SelectDashboardScene';

export type ReportDashboardScene = {
  key?: string;
  uid?: string;
  title?: string;
  timeRange?: SceneTimeRangeLike;
  variables?: SceneVariables;
};

export const useSelectDashboards = ({
  report,
  setValue,
  appendDashboard,
  removeDashboard,
}: {
  report?: Partial<ReportV2>;
  setValue: UseFormSetValue<ReportFormV2>;
  appendDashboard: (dashboard: ReportFormDashboard) => void;
  removeDashboard: (index: number) => void;
}) => {
  const dispatch = useDispatch();
  const [sceneDashboards, setSceneDashboards] = useState<SelectDashboardScene[]>([]);

  const getDashboards = async () => {
    try {
      const dashboards = report?.dashboards?.filter((dashboard) => dashboard?.uid);
      if (!dashboards?.length) {
        return [createSelectDashboardScene()];
      }

      return await Promise.all(
        dashboards.map(async (dashboard) => {
          const resp = await getDashboardAPI('v1').getDashboardDTO(dashboard.uid!);
          const dashboardModel = new DashboardModel(resp.dashboard, resp.meta);

          // time range is automatically converted to browser tz
          const timeRange = new SceneTimeRange({
            from: dashboard.timeRange.from,
            to: dashboard.timeRange.to,
            fiscalYearStartMonth: dashboardModel.fiscalYearStartMonth,
            timeZone: dashboardModel.timezone,
            weekStart: isWeekStart(dashboardModel.weekStart) ? dashboardModel.weekStart : undefined,
          });

          // it is not possible to set the time range to null in the constructor
          if (!dashboard.timeRange.from && !dashboard.timeRange.to) {
            const from = dateTime(null);
            const to = dateTime(null);
            timeRange.onTimeRangeChange({ from, to, raw: { from, to } });
          }

          const reportVariables = applyDefaultVariablesV2(dashboardModel.templating.list, dashboard.variables);
          dashboardModel.templating.list = reportVariables;

          const variables = createVariablesForDashboard(dashboardModel);

          const sceneDashboard = createSelectDashboardScene({
            key: undefined,
            uid: dashboard?.uid,
            title: dashboard?.title,
            timeRange,
            variables,
          });

          return sceneDashboard;
        })
      );
    } catch (e) {
      dispatch(
        notifyApp(
          createErrorNotification(
            e instanceof Error ? e.message : 'There was an error trying to load report dashboards'
          )
        )
      );
      return [];
    }
  };

  const { loading: isLoadingDashboards } = useAsync(async () => {
    const dashboards = await getDashboards();

    const formDashboards = dashboards?.map((scene) => {
      const timeRange = scene.state.$timeRange?.state.value || getDefaultTimeRange();
      return {
        uid: scene.state.uid,
        key: scene.state.key,
        timeRange,
      };
    });

    setSceneDashboards(dashboards ?? []);
    setValue('dashboards', formDashboards ?? [], { shouldDirty: false });
  }, [report]);

  const createSelectDashboardScene = (dashboard?: ReportDashboardScene) => {
    return new SelectDashboardScene({
      key: dashboard?.key,
      uid: dashboard?.uid,
      title: dashboard?.title,
      $timeRange: dashboard?.timeRange?.clone() || new SceneTimeRange({ value: getDefaultTimeRange() }),
      $variables: dashboard?.variables?.clone(),
      variableControls: [new VariableValueSelectors({ layout: 'vertical' }), new SceneDataLayerControls()],
      onRemoveClick: onRemoveDashboardClick,
    });
  };

  const onRemoveDashboardClick = (dashboard: SelectDashboardScene) => {
    const index = sceneDashboards?.findIndex((d) => d.state.key === dashboard.state.key);
    if (index !== undefined) {
      removeDashboard(index);
      setSceneDashboards((prevState) => prevState.filter((d) => d !== dashboard));
    }
  };

  const onAddDashboardClick = () => {
    const customScene = createSelectDashboardScene();

    setSceneDashboards((prevState) => [...prevState, customScene]);

    const timeRange = customScene.state.$timeRange?.state.value || getDefaultTimeRange();
    appendDashboard({
      uid: undefined,
      key: customScene.state.key,
      timeRange,
    });
  };

  return {
    sceneDashboards,
    isLoadingDashboards,
    onAddDashboardClick,
  };
};
