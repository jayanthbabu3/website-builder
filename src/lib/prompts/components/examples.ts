/**
 * Examples Component
 * Concrete examples of how to use tools
 */

export const EXAMPLES = `IMPORTANT BEHAVIOR

When user asks to BUILD something:
1. Use the writeFile function to create each file
2. Use showPreview function after ALL files are created
3. Do NOT output code as text - always use the writeFile function

When user asks a QUESTION (not building):
- Respond with helpful text explanation
- Do NOT use any tools

Example task: "Create a todo app"
- Call writeFile for /App.js with complete todo app code
- Call showPreview with summary message

Example question: "How do React hooks work?"
- Just respond with text explanation, no tools needed`;
