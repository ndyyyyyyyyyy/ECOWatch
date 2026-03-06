import { ContactPoint } from '@grafana/alerting/unstable';

import { ListMeta } from '../../../../../../../packages/grafana-alerting/src/grafana/api/v0alpha1/api.gen';

// Helper function to process contact points data for the prompt
export const processContactPointsForPrompt = (
  contactPointsData:
    | {
        apiVersion?: string | undefined;
        kind?: string | undefined;
        metadata: ListMeta;
        items: ContactPoint[];
      }
    | undefined,
  isLoading: boolean
): string => {
  if (isLoading) {
    return 'Contact points are currently loading...';
  }

  if (!contactPointsData?.items || contactPointsData.items.length === 0) {
    return 'No contact points available.';
  }

  const processedContactPoints = contactPointsData.items.map((contactPoint) => ({
    name: contactPoint.spec.title,
    id: contactPoint.metadata.uid,
    integrations: contactPoint.spec.integrations.map((integration) => integration.type),
  }));

  // return the contact points data in a string format that can be injected into the prompt
  return `Available contact points:
${processedContactPoints.map((cp) => `- ${cp.name} (ID: ${cp.id}, Types: ${cp.integrations.join(', ')})`).join('\n')}`;
};

// Contact point selection prompts
export const createContactPointPrompts = () => ({
  selection: `
4. For setting contactPoints.grafana.selectedContactPoint, use the contact points provided above:
  4.1: if user mentions a specific contact point, use that contact point if it exists in the list above
  4.2: if user mentions a type of contact point, use the first contact point that matches that type
  4.3: or default to the first available contact point if nothing specific is mentioned`,

  configuration: `
- contactPoints: Use actual contact point names from the available contact points list provided in the system prompt. Include all required routing settings:
  - selectedContactPoint: The contact point name
  - overrideGrouping: false (unless specifically requested)
  - groupBy: [] (empty array unless custom grouping requested)
  - overrideTimings: false (unless custom timing requested)
  - groupWaitValue: "" (empty unless overrideTimings is true)
  - groupIntervalValue: "" (empty unless overrideTimings is true)
  - repeatIntervalValue: "" (empty unless overrideTimings is true)
  - muteTimeIntervals: [] (array of mute timing names)
  - activeTimeIntervals: [] (array of active timing names)`,

  examples: `
Contact Point Configuration Examples:
- Basic: "selectedContactPoint": "slack-alerts"
- With grouping: "selectedContactPoint": "email-team", "overrideGrouping": true, "groupBy": ["alertname"]
- With timing: "selectedContactPoint": "pagerduty", "overrideTimings": true, "repeatIntervalValue": "1h"
- With mute intervals: "selectedContactPoint": "webhook", "muteTimeIntervals": ["maintenance-window"]`,
});
