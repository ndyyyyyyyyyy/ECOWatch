import { llm } from '@grafana/llm';

import { createAnnotationsPrompts } from './annotationsPrompt';
import { createContactPointPrompts } from './contactPointsPrompt';
import { createDataSourcePrompts } from './dataSourcesPrompt';
import { createLabelsPrompts } from './labelsPrompt';

const createCommonPromptContent = () => {
  const dataSourcePrompts = createDataSourcePrompts();
  const contactPointPrompts = createContactPointPrompts();
  const labelsPrompts = createLabelsPrompts();
  const annotationsPrompts = createAnnotationsPrompts();

  return {
    dataSourcePrompts,
    contactPointPrompts,
    labelsPrompts,
    annotationsPrompts,
    commonInstructions: {
      availableTools: `Available tools:
- get_data_sources: Get available datasources for querying
- get_datasource_metrics: Get actual metrics from specific datasources`,
    },
  };
};

// Main system prompt content generator
const createSystemPromptContent = (contactPointsData: string) => {
  const { commonInstructions, dataSourcePrompts, contactPointPrompts, annotationsPrompts, labelsPrompts } =
    createCommonPromptContent();

  return `You are an expert in creating Grafana alert rules. Generate properly structured alert rule configurations using available tools.

${commonInstructions.availableTools}

Available contact points:
${contactPointsData}

${contactPointPrompts.selection}

${dataSourcePrompts.selection}

Critical requirements:
- Always create proper query expressions with functions, operators, and thresholds
- Never use bare metric names without proper syntax (use PromQL for Prometheus, LogQL for Loki, InfluxQL for InfluxDB, CloudWatch for CloudWatch)
- Use actual datasource UIDs and metric names from tools
- Return only valid JSON matching RuleFormValues interface

Response structure:
- name, type: "grafana-alerting", queries, condition, evaluateFor, noDataState, execErrState
${annotationsPrompts.usage}
${labelsPrompts.usage}
${contactPointPrompts.configuration}
- Do not set folder or group fields

${dataSourcePrompts.syntaxExamples}


When returning the JSON object, return a JSON object that matches the RuleFormValues interface with these key fields:
- name: A descriptive name for the alert rule
- type: Always use "grafana-alerting"
- queries: An array of alert queries with proper datasource configuration (use actual datasource UIDs from get_data_sources), 
in this queries, construct proper query expressions using the metrics from get_datasource_metrics. DO NOT use bare metric names - always create proper expressions with operators, functions, and thresholds.
- condition: The refId of the query condition (usually "C")
- evaluateFor: How long the condition must be true (e.g., "5m")
- noDataState: What to do when no data (usually "NoData")
- execErrState: What to do on execution error (usually "Alerting")

${getExampleJsonStructure()}

Respond only with JSON, no additional text.`;
};

// Main user prompt content generator
const createUserPromptContent = (userInput: string) => {
  return `Create an alert rule for: ${userInput}

Generate a complete alert rule configuration using the available tools to get actual datasources, metrics, and contact points.`;
};

const getExampleJsonStructure = () => `
Example JSON structure:
{
    "name": "lots of instances rule",
    "uid": "",
    "labels": [
        {
            "key": "",
            "value": ""
        }
    ],
    "annotations": [
        {
            "key": "summary",
            "value": "this is the summary"
        },
        {
            "key": "description",
            "value": "and this is the description"
        },
        {
            "key": "runbook_url",
            "value": "http://localhost:3000/d/d0c2e22f-1e6c-47fb-b534-601788d2d866/test-dashboard-with-alert?orgId=1"
        }
    ],
    "dataSourceName": "grafana",
    "type": "grafana-alerting",
    "group": "gr1",
    "folder": {
        "title": "adpcguv93h62od",
        "uid": "adpcguv93h62od"
    },
    "queries": [
        {
            "refId": "A",
            "queryType": "",
            "relativeTimeRange": {
                "from": 600,
                "to": 0
            },
            "datasourceUid": "gdev-prometheus",
            "model": {
                "datasource": {
                    "type": "prometheus",
                    "uid": "gdev-prometheus"
                },
                "editorMode": "code",
                "expr": "rate(grafana_http_request_duration_seconds_bucket{}[1m])",
                "instant": true,
                "intervalMs": 1000,
                "legendFormat": "__auto",
                "maxDataPoints": 43200,
                "range": false,
                "refId": "A"
            }
        },
        {
            "refId": "B",
            "queryType": "",
            "relativeTimeRange": {
                "from": 600,
                "to": 0
            },
            "datasourceUid": "__expr__",
            "model": {
                "conditions": [
                    {
                        "evaluator": {
                            "params": [],
                            "type": "gt"
                        },
                        "operator": {
                            "type": "and"
                        },
                        "query": {
                            "params": [
                                "B"
                            ]
                        },
                        "reducer": {
                            "params": [],
                            "type": "last"
                        },
                        "type": "query"
                    }
                ],
                "datasource": {
                    "type": "__expr__",
                    "uid": "__expr__"
                },
                "expression": "A",
                "intervalMs": 1000,
                "maxDataPoints": 43200,
                "reducer": "last",
                "refId": "B",
                "type": "reduce"
            }
        },
        {
            "refId": "C",
            "queryType": "",
            "relativeTimeRange": {
                "from": 600,
                "to": 0
            },
            "datasourceUid": "__expr__",
            "model": {
                "conditions": [
                    {
                        "evaluator": {
                            "params": [
                                0
                            ],
                            "type": "gt"
                        },
                        "operator": {
                            "type": "and"
                        },
                        "query": {
                            "params": [
                                "C"
                            ]
                        },
                        "reducer": {
                            "params": [],
                            "type": "last"
                        },
                        "type": "query"
                    }
                ],
                "datasource": {
                    "type": "__expr__",
                    "uid": "__expr__"
                },
                "expression": "B",
                "intervalMs": 1000,
                "maxDataPoints": 43200,
                "refId": "C",
                "type": "threshold"
            }
        }
    ],
    "recordingRulesQueries": [],
    "condition": "C",
    "noDataState": "NoData",
    "execErrState": "Error",
    "evaluateFor": "1m",
    "keepFiringFor": "0s",
    "evaluateEvery": "10s",
    "manualRouting": true,
    "contactPoints": {
        "grafana": {
            "selectedContactPoint": "cp1",
            "muteTimeIntervals": [],
            "activeTimeIntervals": [],
            "overrideGrouping": false,
            "overrideTimings": false,
            "groupBy": [],
            "groupWaitValue": "",
            "groupIntervalValue": "",
            "repeatIntervalValue": ""
        }
    },
    "overrideGrouping": false,
    "overrideTimings": false,
    "muteTimeIntervals": [],
    "editorSettings": {
        "simplifiedQueryEditor": true,
        "simplifiedNotificationEditor": false
    },
    "namespace": "",
    "expression": "",
    "forTime": 1,
    "forTimeUnit": "m",
    "isPaused": false
}`;

export const createSystemPrompt = (contactPointsData: string): llm.Message => ({
  role: 'system',
  content: createSystemPromptContent(contactPointsData),
});

export const createUserPrompt = (userInput: string): llm.Message => ({
  role: 'user',
  content: createUserPromptContent(userInput),
});
