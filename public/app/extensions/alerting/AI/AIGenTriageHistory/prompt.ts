import { TimeRange } from '@grafana/data';
import { llm } from '@grafana/llm';
import { LogRecord } from 'app/features/alerting/unified/components/rules/state-history/common';

// State dictionary for compression
const STATE_DICT = new Map<string, string>([
  ['Normal', 'N'],
  ['Pending', 'P'],
  ['Alerting', 'A'],
  ['Error', 'E'],
  ['NoData', 'ND'],
  ['Recovering', 'R'],
  ['Normal (MissingSeries)', 'N(MS)'],
]);

export const SYSTEM_PROMPT_CONTENT = `You are an expert in alert triage and incident analysis. Your role is to analyze alert event data and provide actionable insights to help operators understand what's happening and prioritize their response.

When analyzing alert events, focus on:

**Pattern Recognition:**
- Identify recurring alerts or patterns
- Spot correlated failures across services
- Detect unusual state transition patterns
- Notice timing correlations

**Severity Assessment:**
- Highlight critical/alerting states that need immediate attention
- Identify which alerts are most important to investigate first
- Flag any alerts in error states or with unusual behavior

**Trend Analysis:**
- Analyze if alerts are increasing, decreasing, or stable
- Identify if issues are spreading across systems
- Notice recovery patterns or persistent problems

**Actionable Recommendations:**
- Suggest which alerts to investigate first (triage priority)
- Recommend potential root causes to investigate
- Identify related alerts that might have the same underlying issue
- Suggest if this looks like a known pattern (service restart, deployment issue, infrastructure problem, etc.)

**Summary Format:**
Provide your analysis in this structure:
1. **🚨 Immediate Attention** - Critical alerts needing urgent action
2. **📊 Pattern Analysis** - Key patterns and trends identified
3. **🔍 Investigation Priority** - Recommended order of investigation
4. **💡 Insights** - Potential root causes and correlations
5. **⏭️ Next Steps** - Suggested actions for operators

Keep your analysis concise but comprehensive. Focus on actionable insights that help operators quickly understand the situation and respond effectively.`;

/**
 * Sets up the AI's behavior and context
 * @returns The system prompt as a llm.Message
 */
export const createSystemPrompt = (): llm.Message => ({
  role: 'system',
  content: SYSTEM_PROMPT_CONTENT,
});

interface EventData {
  summary: {
    totalEvents: number;
    alertingEvents: number;
    errorEvents: number;
    noDataEvents: number;
    normalEvents: number;
    uniqueAlertRules: number;
    timeSpan: {
      from: string;
      to: string;
    };
  };
  events: ProcessedEvent[];
  eventsByRule: Array<{
    alertRule: string;
    eventCount: number;
    states: string[];
    lastEvent: string;
  }>;
  compactRuleData: Array<{
    alertRule: string;
    totalEvents: number;
    latestEvent: string;
    commonLabels: Record<string, string>;
    transitions: Array<{
      transition: string;
      count: number;
      timestamps: string[];
      uniqueLabels: Record<string, string>;
    }>;
  }>;
}

interface ProcessedEvent {
  timestamp: string;
  alertRule: string;
  previousState: string;
  currentState: string;
  labels: Record<string, string>;
  ruleUID?: string;
  fingerprint?: string;
}

/**
 * Process log records into analysis-friendly format
 * @param logRecords - The log records to process
 * @param timeRange - The time range to use for the analysis
 * @returns The processed event data
 */
export const processEventData = (logRecords: LogRecord[], timeRange: TimeRange): EventData => {
  // Process only the most recent log records to avoid unnecessary processing and token limits
  // logRecords are typically already sorted by timestamp (newest first), so we take the first batch
  const allEvents: ProcessedEvent[] = logRecords.map((record) => ({
    timestamp: new Date(record.timestamp).toISOString(),
    alertRule: record.line.labels?.alertname || 'Unknown',
    previousState: record.line.previous,
    currentState: record.line.current,
    labels: record.line.labels || {},
    ruleUID: record.line.ruleUID,
    fingerprint: record.line.fingerprint,
  }));

  // Group events by alert rule and create transition summaries
  const ruleTransitions = new Map<
    string,
    {
      transitions: Map<string, Array<{ timestamp: string; labels: Record<string, string> }>>;
      totalEvents: number;
      latestEvent: string;
    }
  >();

  allEvents.forEach((event) => {
    const ruleName = event.alertRule;
    const transitionKey = `${event.previousState} → ${event.currentState}`;

    if (!ruleTransitions.has(ruleName)) {
      ruleTransitions.set(ruleName, {
        transitions: new Map(),
        totalEvents: 0,
        latestEvent: event.timestamp,
      });
    }

    const ruleData = ruleTransitions.get(ruleName)!;
    ruleData.totalEvents++;

    if (!ruleData.transitions.has(transitionKey)) {
      ruleData.transitions.set(transitionKey, []);
    }

    ruleData.transitions.get(transitionKey)!.push({
      timestamp: event.timestamp,
      labels: event.labels,
    });

    // Update latest event timestamp
    if (new Date(event.timestamp) > new Date(ruleData.latestEvent)) {
      ruleData.latestEvent = event.timestamp;
    }
  });

  // Convert to a more compact format for the prompt
  const compactRuleData = Array.from(ruleTransitions.entries()).map(([ruleName, data]) => {
    // Analyze all labels across all transitions to find common ones
    const allTransitionLabels = Array.from(data.transitions.values())
      .flat()
      .map((occ) => occ.labels);

    if (allTransitionLabels.length === 0) {
      return {
        alertRule: ruleName,
        totalEvents: data.totalEvents,
        latestEvent: data.latestEvent,
        commonLabels: {},
        transitions: Array.from(data.transitions.entries()).map(([transition, occurrences]) => {
          const compressedTransition = transition.replace(
            /\b(Normal|Pending|Alerting|Error|NoData|Recovering|Normal \(MissingSeries\))\b/g,
            (match) => STATE_DICT.get(match) || match
          );
          return {
            transition: compressedTransition,
            count: occurrences.length,
            timestamps: occurrences.map((o) => o.timestamp).slice(0, 3),
            uniqueLabels: {},
          };
        }),
      };
    }

    // Find common labels (same key-value pairs across ALL occurrences)
    const firstLabels = allTransitionLabels[0];
    const commonLabels: Record<string, string> = {};

    Object.entries(firstLabels).forEach(([key, value]) => {
      const isCommon = allTransitionLabels.every((labels) => labels[key] === value);
      if (isCommon) {
        commonLabels[key] = value;
      }
    });

    return {
      alertRule: ruleName,
      totalEvents: data.totalEvents,
      latestEvent: data.latestEvent,
      commonLabels,
      transitions: Array.from(data.transitions.entries()).map(([transition, occurrences]) => {
        // Compress state names using dictionary
        const compressedTransition = transition.replace(
          /\b(Normal|Pending|Alerting|Error|NoData|Recovering|Normal \(MissingSeries\))\b/g,
          (match) => STATE_DICT.get(match) || match
        );

        // Get unique labels (those that differ from common labels)
        const firstOccurrence = occurrences[0];
        const uniqueLabels: Record<string, string> = {};
        Object.entries(firstOccurrence.labels).forEach(([key, value]) => {
          if (commonLabels[key] !== value) {
            uniqueLabels[key] = value;
          }
        });

        return {
          transition: compressedTransition,
          count: occurrences.length,
          timestamps: occurrences.map((o) => o.timestamp).slice(0, 3),
          uniqueLabels,
        };
      }),
    };
  });

  // For backward compatibility, create a smaller events array with key transitions
  const events: ProcessedEvent[] = [];
  compactRuleData.forEach((rule) => {
    rule.transitions.forEach((trans) => {
      // Add one representative event per transition type
      const [previousState, currentState] = trans.transition.split(' → ');
      // Combine common and unique labels
      const combinedLabels = { ...rule.commonLabels, ...trans.uniqueLabels };
      events.push({
        timestamp: trans.timestamps[0],
        alertRule: rule.alertRule,
        previousState,
        currentState,
        labels: combinedLabels,
        ruleUID: undefined,
        fingerprint: undefined,
      });
    });
  });

  // Calculate summary statistics from all events
  const totalEvents = allEvents.length;
  const alertingEvents = allEvents.filter((e) => e.currentState === 'Alerting').length;
  const errorEvents = allEvents.filter((e) => e.currentState === 'Error').length;
  const noDataEvents = allEvents.filter((e) => e.currentState === 'NoData').length;
  const normalEvents = allEvents.filter((e) => e.currentState === 'Normal').length;

  const uniqueAlertRules = new Set(allEvents.map((e) => e.alertRule)).size;
  const timeSpan = {
    from: timeRange.from.toISOString(),
    to: timeRange.to.toISOString(),
  };

  // Group events by alert rule to identify patterns
  const eventsByRule = events.reduce((acc: Record<string, ProcessedEvent[]>, event) => {
    const rule = event.alertRule;
    if (!acc[rule]) {
      acc[rule] = [];
    }
    acc[rule].push(event);
    return acc;
  }, {});

  return {
    summary: {
      totalEvents,
      alertingEvents,
      errorEvents,
      noDataEvents,
      normalEvents,
      uniqueAlertRules,
      timeSpan,
    },
    events,
    eventsByRule: Object.entries(eventsByRule).map(([rule, ruleEvents]) => ({
      alertRule: rule,
      eventCount: ruleEvents.length,
      states: ruleEvents.map((e) => e.currentState),
      lastEvent: ruleEvents[0]?.timestamp,
    })),
    compactRuleData,
  };
};

/**
 * Contains the actual user request for analysis with event data
 * @param customQuestion - The custom question to answer
 * @returns The user prompt as a llm.Message
 */
export const createUserPrompt = (
  logRecords: LogRecord[],
  timeRange: TimeRange,
  customQuestion?: string
): llm.Message => {
  const eventData = processEventData(logRecords, timeRange);

  const basePrompt = customQuestion
    ? `Please analyze the alert events below and answer this specific question: "${customQuestion}"`
    : `Please analyze the alert events below and provide triage insights. I need to understand what's happening and prioritize my response. Focus on:

1. What alerts need immediate attention?
2. Are there any patterns or correlations I should be aware of?
3. What should I investigate first?
4. Any insights about potential root causes?

IMPORTANT: Your analysis is based on state transition patterns grouped by alert rule from the specified time range, showing the most frequent transitions with recent timestamps. Please acknowledge this data format in your response and indicate if a more comprehensive analysis might be needed.`;

  const eventDataText = `

## Alert Event Data

### Summary
- **Total Events**: ${eventData.summary.totalEvents}
- **Alerting Events**: ${eventData.summary.alertingEvents}
- **Error Events**: ${eventData.summary.errorEvents}
- **NoData Events**: ${eventData.summary.noDataEvents}
- **Normal Events**: ${eventData.summary.normalEvents}
- **Unique Alert Rules**: ${eventData.summary.uniqueAlertRules}
- **Time Range**: ${eventData.summary.timeSpan.from} to ${eventData.summary.timeSpan.to}

### Events by Alert Rule  
${eventData.eventsByRule
  .map((rule) => {
    // Compress state names using dictionary
    const compressedStates = rule.states.map((state) => STATE_DICT.get(state) || state);
    return `**${rule.alertRule}**: ${rule.eventCount} events, States: [${compressedStates.join(', ')}], Last Event: ${rule.lastEvent}`;
  })
  .join('\n')}

### State Dictionary
**N**=Normal, **P**=Pending, **A**=Alerting, **E**=Error, **ND**=NoData, **R**=Recovering, **N(MS)**=Normal(MissingSeries)

### Alert Rule State Transitions
${eventData.compactRuleData
  .map(
    (rule) =>
      `**${rule.alertRule}** (${rule.totalEvents} total events, latest: ${rule.latestEvent})${
        Object.keys(rule.commonLabels).length > 0 ? `\nCommon Labels: ${JSON.stringify(rule.commonLabels)}` : ''
      }
${rule.transitions
  .map(
    (trans) =>
      `  • ${trans.transition}: ${trans.count}x | Recent: ${trans.timestamps.join(', ')}${
        Object.keys(trans.uniqueLabels).length > 0 ? ` | Unique: ${JSON.stringify(trans.uniqueLabels)}` : ''
      }`
  )
  .join('\n')}`
  )
  .join('\n\n')}

---

Please provide actionable analysis based on this data.`;

  return {
    role: 'user',
    content: basePrompt + eventDataText,
  };
};
