import { variableRegex } from 'app/features/variables/utils';

/**
 * Detects if a query object contains unresolved template variables that require
 * dashboard context to resolve. Built-in variables (like $__interval, $__from, etc.)
 * are ignored since they work in all contexts and don't cause crashes.
 *
 * This is useful for preventing query editors from crashing when they
 * receive literal variable syntax like "${datasource}" instead of resolved values.
 *
 * @param query - The query object to check for template variables
 * @returns true if unresolved user/dashboard template variables are found
 */
export const hasUnresolvedVariables = (query: any): boolean => {
  if (!query) {
    return false;
  }

  const queryStr = JSON.stringify(query);
  variableRegex.lastIndex = 0; // Reset regex state

  const matches = queryStr.match(variableRegex);
  if (!matches) {
    return false;
  }

  // Check if any matches are NOT built-in variables
  for (const match of matches) {
    if (!match) {
      continue;
    }

    // Ignore built-in variables (they work in all contexts)
    if (match.indexOf('$__') !== -1) {
      continue;
    }
    if (match.indexOf('${__') !== -1) {
      continue;
    }
    if (match.indexOf('$hashKey') !== -1) {
      continue;
    }

    // Found a user/dashboard variable that needs resolution
    return true;
  }

  return false;
};
