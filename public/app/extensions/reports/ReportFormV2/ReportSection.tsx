import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { CollapsableSection, useStyles2 } from '@grafana/ui';

export default function ReportSection({
  label,
  children,
  contentClassName,
  dataTestId,
  isOpen,
  onToggle,
  contentDataTestId,
}: {
  label: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  contentClassName?: string;
  dataTestId?: string;
  contentDataTestId?: string;
}) {
  const styles = useStyles2(getStyles);

  return (
    <CollapsableSection
      isOpen={isOpen}
      onToggle={onToggle}
      label={label}
      className={styles.sectionTitle}
      contentClassName={cx(styles.content, contentClassName)}
      unmountContentWhenClosed={false}
      headerDataTestId={dataTestId}
      contentDataTestId={contentDataTestId}
    >
      {children}
    </CollapsableSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    sectionTitle: css({
      fontSize: theme.typography.h4.fontSize,
    }),
    content: css({
      paddingBottom: theme.spacing(0),
    }),
  };
};
