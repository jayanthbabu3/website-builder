import { NextRequest, NextResponse } from "next/server";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const SYSTEM_PROMPT = `You are an expert React developer and helpful assistant.

IMPORTANT: First determine if the user wants CODE GENERATION or just a CHAT response.

CODE GENERATION requests include: "create", "build", "make", "add", "update", "change", "modify", "fix" + component/feature descriptions.
CHAT requests include: questions, explanations, "how to", "what is", "help with", general conversation.

FOR CODE GENERATION - Respond with JSON:
{"type": "code", "files": {"/App.js": "code"}, "description": "brief description"}

FOR CHAT/QUESTIONS - Respond with JSON:
{"type": "chat", "message": "Your helpful response here"}

CODE RULES (when generating code):
1. Use Tailwind CSS for styling
2. Functional components with hooks (useState, useEffect)
3. Export each component as default
4. Plain JavaScript (JSX), not TypeScript
5. No external libraries except React
6. Include realistic mock data
7. Images: https://picsum.photos/seed/{id}/400/300 or https://ui-avatars.com/api/?name=Name&background=random
8. Modern design: gradients, shadows, rounded corners, hover effects, transitions
9. Mobile-responsive

IMPORTS: import { useState, useEffect } from 'react';

For code follow-ups: Return ALL complete files.

ALWAYS respond with valid JSON only.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, currentFiles, conversationHistory } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Build messages array with conversation history
    const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    // Add current files context if this is a follow-up
    let userPrompt = prompt;
    if (currentFiles && Object.keys(currentFiles).length > 0) {
      const filesContext = Object.entries(currentFiles)
        .map(([path, content]) => `File: ${path}\n\`\`\`jsx\n${content}\n\`\`\``)
        .join("\n\n");

      userPrompt = `CURRENT PROJECT FILES:\n${filesContext}\n\nUSER REQUEST: ${prompt}\n\nPlease update the code based on the user's request. Return ALL files (modified and unmodified) in the response.`;
    } else {
      userPrompt = `Create a new React application for: ${prompt}`;
    }

    messages.push({ role: "user", content: userPrompt });

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7,
          max_tokens: 8000,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Groq API error response:", error);
      throw new Error(`Groq API error: ${response.status} - ${error.substring(0, 500)}`);
    }

    const data = await response.json();

    // Check for truncation (finish_reason !== 'stop' means incomplete)
    const finishReason = data.choices[0]?.finish_reason;
    const wasLengthLimited = finishReason === 'length';

    if (wasLengthLimited) {
      console.warn("Response was truncated due to token limit");
    }

    let content = data.choices[0].message.content || "";

    // Log response stats for debugging
    console.log("Response stats:", {
      finishReason,
      contentLength: content.length,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens
    });

    // Clean up the response
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Try to extract JSON if there's extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    // Fix template literals (backticks) used instead of quotes
    // The LLM sometimes uses backticks for multiline strings which is invalid JSON
    content = fixBackticksInJson(content);

    // Fix unescaped newlines inside JSON strings
    // The LLM sometimes returns multiline code inside JSON strings without proper escaping
    content = fixJsonStringNewlines(content);

    // Parse JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Content (first 1000 chars):", content.substring(0, 1000));
      console.error("Content (last 500 chars):", content.substring(content.length - 500));

      // Try to fix common JSON issues
      try {
        // Sometimes the model adds trailing commas
        let fixedContent = content
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]");

        // If response was truncated, try to close incomplete JSON
        if (wasLengthLimited) {
          // Check if we have a truncated file content
          const lastQuoteIndex = fixedContent.lastIndexOf('"');
          if (lastQuoteIndex > 0) {
            // Try to close the JSON properly
            const beforeLastQuote = fixedContent.substring(0, lastQuoteIndex + 1);
            // Count open braces
            const openBraces = (beforeLastQuote.match(/\{/g) || []).length;
            const closeBraces = (beforeLastQuote.match(/\}/g) || []).length;
            const needClosing = openBraces - closeBraces;

            if (needClosing > 0) {
              // Add description if missing and close braces
              if (!beforeLastQuote.includes('"description"')) {
                fixedContent = beforeLastQuote + ', "description": "Generated (response was truncated)"' + '}'.repeat(needClosing);
              } else {
                fixedContent = beforeLastQuote + '}'.repeat(needClosing);
              }
            }
          }
        }

        result = JSON.parse(fixedContent);
      } catch {
        // Fallback error component with more details
        const errorReason = wasLengthLimited
          ? "The response was too long and got truncated. Try a simpler prompt."
          : "There was an issue generating your component. Please try again.";

        result = {
          files: {
            "/App.js": `export default function App() {
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Generation Error</h1>
        <p className="text-slate-500">${errorReason}</p>
      </div>
    </div>
  );
}`,
          },
          description: errorReason,
        };
      }
    }

    // Check if this is a chat response or code response
    if (result.type === "chat") {
      return NextResponse.json({
        type: "chat",
        message: result.message || "I'm here to help!",
      });
    }

    // Process files - ensure proper React imports
    const processedFiles: Record<string, string> = {};
    if (result.files) {
      for (const [path, code] of Object.entries(result.files)) {
        if (typeof code === "string" && path.endsWith(".js")) {
          processedFiles[path] = normalizeReactImports(code);
        }
      }
    }

    // Ensure App.js exists for code responses
    if (!processedFiles["/App.js"]) {
      processedFiles["/App.js"] = `export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <p className="text-slate-500">No component generated</p>
    </div>
  );
}`;
    }

    return NextResponse.json({
      type: "code",
      files: processedFiles,
      description: result.description || "Generated successfully",
    });
  } catch (error) {
    console.error("Error generating code:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate code: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Fix backticks used as string delimiters (convert to double quotes)
function fixBackticksInJson(jsonStr: string): string {
  // Replace backtick strings with double-quoted strings
  // This handles cases where LLM uses template literals in JSON
  let result = '';
  let i = 0;

  while (i < jsonStr.length) {
    // Check if we're at a backtick that starts a string value
    if (jsonStr[i] === '`') {
      // Find the closing backtick
      let j = i + 1;
      let content = '';

      while (j < jsonStr.length && jsonStr[j] !== '`') {
        if (jsonStr[j] === '\\' && j + 1 < jsonStr.length) {
          content += jsonStr[j] + jsonStr[j + 1];
          j += 2;
        } else {
          content += jsonStr[j];
          j++;
        }
      }

      // Convert to double-quoted string with proper escaping
      const escaped = content
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');

      result += '"' + escaped + '"';
      i = j + 1;
    } else {
      result += jsonStr[i];
      i++;
    }
  }

  return result;
}

// Fix unescaped newlines inside JSON string values
function fixJsonStringNewlines(jsonStr: string): string {
  // This regex finds content between quotes that contains actual newlines
  // and replaces those newlines with \n escape sequences
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && char === '\n') {
      result += '\\n';
      continue;
    }

    if (inString && char === '\r') {
      result += '\\r';
      continue;
    }

    if (inString && char === '\t') {
      result += '\\t';
      continue;
    }

    result += char;
  }

  return result;
}

function normalizeReactImports(code: string): string {
  // Replace React.useState, React.useEffect, etc. with direct hook calls
  code = code.replace(
    /React\.(useState|useEffect|useRef|useMemo|useCallback|useContext|useReducer)/g,
    "$1"
  );

  // Check which hooks are used
  const usedHooks: string[] = [];
  const hookNames = [
    "useState",
    "useEffect",
    "useRef",
    "useMemo",
    "useCallback",
    "useContext",
    "useReducer",
  ];

  for (const hook of hookNames) {
    // Check if hook is used (followed by parenthesis)
    const hookRegex = new RegExp(`\\b${hook}\\s*\\(`);
    if (hookRegex.test(code) && !usedHooks.includes(hook)) {
      usedHooks.push(hook);
    }
  }

  // Check if proper imports exist
  const hasReactImport =
    code.includes("from 'react'") || code.includes('from "react"');

  if (usedHooks.length > 0) {
    if (!hasReactImport) {
      // Add import at the beginning
      code = `import { ${usedHooks.join(", ")} } from 'react';\n\n${code}`;
    } else {
      // Check if all hooks are imported
      const importMatch = code.match(
        /import\s*\{([^}]*)\}\s*from\s*['"]react['"]/
      );
      if (importMatch) {
        const currentImports = importMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const missingHooks = usedHooks.filter(
          (h) => !currentImports.includes(h)
        );

        if (missingHooks.length > 0) {
          const allImports = [...new Set([...currentImports, ...missingHooks])];
          code = code.replace(
            /import\s*\{[^}]*\}\s*from\s*['"]react['"]/,
            `import { ${allImports.join(", ")} } from 'react'`
          );
        }
      }
    }
  }

  return code;
}
