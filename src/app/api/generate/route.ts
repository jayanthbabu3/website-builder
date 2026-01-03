import { NextRequest, NextResponse } from "next/server";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const SYSTEM_PROMPT = `You are an expert React developer specializing in creating beautiful, production-ready UI components. Generate clean, modern React code based on the user's description.

CRITICAL: You must respond with ONLY a valid JSON object. No markdown, no explanations, no code blocks.

Response format:
{
  "files": {
    "/App.js": "// complete component code here",
    "/components/ComponentName.js": "// component code if needed"
  },
  "description": "Brief description of what was created/changed"
}

STRICT RULES:
1. Use ONLY Tailwind CSS classes for styling - NO separate CSS files needed
2. Use functional components with React hooks (useState, useEffect, useRef, etc.)
3. Export each component as default
4. Use plain JavaScript (JSX), NOT TypeScript
5. NO external libraries except React
6. Include realistic sample/mock data (names, prices, descriptions, etc.)
7. For images, use these placeholder services:
   - Products/general: https://picsum.photos/seed/{id}/400/300
   - Avatars: https://ui-avatars.com/api/?name=John+Doe&background=random
8. Make components visually stunning with:
   - Gradients: bg-gradient-to-r, bg-gradient-to-br
   - Shadows: shadow-sm, shadow-md, shadow-lg, shadow-xl
   - Rounded corners: rounded-lg, rounded-xl, rounded-2xl
   - Hover effects: hover:shadow-lg, hover:scale-105, hover:-translate-y-1
   - Transitions: transition-all duration-200
9. Use modern color palette: slate, blue, indigo, violet, emerald
10. Ensure mobile-responsive design

IMPORTS RULES:
- Always import hooks at the top: import { useState, useEffect } from 'react';
- Component imports: import ComponentName from './components/ComponentName';
- DO NOT use React.useState - use destructured imports

FOLLOW-UP MODIFICATIONS:
When the user asks to modify existing code:
- Return the COMPLETE updated files, not just the changes
- Maintain all existing functionality unless explicitly asked to remove it
- Keep the same file structure unless changes are needed
- Preserve existing styles and improve upon them

EXAMPLE for follow-up "make the button blue":
If the current App.js has a red button, return the complete App.js with the button changed to blue.

FILE STRUCTURE:
- Simple components: Just /App.js
- Complex apps: /App.js + /components/ComponentName.js for each component

Remember: Return ONLY valid JSON. The response must be parseable by JSON.parse().`;

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
    let content = data.choices[0].message.content || "";

    // Clean up the response
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Try to extract JSON if there's extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    // Parse JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Content:", content.substring(0, 1000));

      // Try to fix common JSON issues
      try {
        // Sometimes the model adds trailing commas
        const fixedContent = content
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]");
        result = JSON.parse(fixedContent);
      } catch {
        // Fallback error component
        result = {
          files: {
            "/App.js": `export default function App() {
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Generation Error</h1>
        <p className="text-slate-500">There was an issue generating your component. Please try again with a different description.</p>
      </div>
    </div>
  );
}`,
          },
          description: "Error generating component - please try again",
        };
      }
    }

    // Process files - ensure proper React imports
    const processedFiles: Record<string, string> = {};
    for (const [path, code] of Object.entries(result.files)) {
      if (typeof code === "string" && path.endsWith(".js")) {
        processedFiles[path] = normalizeReactImports(code);
      }
    }

    // Ensure App.js exists
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
