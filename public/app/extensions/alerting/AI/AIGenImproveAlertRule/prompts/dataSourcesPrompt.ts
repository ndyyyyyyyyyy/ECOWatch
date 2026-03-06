import { llm } from '@grafana/llm';
import { getDataSourceSrv } from '@grafana/runtime';

import { getDefaultMetrics } from './defaultMetrics';

export const MAX_METRICS_LIMIT = 1000;
export const DEFAULT_METRICS_LIMIT = 100;

// Types for tool arguments - matching the tool definitions exactly
export interface GetDatasourceMetricsArgs {
  datasourceUid: string;
  limit?: number;
  search?: string;
}

// Tool definition for getting available data sources
export const GET_DATA_SOURCES_TOOL: llm.Tool = {
  type: 'function' as const,
  function: {
    name: 'get_data_sources',
    description:
      'Retrieves a list of all data sources available for alerting. This includes Prometheus, Loki, InfluxDB, and other monitoring data sources that support alerting queries.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// Tool definition for getting metrics from a specific datasource
export const GET_DATASOURCE_METRICS_TOOL: llm.Tool = {
  type: 'function' as const,
  function: {
    name: 'get_datasource_metrics',
    description:
      'Retrieves available metrics from a specific datasource. This helps identify what metrics can be used in alert queries for that datasource.',
    parameters: {
      type: 'object',
      properties: {
        datasourceUid: {
          type: 'string',
          description: 'The UID of the datasource to get metrics from',
        },
        limit: {
          type: 'number',
          description: `Optional limit for the number of metrics to return (default: ${DEFAULT_METRICS_LIMIT})`,
          minimum: 1,
          maximum: MAX_METRICS_LIMIT,
          default: DEFAULT_METRICS_LIMIT,
        },
        search: {
          type: 'string',
          description: 'Optional search term to filter metrics by name',
        },
      },
      required: ['datasourceUid'],
    },
  },
};

// Tool handler for getting available data sources
export const handleGetDataSources = async () => {
  try {
    // Get all data sources that support alerting
    const dataSourceSrv = getDataSourceSrv();
    const alertingDataSources = dataSourceSrv.getList({ alerting: true });

    // Only extract what the AI actually needs
    const dataSources = alertingDataSources.map((ds) => ({
      name: ds.name,
      uid: ds.uid,
      type: ds.type,
      isDefault: ds.isDefault,
    }));

    return {
      success: true,
      dataSources,
      count: dataSources.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      dataSources: [],
      count: 0,
    };
  }
};

// Tool handler for getting metrics from a specific datasource
export const handleGetDatasourceMetrics = async (args: GetDatasourceMetricsArgs) => {
  try {
    const { datasourceUid, limit = DEFAULT_METRICS_LIMIT, search } = args;

    if (!datasourceUid) {
      return {
        success: false,
        error: 'datasourceUid is required',
        metrics: [],
        count: 0,
      };
    }

    // Get datasource info
    const dataSourceSrv = getDataSourceSrv();
    const datasources = dataSourceSrv.getList({ alerting: true });
    const datasourceInfo = datasources.find((ds) => ds.uid === datasourceUid);

    if (!datasourceInfo) {
      return {
        success: false,
        error: `Datasource with UID ${datasourceUid} not found`,
        metrics: [],
        count: 0,
      };
    }

    let metrics: string[] = [];
    let fetchedFromAPI = false;

    // Try to fetch real metrics from the datasource API
    try {
      const datasourceResult = await Promise.race([
        dataSourceSrv.get(datasourceUid),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Datasource fetch timeout')), 5000)),
      ]);

      // Check if datasource has metricFindQuery method and call it safely
      if (
        datasourceResult &&
        typeof datasourceResult === 'object' &&
        'metricFindQuery' in datasourceResult &&
        typeof datasourceResult.metricFindQuery === 'function'
      ) {
        // Helper function to extract metrics from datasource response
        const extractMetricsFromResponse = (metricsResponse: unknown): string[] => {
          if (!Array.isArray(metricsResponse)) {
            return [];
          }

          const extractedMetrics: string[] = [];
          for (const item of metricsResponse) {
            if (item && typeof item === 'object') {
              let metricName: string | undefined;
              if ('text' in item && typeof item.text === 'string') {
                metricName = item.text;
              } else if ('value' in item && typeof item.value === 'string') {
                metricName = item.value;
              }
              if (metricName) {
                extractedMetrics.push(metricName);
              }
            }
          }
          return extractedMetrics.slice(0, limit);
        };

        if (datasourceInfo.type === 'prometheus') {
          try {
            // For Prometheus, get metric names via label values API
            const metricsResponse = await Promise.race([
              datasourceResult.metricFindQuery('label_values(__name__)'),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Metrics query timeout')), 8000)),
            ]);
            metrics = extractMetricsFromResponse(metricsResponse);
            fetchedFromAPI = true;
          } catch (error) {
            console.warn('Failed to query Prometheus metrics:', error);
          }
        } else if (datasourceInfo.type === 'loki') {
          try {
            // For Loki, get available label names (equivalent to available "metrics" for log streams)
            const metricsResponse = await Promise.race([
              datasourceResult.metricFindQuery('label_names()'),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Metrics query timeout')), 8000)),
            ]);
            metrics = extractMetricsFromResponse(metricsResponse);
            fetchedFromAPI = true;
          } catch (error) {
            console.warn('Failed to query Loki labels:', error);
          }
        } else if (datasourceInfo.type === 'influxdb') {
          try {
            // For InfluxDB, try to get measurements
            const metricsResponse = await Promise.race([
              datasourceResult.metricFindQuery('SHOW MEASUREMENTS LIMIT 100'),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Metrics query timeout')), 8000)),
            ]);
            metrics = extractMetricsFromResponse(metricsResponse);
            fetchedFromAPI = true;
          } catch (error) {
            console.warn('Failed to query InfluxDB metrics:', error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch real metrics from ${datasourceInfo.type} datasource:`, error);
      // Will fall back to predefined metrics below
    }

    // Fall back to predefined metrics if API fetch failed or returned no results
    if (!fetchedFromAPI || metrics.length === 0) {
      metrics = getDefaultMetrics(datasourceInfo.type);
    }

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase();
      metrics = metrics.filter((metric) => metric.toLowerCase().includes(searchTerm));
    }

    // Apply limit
    const limitedMetrics = metrics.slice(0, limit);

    return {
      success: true,
      datasource: {
        uid: datasourceUid,
        name: datasourceInfo.name,
        type: datasourceInfo.type,
      },
      metrics: limitedMetrics,
      count: limitedMetrics.length,
      totalCount: metrics.length,
      fetchedFromAPI, // Indicates whether metrics were fetched from API or are predefined
    };
  } catch (error) {
    console.error('Error in handleGetDatasourceMetrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metrics: [],
      count: 0,
    };
  }
};

// Data source selection prompts
export const createDataSourcePrompts = () => ({
  selection: `
  For selecting the datasource, use the following workflow:
  Workflow:
1. Use get_data_sources to see available datasources
2. Select appropriate datasource based on user question:
   - Log-based alerts → Loki/Elasticsearch
   - Infrastructure metrics → Prometheus/InfluxDB  
   - Application metrics → Prometheus/InfluxDB
   - AWS/cloud metrics → CloudWatch
   - Container/K8s metrics → Prometheus
   - Default: use datasource marked "isDefault": true
3. Use get_datasource_metrics to get actual available metrics`,

  queryInstructions: `
FOR THE QUERY ARRAY:
- use the datasourceuid from the get_data_sources tool: 
  - 1- if user mentions a specific datasource, use that uid if you can find it, 
  - 2- if the user mentions a type of datasource, use the first data source that matches that type
  - 3- or default to the default datasource if nothing of the above is mentioned
- use the metric names from the get_datasource_metrics tool: 
  - 1- only use metrics that are confirmed to exist in the datasource, or the first 100 metrics if the user doesn't specify a metric
  - 2- if the user mentions a specific metric, and it exists in the datasource, use that metric
  - 3- or use a similar metric that exists in the datasource
- use the proper query syntax in the queries array based on datasource type:

SUPER IMPORTANT: NEVER use bare metric names without proper syntax (use PromQL for Prometheus, LogQL for Loki, InfluxQL for InfluxDB, CloudWatch for CloudWatch)

Query structure requirements:
- refId "A": Data query from datasource using proper syntax 
- refId "B": Reduce expression that reduces the data to a single value
- refId "C": Condition expression that evaluates the data
- Use actual datasource UIDs from get_data_sources tool, not just the name
- Use actual metric names from get_datasource_metrics tool, not just the name
  
`,

  syntaxExamples: `
IMPORTANT: Use proper query syntax in the queries array based on datasource type:

For example, for prometheus, use "rate(http_requests_total[5m])" not just "http_requests_total"
THIS IS WRONG:
sum(rate(go_cpu_classes_total_cpu_seconds_total[5m])) by (instance) > 0.8
THIS IS CORRECT:
sum(rate(go_cpu_classes_total_cpu_seconds_total{job="grafana"}[5m])) by (instance) > 0.8
this is also correct:
sum(rate(go_cpu_classes_total_cpu_seconds_total{}[5m])) by (instance) > 0.8

For Prometheus datasources:
- Always use proper PromQL syntax with label selectors when needed
- Counter metrics: use rate() function, e.g., "rate(http_requests_total[5m])" not just "http_requests_total"
- Gauge metrics: use with proper label selectors, e.g., "cpu_usage_active{instance=~\\".*\\"}" or "memory_usage_bytes / memory_total_bytes"
- Service availability: use "up{job=\\"service-name\\"}" not bare metrics
- NEVER create bare metric comparisons like "METRIC_NAME < value" (or any other comparison). Always include proper context.

Valid PromQL Examples:
- "rate(http_requests_total[5m]) > 100" (for request rate alerts)
- "cpu_usage_active{instance=~\\".*\\"} > 0.8" (for CPU percentage alerts)
- "(memory_usage_bytes / memory_total_bytes) * 100 > 90" (for memory percentage alerts)
- "up{job=\\"grafana\\"} == 0" (for service down alerts)
- "increase(error_count_total[5m]) > 10" (for error count alerts)
- "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5" (for latency alerts)

For Loki datasources:
- Use LogQL expressions for log-based metrics
- Examples:
  - "rate({job=\\"app\\"}[5m]) > 10" (for log rate alerts)
  - "count_over_time({job=\\"app\\", level=\\"error\\"}[5m]) > 5" (for error count alerts)
  - "sum(rate({job=\\"app\\"}[5m])) > 10" (for aggregated log rates)

For InfluxDB datasources:
- Use proper InfluxQL syntax with measurements and fields
- Examples:
  - "SELECT mean(\\"usage_active\\") FROM \\"cpu\\" WHERE time >= now() - 5m" (for CPU alerts)
  - "SELECT mean(\\"usage_percent\\") FROM \\"mem\\" WHERE time >= now() - 5m > 90" (for memory alerts)
  `,
});
