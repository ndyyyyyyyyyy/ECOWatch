// Labels-specific prompt content and examples
export const createLabelsPrompts = () => ({
  usage: `
- labels: Array of key-value pairs for categorization`,

  examples: `
Labels Examples:
- Severity: { "key": "severity", "value": "critical" }
- Environment: { "key": "env", "value": "production" }
- Team: { "key": "team", "value": "platform" }
- Service: { "key": "service", "value": "api" }
- Component: { "key": "component", "value": "database" }`,

  bestPractices: `
Label Best Practices:
- Use consistent key naming conventions
- Include severity levels (critical, warning, info)
- Add environment context (prod, staging, dev)
- Include team or service ownership
- Keep values concise and meaningful
- Use lowercase for consistency`,

  commonLabels: [
    { key: 'severity', values: ['critical', 'warning', 'info'] },
    { key: 'env', values: ['production', 'staging', 'development'] },
    { key: 'team', values: ['platform', 'frontend', 'backend', 'devops'] },
    { key: 'service', values: ['api', 'database', 'web', 'worker'] },
    { key: 'component', values: ['cpu', 'memory', 'disk', 'network'] },
  ],
});
