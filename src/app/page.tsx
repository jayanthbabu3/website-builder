"use client";

import { useState, useRef, useEffect, lazy, Suspense, useMemo, useCallback } from "react";
import { getExpandedProjectFiles } from "@/lib/webcontainer-files";

// Lazy load WebContainerPreview to avoid SSR issues
const WebContainerPreview = lazy(
  () => import("@/components/WebContainerPreview")
);

// Lazy load CodeEditor to avoid SSR issues with CodeMirror
const CodeEditor = lazy(() => import("@/components/CodeEditor"));

// Helper to detect language from file path
function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "js": return "javascript";
    case "jsx": return "jsx";
    case "ts": return "typescript";
    case "tsx": return "tsx";
    case "json": return "json";
    case "css": return "css";
    case "html": return "html";
    default: return "javascript";
  }
}

const DEFAULT_FILES: Record<string, string> = {
  "/App.js": `export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/25">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-4xl font-semibold text-slate-900 mb-4 tracking-tight">
          Ready to Build
        </h1>
        <p className="text-slate-500 max-w-md text-lg leading-relaxed">
          Describe what you want to create and watch your app come to life instantly.
        </p>
      </div>
    </div>
  );
}`,
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Record<string, string>;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<Record<string, string>>(DEFAULT_FILES);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [activeFile, setActiveFile] = useState("/src/App.jsx");
  const [showFullProject, setShowFullProject] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get expanded project files for display
  const displayFiles = useMemo(() => {
    if (showFullProject) {
      return getExpandedProjectFiles(files);
    }
    return files;
  }, [files, showFullProject]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset active file when displayFiles change if current file doesn't exist
  useEffect(() => {
    if (!displayFiles[activeFile]) {
      const newActiveFile = Object.keys(displayFiles).find(f => f.includes("App")) || Object.keys(displayFiles)[0];
      if (newActiveFile) {
        setActiveFile(newActiveFile);
      }
    }
  }, [displayFiles, activeFile]);

  // Handle code changes from the editor
  const handleCodeChange = useCallback((newCode: string) => {
    // Map the display file path back to the original file path
    // For full project view, we need to update the source files
    if (showFullProject) {
      // Map /src/App.jsx -> /App.js, /src/components/X.jsx -> /components/X.js
      let sourceFilePath = activeFile;
      if (activeFile === "/src/App.jsx") {
        sourceFilePath = "/App.js";
      } else if (activeFile.startsWith("/src/components/")) {
        sourceFilePath = activeFile.replace("/src/components/", "/components/").replace(".jsx", ".js");
      } else {
        // For config files, don't update source files
        return;
      }
      setFiles(prev => ({ ...prev, [sourceFilePath]: newCode }));
    } else {
      setFiles(prev => ({ ...prev, [activeFile]: newCode }));
    }
  }, [activeFile, showFullProject]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentPrompt = prompt;
    setPrompt("");
    setIsLoading(true);

    // Determine if this is a follow-up (we have existing non-default files)
    const isFollowUp = messages.length > 0;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: currentPrompt,
          currentFiles: isFollowUp ? files : undefined,
          // Only send last 4 messages to avoid token limits, and don't include full file contents
          conversationHistory: messages.slice(-4).map((m) => ({
            role: m.role,
            content: m.content, // Just the description, files are sent via currentFiles
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate code");
      }

      setFiles(data.files);

      const fileCount = Object.keys(data.files).length;
      const fileList = Object.keys(data.files)
        .map((f) => f.replace("/", ""))
        .join(", ");

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          fileCount > 1
            ? `Done! I've created ${fileCount} files: ${fileList}. ${data.description}`
            : `Done! ${data.description}`,
        files: data.files,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Something went wrong"}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const suggestions = [
    {
      icon: "🏠",
      text: "Dashboard with sidebar and stats",
      desc: "Multi-component layout",
    },
    {
      icon: "🛒",
      text: "E-commerce product page",
      desc: "Product card, gallery, cart",
    },
    {
      icon: "📝",
      text: "Blog with posts and comments",
      desc: "Multiple sections",
    },
    {
      icon: "🔐",
      text: "Login form with validation",
      desc: "Single component",
    },
  ];

  const fileCount = Object.keys(displayFiles).length;
  const fileList = Object.keys(displayFiles).sort((a, b) => {
    // Sort: config files first, then src files, then components
    const order = (path: string) => {
      if (path.startsWith("/src/components")) return 3;
      if (path.startsWith("/src")) return 2;
      return 1;
    };
    return order(a) - order(b) || a.localeCompare(b);
  });

  return (
    <div className="h-screen flex flex-col bg-[#fafafa] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
      {/* Header */}
      <header className="h-16 bg-gradient-to-r from-[#0078d4] to-[#0063b1] flex items-center px-6 shadow-lg shadow-blue-900/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <span className="text-white font-semibold text-lg tracking-tight">
              Component Builder
            </span>
            <span className="text-white/60 text-sm ml-2 font-normal">
              by AI
            </span>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {fileCount > 1 && (
            <span className="px-3 py-1.5 bg-white/15 rounded-lg text-white/90 text-sm border border-white/20">
              {fileCount} files
            </span>
          )}
          <button
            onClick={() => setShowCode(!showCode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              showCode
                ? "bg-white text-[#0078d4] shadow-lg"
                : "bg-white/15 text-white hover:bg-white/25 border border-white/20"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            {showCode ? "Hide Code" : "View Code"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat */}
        <div className="w-[420px] bg-white border-r border-slate-200/80 flex flex-col shadow-xl shadow-slate-200/50">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8 py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-[#0078d4]/10 to-[#00bcf2]/10 rounded-3xl flex items-center justify-center mb-6 border border-[#0078d4]/10">
                  <svg
                    className="w-10 h-10 text-[#0078d4]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-3 tracking-tight">
                  What would you like to build?
                </h2>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-[280px]">
                  Describe your project and I&apos;ll generate a complete React
                  application with full CSS support.
                </p>
                <div className="w-full space-y-3">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setPrompt(suggestion.text)}
                      className="w-full p-4 text-left bg-slate-50/80 hover:bg-gradient-to-r hover:from-[#0078d4]/5 hover:to-[#00bcf2]/5 border border-slate-200/80 hover:border-[#0078d4]/30 rounded-2xl transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{suggestion.icon}</span>
                        <div>
                          <span className="text-slate-800 font-medium group-hover:text-[#0078d4] block transition-colors">
                            {suggestion.text}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {suggestion.desc}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-[#0078d4] to-[#0063b1] text-white shadow-lg shadow-blue-500/20"
                          : "bg-slate-100 text-slate-800 border border-slate-200/50"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      {message.files && Object.keys(message.files).length > 1 && (
                        <div className="mt-3 pt-3 border-t border-slate-200/50">
                          <p className="text-xs text-slate-500 mb-2">
                            Project structure:
                          </p>
                          <div className="space-y-1">
                            {Object.keys(message.files).map((file) => (
                              <div
                                key={file}
                                className="flex items-center gap-2 text-xs text-slate-600"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                                <span className="font-mono">{file}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {message.files && (
                        <button
                          onClick={() => setShowCode(true)}
                          className="mt-2 text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
                        >
                          View code →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 border border-slate-200/50 rounded-2xl px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <span
                            className="w-2.5 h-2.5 bg-[#0078d4] rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="w-2.5 h-2.5 bg-[#0078d4] rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="w-2.5 h-2.5 bg-[#0078d4] rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                        <span className="text-sm text-slate-500 font-medium">
                          Generating project...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-5 border-t border-slate-200/80 bg-gradient-to-t from-slate-50 to-white">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your component or project..."
                rows={3}
                className="w-full px-4 py-3.5 pr-14 bg-white border border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-transparent resize-none text-sm shadow-sm transition-shadow focus:shadow-lg focus:shadow-blue-500/10"
              />
              <button
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className="absolute right-3 bottom-3 w-10 h-10 bg-gradient-to-r from-[#0078d4] to-[#0063b1] hover:from-[#106ebe] hover:to-[#0078d4] disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all duration-200 shadow-lg shadow-blue-500/25 disabled:shadow-none"
              >
                {isLoading ? (
                  <svg
                    className="w-5 h-5 text-white animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400 text-center font-medium">
              Press{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600 text-[10px]">
                Enter
              </kbd>{" "}
              to send ·{" "}
              <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600 text-[10px]">
                Shift + Enter
              </kbd>{" "}
              for new line
            </p>
          </div>
        </div>

        {/* Right Panel - Preview & Code */}
        <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-100 via-slate-50 to-white">
          {/* Preview Header */}
          <div className="h-14 bg-white/80 backdrop-blur-sm border-b border-slate-200/80 flex items-center px-6 justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
              </div>
              <span className="text-sm text-slate-500 font-medium ml-2">
                Live Preview
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Full Vite + React Environment</span>
            </div>
          </div>

          {/* Preview/Code Container */}
          <div className="flex-1 flex min-h-0">
            {/* File Explorer & Code Editor */}
            {showCode && (
              <div className="w-[520px] flex flex-col border-r border-[#3c3c3c] bg-[#1e1e1e]">
                {/* Explorer Header */}
                <div className="h-9 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between px-3">
                  <span className="text-xs font-medium text-[#cccccc] uppercase tracking-wider">
                    Explorer
                  </span>
                  <button
                    onClick={() => setShowFullProject(!showFullProject)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      showFullProject
                        ? "bg-[#0078d4] text-white"
                        : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                    }`}
                  >
                    {showFullProject ? "Full Project" : "Generated Only"}
                  </button>
                </div>
                {/* File Tabs - VS Code style */}
                <div className="bg-[#252526] border-b border-[#3c3c3c] flex items-center overflow-x-auto">
                  {fileList.map((file) => {
                    const fileName = file.replace(/^\//, "").replace("src/", "");
                    const isActive = activeFile === file;
                    const ext = file.split(".").pop() || "";

                    // File icon colors based on extension
                    const iconColor = {
                      js: "#f7df1e",
                      jsx: "#61dafb",
                      ts: "#3178c6",
                      tsx: "#3178c6",
                      json: "#cbcb41",
                      css: "#563d7c",
                      html: "#e34c26",
                    }[ext] || "#cccccc";

                    return (
                      <button
                        key={file}
                        onClick={() => setActiveFile(file)}
                        className={`group flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-r border-[#3c3c3c] transition-colors ${
                          isActive
                            ? "bg-[#1e1e1e] text-white border-t-2 border-t-[#0078d4]"
                            : "bg-[#2d2d2d] text-[#969696] hover:text-[#cccccc] hover:bg-[#2a2a2a]"
                        }`}
                        style={{ borderTopWidth: isActive ? "2px" : "0" }}
                      >
                        <span style={{ color: iconColor }}>
                          {ext === "json" ? "{}" : ext === "html" ? "<>" : ext === "css" ? "#" : "JS"}
                        </span>
                        <span>{fileName}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Code Editor */}
                <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
                  <Suspense
                    fallback={
                      <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
                        <div className="text-slate-400 text-sm">Loading editor...</div>
                      </div>
                    }
                  >
                    <CodeEditor
                      value={displayFiles[activeFile] || "// Select a file to view"}
                      onChange={handleCodeChange}
                      language={detectLanguage(activeFile)}
                      readOnly={showFullProject && !activeFile.includes("/src/")}
                    />
                  </Suspense>
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="flex-1 p-6 min-h-0">
              <div className="h-full rounded-2xl overflow-hidden shadow-2xl shadow-slate-300/50 border border-slate-200/80 bg-white relative">
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading preview...</p>
                      </div>
                    </div>
                  }
                >
                  <WebContainerPreview files={files} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
