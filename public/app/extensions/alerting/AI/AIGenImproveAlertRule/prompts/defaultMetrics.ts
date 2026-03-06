// Default metrics for different datasource types
// These are used as fallbacks when the API calls fail or return no results, as a last resort

export const DEFAULT_METRICS = {
  prometheus: [
    'up',
    'cpu_usage_idle',
    'cpu_usage_active',
    'cpu_usage_system',
    'cpu_usage_user',
    'memory_usage_bytes',
    'memory_available_bytes',
    'memory_total_bytes',
    'disk_usage_bytes',
    'disk_available_bytes',
    'disk_total_bytes',
    'network_bytes_total',
    'network_bytes_recv',
    'network_bytes_sent',
    'http_requests_total',
    'http_request_duration_seconds',
    'http_request_duration_seconds_bucket',
    'http_request_duration_seconds_count',
    'http_request_duration_seconds_sum',
    'process_cpu_seconds_total',
    'process_resident_memory_bytes',
    'process_virtual_memory_bytes',
    'go_memstats_alloc_bytes',
    'go_memstats_heap_alloc_bytes',
    'go_memstats_heap_inuse_bytes',
    'go_goroutines',
    'node_cpu_seconds_total',
    'node_memory_MemAvailable_bytes',
    'node_memory_MemTotal_bytes',
    'node_filesystem_avail_bytes',
    'node_filesystem_size_bytes',
    'node_load1',
    'node_load5',
    'node_load15',
  ],
  loki: [
    'rate({job="app"}[5m])',
    'count_over_time({job="app"}[5m])',
    'bytes_rate({job="app"}[5m])',
    'bytes_over_time({job="app"}[5m])',
    'sum(rate({job="app"}[5m]))',
    'sum(count_over_time({job="app", level="error"}[5m]))',
    'sum(count_over_time({job="app", level="warn"}[5m]))',
    'sum by (job) (rate({job=~".+"}[5m]))',
    'sum by (level) (count_over_time({job="app"}[5m]))',
  ],
  influxdb: [
    'cpu',
    'cpu.usage_active',
    'cpu.usage_idle',
    'cpu.usage_system',
    'cpu.usage_user',
    'mem',
    'mem.usage_percent',
    'mem.available_percent',
    'mem.used_percent',
    'disk',
    'disk.usage_percent',
    'disk.free',
    'disk.used',
    'net',
    'net.bytes_recv',
    'net.bytes_sent',
    'system',
    'system.load1',
    'system.load5',
    'system.load15',
    'processes',
    'processes.total',
    'swap',
    'swap.usage_percent',
    'kernel',
    'kernel.boot_time',
  ],
  cloudwatch: [
    'CPUUtilization',
    'MemoryUtilization',
    'DiskReadOps',
    'DiskWriteOps',
    'NetworkIn',
    'NetworkOut',
    'StatusCheckFailed',
    'StatusCheckFailed_Instance',
    'StatusCheckFailed_System',
  ],
  elasticsearch: [
    'elasticsearch_cluster_health_status',
    'elasticsearch_cluster_health_number_of_nodes',
    'elasticsearch_cluster_health_active_primary_shards',
    'elasticsearch_indices_docs_count',
    'elasticsearch_indices_store_size_bytes',
    'elasticsearch_jvm_memory_used_bytes',
    'elasticsearch_jvm_memory_max_bytes',
  ],
  generic: ['cpu_usage', 'memory_usage', 'disk_usage', 'network_usage', 'response_time', 'error_rate', 'throughput'],
};

export type DatasourceType = keyof typeof DEFAULT_METRICS;

// Type guard to check if a string is a valid datasource type
const isDatasourceType = (type: string): type is DatasourceType => {
  return type in DEFAULT_METRICS;
};

// Helper function to get default metrics for a datasource type
export const getDefaultMetrics = (datasourceType: string): string[] => {
  const normalizedType = datasourceType.toLowerCase();

  if (isDatasourceType(normalizedType)) {
    return DEFAULT_METRICS[normalizedType];
  }

  return DEFAULT_METRICS.generic;
};
