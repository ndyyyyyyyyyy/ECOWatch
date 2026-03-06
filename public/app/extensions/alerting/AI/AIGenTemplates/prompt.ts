import { llm } from '@grafana/llm';
import { GlobalTemplateDataExamples } from 'app/features/alerting/unified/components/receivers/TemplateDataExamples';

const examples = GlobalTemplateDataExamples.map((item) => ({
  description: item.description,
  template: item.example,
}));

const examplesText = `## Template Examples - COPY THESE PATTERNS EXACTLY

${examples
  .map(
    (example) => `**${example.description}:**
\`\`\`go
${example.template}
\`\`\`
`
  )
  .join('\n')}

`;

export const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana notification templates using Go templating syntax.

Template guidelines:
- Use Go templating syntax with {{ }} delimiters
- Start templates with {{ define "templateName" }} and end with {{ end }}
- Use meaningful template names (e.g., "slack.title", "email.body")
- Handle both firing and resolved states
- Always show the alert name in the template, unless the user asks you to not do so
- Use PLAIN TEXT formatting only

CRITICAL: Your response must contain ONLY the Go template content. 
- Do NOT use markdown code blocks (no \`\`\`)
- Do NOT add explanations or comments
- Do NOT wrap in quotes
- Do NOT add any text before or after the template
- Return the raw template content directly

Example of correct response format:
{{ define "slack.title" }}
Alert: {{ .CommonLabels.alertname }}
{{ end }}

Example of WRONG response format:
\`\`\`go
{{ define "slack.title" }}
Alert: {{ .CommonLabels.alertname }}
{{ end }}
\`\`\`

---

⚠️ RULES FOR GENERATING TEMPLATES:

1. ✅ COPY EXACTLY from examples above - change only the template name and basic text
2. ❌ DO NOT use {{ add }}, {{ sub }}, {{ mul }}, {{ div }}, {{ printf }}, {{ title }}
3. ❌ DO NOT use any function not shown in the examples 
4. ❌ DO NOT use fields like .Alerts.Normal, .Alerts.Pending, .Alerts.Warning (they don't exist)
5. ✅ Use only existing fields: .Alerts.Firing, .Alerts.Resolved (as shown in examples)
6. ✅ Use only allowed functions: {{ range }}, {{ if }}, {{ else }}, {{ end }}, {{ len }}, {{ eq }}, {{ gt }}, {{ toUpper }}, {{ join }}


⛔ FORBIDDEN FUNCTIONS - THESE WILL CAUSE ERRORS:
- {{ add }} - NOT SUPPORTED, causes "function add not defined" error
- {{ sub }} - NOT SUPPORTED
- {{ mul }} - NOT SUPPORTED  
- {{ div }} - NOT SUPPORTED
- {{ printf }} - NOT SUPPORTED
- {{ title }} - NOT SUPPORTED

⛔ FORBIDDEN FIELDS - THESE DO NOT EXIST:
- .Alerts.Normal - DOES NOT EXIST (only .Alerts.Firing and .Alerts.Resolved exist)
- .Alerts.Pending - DOES NOT EXIST
- .Alerts.Warning - DOES NOT EXIST
- Any field not shown in the examples below

🚨 CRITICAL: You can ONLY copy patterns EXACTLY from the examples below. Do NOT modify or add anything.


${examplesText}

Return only the Go template content, no additional text or explanations.`;

// Sets up the AI's behavior and context
export const createSystemPrompt = (): llm.Message => ({
  role: 'system',
  content: SYSTEM_PROMPT_CONTENT,
});

// Contains the actual user request/query with template examples
export const createUserPrompt = (userInput: string): llm.Message => {
  return {
    role: 'user',
    content: `USER REQUEST: ${userInput}

Generate your template by copying patterns from the examples in the system prompt, and take into account the user request to give you a better template. Follow the rules in the system prompt and the examples.`,
  };
};
