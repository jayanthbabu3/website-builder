/**
 * writeFile Tool Definition
 * Creates or updates files in the project
 */

import { ToolDefinition } from "../types";

export const writeFileTool: ToolDefinition = {
  name: "writeFile",
  description:
    "Create or update a file in the project. If the file exists, it will be overwritten. If it doesn't exist, it will be created. Use this tool for ALL code creation and modifications.",
  parameters: [
    {
      name: "path",
      type: "string",
      description:
        "The file path starting with /. Valid paths: /App.js (main component), /components/Name.js (child components), /App.css (custom styles)",
      required: true,
      example: "/App.js or /components/Header.js or /App.css",
    },
    {
      name: "content",
      type: "string",
      description:
        "The COMPLETE file content. You MUST provide the entire file content, never truncate or use placeholders. Include all imports, component code, and exports.",
      required: true,
      example: "import { useState } from 'react';\n\nexport default function App() {\n  return <div>Hello</div>;\n}",
    },
    {
      name: "description",
      type: "string",
      description:
        "A brief description of what this file does or what changes were made. This is shown to the user.",
      required: false,
      example: "Main app component with navigation and hero section",
    },
  ],
  usage: `<writeFile>
  <path>/App.js</path>
  <content>
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Count: {count}
      </button>
    </div>
  );
}
  </content>
  <description>Simple counter component</description>
</writeFile>`,
};

/**
 * OpenAI/Groq function calling schema for writeFile
 */
export const writeFileSchema = {
  type: "function" as const,
  function: {
    name: "writeFile",
    description:
      "Create or update a file. MUST be used for any code creation. Call this function - do not output code as text.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "File path. Use: /App.js for main component, /components/Name.js for other components, /App.css for styles",
        },
        content: {
          type: "string",
          description:
            "The COMPLETE source code for the file. Include all imports, the full component code, and exports. Never use placeholders or truncation.",
        },
        description: {
          type: "string",
          description: "One sentence describing what this file does",
        },
      },
      required: ["path", "content"],
    },
  },
};
