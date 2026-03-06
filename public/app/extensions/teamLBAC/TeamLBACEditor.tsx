import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConnectedProps, connect } from 'react-redux';

import { DataSourceJsonData, DataSourceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfigSection } from '@grafana/plugin-ui';
import { getBackendSrv } from '@grafana/runtime';
import {
  Alert,
  Box,
  Button,
  Collapse,
  FilterInput,
  Icon,
  LinkButton,
  Stack,
  Text,
  TextLink,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { ResourcePermission } from 'app/core/components/AccessControl/types';
import { contextSrv } from 'app/core/core';
import { DataSourceReadOnlyMessage } from 'app/features/datasources/components/DataSourceReadOnlyMessage';
import { Team } from 'app/types/teams';

import { AccessControlAction as EnterpriseActions, EnterpriseStoreState, TeamRule } from '../types';

import { CreateTeamLBACForm, LBACFormData } from './AddTeamLBACForm';
import { TeamRulesRow } from './TeamRulesRow';
import { useFilterAndSort } from './hooks/useFilterAndSort';
import { getTeamLBAC, updateTeamLBACRules } from './state/actions';
import { formatLBACRule } from './utils';

export interface OwnProps {
  dataSourceConfig: DataSourceSettings<DataSourceJsonData, {}>;
  readOnly?: boolean;
  onTeamLBACUpdate: () => Promise<DataSourceSettings> | void;
  getWarnings?: (items: TeamRule[]) => TeamRule[];
  items?: ResourcePermission[];
}

function mapStateToProps(state: EnterpriseStoreState) {
  return {
    teamLBACConfig: state.teamLBAC?.teamLBACConfig,
  };
}

const mapDispatchToProps = {
  getTeamLBAC,
  updateTeamLBACRules,
};

export const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = OwnProps & ConnectedProps<typeof connector>;

export const TeamLBACEditorUnconnected = ({
  teamLBACConfig,
  dataSourceConfig,
  readOnly,
  onTeamLBACUpdate,
  getTeamLBAC,
  updateTeamLBACRules,
  items,
}: Props) => {
  const [teams, setTeams] = useState<Array<Pick<Team, 'name' | 'avatarUrl' | 'id' | 'uid'>>>([]);
  const [showLBACForm, setShowLBACForm] = useState(false);
  const [rolesWithoutLBAC, setRolesWithoutLBAC] = useState<Set<string>>(new Set<string>());
  const [teamsWithoutLBAC, setTeamsWithoutLBAC] = useState<Set<string>>(new Set<string>());
  const [lbacTeamsWithoutTeamPermissions, setLBACTeamsWithoutTeamPermission] = useState<Set<string>>(new Set<string>());
  const teamLBACRules = useMemo(() => teamLBACConfig?.rules || [], [teamLBACConfig?.rules]);
  const styles = useStyles2(getStyles);
  const [recommendationIsOpen, setRecommendationIsOpen] = useState(false);

  // Use the custom hook for filtering and sorting
  const {
    filterQuery,
    setFilterQuery,
    sortOrder,
    toggleSortOrder,
    sortIconTooltip,
    sortedAndFilteredRules,
    clearFilter,
  } = useFilterAndSort({ teamLBACRules, teams });

  useEffect(() => {
    getTeamLBAC(dataSourceConfig.uid);
  }, [dataSourceConfig.uid, getTeamLBAC]);

  useEffect(() => {
    const fetchTeams = async () => {
      const teamUIDs = teamLBACRules.map((r) => r.teamUid).filter(Boolean);
      const uniqueIdentifiers = [...new Set(teamUIDs)];

      if (!uniqueIdentifiers?.length) {
        return;
      }

      const result = await getBackendSrv().get('/api/teams/search', {
        teamUid: teamUIDs,
      });
      const teamsArray: Team[] = result?.teams;
      const teams = teamsArray.map((team) => ({
        id: team.id,
        uid: team.uid,
        value: team.id,
        name: team.name,
        avatarUrl: team.avatarUrl,
      }));
      setTeams(teams);
    };
    fetchTeams();
  }, [teamLBACRules]);

  useEffect(() => {
    if (!items?.length) {
      return;
    }
    const lbacTeams = new Set(teamLBACRules.map((r) => r.teamUid));
    const resourceTeams = new Set(items.map((r) => r.teamUid));
    const resourceRoles: Set<string> = new Set(
      items
        .filter((r) => typeof r.builtInRole === 'string' && r.builtInRole.trim() !== '' && r.permission !== 'Admin')
        .map((r) => r.builtInRole as string) // Assert that r.builtInRole is a string
    );

    const teamsWithoutLbac: Set<string> = new Set(
      Array.from(resourceTeams)
        .filter((x) => x !== undefined && !lbacTeams.has(x.toString()))
        .map((x) => x?.toString() || '')
    );
    const lbacTeamsWithoutTeamPermissions = new Set(
      Array.from(lbacTeams).filter((x) => x && !resourceTeams.has(x.toString()))
    );

    if (lbacTeamsWithoutTeamPermissions) {
      setLBACTeamsWithoutTeamPermission(lbacTeamsWithoutTeamPermissions);
    }
    if (teamsWithoutLbac) {
      setTeamsWithoutLBAC(teamsWithoutLbac);
    }
    if (resourceRoles) {
      setRolesWithoutLBAC(resourceRoles);
    }
  }, [items, teamLBACRules]);

  const onTeamLBACUpdateInternal = useCallback(
    async (rules: TeamRule[]) => {
      await updateTeamLBACRules(dataSourceConfig.uid, { rules });
      await onTeamLBACUpdate();
    },
    [dataSourceConfig.uid, onTeamLBACUpdate, updateTeamLBACRules]
  );

  const onSubmitLBAC = async ({ teamUid, rule }: LBACFormData) => {
    let updatedRules: TeamRule[] = [];
    const existingTeamRules = teamLBACRules.find((teamRules) => teamRules.teamUid === teamUid.toString());

    if (existingTeamRules) {
      updatedRules = teamLBACRules.map((teamRules) => {
        if (teamRules.teamUid === teamUid.toString()) {
          return { ...teamRules, rules: [...teamRules.rules, formatLBACRule(rule)] };
        }
        return { ...teamRules };
      });
    } else {
      updatedRules = teamLBACRules.concat({
        teamUid: teamUid.toString(),
        rules: [formatLBACRule(rule)],
      });
    }
    await onTeamLBACUpdateInternal(updatedRules);
    setShowLBACForm(false);
  };

  const onRulesUpdate = async (teamIdentifier: string, updatedRules: string[]) => {
    const updatedTeamRules = teamLBACRules.map((r) => {
      if (r.teamUid === teamIdentifier) {
        return { ...r, rules: updatedRules };
      }
      return r;
    });
    await onTeamLBACUpdateInternal(updatedTeamRules);
  };

  const canEdit = contextSrv.hasPermission(EnterpriseActions.DataSourcesPermissionsWrite) && !readOnly;
  const getDescription = (item: ResourcePermission) => {
    if (item.userId) {
      return item.userLogin;
    } else if (item.teamId) {
      return item.team;
    } else if (item.builtInRole) {
      return item.builtInRole;
    }
    return;
  };

  return (
    <Box paddingBottom={2}>
      {readOnly && <DataSourceReadOnlyMessage />}
      <Stack direction="column" gap={3}>
        <ConfigSection
          title={t('team-lbac.team-lbaceditor-unconnected.title-data-access', 'Data access')}
          description={t(
            'team-lbac.team-lbaceditor-unconnected.description-data-access',
            'Here you can configure access to specific data within the datasource using LogQL label selectors.'
          )}
        >
          {(lbacTeamsWithoutTeamPermissions.size > 0 || teamsWithoutLBAC.size > 0 || rolesWithoutLBAC.size > 0) &&
            teamLBACRules.length > 0 && (
              <Box marginBottom={3}>
                <Collapse
                  label={
                    recommendationIsOpen ? (
                      t(
                        'team-lbac.team-lbaceditor-unconnected.hide-access-control-recommendations',
                        'Hide Access Control Recommendations'
                      )
                    ) : (
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Tooltip
                          content={t(
                            'team-lbac.team-lbaceditor-unconnected.content-found-recommendation',
                            'Found recommendations'
                          )}
                        >
                          <Icon name="exclamation-triangle" className={styles.warning} />
                        </Tooltip>
                        <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.show-access-control-recommendations">
                          Show Access Control Recommendations
                        </Trans>
                      </Stack>
                    )
                  }
                  isOpen={recommendationIsOpen}
                  onToggle={() => setRecommendationIsOpen(!recommendationIsOpen)}
                />
                {recommendationIsOpen && (
                  <Alert
                    title={t(
                      'team-lbac.team-lbaceditor-unconnected.title-access-control-recommendations',
                      'Access Control Recommendations'
                    )}
                    severity="warning"
                  >
                    <p>
                      <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.ensure-proper-access-control-please-follow">
                        To ensure proper access control, please follow these recommendations:
                      </Trans>
                    </p>
                    <ul className={styles.warningList}>
                      {lbacTeamsWithoutTeamPermissions.size > 0 && (
                        <li>
                          <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.add-query-permissions">
                            <strong>Add Query Permissions:</strong> The following teams do not have query permissions
                            for the data source, and are therefore not able to query logs with the configured LBAC
                            rules.
                          </Trans>
                          <ul>
                            {Array.from(lbacTeamsWithoutTeamPermissions).map((team) => {
                              const teamName = teams?.find((t) => t.uid?.toString() === team)?.name;
                              return (
                                <li className={styles.warningList} key={team}>
                                  {teamName}
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      )}
                      {teamsWithoutLBAC.size > 0 && (
                        <li>
                          <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.add-team-lbac-rules">
                            <strong>Add Team LBAC Rules:</strong> The following teams can query all logs. Please add
                            Team LBAC rules for them:
                          </Trans>
                          <ul>
                            {Array.from(teamsWithoutLBAC).map((team) => {
                              const i = items?.find((t) => t.teamUid?.toString() === team);
                              if (!i) {
                                return null;
                              }
                              return (
                                <li className={styles.warningList} key={team}>
                                  {getDescription(i)}
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      )}
                      {rolesWithoutLBAC.size > 0 && (
                        <li>
                          <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.remove-unrestricted-access">
                            <strong>Remove Unrestricted Access:</strong> The following roles currently have unrestricted
                            access to logs.
                          </Trans>
                          <ul>
                            {Array.from(rolesWithoutLBAC).map((role) => {
                              return (
                                <li className={styles.warningList} key={role}>
                                  {t('team-lbac.team-lbaceditor-unconnected.role-warning-list', 'Role: {{role}}', {
                                    role,
                                  })}
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      )}
                    </ul>
                  </Alert>
                )}
              </Box>
            )}
          <Stack direction={'column'} gap={2}>
            <Stack direction={'column'}>
              <Text variant={'h4'}>
                <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.lbac-labelbased-access-control">
                  LBAC (Label-based access control)
                </Trans>
              </Text>
              <Stack alignItems={{ xs: 'flex-start', md: 'center' }} direction={{ xs: 'column', md: 'row' }}>
                <Text variant={'bodySmall'} color={'secondary'}>
                  <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.lbac-description">
                    Configure LBAC rules to restrict access for specific metrics/logs.
                  </Trans>
                </Text>
                <TextLink
                  variant={'bodySmall'}
                  external
                  href="https://grafana.com/docs/grafana/latest/administration/data-source-management/teamlbac/create-teamlbac-rules/#lbac-rule"
                >
                  <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.learn-more-about-lbac-rules">
                    Learn more about LBAC rules
                  </Trans>
                </TextLink>
              </Stack>
            </Stack>
            {canEdit && (
              <Stack direction={{ xs: 'column-reverse', md: 'row' }} alignItems={'flex-start'} gap={2}>
                <LinkButton
                  onClick={() => setShowLBACForm(!showLBACForm)}
                  icon={showLBACForm ? 'angle-down' : 'plus'}
                  aria-expanded={showLBACForm}
                >
                  {showLBACForm
                    ? t('team-lbac.team-lbaceditor-unconnected.hide-lbac-rule', 'Hide LBAC rule')
                    : t('team-lbac.team-lbaceditor-unconnected.add-a-lbac-rule', 'Add a LBAC rule')}
                </LinkButton>
                {!isEmpty(teamLBACRules) && (
                  <FilterInput
                    placeholder={t('team-lbac.team-lbaceditor-unconnected.filter-teams-placeholder', 'Filter teams')}
                    value={filterQuery}
                    onChange={setFilterQuery}
                    width={30}
                    escapeRegex={false}
                    aria-label={t(
                      'team-lbac.team-lbaceditor-unconnected.filter-teams-aria-label',
                      'Filter LBAC rules by team name'
                    )}
                  />
                )}
                {showLBACForm && (
                  <Box marginTop={2}>
                    <CreateTeamLBACForm onSubmit={onSubmitLBAC} datasourceType={dataSourceConfig.type} />
                  </Box>
                )}
              </Stack>
            )}
          </Stack>
        </ConfigSection>
        {!isEmpty(sortedAndFilteredRules) && (
          <div className={styles.tableContainer}>
            {!isEmpty(filterQuery) && (
              <Box marginBottom={2}>
                <Text variant="bodySmall">
                  {sortedAndFilteredRules.length === 1
                    ? t('team-lbac.team-lbaceditor-unconnected.filter-results-single', 'Showing 1 result')
                    : t('team-lbac.team-lbaceditor-unconnected.filter-results-multiple', 'Showing {{count}} results', {
                        count: sortedAndFilteredRules.length,
                      })}
                  <Button
                    onClick={clearFilter}
                    fill="text"
                    size="sm"
                    icon="times"
                    variant="secondary"
                    aria-label={t('team-lbac.team-lbaceditor-unconnected.clear-filter-aria-label', 'Clear filter')}
                  >
                    {t('team-lbac.team-lbaceditor-unconnected.clear-filter', 'Clear')}
                  </Button>
                </Text>
              </Box>
            )}
            <table className={styles.table} role="grid" aria-labelledby="team_lbac_rules">
              <thead>
                <tr>
                  <th
                    style={{ width: '30%' }}
                    className={styles.sortableHeader}
                    onClick={toggleSortOrder}
                    aria-sort={sortOrder === 'asc' ? 'ascending' : 'descending'}
                  >
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.team">Team</Trans>
                      <Tooltip content={sortIconTooltip}>
                        <Icon name={sortOrder === 'asc' ? 'angle-up' : 'angle-down'} aria-hidden="true" />
                      </Tooltip>
                    </Stack>
                  </th>
                  <th style={{ width: '1%' }} />
                  <th>
                    <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.label-selector">Label selector</Trans>
                  </th>
                  <th style={{ width: '1%' }} />
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredRules.map((teamRules: TeamRule, idx: number) => {
                  const rules = teamRules.rules;
                  const teamIdentifier = teamRules.teamUid;
                  let warning = '';
                  if (lbacTeamsWithoutTeamPermissions.has(teamIdentifier)) {
                    warning = 'Warning: This team may not have permission to query the datasource.';
                  }
                  return (
                    <TeamRulesRow
                      key={idx}
                      datasourcetype={dataSourceConfig.type}
                      teamRules={rules}
                      disabled={!canEdit}
                      team={
                        teams.find((t) => t.uid === teamRules.teamUid) || {
                          name: '',
                          avatarUrl: '',
                          uid: '',
                        }
                      }
                      onChange={(updatedRules) => onRulesUpdate(teamIdentifier, updatedRules)}
                      warning={warning}
                    />
                  );
                })}
              </tbody>
            </table>
            <Box marginTop={2}>
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="team-lbac.team-lbaceditor-unconnected.lbac-rules-note">
                  Note:
                  <br />
                  - LBAC rules will NOT apply to the query if the authenticated Cloud Access Policy token has any label
                  selectors configured in Grafana Cloud.
                  <br />- Changes to LBAC rules may take up to 5 minutes to be reflected due to query path caching.
                </Trans>
              </Text>
            </Box>
          </div>
        )}
      </Stack>
    </Box>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    warning: css({
      ...theme.typography.bodySmall,
      color: theme.colors.warning.text,
    }),
    warningList: css({
      ...theme.typography.bodySmall,
      listStylePosition: 'inside',
      marginLeft: theme.spacing(2),
    }),
    table: css({
      ...theme.typography.bodySmall,
      width: '100%',
      borderCollapse: 'collapse',
      '& th, & td': {
        padding: theme.spacing(2),
        borderBottom: `1px solid ${theme.colors.border.weak}`,
      },
      '& th': {
        textAlign: 'left',
        fontWeight: theme.typography.fontWeightMedium,
      },
    }),
    sortableHeader: css({
      cursor: 'pointer',
      '&:hover': {
        color: theme.colors.text.link,
      },
    }),
    tableContainer: css({
      overflowX: 'auto',
    }),
  };
};

export const TeamLBACEditor = connector(TeamLBACEditorUnconnected);
