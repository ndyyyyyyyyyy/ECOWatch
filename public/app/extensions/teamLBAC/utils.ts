import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ResourcePermission } from 'app/core/components/AccessControl/types';
import { config } from 'app/core/config';

import { TeamRule } from '../types';

export const LBACHTTPHeaderName = 'X-Prom-Label-Policy';

export function hasLBACSupport(ds: DataSourceSettings<DataSourceJsonData, {}>): boolean {
  let DataSourcesWithLBACSupport = ['loki', 'prometheus'];
  if (config.featureToggles.teamHttpHeadersTempo) {
    DataSourcesWithLBACSupport.push('tempo');
  }
  return !!ds.basicAuth && DataSourcesWithLBACSupport.includes(ds.type);
}

export function trimLBACRule(rule: string) {
  const pattern = /\{([^{}]*)\}/;
  const res = pattern.exec(rule);
  if (res && res.length > 1) {
    return res[1].trim();
  }
  return '';
}

export function formatLBACRule(labelSelector: string) {
  const pattern = /\{{0,1}([^\{\}]*)\}{0,1}/;
  const res = pattern.exec(labelSelector);
  if (res && res.length > 1) {
    return `{ ${res[1].trim()} }`;
  }
  return '';
}

export function extractLBACRule(rule: string) {
  const pattern = /\w+\:\{{0,1}([^\{\}]*)\}{0,1}/;
  const res = pattern.exec(rule);
  if (res && res.length > 1) {
    return res[1].trim();
  }
  return '';
}

export const validateLBACRule = (str: string, dstype: string): boolean => {
  if (!str) {
    return false;
  }
  const trimmedStr = str.trim().replace(/^{|}$/g, '');
  /*
   Matches a comma-separated list of Prometheus,Tempo-style label matchers.
   
   Label matcher format:
     <label>[.<label>...]<operator>"<value>"
   
   - Label names: letters, digits, underscores, and dots (no trailing or consecutive dots)
   - For Tempo: labels must start with "resource." or "span."
   - Operators: =, !=, =~, !~
   - Values: double-quoted strings
   - Multiple matchers can be separated by commas, with optional whitespace
   
   Examples matched (Prometheus/Loki):
     foo="bar"
     foo="bar",baz!="qux"
     label1 = "abc" , label2 =~ "def.*"
   
   Examples matched (Tempo):
     resource.service.name="my-service"
     span.status.code="OK"
     resource.service.name="my-service",span.duration="100ms"
   
   Examples NOT matched:
     foo.bar.="hej"   // trailing dot not allowed
     foo..bar="baz"   // consecutive dots not allowed
     foo=bar          // value must be quoted
     service.name="test"  // (Tempo) must start with resource. or span.
*/
  let pattern: RegExp;
  switch (dstype) {
    case 'tempo':
      pattern = /^\s*(?:\s*(?:resource|span)(?:\.[\w]+)+\s*(?:=|!=|=~|!~)\s*\"[^\"]+\"\s*,*)+\s*$/;
      break;
    case 'loki':
    case 'prometheus':
      pattern = /^\s*(?:\s*\w+\s*(?:=|!=|=~|!~)\s*\"[^\"]+\"\s*,*)+\s*$/;
      break;
    default:
      throw new Error('validateLBACRule: unsupported datasource type');
  }
  return pattern.test(trimmedStr);
};

export const getLBACTeamsConfigured = (rules: TeamRule[]): string[] => {
  const teams: string[] = [];
  if (rules.length) {
    rules.forEach((rule) => {
      if (rule.teamUid) {
        teams.push(rule.teamUid);
      }
    });
  }
  return teams;
};

export const addTeamLBACWarnings = (teams: string[], items: ResourcePermission[]) => {
  const warningTeam = t(
    'access-control.permissions.lbac-warning-team',
    'Warning: This team has full data access if no LBAC rules are set.'
  );
  return items.map((item) => {
    if (item.builtInRole && item.permission !== 'Admin') {
      const warningBasicRole = t(
        'access-control.permissions.lbac-warning-basic-role',
        `Warning: ${item.builtInRole} may have full data access if permission is not removed.`
      );
      item.warning = warningBasicRole;
    } else if (item.teamUid && !teams.includes(item.teamUid)) {
      item.warning = warningTeam;
    }
    return { ...item };
  });
};

export const addTeamLBACWarningsToLBACRule = (teams: string[], items: TeamRule[]) => {
  const warningTeam = t(
    'access-control.permissions.lbac-warning-rule',
    'Warning: This team might not have permission to the query the datasource.'
  );
  return items.map((item) => {
    if (item.teamUid && !teams.includes(item.teamUid)) {
      item.warning = warningTeam;
    }
    return { ...item };
  });
};
