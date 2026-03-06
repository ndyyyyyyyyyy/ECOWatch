import { hasUnresolvedVariables } from './templateVariables';

describe('hasUnresolvedVariables', () => {
  it('detects user variables in queries from datasources like cardinality query', () => {
    const cardinalityQuery = {
      refId: 'A',
      datasource: {
        type: 'cardinality-datasource',
        uid: 'sample-cardinality-management',
      },
      cardinalityType: 'metrics',
      limit: '100',
      refreshQueryWhenFilterChanges: '${filter}',
      resultType: 'top',
      selector: '',
      targetDatasource: '${datasource}',
    };

    expect(hasUnresolvedVariables(cardinalityQuery)).toBe(true);
  });

  it('detects $variable syntax in prometheus query', () => {
    const promQuery = {
      refId: 'A',
      datasource: { uid: 'prometheus', type: 'prometheus' },
      expr: 'up{instance=~"$instance"}',
    };

    expect(hasUnresolvedVariables(promQuery)).toBe(true);
  });

  it('detects [[variable]] syntax in prometheus query', () => {
    const promQuery = {
      refId: 'A',
      datasource: { uid: 'prometheus', type: 'prometheus' },
      expr: 'rate(http_requests_total{job=[[job]]}[5m])',
    };

    expect(hasUnresolvedVariables(promQuery)).toBe(true);
  });

  it('returns false for query without variables', () => {
    const promQuery = {
      refId: 'A',
      datasource: { uid: 'prometheus', type: 'prometheus' },
      expr: 'up{job="api-server"}',
    };

    expect(hasUnresolvedVariables(promQuery)).toBe(false);
  });

  it('returns false for queries not using variables in datasources like cardinality', () => {
    const cardinalityQuery = {
      refId: 'A',
      datasource: {
        type: 'grafanacloud-cardinality-datasource',
        uid: 'grafanacloud-sample-cardinality-management',
      },
      cardinalityType: 'metrics',
      limit: '100',
      refreshQueryWhenFilterChanges: 'false',
      resultType: 'top',
      selector: '',
      targetDatasource: 'prometheus-uid',
    };

    expect(hasUnresolvedVariables(cardinalityQuery)).toBe(false);
  });

  it('ignores built-in variables (should return false)', () => {
    const promQueryWithBuiltins = {
      refId: 'A',
      datasource: { uid: 'prometheus', type: 'prometheus' },
      expr: 'rate(http_requests_total[$__interval])',
      interval: '${__interval_ms}',
      maxDataPoints: '$__maxDataPoints',
    };

    expect(hasUnresolvedVariables(promQueryWithBuiltins)).toBe(false);
  });

  it('detects user variables even when mixed with built-in variables', () => {
    const mixedQuery = {
      refId: 'A',
      datasource: { uid: 'prometheus', type: 'prometheus' },
      expr: 'rate(http_requests_total{job="$job"}[$__interval])',
      timeRange: { from: '$__from', to: '$__to' },
    };

    expect(hasUnresolvedVariables(mixedQuery)).toBe(true);
  });
});
