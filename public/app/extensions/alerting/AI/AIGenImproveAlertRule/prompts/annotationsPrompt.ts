// Annotations-specific prompt content and examples
export const createAnnotationsPrompts = () => ({
  usage: `
- annotations: Array of key-value pairs for additional information`,

  examples: `
Annotations Examples:
- Summary: { "key": "summary", "value": "High CPU usage detected" }
- Description: { "key": "description", "value": "CPU usage is above 80% for more than 5 minutes" }
- Runbook: { "key": "runbook_url", "value": "https://wiki.company.com/runbooks/high-cpu" }
- Dashboard: { "key": "dashboard_url", "value": "https://grafana.company.com/d/cpu-dashboard" }

Template Variable Examples:
- With labels: { "key": "summary", "value": "High CPU usage on {{ $labels.instance }}" }
- With values: { "key": "description", "value": "Current CPU usage is {{ $value }}%" }
- Combined: { "key": "summary", "value": "{{ $labels.alertname }} triggered on {{ $labels.instance }} with value {{ $value }}" }`,

  bestPractices: `
Annotation Best Practices:
- Always include a clear summary
- Provide detailed description with context
- Add runbook URLs for troubleshooting steps
- Include dashboard links for investigation
- Use consistent key naming
- Keep descriptions actionable and specific

Template Variable Syntax:
- Use {{ $labels.labelname }} for label values (DO NOT escape the $)
- Use {{ $value }} for alert value (DO NOT escape the $)
- Use {{ $labels.instance }} for instance names (DO NOT escape the $)
- CORRECT: "{{ $labels.instance }}" 
- INCORRECT: "{{ \\$labels.instance }}" (do not escape the dollar sign)`,

  standardAnnotations: [
    {
      key: 'summary',
      description: 'Brief description of the alert condition',
      required: true,
    },
    {
      key: 'description',
      description: 'Detailed explanation of what the alert means and potential impact',
      required: true,
    },
    {
      key: 'runbook_url',
      description: 'Link to troubleshooting documentation or runbook: only update it if user input mentions a runbook',
      required: false,
    },
    {
      key: 'dashboard_url',
      description:
        'Link to relevant dashboard for investigation: only update it if user input mentions a dashboard url',
      required: false,
    },
    {
      key: 'documentation_url',
      description: 'Link to additional documentation, only update it if user input mentions a documentation url',
      required: false,
    },
  ],
});
