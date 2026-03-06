import { css } from '@emotion/css';
import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useMedia } from 'react-use';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneDataLayerControls,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneTimeRange,
  SceneTimeRangeLike,
  SceneVariables,
  VariableValueSelectors,
} from '@grafana/scenes';
import {
  CollapsableSection,
  Field,
  isWeekStart,
  Stack,
  useTheme2,
  useStyles2,
  IconButton,
  Alert,
  TimeRangeInput,
  LinkButton,
  Label,
  Icon,
  Tooltip,
} from '@grafana/ui';
import { DashboardPicker, DashboardPickerDTO } from 'app/core/components/Select/DashboardPicker';
import { formSchemaValidationRules } from 'app/extensions/reports/utils/validation';
import { ReportFormV2 } from 'app/extensions/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { createVariablesForDashboard } from 'app/features/dashboard-scene/utils/variables';

export interface SelectDashboardState extends SceneObjectState {
  uid?: string;
  title: string;
  variables?: SceneVariables;
  timeRange?: SceneTimeRangeLike;
  variableControls?: SceneObject[];
  onRemoveClick: (scene: SelectDashboardScene) => void;
}

export class SelectDashboardScene extends SceneObjectBase<SelectDashboardState> {
  static Component = SelectDashboardRenderer;

  public constructor(state?: Partial<SelectDashboardState>) {
    super({
      ...state,
      title: state?.title ?? '',
      onRemoveClick: state?.onRemoveClick ?? (() => {}),
    });
  }

  public onDashboardChange = (
    uid: string,
    title: string,
    timeRange: SceneTimeRangeLike,
    variables: SceneVariables,
    variableControls: SceneObject[]
  ) => {
    this.setState({ uid, title, $timeRange: timeRange, $variables: variables, variableControls });
  };

  public onRemove = () => {
    this.setState({ uid: undefined, title: undefined, $variables: undefined, $timeRange: undefined });
  };
}

function SelectDashboardRenderer({ model }: SceneComponentProps<SelectDashboardScene>) {
  const {
    watch,
    control,
    formState: { errors },
    setValue,
  } = useFormContext<ReportFormV2>();

  const { uid, variableControls, $variables, onRemoveClick, key } = model.useState();

  const [isTemplateVariablesOpen, setIsTemplateVariablesOpen] = useState(true);

  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const isTimeRangeReversed = useMedia(`(max-width: ${theme.breakpoints.values.md}px)`);

  const dashboards = watch('dashboards');
  const isDuplicate = dashboards.filter((dashboard) => dashboard.uid === uid).length > 1;
  const firstIndex = dashboards.findIndex((dashboard) => dashboard.uid === uid);
  const dashboardIndex = dashboards.findIndex((dashboard) => dashboard.key === key);

  const showDuplicateTemplateVariablesAlert = isDuplicate && dashboardIndex > firstIndex;

  const onDashboardChange = async (dashboard?: DashboardPickerDTO) => {
    if (!dashboard) {
      model.onRemove();
      return;
    }

    const resp = await getDashboardAPI('v1').getDashboardDTO(dashboard.uid);
    const dashboardModel = new DashboardModel(resp.dashboard, resp.meta);

    const timeRange = new SceneTimeRange({
      from: dashboardModel.time.from,
      to: dashboardModel.time.to,
      fiscalYearStartMonth: dashboardModel.fiscalYearStartMonth,
      timeZone: dashboardModel.timezone,
      weekStart: isWeekStart(dashboardModel.weekStart) ? dashboardModel.weekStart : undefined,
    });
    const variables = createVariablesForDashboard(dashboardModel);

    model.onDashboardChange(dashboard.uid, dashboard.title, timeRange, variables, [
      new VariableValueSelectors({ layout: 'vertical' }),
      new SceneDataLayerControls(),
    ]);

    setValue(`dashboards.${dashboardIndex}.uid`, dashboard.uid);
    setValue(`dashboards.${dashboardIndex}.timeRange`, timeRange.state.value);
  };

  const timeRange = sceneGraph.getTimeRange(model);

  const templateVariables = $variables?.state.variables?.filter(
    ({ state }) => state.hide !== VariableHide.hideVariable
  );

  return (
    <Stack direction="column" flex={1}>
      <Stack alignItems="flex-start" flex={1} direction={{ xs: 'column', md: 'row' }}>
        <div className={styles.sourceDashboard}>
          <Field
            label={t('share-report.dashboard.source-dashboard-label', 'Source dashboard')}
            required
            className={styles.field}
            error={errors.dashboards?.[dashboardIndex]?.uid?.message}
            invalid={!!errors.dashboards?.[dashboardIndex]?.uid?.message}
          >
            <Controller
              name={`dashboards.${dashboardIndex}.uid`}
              control={control}
              rules={formSchemaValidationRules().dashboards.uid}
              render={({ field: { onChange, ...fieldProps } }) => {
                return (
                  <DashboardPicker
                    {...fieldProps}
                    onChange={(dashboard) => {
                      onChange(dashboard?.uid);
                      onDashboardChange(dashboard);
                    }}
                  />
                );
              }}
            />
          </Field>
        </div>
        <Field
          label={
            <Label>
              <Stack alignItems="center">
                {t('share-report.dashboard.time-range-label', 'Time range')}
                <Tooltip
                  content={t(
                    'share-report.dashboard.time-range-description',
                    "Empty time range will fallback to the time range from the report's dashboard. Absolute time range is represented in your browser's timezone."
                  )}
                >
                  <Icon name="info-circle" />
                </Tooltip>
              </Stack>
            </Label>
          }
          className={styles.field}
          error={errors.dashboards?.[dashboardIndex]?.timeRange?.message}
          invalid={!!errors.dashboards?.[dashboardIndex]?.timeRange?.message}
          required
        >
          <Controller
            name={`dashboards.${dashboardIndex}.timeRange`}
            control={control}
            render={({ field: { onChange, ref, ...fieldProps } }) => {
              return (
                <TimeRangeInput
                  {...fieldProps}
                  clearable
                  value={timeRange.state.value}
                  timeZone="browser"
                  onChange={(e) => {
                    onChange(e);
                    timeRange.onTimeRangeChange(e);
                  }}
                  isReversed={isTimeRangeReversed}
                />
              );
            }}
          />
        </Field>
        <Field label="">
          <Stack alignItems="center">
            <LinkButton
              disabled={!uid}
              href={`${config.appUrl}d/${uid}`}
              target="_blank"
              icon="external-link-alt"
              variant="secondary"
              fill="text"
              tooltip={t('share-report.dashboard.view-dashboard-tooltip', 'View dashboard')}
            />
            {dashboards.length > 1 && (
              <IconButton
                key="delete"
                name="trash-alt"
                tooltip={t('share-report.dashboard.delete-dashboard-tooltip', 'Delete this dashboard')}
                onClick={() => onRemoveClick(model)}
              />
            )}
          </Stack>
        </Field>
      </Stack>
      {templateVariables?.length ? (
        showDuplicateTemplateVariablesAlert ? (
          <Alert
            severity="info"
            title={t(
              'share-report.dashboard.repeated-template-variables-description',
              'When adding the same dashboard multiple times in one report, template variables that you selected first are applied to all instances of that dashboard in the report.'
            )}
          ></Alert>
        ) : (
          <div>
            <CollapsableSection
              label={t('share-report.dashboard.template-variables-title', 'Customize template variables')}
              isOpen={isTemplateVariablesOpen}
              onToggle={() => setIsTemplateVariablesOpen((prevState) => !prevState)}
              className={styles.templateVariablesSectionTitle}
            >
              <Stack gap={1} direction={{ xs: 'column', md: 'row' }} wrap={'wrap'}>
                {variableControls?.map((c) => <c.Component model={c} key={c.state.key} />) ?? <></>}
              </Stack>
            </CollapsableSection>
          </div>
        )
      ) : null}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    sourceDashboard: css({
      flex: 1,
      width: '100%',
      [theme.breakpoints.up('md')]: {
        width: 'auto',
      },
    }),
    field: css({
      width: '100%',
      [theme.breakpoints.up('md')]: {
        width: 'auto',
      },
    }),
    templateVariablesSectionTitle: css({
      fontSize: theme.typography.h6.fontSize,
      color: theme.colors.text.primary,
    }),
  };
};
