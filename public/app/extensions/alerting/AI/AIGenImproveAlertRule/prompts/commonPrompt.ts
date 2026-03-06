import { llm } from '@grafana/llm';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { Annotation } from 'app/features/alerting/unified/utils/constants';

// Common base structure for all improvement prompts
export const createBaseSystemPrompt = (
  type: 'labels' | 'annotations',
  specificGuidelines: string,
  responseFormat: string
) => `You are an expert in improving Grafana alert rule ${type} to make them more effective.

Your role is to enhance existing alert rules by improving their ${type}:

${specificGuidelines}

Important notes:
- Only suggest improvements that add value
- Don't change existing ${type} unless they need improvement
- Focus on making the alert more actionable and informative
- Use consistent naming conventions

Response format: Return ONLY a JSON object with ${type}:
${responseFormat}

Do not include any other text or explanation - only the JSON object.`;

// Common context building for current rule state
export const buildCurrentRuleContext = (currentRule: RuleFormValues) => `
Current Alert Rule:
- Name: ${currentRule.name || 'Unnamed alert'}
- Type: ${currentRule.type || 'Not specified'}

Current Queries:
${currentRule.queries?.map((q, index) => `Query ${q.refId || index}: ${JSON.stringify(q.model, null, 2)}`).join('\n') || 'No queries defined'}

Current Labels:
${currentRule.labels?.map((l) => `- ${l.key}: ${l.value}`).join('\n') || 'No labels defined'}

Current Annotations:
${currentRule.annotations?.map((a) => `- ${a.key}: ${a.value}`).join('\n') || 'No annotations defined'}

Current Evaluation:
- Evaluate For: ${currentRule.evaluateFor || 'Not specified'}
- No Data State: ${currentRule.noDataState || 'Not specified'}
- Execution Error State: ${currentRule.execErrState || 'Not specified'}

Current Contact Points:
${currentRule.contactPoints?.grafana?.selectedContactPoint ? `- ${currentRule.contactPoints.grafana.selectedContactPoint}` : 'No contact points configured'}
`;

// Common template syntax guidelines
export const TEMPLATE_SYNTAX_GUIDELINES = `
**Template Syntax Guidelines**:
- Use \\$values.QueryRef.Value for numeric query results (e.g., \\$values.A.Value, \\$values.B.Value)
- Use \\$labels.labelname for label values from queries (e.g., \\$labels.instance, \\$labels.job)
- Use {{ \\$value }} for the current alert value in annotations
- Use {{ \\$labels.instance }} for label values from queries in annotations
`;

// Labels-specific guidelines
export const LABELS_GUIDELINES = `
Guidelines for label improvements:
1. **Categorization Labels**: Add relevant labels (team, severity, service, environment, etc.)
2. **Template Labels**: Use when query labels are insufficient. They can:
   - Group alerts differently for notifications
   - Be used in notification policies to alter contact points
   - Create dynamic labels based on query values
   - Example conditional severity: \`{{- if gt \\$values.A.Value 90.0 -}}critical{{- else if gt \\$values.A.Value 80.0 -}}warning{{- else if gt \\$values.A.Value 70.0 -}}minor{{- else -}}none{{- end -}}\`

**Important Template Syntax**: 
- Alert instances are uniquely identified by their set of labels
- Avoid displaying query values in labels (creates many instances)
- Labels should be stable identifiers for grouping and routing
- Use conditional logic in labels for dynamic categorization

**Dynamic Severity Example**:
Instead of creating separate rules for different thresholds, use one rule with dynamic severity:
- Query condition: \\$B > 70 (to prevent firing when severity=none)
- Severity label template: \`{{- if gt \\$values.B.Value 90.0 -}}critical{{- else if gt \\$values.B.Value 80.0 -}}warning{{- else if gt \\$values.B.Value 70.0 -}}minor{{- else -}}none{{- end -}}\`

- Use consistent naming conventions for labels
- Ensure severity levels are appropriate (critical, warning, minor, info, none) when adding dynamic labels
- Add team/service ownership when possible
${TEMPLATE_SYNTAX_GUIDELINES}`;

// Annotations-specific guidelines
export const ANNOTATIONS_GUIDELINES = `
Guidelines for annotation improvements:
1. **Standard Annotations** (always present in alert rules):
   - summary: Keep it concise (1-2 sentences), describe what is happening (key must be "${Annotation.summary}")
   - description: Provide detailed explanation, potential causes, and actionable steps (key must be "${Annotation.description}")
   - runbook_url: Add runbook links when relevant (key must be "${Annotation.runbookURL}")

2. **Custom Annotations**: Use any meaningful key name that makes sense for the context (e.g., "troubleshooting_guide", "escalation_contact", "related_metrics")

3. **Template Annotations**: Use for displaying query values and additional context:
   - Use \`{{ \\$value }}\` for the current alert value
   - Use \`{{ \\$labels.instance }}\` for label values from queries
   - Use \`{{ \\$labels.job }}\` for job names from metrics
   - Example: "CPU usage is {{ \\$value }}% on {{ \\$labels.instance }}"

- Standard annotations (${Annotation.summary}, ${Annotation.description}, ${Annotation.runbookURL}) should be improved, not added
- Annotations are safe place for query values and changing data
- Don't add urls that are not mentioned in the user request
${TEMPLATE_SYNTAX_GUIDELINES}`;

// Response format templates
export const LABELS_RESPONSE_FORMAT = `{
  "labels": [
    {"key": "severity", "value": "{{- if gt \\$values.A.Value 90.0 -}}critical{{- else if gt \\$values.A.Value 80.0 -}}warning{{- else if gt \\$values.A.Value 70.0 -}}minor{{- else -}}none{{- end -}}"},
    {"key": "team", "value": "platform"},
    {"key": "service", "value": "api"}
  ]
}`;

export const ANNOTATIONS_RESPONSE_FORMAT = `{
  "annotations": [
    {"key": "${Annotation.summary}", "value": "High CPU usage detected on {{ \\$labels.instance }}"},
    {"key": "${Annotation.description}", "value": "CPU usage is {{ \\$value }}% for more than 5 minutes. Check running processes and consider scaling."},
    {"key": "${Annotation.runbookURL}", "value": "https://wiki.company.com/runbooks/high-cpu"},
    {"key": "escalation_contact", "value": "platform-team@company.com"}
  ]
}`;

// Common improvement considerations
export const createImprovementConsiderations = (type: 'labels' | 'annotations') => {
  const baseConsiderations = `Focus on the specific improvements requested. Provide better ${type} that would make this alert more actionable and informative for the operations team.`;

  if (type === 'labels') {
    return `${baseConsiderations}

Consider adding:
- Dynamic labels using conditional logic based on query values if user request is to improve labels this way
- Team ownership labels if user request is to improve labels this way  
- Environment or service labels if user request is to improve labels this way
- Categorization labels for better routing and grouping if user request is to improve labels this way

Remember:
- Use template labels for grouping and routing (e.g., conditional severity)
- Labels should be stable identifiers, not constantly changing values
- Use conditional logic in labels for dynamic categorization
- Each unique label combination creates a separate alert instance
- if the label key already exists, improve the value, do not add a new label`;
  } else {
    return `${baseConsiderations}

Consider improving:
- Standard annotations (${Annotation.summary}, ${Annotation.description}, ${Annotation.runbookURL}) - these are always present
- Clear, concise summary annotation
- Detailed description annotation with troubleshooting steps
- Runbook URL annotation if relevant (if user request is to improve annotations, and user input mentions a runbook, add it, if not, don't update it)
- Additional custom annotations if user request is to improve annotations this way (use meaningful key names like "escalation_contact", "troubleshooting_guide", etc.)

Remember:
- Put query values in annotations (safe place for changing data)
- Use templates like {{ \\$value }} and {{ \\$labels.instance }} for dynamic content
- Standard annotations should be improved, not added
- Only add or improve specific annotations if user request is to improve annotations`;
  }
};

// Generic user prompt creator
export const createUserPrompt = (
  userInput: string,
  currentRule: RuleFormValues,
  type: 'labels' | 'annotations'
): llm.Message => {
  const currentRuleContext = buildCurrentRuleContext(currentRule);
  const improvements = createImprovementConsiderations(type);

  return {
    role: 'user',
    content: `Please improve the ${type} for the following alert rule based on this request: "${userInput}" and the current alert rule:

${currentRuleContext}

${improvements}

Return only the JSON object with the ${type} improvements.`,
  };
};
