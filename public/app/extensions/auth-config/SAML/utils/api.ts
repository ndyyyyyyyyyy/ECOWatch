import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { SAMLSettings, SAMLFormData } from 'app/extensions/types';
import { AccessControlAction } from 'app/types/accessControl';
import { SettingsSection } from 'app/types/settings';
import { ThunkResult } from 'app/types/store';

import { SettingsError } from '../../../../features/auth-config';
import { resetError, setError } from '../state/reducers';

export async function getSAMLSettings(): Promise<[SAMLSettings, any]> {
  return getSSOSAMLConfig();
}

async function getSSOSAMLConfig(): Promise<[SAMLSettings, any]> {
  const result = await getBackendSrv().get('/api/v1/sso-settings/saml');
  const samlSettings = result ? result.settings : {};
  const samlSettingsRaw = ssoToRawSettings(samlSettings);

  return [samlSettings, samlSettingsRaw];
}

export function updateSAMLSettings(
  formData: SAMLFormData,
  savedSettings: SettingsSection
): ThunkResult<Promise<boolean>> {
  const samlSettings = formDataToSSOData(formData);
  return updateSSOSAMLConfig(samlSettings);
}

function updateSSOSAMLConfig(samlSettings: SAMLSettings): ThunkResult<Promise<boolean>> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsWrite)) {
      try {
        await getBackendSrv().put(
          `/api/v1/sso-settings/saml`,
          {
            provider: 'saml',
            settings: { ...samlSettings },
          },
          {
            showErrorAlert: false,
          }
        );
        dispatch(resetError());
        return true;
      } catch (error) {
        if (isFetchError(error)) {
          error.isHandled = true;
          const updateErr: SettingsError = {
            message: error.data?.message,
            errors: error.data?.errors,
          };
          dispatch(setError(updateErr));
          return false;
        }
      }
    }
    return false;
  };
}

export function removeSAMLSettings(): ThunkResult<Promise<boolean>> {
  return removeSSOSAMLConfig();
}

function removeSSOSAMLConfig(): ThunkResult<Promise<boolean>> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsWrite)) {
      try {
        await getBackendSrv().delete(`/api/v1/sso-settings/saml`, undefined, {
          showSuccessAlert: false,
          showErrorAlert: false,
        });
        dispatch(resetError());
        return true;
      } catch (error) {
        if (isFetchError(error)) {
          error.isHandled = true;
          const removeErr: SettingsError = {
            message: error.data?.message,
            errors: error.data?.errors,
          };
          dispatch(setError(removeErr));
          return false;
        }
      }
    }
    return false;
  };
}

export function enableSAMLSettings(samlSettings: SAMLSettings): ThunkResult<Promise<boolean>> {
  return enableSSOSAMLConfig(samlSettings);
}

function enableSSOSAMLConfig(samlSettings: SAMLSettings): ThunkResult<Promise<boolean>> {
  return updateSSOSAMLConfig({
    ...samlSettings,
    enabled: true,
  });
}

export function disableSAMLSettings(samlSettings: SAMLSettings): ThunkResult<Promise<boolean>> {
  return disableSSOSAMLConfig(samlSettings);
}

function disableSSOSAMLConfig(samlSettings: SAMLSettings): ThunkResult<Promise<boolean>> {
  return updateSSOSAMLConfig({
    ...samlSettings,
    enabled: false,
  });
}

function ssoToRawSettings(samlSettings: SAMLSettings): any {
  return {
    enabled: samlSettings?.enabled ? 'true' : 'false',
    entityId: samlSettings?.entityId,
    name: samlSettings?.name,
    allow_sign_up: samlSettings?.allowSignUp ? 'true' : 'false',
    auto_login: samlSettings?.autoLogin ? 'true' : 'false',
    single_logout: samlSettings?.singleLogout ? 'true' : 'false',
    allow_idp_initiated: samlSettings?.allowIdpInitiated ? 'true' : 'false',
    skip_org_role_sync: samlSettings?.skipOrgRoleSync ? 'true' : 'false',
    private_key: samlSettings?.privateKey,
    private_key_path: samlSettings?.privateKeyPath,
    certificate: samlSettings?.certificate,
    certificate_path: samlSettings?.certificatePath,
    signature_algorithm: samlSettings?.signatureAlgorithm,
    idp_metadata: samlSettings?.idpMetadata,
    idp_metadata_path: samlSettings?.idpMetadataPath,
    idp_metadata_url: samlSettings?.idpMetadataUrl,
    max_issue_delay: samlSettings?.maxIssueDelay,
    metadata_valid_duration: samlSettings?.metadataValidDuration,
    relay_state: samlSettings?.relayState,
    assertion_attribute_name: samlSettings?.assertionAttributeName,
    assertion_attribute_login: samlSettings?.assertionAttributeLogin,
    assertion_attribute_email: samlSettings?.assertionAttributeEmail,
    assertion_attribute_groups: samlSettings?.assertionAttributeGroups,
    assertion_attribute_role: samlSettings?.assertionAttributeRole,
    assertion_attribute_org: samlSettings?.assertionAttributeOrg,
    assertion_attribute_external_uid: samlSettings?.assertionAttributeExternalUid,
    allowed_organizations: samlSettings?.allowedOrganizations,
    org_mapping: samlSettings?.orgMapping,
    role_values_none: samlSettings?.roleValuesNone,
    role_values_viewer: samlSettings?.roleValuesViewer,
    role_values_editor: samlSettings?.roleValuesEditor,
    role_values_admin: samlSettings?.roleValuesAdmin,
    role_values_grafana_admin: samlSettings?.roleValuesGrafanaAdmin,
    name_id_format: samlSettings?.nameIdFormat,
    client_id: samlSettings?.clientId,
    client_secret: samlSettings?.clientSecret,
    token_url: samlSettings?.tokenUrl,
    force_use_graph_api: samlSettings?.forceUseGraphApi ? 'true' : 'false',
  };
}

function formDataToSSOData(data: SAMLFormData): SAMLSettings {
  return {
    enabled: data?.enabled,
    entityId: data?.entityId,
    name: data?.name,
    allowSignUp: data?.allowSignUp,
    autoLogin: data?.autoLogin,
    singleLogout: data?.singleLogout,
    allowIdpInitiated: data?.allowIdpInitiated,
    skipOrgRoleSync: data?.skipOrgRoleSync,
    privateKey: data?.privateKey,
    privateKeyPath: data?.privateKeyPath,
    certificate: data?.certificate,
    certificatePath: data?.certificatePath,
    signatureAlgorithm: data?.signatureAlgorithm,
    idpMetadata: data?.idpMetadata,
    idpMetadataPath: data?.idpMetadataPath,
    idpMetadataUrl: data?.idpMetadataUrl,
    maxIssueDelay: data?.maxIssueDelay,
    metadataValidDuration: data?.metadataValidDuration,
    relayState: data?.relayState,
    assertionAttributeName: data?.assertionAttributeName,
    assertionAttributeLogin: data?.assertionAttributeLogin,
    assertionAttributeEmail: data?.assertionAttributeEmail,
    assertionAttributeGroups: data?.assertionAttributeGroups,
    assertionAttributeRole: data?.assertionAttributeRole,
    assertionAttributeOrg: data?.assertionAttributeOrg,
    assertionAttributeExternalUid: data?.assertionAttributeExternalUid,
    allowedOrganizations: data?.allowedOrganizations,
    orgMapping: data?.orgMapping,
    roleValuesNone: data?.roleValuesNone,
    roleValuesViewer: data?.roleValuesViewer,
    roleValuesEditor: data?.roleValuesEditor,
    roleValuesAdmin: data?.roleValuesAdmin,
    roleValuesGrafanaAdmin: data?.roleValuesGrafanaAdmin,
    nameIdFormat: data?.nameIdFormat,
    clientId: data?.clientId,
    clientSecret: data?.clientSecret,
    tokenUrl: data?.tokenUrl,
    forceUseGraphApi: data?.forceUseGraphApi,
  };
}
