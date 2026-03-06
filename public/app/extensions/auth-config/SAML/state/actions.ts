import { t } from '@grafana/i18n';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
import { SettingsSection } from 'app/types/settings';
import { ThunkResult } from 'app/types/store';

import { SAMLFormData, SAMLSettings } from '../../../types';
import { getMetadataValueType } from '../utils';
import {
  disableSAMLSettings,
  enableSAMLSettings,
  getSAMLSettings,
  removeSAMLSettings,
  updateSAMLSettings,
} from '../utils/api';
import { validateConfig } from '../utils/validation';

import {
  settingsLoaded,
  setCertConfigured,
  setKeyCertValueType,
  setKeyConfigured,
  setMetadataValueType,
  setShowSavedBadge,
  settingsLoadingBegin,
  settingsLoadingEnd,
  setSignRequests,
  setStoredSAMLSettings,
  resetError,
  setError,
} from './reducers';

const SHOW_SAVED_BADGE_TIME = 5000;

export function loadSAMLSettings(): ThunkResult<void> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
      try {
        dispatch(settingsLoadingBegin());
        const [samlSettings, samlSettingsRaw] = await getSAMLSettings();
        dispatch(setStoredSAMLSettings(samlSettingsRaw));
        dispatch(
          setSignRequests(
            !!samlSettings.signatureAlgorithm ||
              !!samlSettings.privateKeyPath ||
              !!samlSettings.privateKey ||
              !!samlSettings.certificatePath ||
              !!samlSettings.certificate
          )
        );
        dispatch(setKeyCertValueType(samlSettings.privateKeyPath ? 'path' : 'base64'));
        dispatch(setKeyConfigured(!!samlSettings.privateKeyPath || !!samlSettings.privateKey));
        dispatch(setCertConfigured(!!samlSettings.certificatePath || !!samlSettings.certificate));
        dispatch(setMetadataValueType(getMetadataValueType(samlSettings)));
        dispatch(settingsLoaded(samlSettings));
      } catch (error) {
        dispatch(settingsLoadingEnd());
      }
    }
  };
}

export function saveSAMLSettings(formData: SAMLFormData, savedSettings: SettingsSection): ThunkResult<void> {
  return async (dispatch) => {
    // Validate settings on save
    dispatch(resetError());
    const validationResults = validateConfig(formData);
    if (!validationResults.valid) {
      dispatch(
        setError({
          message: t('auth-config.save-samlsettings.message.cannot-save-settings', 'Cannot save settings'),
          errors: validationResults.errors!,
        })
      );
      return;
    }

    const updated = await dispatch(updateSAMLSettings(formData, savedSettings));
    if (updated) {
      dispatch(showSavedBadge());
      dispatch(loadSAMLSettings());
    }
  };
}

export function resetSAMLSettings(): ThunkResult<void> {
  return async (dispatch) => {
    const removed = await dispatch(removeSAMLSettings());
    if (removed) {
      dispatch(showSavedBadge());
      dispatch(loadSAMLSettings());
    }
  };
}

export function enableSAML(samlSettings: SAMLSettings): ThunkResult<void> {
  return async (dispatch) => {
    const enabled = await dispatch(enableSAMLSettings(samlSettings));
    if (enabled) {
      dispatch(showSavedBadge());
      dispatch(loadSAMLSettings());
    }
  };
}

export function disableSAML(samlSettings: SAMLSettings): ThunkResult<void> {
  return async (dispatch) => {
    const disabled = await dispatch(disableSAMLSettings(samlSettings));
    if (disabled) {
      dispatch(showSavedBadge());
      dispatch(loadSAMLSettings());
    }
  };
}

export function showSavedBadge(): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(setShowSavedBadge(true));
    setTimeout(() => {
      dispatch(setShowSavedBadge(false));
    }, SHOW_SAVED_BADGE_TIME);
  };
}
