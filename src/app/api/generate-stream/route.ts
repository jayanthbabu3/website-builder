import { NextRequest } from "next/server";
import { getSystemPrompt, getToolSchemas } from "@/lib/prompts";

/**
 * Streaming API Route for AI Website Builder
 * Uses modular prompt system and tool calling
 */

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface StreamEvent {
  type: "thinking" | "writeFile" | "showPreview" | "text" | "error" | "done";
  path?: string;
  content?: string;
  message?: string;
}

// Available models with fallback chain
const MODELS = [
  { id: "llama-3.3-70b-versatile", maxTokens: 8000 },
  { id: "llama-3.1-8b-instant", maxTokens: 4000 },
];

/**
 * Extract CSS import paths from code
 * Returns array of CSS file paths that are imported
 */
function extractCssImports(code: string, filePath: string): string[] {
  const cssImports: string[] = [];

  // Match import statements for CSS files
  // Patterns: import './File.css' or import "./File.css"
  const importRegex = /import\s+['"](.+\.css)['"]/g;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1];

    // Convert relative import to absolute path
    if (importPath.startsWith('./')) {
      // Get directory of current file
      const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
      const cssPath = fileDir + importPath.substring(1); // Remove the '.'
      cssImports.push(cssPath);
    } else if (!importPath.startsWith('/')) {
      // Relative without ./
      const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
      const cssPath = fileDir + '/' + importPath;
      cssImports.push(cssPath);
    } else {
      cssImports.push(importPath);
    }
  }

  return cssImports;
}

/**
 * Generate a basic CSS file with common styles for a component
 */
function generatePlaceholderCss(cssPath: string): string {
  const componentName = cssPath
    .split('/')
    .pop()
    ?.replace('.css', '') || 'component';

  // Generate basic CSS with the component name as class prefix
  const className = componentName.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '');

  return `/* Auto-generated styles for ${componentName} */
.${className} {
  /* Add custom styles here */
}
`;
}

/**
 * Fix common code issues from LLM output
 */
function sanitizeCode(code: string): string {
  let fixed = code;

  // Fix "default ComponentName()" -> "function ComponentName()"
  // This is a common LLM mistake where the model outputs:
  // - "default Footer() {" instead of "function Footer() {"
  // - "export default Footer() {" instead of "export default function Footer() {"
  fixed = fixed.replace(/^default\s+(\w+)\s*\(/gm, "function $1(");
  fixed = fixed.replace(/^export\s+default\s+(\w+)\s*\(/gm, "export default function $1(");
  fixed = fixed.replace(/\nexport\s+default\s+(\w+)\s*\(/gm, "\nexport default function $1(");
  fixed = fixed.replace(/\ndefault\s+(\w+)\s*\(/gm, "\nfunction $1(");

  // Fix mismatched quotes in JSX attributes (className='...' with " at end)
  fixed = fixed.replace(/className='([^']*?)"\s*>/g, 'className="$1">');
  fixed = fixed.replace(/className="([^"]*?)'\s*>/g, 'className="$1">');

  // Fix any other attribute with mismatched quotes
  fixed = fixed.replace(/(\w+)='([^']*?)"\s*>/g, '$1="$2">');
  fixed = fixed.replace(/(\w+)="([^"]*?)'\s*>/g, '$1="$2">');

  // Ensure consistent quote usage - convert single quotes in JSX to double
  fixed = fixed.replace(/className='([^']*)'/g, 'className="$1"');

  // Fix missing 'function' keyword before component name
  // Pattern: starts with component name followed by () {
  fixed = fixed.replace(/^(\s*)(\w+)\s*\(\)\s*\{/gm, (match, indent, name) => {
    // Only fix if it looks like a component (PascalCase)
    if (name[0] === name[0].toUpperCase() && !match.includes("function")) {
      return `${indent}function ${name}() {`;
    }
    return match;
  });

  return fixed;
}

/**
 * Parse tool call arguments with error recovery
 */
function parseToolArguments(args: string): Record<string, unknown> | null {
  try {
    return JSON.parse(args);
  } catch {
    // Try to fix common JSON issues (unescaped newlines, etc.)
    try {
      const fixed = args
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
      return JSON.parse(fixed);
    } catch {
      // Try to extract content manually for writeFile
      const pathMatch = args.match(/"path"\s*:\s*"([^"]+)"/);
      const descMatch = args.match(/"description"\s*:\s*"([^"]+)"/);

      // For content, we need a more robust extraction
      const contentStart = args.indexOf('"content"');
      if (contentStart !== -1 && pathMatch) {
        // Find the content value
        const afterContent = args.slice(contentStart);
        const colonPos = afterContent.indexOf(":");
        if (colonPos !== -1) {
          const valueStart = afterContent.indexOf('"', colonPos) + 1;
          // Find the closing quote (not escaped)
          let valueEnd = valueStart;
          let escaped = false;
          for (let i = valueStart; i < afterContent.length; i++) {
            if (escaped) {
              escaped = false;
              continue;
            }
            if (afterContent[i] === "\\") {
              escaped = true;
              continue;
            }
            if (afterContent[i] === '"') {
              valueEnd = i;
              break;
            }
          }
          const content = afterContent
            .slice(valueStart, valueEnd)
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\t/g, "\t");

          return {
            path: pathMatch[1],
            content,
            description: descMatch?.[1],
          };
        }
      }

      console.error(
        "Failed to parse tool arguments:",
        args.substring(0, 500)
      );
      return null;
    }
  }
}

/**
 * Make API request to Groq with model fallback and retry logic
 */
async function callGroqAPI(
  messages: Message[],
  tools: ReturnType<typeof getToolSchemas>,
  isFollowUp: boolean,
  retryCount: number = 0
): Promise<{ data: unknown; model: string } | { error: string }> {
  let lastError = "";
  const MAX_RETRIES = 2;

  for (const model of MODELS) {
    // Get model-appropriate system prompt
    const systemPrompt = getSystemPrompt(model.id, { isFollowUp });

    // Build messages with system prompt
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.slice(1), // Skip the placeholder system message
    ];

    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: model.id,
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: model.maxTokens,
            tools,
            tool_choice: "auto",
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`Successfully used model: ${model.id}`);
        return { data, model: model.id };
      }

      const errorText = await response.text();

      // Check for rate limit - try next model
      if (
        errorText.includes("rate_limit") ||
        errorText.includes("Rate limit")
      ) {
        console.log(`Rate limited on ${model.id}, trying next model...`);
        lastError = `Rate limited on ${model.id}`;
        continue;
      }

      // Check for tool_use_failed error - model output wrong format
      // Retry with lower temperature to get more consistent output
      if (errorText.includes("tool_use_failed")) {
        console.warn(`Tool use failed on ${model.id}, retry ${retryCount + 1}/${MAX_RETRIES}`);
        if (retryCount < MAX_RETRIES) {
          // Wait a moment and retry
          await new Promise(resolve => setTimeout(resolve, 500));
          return callGroqAPI(messages, tools, isFollowUp, retryCount + 1);
        }
        lastError = "Model failed to use tools correctly. Please try a simpler request.";
        continue;
      }

      // Other error
      lastError = errorText;
      console.error(`Error from ${model.id}:`, errorText.substring(0, 200));
    } catch (err) {
      console.error(`Network error with ${model.id}:`, err);
      lastError = err instanceof Error ? err.message : "Network error";
      continue;
    }
  }

  return { error: lastError || "All models failed" };
}

/**
 * Stream helper to send events
 */
function createEventSender(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  return (event: StreamEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, currentFiles, conversationHistory } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Determine if this is a follow-up request
    const isFollowUp =
      (conversationHistory && conversationHistory.length > 0) ||
      (currentFiles && Object.keys(currentFiles).length > 1);

    // Build messages
    const messages: Message[] = [
      { role: "system", content: "" }, // Placeholder, will be replaced
    ];

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    // Build user prompt with file context
    let userPrompt = prompt;
    if (currentFiles && Object.keys(currentFiles).length > 0) {
      const filesContext = Object.entries(currentFiles)
        .map(([path, content]) => {
          const truncated =
            (content as string).length > 3000
              ? (content as string).substring(0, 3000) + "\n... (truncated)"
              : content;
          return `File: ${path}\n\`\`\`\n${truncated}\n\`\`\``;
        })
        .join("\n\n");
      userPrompt = `CURRENT PROJECT FILES:\n${filesContext}\n\nUSER REQUEST: ${prompt}`;
    }

    messages.push({ role: "user", content: userPrompt });

    // Get tool schemas
    const tools = getToolSchemas();

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = createEventSender(controller, encoder);

        try {
          // Send initial thinking message
          sendEvent({ type: "thinking", message: "Analyzing your request..." });

          // Call Groq API with fallback
          const result = await callGroqAPI(messages, tools, isFollowUp);

          if ("error" in result) {
            sendEvent({ type: "error", message: result.error });
            sendEvent({ type: "done" });
            controller.close();
            return;
          }

          const data = result.data as {
            choices: Array<{
              message: {
                content?: string;
                tool_calls?: Array<{
                  function: { name: string; arguments: string };
                }>;
              };
            }>;
          };

          const message = data.choices[0]?.message;

          if (!message) {
            sendEvent({ type: "error", message: "No response from model" });
            sendEvent({ type: "done" });
            controller.close();
            return;
          }

          // Handle text response (for chat/questions)
          if (message.content && !message.tool_calls) {
            // Check if model incorrectly output tool calls as text
            if (
              message.content.includes("<writeFile>") ||
              message.content.includes("writeFile(") ||
              message.content.includes('"path":') ||
              message.content.includes("```")
            ) {
              // Model confused - try to extract and use the content
              console.warn("Model output code as text instead of using tools");
              sendEvent({
                type: "error",
                message:
                  "I encountered an issue. Please try again with a simpler request.",
              });
              sendEvent({ type: "done" });
              controller.close();
              return;
            }

            sendEvent({ type: "text", content: message.content });
            sendEvent({ type: "done" });
            controller.close();
            return;
          }

          // Handle tool calls
          if (message.tool_calls && message.tool_calls.length > 0) {
            sendEvent({
              type: "thinking",
              message: "Building your application...",
            });

            let hasWrittenFiles = false;
            let hasCalledShowPreview = false;
            const createdFiles = new Set<string>();
            const requiredCssFiles = new Set<string>();

            for (const toolCall of message.tool_calls) {
              const functionName = toolCall.function.name;
              const args = parseToolArguments(toolCall.function.arguments);

              if (!args) {
                console.error("Skipping tool call due to parse error");
                continue;
              }

              if (functionName === "writeFile") {
                hasWrittenFiles = true;
                const filePath = args.path as string;
                const rawContent = args.content as string;

                // Track created files
                createdFiles.add(filePath);

                // Extract CSS imports from this file
                const cssImports = extractCssImports(rawContent, filePath);
                cssImports.forEach(css => requiredCssFiles.add(css));

                // Sanitize the code to fix common LLM issues
                const sanitizedContent = sanitizeCode(rawContent);
                sendEvent({
                  type: "writeFile",
                  path: filePath,
                  content: sanitizedContent,
                  message:
                    (args.description as string) || `Creating ${filePath}`,
                });

                // Small delay for visual effect
                await new Promise((resolve) => setTimeout(resolve, 150));
              } else if (functionName === "showPreview") {
                hasCalledShowPreview = true;
                sendEvent({
                  type: "showPreview",
                  message: (args.message as string) || "Your app is ready!",
                });
              }
            }

            // Auto-create any missing CSS files that were imported but not created
            for (const cssPath of requiredCssFiles) {
              if (!createdFiles.has(cssPath)) {
                console.log(`Auto-creating missing CSS file: ${cssPath}`);
                const placeholderCss = generatePlaceholderCss(cssPath);
                sendEvent({
                  type: "writeFile",
                  path: cssPath,
                  content: placeholderCss,
                  message: `Creating ${cssPath} (auto-generated)`,
                });
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            }

            // Auto-trigger showPreview if files were written but it wasn't called
            if (hasWrittenFiles && !hasCalledShowPreview) {
              sendEvent({
                type: "showPreview",
                message: "Your app is ready!",
              });
            }

            // Also send any text content from the assistant
            if (message.content) {
              sendEvent({ type: "text", content: message.content });
            }
          }

          sendEvent({ type: "done" });
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          sendEvent({
            type: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
          sendEvent({ type: "done" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
