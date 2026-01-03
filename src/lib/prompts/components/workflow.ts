/**
 * Workflow Component
 * Defines how the AI should approach tasks
 */

import { PromptContext } from "../types";

export const getWorkflowSection = (context: PromptContext): string => {
  const isFollowUp = context.isFollowUp || false;

  if (isFollowUp) {
    return `WORKFLOW (Follow-up Request)

1. ANALYZE the user's request and identify which files need changes
2. MODIFY only the files that need updates using writeFile
3. PRESERVE existing functionality unless explicitly asked to change it
4. CALL showPreview after all changes are complete

Important: For follow-up requests, only update files that need changes. Don't rewrite files that don't need modifications.`;
  }

  return `WORKFLOW (New Project)

1. ANALYZE the user's request to understand what they want to build
2. PLAN the component structure (what components are needed, how they relate)
3. CREATE files using writeFile, starting with App.js
4. BUILD additional components as separate files in /components/
5. ADD custom CSS in /App.css if needed for animations or complex styles
6. CALL showPreview with a summary of what was built

Always create files one at a time so the user can see progress. Start with the main App.js, then create supporting components.`;
};
