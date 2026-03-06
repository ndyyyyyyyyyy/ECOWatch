import { css } from '@emotion/css';
import { forwardRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Stack, useStyles2, DatePickerWithInput, DatePickerWithInputProps } from '@grafana/ui';

interface DatePickerInputProps extends DatePickerWithInputProps {
  onClear?: () => void;
}

export const DatePickerInput = forwardRef<HTMLInputElement, DatePickerInputProps>(({ onClear, ...props }, ref) => {
  const styles = useStyles2(getStyles);

  return (
    <DatePickerWithInput
      {...props}
      ref={ref}
      closeOnSelect
      suffix={
        <Stack gap={1} alignItems="center">
          {props.value && onClear && <Icon name="times" size="lg" className={styles.iconButton} onClick={onClear} />}
          <Icon name="calendar-alt" />
        </Stack>
      }
    />
  );
});

DatePickerInput.displayName = 'DatePickerInput';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    iconButton: css({
      '&:hover': {
        color: theme.colors.text.maxContrast,
      },
      cursor: 'pointer',
    }),
  };
};
