import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Combobox, Field, Stack, useStyles2, Tooltip, Icon, Label, Grid, Divider } from '@grafana/ui';
import config from 'app/core/config';

import { reportOrientations, reportLayouts, ReportFormV2 } from '../../../types';
import { getZoomOptions } from '../../constants';
import { selectors } from '../../e2e-selectors/selectors';
import ReportSection from '../ReportSection';

import { SectionProps } from './types';

// Convert options to Combobox format with required value property
const orientationOptions = reportOrientations.map(({ icon, ...rest }) => ({
  ...rest,
  value: rest.value ?? '',
}));

const layoutOptions = reportLayouts.map(({ icon, ...rest }) => ({
  ...rest,
  value: rest.value ?? '',
}));

export default function Attachments({ open, onToggle, dashboards }: SectionProps) {
  const {
    register,
    watch,
    control,
    formState: { touchedFields },
  } = useFormContext<ReportFormV2>();

  const styles = useStyles2(getStyles);
  const pdfFormatRef = useRef<HTMLDivElement>(null);

  const isNewPDFRenderingEnabled = !!config.featureToggles.newPDFRendering;
  const isPDFTablesEnabled = !!config.featureToggles.pdfTables;

  const isPDFSelected = watch('attachments.pdf');
  const isPDFTablesSelected = watch('attachments.pdfTables');
  const hasDashboardWithVariables = dashboards?.some((d) =>
    d.state.$variables?.state.variables?.some(({ state }) => state.hide !== VariableHide.hideVariable)
  );

  useEffect(() => {
    if (
      (isPDFSelected && touchedFields.attachments?.pdf) ||
      (isPDFTablesSelected && touchedFields.attachments?.pdfTables)
    ) {
      pdfFormatRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isPDFSelected, isPDFTablesSelected, touchedFields, pdfFormatRef]);

  const zoomOptions = getZoomOptions(isNewPDFRenderingEnabled)
    .filter((opt) => !opt.isDisabled)
    .map((opt) => ({
      label: opt.label,
      value: opt.value ?? 1,
    }));

  return (
    <ReportSection
      isOpen={open}
      label={t('share-report.attachments.section-title', 'Attachments')}
      onToggle={onToggle}
      dataTestId={selectors.components.ReportFormDrawer.Attachments.header}
      contentDataTestId={selectors.components.ReportFormDrawer.Attachments.content}
    >
      <Stack direction="column" alignItems={'start'} gap={1.5}>
        <Checkbox
          label={t('share-report.attachments.pdf-report', 'Attach the report as a PDF')}
          {...register('attachments.pdf')}
          data-test-id={selectors.components.ReportFormDrawer.Attachments.pdfReportCheckbox}
        />
        {isPDFTablesEnabled && (
          <Checkbox
            label={t('share-report.attachments.pdf-tables', 'Attach a separate PDF of table data')}
            {...register('attachments.pdfTables')}
            data-test-id={selectors.components.ReportFormDrawer.Attachments.pdfTablesCheckbox}
          />
        )}
        <Checkbox
          label={t('share-report.attachments.csv-tables', 'Attach a CSV file of table panel data')}
          {...register('attachments.csv')}
          data-test-id={selectors.components.ReportFormDrawer.Attachments.csvTablesCheckbox}
        />
      </Stack>
      {(isPDFSelected || isPDFTablesSelected) && (
        <>
          <Divider />
          <div ref={pdfFormatRef}>
            <h4 className={styles.pdfFormatTitle}>{t('share-report.attachments.pdf-format', 'PDF format')}</h4>
            <Grid columns={{ xs: 1, md: 3 }} gap={1}>
              <Field
                label={
                  <Stack>
                    <Label>{t('share-report.attachments.orientation', 'Orientation')}</Label>
                    <Tooltip
                      placement="right-end"
                      content={t(
                        'share-report.attachments.orientation-tooltip',
                        'The orientation selection will be applied to the dashboard PDF, table data and the PDF appendix'
                      )}
                    >
                      <Icon name="info-circle" size="xs" />
                    </Tooltip>
                  </Stack>
                }
              >
                <Controller
                  control={control}
                  name={'pdfOptions.orientation'}
                  render={({ field: { onChange, ref, ...rest } }) => {
                    return <Combobox {...rest} options={orientationOptions} onChange={(v) => onChange(v.value)} />;
                  }}
                />
              </Field>
              {isPDFSelected && (
                <>
                  <Field label={t('share-report.attachments.layout', 'Layout')}>
                    <Controller
                      control={control}
                      name={'pdfOptions.layout'}
                      render={({ field: { onChange, ref, ...rest } }) => {
                        return <Combobox {...rest} options={layoutOptions} onChange={(v) => onChange(v.value)} />;
                      }}
                    />
                  </Field>
                  <Field label={t('share-report.attachments.zoom', 'Zoom scale')}>
                    <Controller
                      control={control}
                      name={'pdfOptions.scaleFactor'}
                      render={({ field: { onChange, ref, ...rest } }) => {
                        return <Combobox {...rest} options={zoomOptions} onChange={(v) => onChange(v.value)} />;
                      }}
                    />
                  </Field>
                </>
              )}
            </Grid>
            {isPDFSelected && (
              <div>
                <Stack direction="column" alignItems={'start'} gap={1.5}>
                  {dashboards && dashboards?.length > 1 && (
                    <Checkbox
                      {...register('pdfOptions.dashboardPDF.combineOneFile')}
                      label={t('share-report.attachments.combine-one-file', 'Combine all dashboards PDFs in one file')}
                      data-test-id={selectors.components.ReportFormDrawer.Attachments.combineDashboardsCheckbox}
                    />
                  )}
                  {hasDashboardWithVariables && (
                    <Checkbox
                      {...register('pdfOptions.dashboardPDF.showTemplateVariables')}
                      label={t(
                        'share-report.attachments.show-template-variables',
                        'Show template variables in the header'
                      )}
                      data-test-id={selectors.components.ReportFormDrawer.Attachments.showTemplateVariablesCheckbox}
                    />
                  )}
                  {isPDFTablesEnabled && (
                    <Checkbox
                      {...register('pdfOptions.dashboardPDF.addPDFTablesAppendix')}
                      label={t('share-report.attachments.pdf-tables-appendix', 'Include table data as PDF appendix')}
                      data-test-id={selectors.components.ReportFormDrawer.Attachments.pdfTablesAppendixCheckbox}
                    />
                  )}
                </Stack>
              </div>
            )}
          </div>
        </>
      )}
    </ReportSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    pdfFormatTitle: css({
      color: theme.colors.text.secondary,
    }),
  };
};
