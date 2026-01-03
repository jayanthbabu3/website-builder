/**
 * showPreview Tool Definition
 * Signals that all files are ready and preview should be displayed
 */

import { ToolDefinition } from "../types";

export const showPreviewTool: ToolDefinition = {
  name: "showPreview",
  description:
    "Display the live preview to the user. This MUST be called after all files have been written. Include a brief summary of what was created.",
  parameters: [
    {
      name: "message",
      type: "string",
      description:
        "A brief summary (1-2 sentences) of what was built. Describe the main features and components created. This message is shown to the user.",
      required: true,
      example:
        "Created a portfolio website with hero section, projects grid, and contact form with form validation.",
    },
  ],
  usage: `<showPreview>
  <message>Created a responsive landing page with animated hero section, feature cards, and newsletter signup form.</message>
</showPreview>`,
};

/**
 * OpenAI/Groq function calling schema for showPreview
 */
export const showPreviewSchema = {
  type: "function" as const,
  function: {
    name: "showPreview",
    description:
      "Display the live preview. REQUIRED - must be called after all writeFile calls are complete.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description:
            "Brief summary of what was built, e.g. 'Created a portfolio with hero, projects, and contact sections'",
        },
      },
      required: ["message"],
    },
  },
};
