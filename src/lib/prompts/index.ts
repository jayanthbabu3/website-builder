/**
 * Prompt Builder
 * Composes the system prompt from modular components
 */

import { PromptContext } from "./types";
import { AGENT_ROLE } from "./components/agent-role";
import { CAPABILITIES } from "./components/capabilities";
import { CODE_GUIDELINES } from "./components/code-guidelines";
import { getWorkflowSection } from "./components/workflow";
import { RULES } from "./components/rules";
import { EXAMPLES } from "./components/examples";
import { writeFileTool, showPreviewTool } from "./tools";

// Re-export tools
export { getToolSchemas, writeFileSchema, showPreviewSchema } from "./tools";
export type { PromptContext, ToolDefinition, ToolParameter } from "./types";

/**
 * Format tool definitions for the system prompt
 * Note: Keep this simple - detailed schemas are in the function calling interface
 */
function formatToolsSection(): string {
  return `AVAILABLE FUNCTIONS

You have access to these functions via the function calling interface:

1. writeFile(path, content, description)
   - path: File path like "/App.js" or "/components/Header.js"
   - content: Complete file code (never truncate)
   - description: Brief description of the file

2. showPreview(message)
   - message: Summary of what was built
   - MUST be called after all writeFile calls

CRITICAL FORMAT RULES:
- Use the native function calling interface (JSON tool calls)
- NEVER output XML like <function> or <writeFile> tags
- NEVER write function calls as plain text
- The system handles function execution automatically`;
}

/**
 * Build the complete system prompt
 */
export function buildSystemPrompt(context: PromptContext = {}): string {
  const sections = [
    AGENT_ROLE,
    formatToolsSection(),
    RULES,
    CODE_GUIDELINES,
    getWorkflowSection(context),
  ];

  return sections.join("\n\n");
}

/**
 * Build a compact system prompt for smaller models
 * Includes only essential information
 */
export function buildCompactSystemPrompt(context: PromptContext = {}): string {
  const compactPrompt = `You are BuilderAI, a React developer that builds web applications.

TOOLS:
1. writeFile(path, content, description) - Create/update files. Paths: /App.js, /components/Name.js, /App.css
2. showPreview(message) - MUST call after writing all files

RULES:
- Prefer Tailwind CSS classes for styling
- If you import a CSS file, create it too with writeFile
- Functional components with hooks
- Export default from each file
- Plain JavaScript (not TypeScript)
- ALWAYS use writeFile for code, ALWAYS call showPreview at the end
- For questions, respond with text only (no tools)

WORKFLOW:
${context.isFollowUp ? "1. Update only files that need changes\n2. Call showPreview" : "1. Create /App.js first\n2. Create components in /components/\n3. Add CSS files if needed\n4. Call showPreview"}

Images: https://picsum.photos/seed/{id}/{width}/{height} or user's preferred source`;

  return compactPrompt;
}

/**
 * Get the appropriate prompt based on model
 */
export function getSystemPrompt(
  model: string,
  context: PromptContext = {}
): string {
  // Use compact prompt for smaller models
  const smallModels = ["llama-3.1-8b-instant", "llama-3.2-3b", "gemma-7b"];

  if (smallModels.some((m) => model.includes(m))) {
    return buildCompactSystemPrompt(context);
  }

  return buildSystemPrompt(context);
}
