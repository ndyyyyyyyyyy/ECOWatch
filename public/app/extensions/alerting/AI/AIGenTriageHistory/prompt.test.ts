import { rangeUtil, TimeRange } from '@grafana/data';
import { LogRecord } from 'app/features/alerting/unified/components/rules/state-history/common';
import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

import { processEventData } from './prompt';

describe('processEventData', () => {
  const createMockTimeRange = (fromTime: string, toTime: string): TimeRange =>
    rangeUtil.convertRawToRange({
      from: fromTime,
      to: toTime,
    });

  const createMockLogRecord = (
    timestamp: string,
    alertname: string,
    previous: GrafanaAlertStateWithReason,
    current: GrafanaAlertStateWithReason,
    ruleUID?: string,
    fingerprint?: string,
    additionalLabels?: Record<string, string>
  ): LogRecord => ({
    timestamp: new Date(timestamp).getTime(),
    line: {
      labels: {
        alertname,
        ...additionalLabels,
      },
      previous,
      current,
      ruleUID,
      fingerprint,
    },
  });

  describe('basic functionality', () => {
    it('should process empty log records correctly', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const result = processEventData([], timeRange);

      expect(result.summary.totalEvents).toBe(0);
      expect(result.summary.alertingEvents).toBe(0);
      expect(result.summary.errorEvents).toBe(0);
      expect(result.summary.noDataEvents).toBe(0);
      expect(result.summary.normalEvents).toBe(0);
      expect(result.summary.uniqueAlertRules).toBe(0);
      expect(result.summary.timeSpan).toEqual({
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-01T01:00:00.000Z',
      });
      expect(result.events).toEqual([]);
      expect(result.eventsByRule).toEqual([]);
      expect(result.compactRuleData).toEqual([]);
    });

    it('should process single log record correctly', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecords = [
        createMockLogRecord('2024-01-01T00:30:00Z', 'HighCPUUsage', 'Normal', 'Alerting', 'rule-123', 'fp-456'),
      ];

      const result = processEventData(logRecords, timeRange);

      expect(result.summary.totalEvents).toBe(1);
      expect(result.summary.alertingEvents).toBe(1);
      expect(result.summary.errorEvents).toBe(0);
      expect(result.summary.noDataEvents).toBe(0);
      expect(result.summary.normalEvents).toBe(0);
      expect(result.summary.uniqueAlertRules).toBe(1);
      expect(result.summary.timeSpan).toEqual({
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-01T01:00:00.000Z',
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        timestamp: '2024-01-01T00:30:00.000Z',
        alertRule: 'HighCPUUsage',
        previousState: 'N',
        currentState: 'A',
        labels: { alertname: 'HighCPUUsage' },
        ruleUID: undefined,
        fingerprint: undefined,
      });

      expect(result.eventsByRule).toHaveLength(1);
      expect(result.eventsByRule[0]).toEqual({
        alertRule: 'HighCPUUsage',
        eventCount: 1,
        states: ['A'],
        lastEvent: '2024-01-01T00:30:00.000Z',
      });

      expect(result.compactRuleData).toHaveLength(1);
      expect(result.compactRuleData[0]).toEqual({
        alertRule: 'HighCPUUsage',
        totalEvents: 1,
        latestEvent: '2024-01-01T00:30:00.000Z',
        commonLabels: { alertname: 'HighCPUUsage' },
        transitions: [
          {
            transition: 'N → A',
            count: 1,
            timestamps: ['2024-01-01T00:30:00.000Z'],
            uniqueLabels: {},
          },
        ],
      });
    });

    it('should process multiple log records with different states correctly', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecords = [
        createMockLogRecord('2024-01-01T00:10:00Z', 'HighCPUUsage', 'Normal', 'Alerting'),
        createMockLogRecord('2024-01-01T00:20:00Z', 'DatabaseDown', 'Normal', 'Error'),
        createMockLogRecord('2024-01-01T00:30:00Z', 'MemoryHigh', 'Normal', 'NoData'),
        createMockLogRecord('2024-01-01T00:40:00Z', 'DiskSpace', 'Alerting', 'Normal'),
        createMockLogRecord('2024-01-01T00:50:00Z', 'HighCPUUsage', 'Alerting', 'Normal'),
      ];

      const result = processEventData(logRecords, timeRange);

      expect(result.summary.totalEvents).toBe(5);
      expect(result.summary.alertingEvents).toBe(1);
      expect(result.summary.errorEvents).toBe(1);
      expect(result.summary.noDataEvents).toBe(1);
      expect(result.summary.normalEvents).toBe(2);
      expect(result.summary.uniqueAlertRules).toBe(4);
      expect(result.summary.timeSpan).toEqual({
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-01T01:00:00.000Z',
      });
      // Representative events: 5 unique transitions, so 5 events
      expect(result.events).toHaveLength(5);
      expect(result.events[0]).toEqual({
        timestamp: '2024-01-01T00:10:00.000Z',
        alertRule: 'HighCPUUsage',
        previousState: 'N',
        currentState: 'A',
        labels: { alertname: 'HighCPUUsage' },
        ruleUID: undefined,
        fingerprint: undefined,
      });

      expect(result.eventsByRule).toHaveLength(4);
      expect(result.eventsByRule[0]).toEqual({
        alertRule: 'HighCPUUsage',
        eventCount: 2, // 2 representative events for HighCPUUsage (Normal→Alerting, Alerting→Normal)
        states: ['A', 'N'],
        lastEvent: '2024-01-01T00:10:00.000Z',
      });
      expect(result.eventsByRule[1]).toEqual({
        alertRule: 'DatabaseDown',
        eventCount: 1,
        states: ['E'],
        lastEvent: '2024-01-01T00:20:00.000Z',
      });
      expect(result.eventsByRule[2]).toEqual({
        alertRule: 'MemoryHigh',
        eventCount: 1,
        states: ['ND'],
        lastEvent: '2024-01-01T00:30:00.000Z',
      });
      expect(result.eventsByRule[3]).toEqual({
        alertRule: 'DiskSpace',
        eventCount: 1,
        states: ['N'],
        lastEvent: '2024-01-01T00:40:00.000Z',
      });

      // Test compactRuleData
      expect(result.compactRuleData).toHaveLength(4);

      const highCpuCompact = result.compactRuleData.find((r) => r.alertRule === 'HighCPUUsage');
      expect(highCpuCompact).toEqual({
        alertRule: 'HighCPUUsage',
        totalEvents: 2,
        latestEvent: '2024-01-01T00:50:00.000Z', // Latest timestamp from all events
        commonLabels: { alertname: 'HighCPUUsage' },
        transitions: [
          {
            transition: 'N → A',
            count: 1,
            timestamps: ['2024-01-01T00:10:00.000Z'],
            uniqueLabels: {},
          },
          {
            transition: 'A → N',
            count: 1,
            timestamps: ['2024-01-01T00:50:00.000Z'],
            uniqueLabels: {},
          },
        ],
      });
    });
  });

  describe('record processing', () => {
    it('should process all provided records', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecords: LogRecord[] = [];

      // Create 1200 log records
      for (let i = 0; i < 1200; i++) {
        logRecords.push(
          createMockLogRecord(
            `2024-01-01T00:${String(i % 60).padStart(2, '0')}:${String(Math.floor(i / 60)).padStart(2, '0')}Z`,
            `Alert${i}`,
            'Normal',
            i % 2 === 0 ? 'Alerting' : 'Normal'
          )
        );
      }

      const result = processEventData(logRecords, timeRange);

      // Should process all 1200 records since limit was removed
      expect(result.summary.totalEvents).toBe(1200);

      // Since each alert has a unique name and unique transition pattern,
      // we should have 1200 representative events (one per unique transition)
      expect(result.events.length).toBe(1200);

      // Verify we processed all records (Alert0 to Alert1199)
      const alertRules = result.events.map((e) => e.alertRule);
      expect(
        alertRules.every((rule) => {
          const num = parseInt(rule.replace('Alert', ''), 10);
          return num >= 0 && num <= 1199;
        })
      ).toBe(true);

      // Should have 1200 unique alert rules since each record has a different alertname
      expect(result.summary.uniqueAlertRules).toBe(1200);

      // EventsByRule should also have 1200 entries (one per unique alert)
      expect(result.eventsByRule.length).toBe(1200);

      // CompactRuleData should also have 1200 entries
      expect(result.compactRuleData.length).toBe(1200);
    });
  });

  describe('grouping by alert rules', () => {
    it('should group events by alert rule correctly', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecords = [
        createMockLogRecord('2024-01-01T00:10:00Z', 'HighCPUUsage', 'Normal', 'Alerting'),
        createMockLogRecord('2024-01-01T00:20:00Z', 'HighCPUUsage', 'Alerting', 'Normal'),
        createMockLogRecord('2024-01-01T00:30:00Z', 'DatabaseDown', 'Normal', 'Error'),
        createMockLogRecord('2024-01-01T00:40:00Z', 'HighCPUUsage', 'Normal', 'Alerting'),
      ];

      const result = processEventData(logRecords, timeRange);

      // Representative events: 3 unique transitions
      // HighCPUUsage: Normal→Alerting (first occurrence), Alerting→Normal
      // DatabaseDown: Normal→Error
      expect(result.events).toHaveLength(3);

      expect(result.eventsByRule).toHaveLength(2);

      const highCpuRule = result.eventsByRule.find((rule) => rule.alertRule === 'HighCPUUsage');
      expect(highCpuRule).toEqual({
        alertRule: 'HighCPUUsage',
        eventCount: 2, // 2 representative events (Normal→Alerting, Alerting→Normal)
        states: ['A', 'N'], // States from representative events
        lastEvent: '2024-01-01T00:10:00.000Z', // First representative event timestamp
      });

      const dbRule = result.eventsByRule.find((rule) => rule.alertRule === 'DatabaseDown');
      expect(dbRule).toEqual({
        alertRule: 'DatabaseDown',
        eventCount: 1,
        states: ['E'],
        lastEvent: '2024-01-01T00:30:00.000Z',
      });

      // Test compactRuleData for HighCPUUsage
      const highCpuCompact = result.compactRuleData.find((r) => r.alertRule === 'HighCPUUsage');
      expect(highCpuCompact).toEqual({
        alertRule: 'HighCPUUsage',
        totalEvents: 3, // Total events for this rule across all occurrences
        latestEvent: '2024-01-01T00:40:00.000Z', // Latest timestamp from all HighCPUUsage events
        commonLabels: { alertname: 'HighCPUUsage' },
        transitions: [
          {
            transition: 'N → A',
            count: 2, // Two occurrences of Normal→Alerting
            timestamps: ['2024-01-01T00:10:00.000Z', '2024-01-01T00:40:00.000Z'],
            uniqueLabels: {},
          },
          {
            transition: 'A → N',
            count: 1, // One occurrence of Alerting→Normal
            timestamps: ['2024-01-01T00:20:00.000Z'],
            uniqueLabels: {},
          },
        ],
      });
    });
  });

  describe('edge cases and missing data', () => {
    it('should handle missing alert names gracefully', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecord: LogRecord = {
        timestamp: new Date('2024-01-01T00:30:00Z').getTime(),
        line: {
          labels: {}, // No alertname
          previous: 'Normal',
          current: 'Alerting',
        },
      };

      const result = processEventData([logRecord], timeRange);

      expect(result.events[0].alertRule).toBe('Unknown');
      expect(result.eventsByRule[0].alertRule).toBe('Unknown');
    });

    it('should handle missing labels gracefully', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecord: LogRecord = {
        timestamp: new Date('2024-01-01T00:30:00Z').getTime(),
        line: {
          labels: undefined, // No labels
          previous: 'Normal',
          current: 'Alerting',
        },
      };

      const result = processEventData([logRecord], timeRange);

      expect(result.events[0].alertRule).toBe('Unknown');
      expect(result.events[0].labels).toEqual({});
    });

    it('should handle optional fields correctly', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecord: LogRecord = {
        timestamp: new Date('2024-01-01T00:30:00Z').getTime(),
        line: {
          labels: { alertname: 'TestAlert' },
          previous: 'Normal',
          current: 'Alerting',
          // ruleUID and fingerprint are missing
        },
      };

      const result = processEventData([logRecord], timeRange);

      expect(result.events[0]).toEqual({
        timestamp: '2024-01-01T00:30:00.000Z',
        alertRule: 'TestAlert',
        previousState: 'N',
        currentState: 'A',
        labels: { alertname: 'TestAlert' },
        ruleUID: undefined,
        fingerprint: undefined,
      });
    });

    it('should preserve additional labels', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecords = [
        createMockLogRecord('2024-01-01T00:30:00Z', 'HighCPUUsage', 'Normal', 'Alerting', 'rule-123', 'fp-456', {
          instance: 'server-1',
          severity: 'critical',
        }),
      ];

      const result = processEventData(logRecords, timeRange);

      expect(result.events[0].labels).toEqual({
        alertname: 'HighCPUUsage',
        instance: 'server-1',
        severity: 'critical',
      });

      // Test compactRuleData preserves labels correctly
      expect(result.compactRuleData[0]).toEqual({
        alertRule: 'HighCPUUsage',
        totalEvents: 1,
        latestEvent: '2024-01-01T00:30:00.000Z',
        commonLabels: {
          alertname: 'HighCPUUsage',
          instance: 'server-1',
          severity: 'critical',
        },
        transitions: [
          {
            transition: 'N → A',
            count: 1,
            timestamps: ['2024-01-01T00:30:00.000Z'],
            uniqueLabels: {},
          },
        ],
      });
    });

    it('should separate common and unique labels correctly', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecords = [
        createMockLogRecord('2024-01-01T00:10:00Z', 'CPUAlert', 'Normal', 'Alerting', 'rule-1', 'fp-1', {
          service: 'backend',
          instance: 'server-1',
          severity: 'critical',
        }),
        createMockLogRecord('2024-01-01T00:20:00Z', 'CPUAlert', 'Alerting', 'Normal', 'rule-1', 'fp-2', {
          service: 'backend',
          instance: 'server-2', // Different instance
          severity: 'critical',
        }),
        createMockLogRecord('2024-01-01T00:30:00Z', 'CPUAlert', 'Normal', 'Error', 'rule-1', 'fp-3', {
          service: 'backend',
          instance: 'server-1',
          severity: 'warning', // Different severity
        }),
      ];

      const result = processEventData(logRecords, timeRange);

      // Should have 3 representative events (all unique transitions)
      expect(result.events).toHaveLength(3);

      // Test compactRuleData for common/unique labels logic
      const cpuAlert = result.compactRuleData.find((r) => r.alertRule === 'CPUAlert');
      expect(cpuAlert).toEqual({
        alertRule: 'CPUAlert',
        totalEvents: 3,
        latestEvent: '2024-01-01T00:30:00.000Z',
        commonLabels: {
          alertname: 'CPUAlert',
          service: 'backend', // Common across all events
        },
        transitions: [
          {
            transition: 'N → A',
            count: 1,
            timestamps: ['2024-01-01T00:10:00.000Z'],
            uniqueLabels: {
              instance: 'server-1',
              severity: 'critical',
            },
          },
          {
            transition: 'A → N',
            count: 1,
            timestamps: ['2024-01-01T00:20:00.000Z'],
            uniqueLabels: {
              instance: 'server-2',
              severity: 'critical',
            },
          },
          {
            transition: 'N → E',
            count: 1,
            timestamps: ['2024-01-01T00:30:00.000Z'],
            uniqueLabels: {
              instance: 'server-1',
              severity: 'warning',
            },
          },
        ],
      });
    });
  });

  describe('state counting', () => {
    it('should count different states correctly', () => {
      const timeRange = createMockTimeRange('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
      const logRecords = [
        createMockLogRecord('2024-01-01T00:10:00Z', 'Alert1', 'Normal', 'Alerting'),
        createMockLogRecord('2024-01-01T00:20:00Z', 'Alert2', 'Normal', 'Alerting'),
        createMockLogRecord('2024-01-01T00:30:00Z', 'Alert3', 'Normal', 'Error'),
        createMockLogRecord('2024-01-01T00:40:00Z', 'Alert4', 'Normal', 'Error'),
        createMockLogRecord('2024-01-01T00:50:00Z', 'Alert5', 'Normal', 'Error'),
        createMockLogRecord('2024-01-01T01:00:00Z', 'Alert6', 'Normal', 'NoData'),
        createMockLogRecord('2024-01-01T01:10:00Z', 'Alert7', 'Alerting', 'Normal'),
        createMockLogRecord('2024-01-01T01:20:00Z', 'Alert8', 'Alerting', 'Normal'),
        createMockLogRecord('2024-01-01T01:30:00Z', 'Alert9', 'Alerting', 'Normal'),
        createMockLogRecord('2024-01-01T01:40:00Z', 'Alert10', 'Alerting', 'Normal'),
      ];

      const result = processEventData(logRecords, timeRange);

      expect(result.summary.totalEvents).toBe(10);
      expect(result.summary.alertingEvents).toBe(2);
      expect(result.summary.errorEvents).toBe(3);
      expect(result.summary.noDataEvents).toBe(1);
      expect(result.summary.normalEvents).toBe(4);
      expect(result.summary.uniqueAlertRules).toBe(10);
    });
  });

  describe('time range handling', () => {
    it('should format time range correctly', () => {
      const timeRange = createMockTimeRange('2024-12-25T10:30:45Z', '2024-12-25T11:45:30Z');
      const result = processEventData([], timeRange);

      expect(result.summary.timeSpan).toEqual({
        from: '2024-12-25T10:30:45.000Z',
        to: '2024-12-25T11:45:30.000Z',
      });
    });
  });
});
