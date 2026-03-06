import { css } from '@emotion/css';
import { Fragment } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Text, useStyles2 } from '@grafana/ui';

import { Matcher } from '../../api/clients/alertenrichment/v1beta1/endpoints.gen';

interface MatchersProps {
  matchers: Matcher[];
}

const getStyles = (theme: GrafanaTheme2) => ({
  matchersGrid: css({
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: theme.spacing(0.5),
    alignItems: 'center',
  }),
});

export function Matchers({ matchers }: MatchersProps) {
  const styles = useStyles2(getStyles);

  if (matchers.length === 0) {
    return null;
  }

  return (
    <div className={styles.matchersGrid}>
      {matchers.map((matcher, index) => (
        <Fragment key={index}>
          <Text key={`name-${index}`} variant="bodySmall" color="primary">
            {matcher.name}
          </Text>
          <Box paddingX={1.5}>
            <Text variant="bodySmall" color="maxContrast" weight="medium">
              {matcher.type}
            </Text>
          </Box>
          <Text key={`value-${index}`} variant="bodySmall" color="primary">
            {matcher.value}
          </Text>
        </Fragment>
      ))}
    </div>
  );
}
