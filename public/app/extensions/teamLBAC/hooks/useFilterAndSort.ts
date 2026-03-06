import { useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { Team } from 'app/types/teams';

import { TeamRule } from '../../types';

export interface UseFilterAndSortParams {
  teamLBACRules: TeamRule[];
  teams: Array<Pick<Team, 'name' | 'avatarUrl' | 'id' | 'uid'>>;
}

export interface UseFilterAndSortResult {
  filterQuery: string;
  setFilterQuery: (query: string) => void;
  sortOrder: 'asc' | 'desc';
  toggleSortOrder: () => void;
  sortIconTooltip: string;
  sortedAndFilteredRules: TeamRule[];
  clearFilter: () => void;
}

export function useFilterAndSort({ teamLBACRules, teams }: UseFilterAndSortParams): UseFilterAndSortResult {
  const [filterQuery, setFilterQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Create a mapping from team UIDs to team names for efficient lookups
  const teamUidToNameMap = useMemo(() => {
    return new Map<string, string>(teams.map((team) => [team.uid, team.name ?? '']));
  }, [teams]);

  const sortIconTooltip = useMemo(() => {
    return sortOrder === 'asc'
      ? t('team-lbac.team-lbaceditor-unconnected.sort-teams-ascending', 'Sort teams A-Z')
      : t('team-lbac.team-lbaceditor-unconnected.sort-teams-descending', 'Sort teams Z-A');
  }, [sortOrder]);

  // Sort and filter rules based on team name
  const sortedAndFilteredRules = useMemo(() => {
    const sortedRules = [...teamLBACRules].sort((a, b) => {
      const teamA = teamUidToNameMap.get(a.teamUid) || '';
      const teamB = teamUidToNameMap.get(b.teamUid) || '';
      return sortOrder === 'asc' ? teamA.localeCompare(teamB) : teamB.localeCompare(teamA);
    });

    if (!filterQuery) {
      return sortedRules;
    }

    return sortedRules.filter((rule) => {
      const teamName = teamUidToNameMap.get(rule.teamUid) || '';
      return teamName.toLowerCase().includes(filterQuery.toLowerCase());
    });
  }, [teamLBACRules, teamUidToNameMap, filterQuery, sortOrder]);

  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  }, [sortOrder]);

  // Clear filter
  const clearFilter = useCallback(() => {
    setFilterQuery('');
  }, []);

  return {
    filterQuery,
    setFilterQuery,
    sortOrder,
    toggleSortOrder,
    sortIconTooltip,
    sortedAndFilteredRules,
    clearFilter,
  };
}
