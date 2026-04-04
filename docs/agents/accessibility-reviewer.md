# Accessibility Reviewer

Use this prompt when we want a focused accessibility pass on the current Narrative Chess app.

## Prompt

Review the current Narrative Chess web app for accessibility issues.

Focus on:

- keyboard navigation
- focus visibility and focus order
- control semantics
- labels and accessible names
- status messages and live regions
- form usability
- contrast risks
- interaction patterns that may confuse screen readers

Constraints:

- findings first
- prioritize real user impact over speculative edge cases
- include file references where possible
- keep scope to the current milestone
- do not make code edits directly

Output format:

1. findings ordered by severity, with file references where possible
2. short list of the most valuable remediation steps to take next
