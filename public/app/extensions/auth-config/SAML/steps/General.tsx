import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { t } from '@grafana/i18n';
import { Field, Input, Switch } from '@grafana/ui';

import { EnterpriseStoreState, SAMLFormData, SAMLStepKey } from '../../../types';
import SAMLForm from '../SAMLForm';
import { settingsUpdated } from '../state/reducers';
import { isValidDuration } from '../utils/validation';

type GeneralData = Pick<
  SAMLFormData,
  | 'allowSignUp'
  | 'entityId'
  | 'name'
  | 'singleLogout'
  | 'allowIdpInitiated'
  | 'relayState'
  | 'maxIssueDelay'
  | 'metadataValidDuration'
  | 'autoLogin'
>;

const mapStateToProps = (state: EnterpriseStoreState) => {
  const { samlSettings } = state.samlConfig;
  return {
    samlSettings,
  };
};

const mapActionsToProps = {
  settingsUpdated,
};

const connector = connect(mapStateToProps, mapActionsToProps);
export type Props = ConnectedProps<typeof connector>;

export const GeneralUnconnected = ({ samlSettings, settingsUpdated }: Props): JSX.Element => {
  const {
    allowSignUp,
    entityId,
    name,
    autoLogin,
    singleLogout,
    allowIdpInitiated,
    relayState,
    maxIssueDelay,
    metadataValidDuration,
  } = samlSettings || {};
  const {
    handleSubmit,
    register,
    watch,
    getValues,
    formState: { isDirty, errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      allowSignUp,
      entityId,
      name,
      autoLogin,
      singleLogout,
      allowIdpInitiated,
      relayState,
      maxIssueDelay,
      metadataValidDuration,
    },
  });

  const watchAllowIdPInitiated = watch('allowIdpInitiated');

  const onSubmit = (data: GeneralData) => {
    if (isDirty) {
      settingsUpdated({ ...samlSettings, ...data });
    }
  };

  const validateDuration = (value?: string) => {
    return !value || isValidDuration(value) ? true : 'Not a valid duration';
  };
  const validateRelayState = (value?: string): boolean | string => {
    if (watchAllowIdPInitiated && !!value) {
      if (value.length > 80) {
        return 'Relay state needs to be 80 characters or less';
      }
      return true;
    } else {
      return 'Relay state is required';
    }
  };

  return (
    <SAMLForm
      activeStep={SAMLStepKey.General}
      onSubmit={handleSubmit(onSubmit)}
      confirmRedirect={isDirty}
      getFormData={getValues}
      label={t('auth-config.general-unconnected.label-general-settings', 'General settings')}
    >
      <Field
        label={t(
          'auth-config.general-unconnected.label-display-name-for-this-saml-integration',
          'Display name for this SAML 2.0 integration'
        )}
        description={t(
          'auth-config.general-unconnected.description-display-name-for-this-saml-integration',
          'Helpful if you use more than one SSO IdP provider or protocol.'
        )}
      >
        <Input
          {...register('name')}
          id="displayName"
          width={60}
          placeholder={t('auth-config.general-unconnected.displayName-placeholder-saml', 'SAML')}
        />
      </Field>
      <Field
        label={t('auth-config.general-unconnected.label-entity-id', 'Entity ID')}
        description={t(
          'auth-config.general-unconnected.description-entity-id',
          'The entity ID is a globally unique identifier for the service provider. It is used to identify the service provider to the identity provider. Defaults to the URL of the Grafana instance.'
        )}
      >
        <Input {...register('entityId')} id="entityId" width={60} placeholder="" />
      </Field>
      <Field
        label={t('auth-config.general-unconnected.label-allow-signup', 'Allow signup')}
        description={t(
          'auth-config.general-unconnected.description-allow-signup',
          'Whether to allow new Grafana user creation through SAML login. If not enabled, then only existing Grafana users can log in with SAML.'
        )}
      >
        <Switch {...register('allowSignUp')} defaultChecked={allowSignUp} id="allowSignup" />
      </Field>
      <Field
        label={t('auth-config.general-unconnected.label-auto-login', 'Auto login')}
        description={t(
          'auth-config.general-unconnected.description-auto-login',
          'Attempt to log in with SAML automatically, skipping the login screen.'
        )}
      >
        <Switch {...register('autoLogin')} defaultChecked={autoLogin} id="autoLogin" />
      </Field>
      <Field
        label={t('auth-config.general-unconnected.label-single-logout', 'Single logout')}
        description={t(
          'auth-config.general-unconnected.description-single-logout',
          'Allows users to log out from IdP session and applications associated with the current IdP session established via SAML.'
        )}
      >
        <Switch {...register('singleLogout')} defaultChecked={singleLogout} id="singleLogout" />
      </Field>
      <Field
        label={t(
          'auth-config.general-unconnected.label-identity-provider-initiated-login',
          'Identity provider initiated login'
        )}
        description={t(
          'auth-config.general-unconnected.description-identity-provider-initiated-login',
          'Allows users to log in into Grafana directly from identity provider.'
        )}
      >
        <Switch {...register('allowIdpInitiated')} defaultChecked={allowIdpInitiated} id="allowIdpInitiated" />
      </Field>
      {watchAllowIdPInitiated && (
        <Field
          label={t('auth-config.general-unconnected.label-relay-state', 'Relay state')}
          description={t(
            'auth-config.general-unconnected.description-relay-state',
            'Required. Should match relay state configured in IdP and trailing space is required.'
          )}
          required={watchAllowIdPInitiated}
          invalid={watchAllowIdPInitiated && !!errors.relayState}
          error={errors.relayState?.message}
        >
          <Input
            {...register('relayState', {
              validate: validateRelayState,
            })}
            width={60}
            id="relayState"
            defaultValue={relayState}
          />
        </Field>
      )}
      <Field
        label={t('auth-config.general-unconnected.label-max-issue-delay', 'Max issue delay')}
        description={t(
          'auth-config.general-unconnected.description-max-issue-delay',
          'Duration, since the IdP issued a response and Grafana is allowed to process it.'
        )}
        invalid={!!errors.maxIssueDelay}
        error={errors.maxIssueDelay?.message}
      >
        <Input
          {...register('maxIssueDelay', { validate: validateDuration })}
          width={24}
          id="max_issue_delay"
          defaultValue={maxIssueDelay}
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          placeholder="90s"
        />
      </Field>
      <Field
        label={t('auth-config.general-unconnected.label-metadata-valid-duration', 'Metadata valid duration')}
        description={t(
          'auth-config.general-unconnected.description-duration-grafana-metadata-valid',
          'Duration, for how long Grafana metadata is valid.'
        )}
        invalid={!!errors.metadataValidDuration}
        error={errors.metadataValidDuration?.message}
      >
        <Input
          {...register('metadataValidDuration', { validate: validateDuration })}
          defaultValue={metadataValidDuration}
          width={24}
          id="metadataValidDuration"
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          placeholder="48h"
        />
      </Field>
    </SAMLForm>
  );
};

export default connector(GeneralUnconnected);
