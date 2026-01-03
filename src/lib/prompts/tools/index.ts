/**
 * Tools Index
 * Exports all tool definitions and schemas
 */

export { writeFileTool, writeFileSchema } from "./write-file";
export { showPreviewTool, showPreviewSchema } from "./show-preview";

import { writeFileSchema } from "./write-file";
import { showPreviewSchema } from "./show-preview";

/**
 * Get all tool schemas for API calls
 */
export function getToolSchemas() {
  return [writeFileSchema, showPreviewSchema];
}

/**
 * Get tool schema by name
 */
export function getToolSchema(name: string) {
  const schemas: Record<string, typeof writeFileSchema | typeof showPreviewSchema> = {
    writeFile: writeFileSchema,
    showPreview: showPreviewSchema,
  };
  return schemas[name];
}
