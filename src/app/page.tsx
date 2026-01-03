"use client";

import { useState, useRef, useEffect, lazy, Suspense } from "react";

// Lazy load IDELayout to avoid SSR issues
const IDELayout = lazy(() => import("@/components/IDELayout"));

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

// Chat Panel Component
function ChatPanel({
  messages,
  isLoading,
  prompt,
  onPromptChange,
  onSend,
}: {
  messages: Message[];
  isLoading: boolean;
  prompt: string;
  onPromptChange: (value: string) => void;
  onSend: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const suggestions = [
    { icon: "🏠", text: "Dashboard with sidebar and stats", desc: "Multi-component layout" },
    { icon: "🛒", text: "E-commerce product page", desc: "Product card, gallery, cart" },
    { icon: "📝", text: "Blog with posts and comments", desc: "Multiple sections" },
    { icon: "🔐", text: "Login form with validation", desc: "Single component" },
  ];

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Chat Header */}
      <div className="h-10 bg-[#252526] border-b border-[#3c3c3c] flex items-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-[#0078d4] to-[#00bcf2] rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[#cccccc] text-sm font-medium">AI Assistant</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-4 py-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#0078d4]/20 to-[#00bcf2]/20 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#0078d4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-[#cccccc] text-base font-medium mb-2">What would you like to build?</h3>
            <p className="text-[#858585] text-xs text-center mb-6 max-w-[220px]">
              Describe your project and I&apos;ll generate a complete React application.
            </p>
            <div className="w-full space-y-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onPromptChange(s.text)}
                  className="w-full p-3 text-left bg-[#2d2d2d] hover:bg-[#37373d] border border-[#3c3c3c] rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{s.icon}</span>
                    <div>
                      <span className="text-[#cccccc] text-sm group-hover:text-white block">{s.text}</span>
                      <span className="text-[#858585] text-[10px]">{s.desc}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-3 py-2 ${
                    message.role === "user"
                      ? "bg-[#0078d4] text-white"
                      : "bg-[#2d2d2d] text-[#cccccc] border border-[#3c3c3c]"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  {message.files && Object.keys(message.files).length > 1 && (
                    <div className="mt-2 pt-2 border-t border-white/20">
                      <p className="text-[10px] opacity-70 mb-1">Files created:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(message.files).map((file) => (
                          <span
                            key={file}
                            className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded"
                          >
                            {file.replace("/", "").replace("components/", "")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#2d2d2d] border border-[#3c3c3c] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[#0078d4] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-[#0078d4] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-[#0078d4] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[#858585] text-xs">Generating...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[#3c3c3c] bg-[#252526]">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            rows={3}
            className="w-full px-3 py-2.5 pr-12 bg-[#3c3c3c] border border-[#3c3c3c] rounded-lg text-[#cccccc] placeholder-[#858585] focus:outline-none focus:border-[#0078d4] resize-none text-sm"
          />
          <button
            onClick={onSend}
            disabled={isLoading || !prompt.trim()}
            className="absolute right-2 bottom-2 w-8 h-8 bg-[#0078d4] hover:bg-[#106ebe] disabled:bg-[#3c3c3c] disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
          >
            {isLoading ? (
              <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[#858585] text-center">
          Press <kbd className="px-1 py-0.5 bg-[#3c3c3c] rounded text-[#cccccc]">Enter</kbd> to send
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<Record<string, string>>(DEFAULT_FILES);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

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

    const isFollowUp = messages.length > 0;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: currentPrompt,
          currentFiles: isFollowUp ? files : undefined,
          conversationHistory: messages.slice(-4).map((m) => ({
            role: m.role,
            content: m.content,
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

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e]">
      {/* Title Bar */}
      <header className="h-8 bg-[#323233] flex items-center justify-center border-b border-[#252526]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gradient-to-br from-[#0078d4] to-[#00bcf2] rounded flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[#cccccc] text-xs font-medium">AI Website Builder</span>
        </div>
      </header>

      {/* Main IDE Layout */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-[#0078d4] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[#858585] text-sm">Loading IDE...</p>
              </div>
            </div>
          }
        >
          <IDELayout
            files={files}
            onFilesChange={setFiles}
            chatPanel={
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                prompt={prompt}
                onPromptChange={setPrompt}
                onSend={handleGenerate}
              />
            }
          />
        </Suspense>
      </div>

      {/* Status Bar */}
      <footer className="h-6 bg-[#007acc] flex items-center justify-between px-3 text-white text-[11px]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            main
          </span>
          <span>{Object.keys(files).length} source files</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Vite + React + Tailwind</span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            Ready
          </span>
        </div>
      </footer>
    </div>
  );
}
