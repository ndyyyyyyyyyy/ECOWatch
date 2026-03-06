import { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { Trans, t } from '@grafana/i18n';
import { Button, Drawer, Input, Field, Stack } from '@grafana/ui';

import { KeyCertFormData } from '../../../types';

interface OwnProps {
  onClose: () => void;
  onGenerateCert: (data: KeyCertFormData) => void;
}

export type Props = OwnProps & ConnectedProps<typeof connector>;

const connector = connect(undefined, {});

export const KeyCertDrawerUnconnected = ({ onClose, onGenerateCert }: Props): JSX.Element => {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      validityDays: 365,
      organization: '',
      country: '',
      state: '',
      city: '',
    },
  });

  const validateCountryCode = (value?: string) => {
    return !value || (value.length >= 2 && value.length <= 3)
      ? true
      : 'Country code must have a length of 2 or 3 characters.';
  };

  const validateValidityDays = (value?: number) => {
    if (value === undefined || isNaN(Number(value)) || value < 1 || value > 10000) {
      return 'Validity days must be a positive integer between 1 and 10000.';
    }
    return true;
  };

  const onSubmit = (data: KeyCertFormData) => {
    onGenerateCert(data);
  };

  return (
    <Drawer
      title={t('auth-config.key-cert-drawer-unconnected.title-saml-key-and-certificate', 'SAML key and certificate')}
      subtitle={t(
        'auth-config.key-cert-drawer-unconnected.subtitle-saml-key-and-certificate',
        'The following data will be included in the generated certificate'
      )}
      size="md"
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.stopPropagation();
          return handleSubmit(onSubmit)(e);
        }}
      >
        <Field
          label={t('auth-config.key-cert-drawer-unconnected.label-your-organization', 'Your organization')}
          htmlFor="organization"
        >
          <Input {...register('organization')} width={48} id="organization" />
        </Field>
        <Field
          label={t('auth-config.key-cert-drawer-unconnected.label-country-code', 'Country code')}
          invalid={!!errors.country}
          error={errors.country?.message}
          htmlFor="country"
        >
          <Input {...register('country', { validate: validateCountryCode })} width={48} id="country" />
        </Field>
        <Field label={t('auth-config.key-cert-drawer-unconnected.label-state', 'State')} htmlFor="state">
          <Input {...register('state')} width={48} id="state" />
        </Field>
        <Field label={t('auth-config.key-cert-drawer-unconnected.label-city', 'City')} htmlFor="city">
          <Input {...register('city')} width={48} id="city" />
        </Field>
        <Field
          label={t('auth-config.key-cert-drawer-unconnected.label-validity-days', 'Validity days')}
          description={t(
            'auth-config.key-cert-drawer-unconnected.description-number-generated-certificate-valid',
            'Number of days the generated certificate is valid for.'
          )}
          invalid={!!errors.validityDays}
          error={errors.validityDays?.message}
          htmlFor="validityDays"
        >
          <Input {...register('validityDays', { validate: validateValidityDays })} width={48} id="validityDays" />
        </Field>
        <Stack>
          <Button
            type="submit"
            size="md"
            variant="primary"
            tooltip={t(
              'auth-config.key-cert-drawer-unconnected.tooltip-generate-the-certificate-and-private-key',
              'Generate the certificate and private key'
            )}
          >
            <Trans i18nKey="auth-config.key-cert-drawer-unconnected.generate">Generate</Trans>
          </Button>
          <Button type="button" size="md" variant="secondary" onClick={onClose}>
            <Trans i18nKey="auth-config.key-cert-drawer-unconnected.close">Close</Trans>
          </Button>
        </Stack>
      </form>
    </Drawer>
  );
};

export default connector(KeyCertDrawerUnconnected);
