import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';
import { MetaText } from 'app/features/alerting/unified/components/MetaText';

import { AlertEnrichment, Matcher } from '../../api/clients/alertenrichment/v1beta1/endpoints.gen';

interface ExpandedRowProps {
  row: AlertEnrichment;
}

function formatMatchers(matchers: Matcher[]): string {
  return matchers.map((m: Matcher) => `${m.name}${m.type}${m.value}`).join(' AND ');
}

const getStyles = (theme: GrafanaTheme2) => ({
  expandedRowWrapper: css({
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.colors.background.secondary,
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});

export function ExpandedRow({ row }: ExpandedRowProps) {
  const styles = useStyles2(getStyles);
  const spec = row.spec;
  const step = spec?.steps?.[0];
  const enricherType = step?.enricher?.type;

  if (!step || !enricherType) {
    return null;
  }

  const labelMatchers = spec?.labelMatchers ?? [];
  const annotationMatchers = spec?.annotationMatchers ?? [];

  const metadata: React.ReactNode[] = [];

  // Show enricher type prominently
  metadata.push(
    <MetaText icon="cog">
      <Text color="primary">
        <Trans i18nKey="alerting.enrichment.expanded-row.type">Type:</Trans> {enricherType}
      </Text>
    </MetaText>
  );

  // Show label matchers if any
  if (labelMatchers.length > 0) {
    metadata.push(
      <MetaText icon="tag-alt">
        <Text>
          <Trans i18nKey="alerting.enrichment.expanded-row.labelMatchers">
            <strong>Label matchers:</strong> {formatMatchers(labelMatchers)}
          </Trans>
        </Text>
      </MetaText>
    );
  }

  // Show annotation matchers if any
  if (annotationMatchers.length > 0) {
    metadata.push(
      <MetaText icon="comment-alt">
        <Text>
          <Trans i18nKey="alerting.enrichment.expanded-row.annotationMatchers">
            <strong>Annotation matchers:</strong> {formatMatchers(annotationMatchers)}
          </Trans>
        </Text>
      </MetaText>
    );
  }

  // Add enricher-specific details
  if (enricherType === 'assign' && step.enricher?.assign?.annotations) {
    const assignments = step.enricher.assign.annotations;
    metadata.push(
      <MetaText icon="plus-circle">
        <Text>
          <Trans i18nKey="alerting.enrichment.expanded-row.assignments">
            <strong>Assigns:</strong> {assignments.map((a) => `${a.name}=${a.value}`).join(', ')}
          </Trans>
        </Text>
      </MetaText>
    );
  }

  if (enricherType === 'external' && step.enricher?.external?.url) {
    metadata.push(
      <MetaText icon="external-link-alt">
        <Text>
          <Trans i18nKey="alerting.enrichment.expanded-row.externalUrl">
            <strong>URL:</strong> {step.enricher.external.url}
          </Trans>
        </Text>
      </MetaText>
    );
  }

  if (enricherType === 'dsquery' && step.enricher?.dataSource) {
    const ds = step.enricher.dataSource;
    const details: string[] = [];
    if (ds.type) {
      details.push(`Type: ${ds.type}`);
    }
    if (ds.logs?.expr) {
      details.push(`Query: ${ds.logs.expr}`);
    }
    if (ds.logs?.maxLines) {
      details.push(`Max Lines: ${ds.logs.maxLines}`);
    }

    metadata.push(
      <MetaText icon="database">
        <Text>
          <Trans i18nKey="alerting.enrichment.expanded-row.datasource">
            <strong>Datasource:</strong> {details.join(', ')}
          </Trans>
        </Text>
      </MetaText>
    );
  }

  if (enricherType === 'asserts') {
    metadata.push(
      <MetaText icon="shield">
        <Text>
          <Trans i18nKey="alerting.enrichment.expanded-row.asserts">
            <strong>Asserts</strong> enrichment configured
          </Trans>
        </Text>
      </MetaText>
    );
  }

  if (enricherType === 'sift') {
    metadata.push(
      <MetaText icon="filter">
        <Text>
          <Trans i18nKey="alerting.enrichment.expanded-row.sift">
            <strong>Sift</strong> enrichment configured
          </Trans>
        </Text>
      </MetaText>
    );
  }

  return (
    <div className={styles.expandedRowWrapper}>
      <Stack direction="column" gap={1}>
        {metadata.map((item, index) => (
          <div key={index}>{item}</div>
        ))}
      </Stack>
    </div>
  );
}
