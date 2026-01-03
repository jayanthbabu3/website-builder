/**
 * Types for the modular prompt system
 */

export interface ToolParameter {
  name: string;
  type: "string" | "boolean" | "number" | "object" | "array";
  description: string;
  required: boolean;
  example?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  usage: string;
}

export interface PromptContext {
  cwd?: string;
  hasExistingFiles?: boolean;
  fileCount?: number;
  isFollowUp?: boolean;
}

export interface SystemPromptSection {
  id: string;
  content: string | ((context: PromptContext) => string);
  order: number;
}
