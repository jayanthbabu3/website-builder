"use client";

import { useState, useRef, useEffect, lazy, Suspense, useCallback } from "react";
import { getExpandedProjectFiles } from "@/lib/webcontainer-files";

// Lazy load heavy components
const CodeEditor = lazy(() => import("@/components/CodeEditor"));
const WebContainerPreview = lazy(() => import("@/components/WebContainerPreview"));

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
  isStreaming?: boolean;
  streamContent?: StreamEvent[];
}

interface StreamEvent {
  type: "thinking" | "writeFile" | "showPreview" | "text" | "error" | "done";
  path?: string;
  content?: string;
  message?: string;
}

type RightPanelView = "preview" | "code" | "split";
type AppView = "landing" | "builder";

// Helper to detect language
function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
    json: "json", css: "css", html: "html",
  };
  return langMap[ext] || "javascript";
}

export default function Home() {
  const [appView, setAppView] = useState<AppView>("landing");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<Record<string, string>>(DEFAULT_FILES);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rightView, setRightView] = useState<RightPanelView>("preview");
  const [chatWidth, setChatWidth] = useState(420);
  const [activeFile, setActiveFile] = useState("/src/App.jsx");
  const [openFiles, setOpenFiles] = useState<string[]>(["/src/App.jsx"]);
  const [isResizing, setIsResizing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string>("");
  const [writingFile, setWritingFile] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const landingInputRef = useRef<HTMLInputElement>(null);

  // Get expanded project files
  const displayFiles = getExpandedProjectFiles(files);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.min(Math.max(320, e.clientX), 600);
      setChatWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleGenerate = async (initialPrompt?: string) => {
    const currentPrompt = initialPrompt || prompt;
    if (!currentPrompt.trim() || isLoading) return;

    // Switch to builder view on first generation
    if (appView === "landing") {
      setAppView("builder");
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: currentPrompt,
    };

    // Create assistant message placeholder for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
      streamContent: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setPrompt("");
    setIsLoading(true);
    setShowPreview(false);
    setCurrentActivity("Thinking...");

    const isFollowUp = messages.length > 0;
    const newFiles: Record<string, string> = isFollowUp ? { ...files } : {};

    try {
      const response = await fetch("/api/generate-stream", {
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

      if (!response.ok) {
        throw new Error("Failed to generate");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      const streamEvents: StreamEvent[] = [];
      let textContent = "";
      let previewMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as StreamEvent;
              streamEvents.push(data);

              if (data.type === "thinking") {
                setCurrentActivity(data.message || "Planning...");
              } else if (data.type === "writeFile" && data.path && data.content) {
                setCurrentActivity(`Writing ${data.path}...`);
                setWritingFile(data.path);
                newFiles[data.path] = data.content;
                setFiles({ ...newFiles });

                // Auto-select the file being written
                const displayPath = data.path === "/App.js"
                  ? "/src/App.jsx"
                  : data.path.startsWith("/components/")
                    ? `/src${data.path.replace(".js", ".jsx")}`
                    : data.path;
                setActiveFile(displayPath);
                if (!openFiles.includes(displayPath)) {
                  setOpenFiles(prev => [...prev, displayPath]);
                }

                // Small delay to show writing animation
                await new Promise(r => setTimeout(r, 300));
                setWritingFile("");
              } else if (data.type === "showPreview") {
                setCurrentActivity(data.message || "Starting preview...");
                setShowPreview(true);
                // Capture the preview message to show in chat
                previewMessage = data.message || "Your app is ready!";
              } else if (data.type === "text") {
                // Only add text content if it doesn't look like raw code/JSON
                const content = data.content || "";
                if (!content.includes("<writeFile>") && !content.includes('"path"')) {
                  textContent += content;
                }
              } else if (data.type === "error") {
                textContent = `Error: ${data.message}`;
              }

              // Update the assistant message with stream events
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, streamContent: [...streamEvents] }
                  : m
              ));
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }

      // Finalize the message - prefer previewMessage, then textContent, then default
      const fileCount = Object.keys(newFiles).length;
      const finalContent = previewMessage || textContent || (fileCount > 0
        ? `Created ${fileCount} file${fileCount > 1 ? "s" : ""} successfully!`
        : "Done!");

      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? { ...m, content: finalContent, isStreaming: false, files: fileCount > 0 ? newFiles : undefined }
          : m
      ));

      setCurrentActivity("");
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? { ...m, content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`, isStreaming: false }
          : m
      ));
      setCurrentActivity("");
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

  const handleLandingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleFileSelect = (filePath: string) => {
    setActiveFile(filePath);
    if (!openFiles.includes(filePath)) {
      setOpenFiles((prev) => [...prev, filePath]);
    }
  };

  const handleFileClose = (filePath: string) => {
    setOpenFiles((prev) => {
      const newFiles = prev.filter((f) => f !== filePath);
      if (filePath === activeFile && newFiles.length > 0) {
        setActiveFile(newFiles[newFiles.length - 1]);
      }
      return newFiles;
    });
  };

  const handleCodeChange = (newCode: string) => {
    let sourceFilePath = activeFile;
    if (activeFile === "/src/App.jsx") {
      sourceFilePath = "/App.js";
    } else if (activeFile.startsWith("/src/components/")) {
      sourceFilePath = activeFile.replace("/src/components/", "/components/").replace(".jsx", ".js");
    } else if (activeFile === "/src/App.css") {
      sourceFilePath = "/App.css";
    } else {
      return;
    }
    setFiles((prev) => ({ ...prev, [sourceFilePath]: newCode }));
  };

  const templates = [
    { title: "Portfolio Website", description: "Personal portfolio with about, projects & contact", icon: "👤", gradient: "from-violet-500 to-purple-600" },
    { title: "Dashboard", description: "Analytics dashboard with charts and stats", icon: "📊", gradient: "from-blue-500 to-cyan-500" },
    { title: "E-commerce", description: "Product listing with cart functionality", icon: "🛒", gradient: "from-orange-500 to-pink-500" },
    { title: "Landing Page", description: "Marketing page with hero and features", icon: "🚀", gradient: "from-emerald-500 to-teal-500" },
  ];

  const suggestions = [
    { icon: "🎨", text: "Landing page with hero section", gradient: "from-purple-500 to-pink-500" },
    { icon: "📊", text: "Dashboard with charts and stats", gradient: "from-blue-500 to-cyan-500" },
    { icon: "🛒", text: "E-commerce product grid", gradient: "from-orange-500 to-red-500" },
    { icon: "📱", text: "Mobile app UI components", gradient: "from-green-500 to-emerald-500" },
  ];

  const fileList = Object.keys(displayFiles).sort();

  // Landing Page View
  if (appView === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-100 via-violet-100 to-cyan-100 relative overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-violet-400/30 to-purple-400/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-pink-400/30 to-rose-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-violet-700 to-indigo-700 bg-clip-text text-transparent">
              BuilderAI
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Features</a>
            <a href="#" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Templates</a>
            <a href="#" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-slate-700 font-medium hover:text-slate-900 transition-colors">
              Sign In
            </button>
            <button className="px-5 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">
              Get Started
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex flex-col items-center justify-center px-8 pt-16 pb-24">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-white/50 shadow-sm mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-slate-700">Powered by AI</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 tracking-tight leading-tight">
              What&apos;s on your
              <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent"> mind</span>?
            </h1>

            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Describe your idea and watch it come to life. Build beautiful React applications with AI in seconds.
            </p>
          </div>

          {/* Main Input Card */}
          <div className="w-full max-w-2xl mb-16">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-slate-900/10 border border-white/50 p-2">
              <div className="flex items-center gap-3">
                <input
                  ref={landingInputRef}
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleLandingKeyDown}
                  placeholder="Ask BuilderAI to create a web app that..."
                  className="flex-1 px-5 py-4 bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none text-lg"
                />
                <div className="flex items-center gap-2 pr-2">
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isLoading || !prompt.trim()}
                    className="w-12 h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-violet-500/30 disabled:shadow-none"
                  >
                    {isLoading ? (
                      <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Templates */}
          <div className="w-full max-w-5xl">
            <div className="flex items-center justify-center gap-6 mb-8">
              <button className="px-5 py-2 bg-white/80 backdrop-blur-sm rounded-full text-sm font-semibold text-slate-900 shadow-sm border border-white/50">
                Templates
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.map((template, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPrompt(`Create a ${template.title.toLowerCase()}: ${template.description}`);
                    landingInputRef.current?.focus();
                  }}
                  className="group bg-white/60 backdrop-blur-sm hover:bg-white/80 border border-white/50 hover:border-violet-200 rounded-2xl p-5 text-left transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1"
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${template.gradient} rounded-xl flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                    {template.icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{template.title}</h3>
                  <p className="text-sm text-slate-500">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Builder View
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
        <button onClick={() => setAppView("landing")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-semibold bg-gradient-to-r from-violet-700 to-indigo-700 bg-clip-text text-transparent">
            BuilderAI
          </span>
        </button>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {(["preview", "split", "code"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setRightView(view)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                rightView === view ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
            {Object.keys(files).length} files
          </span>
          <button className="px-3 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-medium rounded-lg hover:shadow-lg transition-all">
            Export
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="bg-white border-r border-slate-200 flex flex-col" style={{ width: chatWidth }}>
          {/* Chat Header */}
          <div className="h-11 border-b border-slate-100 flex items-center justify-between px-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-lg flex items-center justify-center">
                <svg className="w-3 h-3 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-900">Chat</span>
            </div>
            {currentActivity && (
              <div className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                {currentActivity}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-4 py-6">
                <div className="w-14 h-14 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">Start Building</h3>
                <p className="text-slate-500 text-xs text-center mb-5">Describe your idea below</p>
                <div className="w-full space-y-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(s.text)}
                      className="w-full p-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-violet-200 rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 bg-gradient-to-br ${s.gradient} rounded-lg flex items-center justify-center text-sm`}>
                          {s.icon}
                        </div>
                        <span className="text-slate-600 text-xs group-hover:text-slate-900">{s.text}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[90%] rounded-xl px-3 py-2 ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}>
                      {/* Show streaming content */}
                      {message.isStreaming && message.streamContent && message.streamContent.length > 0 ? (
                        <div className="space-y-1.5">
                          {message.streamContent.map((event, i) => (
                            <div key={i} className="text-xs">
                              {event.type === "thinking" && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                  {event.message}
                                </div>
                              )}
                              {event.type === "writeFile" && (
                                <div className="flex items-center gap-1.5 text-emerald-600">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Created {event.path}</span>
                                </div>
                              )}
                              {event.type === "showPreview" && (
                                <div className="flex items-center gap-1.5 text-blue-600">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  {event.message}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <p className="text-xs leading-relaxed">{message.content}</p>
                          {message.files && Object.keys(message.files).length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-white/20">
                              <div className="flex flex-wrap gap-1">
                                {Object.keys(message.files).map((file) => (
                                  <span key={file} className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                                    {file.replace("/", "").replace("components/", "")}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100 flex-shrink-0">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to build..."
                rows={2}
                className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none text-xs"
              />
              <button
                onClick={() => handleGenerate()}
                disabled={isLoading || !prompt.trim()}
                className="absolute right-2 bottom-2 w-7 h-7 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 rounded-lg flex items-center justify-center transition-all"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          className="w-1 bg-slate-200 hover:bg-violet-400 cursor-col-resize transition-colors flex-shrink-0"
          onMouseDown={() => setIsResizing(true)}
        />

        {/* Right Panel */}
        <div className="flex-1 flex min-w-0">
          {/* Code Panel */}
          {(rightView === "code" || rightView === "split") && (
            <div className={`flex flex-col bg-[#1e1e1e] ${rightView === "split" ? "w-1/2 border-r border-[#3c3c3c]" : "flex-1"}`}>
              <div className="flex-1 flex min-h-0">
                {/* File Explorer */}
                <div className="w-48 bg-[#252526] border-r border-[#3c3c3c] flex flex-col flex-shrink-0">
                  <div className="h-8 flex items-center px-3 text-[10px] font-medium uppercase tracking-wider text-[#bbbbbb] border-b border-[#3c3c3c]">
                    Explorer
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                    {fileList.map((file) => {
                      const fileName = file.split("/").pop() || "";
                      const ext = fileName.split(".").pop() || "";
                      const isActive = file === activeFile;
                      const isWriting = writingFile && (
                        file === `/src${writingFile.replace(".js", ".jsx")}` ||
                        file === writingFile
                      );
                      const depth = file.split("/").length - 2;
                      const iconColor: Record<string, string> = {
                        js: "#f7df1e", jsx: "#61dafb", json: "#cbcb41", css: "#563d7c", html: "#e34c26",
                      };

                      return (
                        <button
                          key={file}
                          onClick={() => handleFileSelect(file)}
                          className={`w-full flex items-center gap-1.5 py-0.5 px-2 text-[11px] transition-all ${
                            isActive ? "bg-[#37373d] text-white" : "text-[#cccccc] hover:bg-[#2a2d2e]"
                          } ${isWriting ? "bg-emerald-500/20 text-emerald-400" : ""}`}
                          style={{ paddingLeft: `${depth * 8 + 8}px` }}
                        >
                          {isWriting && (
                            <svg className="w-3 h-3 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                          <span className="text-[9px] font-medium" style={{ color: isWriting ? "#34d399" : iconColor[ext] || "#6d8086" }}>
                            {ext.toUpperCase()}
                          </span>
                          <span className="truncate">{fileName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Editor */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="h-8 bg-[#252526] border-b border-[#3c3c3c] flex items-center overflow-x-auto flex-shrink-0">
                    {openFiles.map((file) => {
                      const fileName = file.split("/").pop() || "";
                      const ext = fileName.split(".").pop() || "";
                      const isActive = file === activeFile;
                      const iconColor: Record<string, string> = {
                        js: "#f7df1e", jsx: "#61dafb", json: "#cbcb41", css: "#563d7c", html: "#e34c26",
                      };

                      return (
                        <div
                          key={file}
                          className={`group flex items-center gap-1.5 px-2.5 h-full border-r border-[#3c3c3c] cursor-pointer ${
                            isActive ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-[#969696] hover:text-white"
                          }`}
                          onClick={() => setActiveFile(file)}
                        >
                          <span className="text-[9px]" style={{ color: iconColor[ext] || "#6d8086" }}>
                            {ext.toUpperCase()}
                          </span>
                          <span className="text-[11px] whitespace-nowrap">{fileName}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFileClose(file); }}
                            className="opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] rounded p-0.5"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Suspense fallback={<div className="h-full bg-[#1e1e1e] flex items-center justify-center text-[#858585] text-xs">Loading...</div>}>
                      <CodeEditor
                        value={displayFiles[activeFile] || "// Select a file"}
                        onChange={handleCodeChange}
                        language={detectLanguage(activeFile)}
                        readOnly={!activeFile.startsWith("/src/")}
                      />
                    </Suspense>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview Panel */}
          {(rightView === "preview" || rightView === "split") && (
            <div className={`flex flex-col bg-white ${rightView === "split" ? "w-1/2" : "flex-1"}`}>
              <div className="h-9 bg-slate-50 border-b border-slate-200 flex items-center px-3 gap-2 flex-shrink-0">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded border border-slate-200 text-[10px] text-slate-500">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    localhost:5173
                  </div>
                </div>
                {showPreview && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                {showPreview ? (
                  <Suspense
                    fallback={
                      <div className="h-full flex items-center justify-center bg-slate-50">
                        <div className="text-center">
                          <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-slate-500 text-xs">Starting preview...</p>
                        </div>
                      </div>
                    }
                  >
                    <WebContainerPreview files={files} />
                  </Suspense>
                ) : (
                  <div className="h-full flex items-center justify-center bg-slate-50">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                      <p className="text-slate-500 text-sm font-medium">Preview will appear here</p>
                      <p className="text-slate-400 text-xs mt-1">After code generation is complete</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
