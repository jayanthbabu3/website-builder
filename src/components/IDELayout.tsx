"use client";

import { useState, lazy, Suspense, useCallback, useMemo } from "react";
import { getExpandedProjectFiles } from "@/lib/webcontainer-files";
import FileExplorer from "./FileExplorer";

// Lazy load heavy components
const CodeEditor = lazy(() => import("./CodeEditor"));
const WebContainerPreview = lazy(() => import("./WebContainerPreview"));

type ViewMode = "code" | "preview" | "split";
type ActivityTab = "explorer" | "search" | "git" | "chat";

interface IDELayoutProps {
  files: Record<string, string>;
  onFilesChange: (files: Record<string, string>) => void;
  chatPanel: React.ReactNode;
}

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

// Activity Bar icons
function ActivityBar({
  activeTab,
  onTabChange,
}: {
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
}) {
  const tabs: { id: ActivityTab; icon: React.ReactNode; label: string }[] = [
    {
      id: "chat",
      label: "AI Chat",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "explorer",
      label: "Explorer",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "search",
      label: "Search",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-12 bg-[#333333] flex flex-col items-center py-2 border-r border-[#252526]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`w-12 h-12 flex items-center justify-center transition-colors relative ${
            activeTab === tab.id
              ? "text-white"
              : "text-[#858585] hover:text-white"
          }`}
          title={tab.label}
        >
          {tab.icon}
          {activeTab === tab.id && (
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white" />
          )}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <button
        className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-white transition-colors"
        title="Settings"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// View Mode Toggle
function ViewModeToggle({
  mode,
  onModeChange,
}: {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-[#252526] rounded-lg p-1">
      <button
        onClick={() => onModeChange("code")}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
          mode === "code"
            ? "bg-[#0078d4] text-white"
            : "text-[#cccccc] hover:text-white hover:bg-[#3c3c3c]"
        }`}
        title="Code Only"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Code
      </button>
      <button
        onClick={() => onModeChange("split")}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
          mode === "split"
            ? "bg-[#0078d4] text-white"
            : "text-[#cccccc] hover:text-white hover:bg-[#3c3c3c]"
        }`}
        title="Split View"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 3v18" />
        </svg>
        Split
      </button>
      <button
        onClick={() => onModeChange("preview")}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
          mode === "preview"
            ? "bg-[#0078d4] text-white"
            : "text-[#cccccc] hover:text-white hover:bg-[#3c3c3c]"
        }`}
        title="Preview Only"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Preview
      </button>
    </div>
  );
}

// Editor tabs
function EditorTabs({
  files,
  activeFile,
  onFileSelect,
  onFileClose,
}: {
  files: string[];
  activeFile: string;
  onFileSelect: (file: string) => void;
  onFileClose: (file: string) => void;
}) {
  return (
    <div className="h-9 bg-[#252526] border-b border-[#3c3c3c] flex items-center overflow-x-auto">
      {files.map((file) => {
        const fileName = file.split("/").pop() || file;
        const ext = fileName.split(".").pop() || "";
        const isActive = file === activeFile;

        const iconColor: Record<string, string> = {
          js: "#f7df1e",
          jsx: "#61dafb",
          ts: "#3178c6",
          tsx: "#3178c6",
          json: "#cbcb41",
          css: "#563d7c",
          html: "#e34c26",
        };

        return (
          <div
            key={file}
            className={`group flex items-center gap-2 px-3 h-full border-r border-[#3c3c3c] cursor-pointer transition-colors ${
              isActive
                ? "bg-[#1e1e1e] text-white"
                : "bg-[#2d2d2d] text-[#969696] hover:text-[#cccccc]"
            }`}
            onClick={() => onFileSelect(file)}
          >
            <span
              className="text-[10px] font-medium"
              style={{ color: iconColor[ext] || "#6d8086" }}
            >
              {ext === "json" ? "{}" : ext === "jsx" || ext === "tsx" ? "⚛" : ext.toUpperCase()}
            </span>
            <span className="text-[13px] whitespace-nowrap">{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileClose(file);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] rounded p-0.5 transition-opacity"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function IDELayout({
  files,
  onFilesChange,
  chatPanel,
}: IDELayoutProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [activeTab, setActiveTab] = useState<ActivityTab>("chat");
  const [activeFile, setActiveFile] = useState("/src/App.jsx");
  const [openFiles, setOpenFiles] = useState<string[]>(["/src/App.jsx"]);
  const [sidebarWidth, setSidebarWidth] = useState(280);

  // Get expanded project files for display
  const displayFiles = useMemo(() => getExpandedProjectFiles(files), [files]);

  // Handle file selection
  const handleFileSelect = useCallback((filePath: string) => {
    setActiveFile(filePath);
    if (!openFiles.includes(filePath)) {
      setOpenFiles((prev) => [...prev, filePath]);
    }
  }, [openFiles]);

  // Handle file close
  const handleFileClose = useCallback((filePath: string) => {
    setOpenFiles((prev) => {
      const newFiles = prev.filter((f) => f !== filePath);
      if (filePath === activeFile && newFiles.length > 0) {
        setActiveFile(newFiles[newFiles.length - 1]);
      }
      return newFiles;
    });
  }, [activeFile]);

  // Handle code changes
  const handleCodeChange = useCallback((newCode: string) => {
    // Map display paths back to source paths
    let sourceFilePath = activeFile;
    if (activeFile === "/src/App.jsx") {
      sourceFilePath = "/App.js";
    } else if (activeFile.startsWith("/src/components/")) {
      sourceFilePath = activeFile
        .replace("/src/components/", "/components/")
        .replace(".jsx", ".js");
    } else {
      // Config files - don't update
      return;
    }
    onFilesChange({ ...files, [sourceFilePath]: newCode });
  }, [activeFile, files, onFilesChange]);

  // Determine if current file is editable
  const isEditable = activeFile.startsWith("/src/");

  return (
    <div className="h-full flex bg-[#1e1e1e]">
      {/* Activity Bar */}
      <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Sidebar */}
      <div
        className="flex flex-col border-r border-[#3c3c3c] overflow-hidden"
        style={{ width: sidebarWidth }}
      >
        {activeTab === "chat" && chatPanel}
        {activeTab === "explorer" && (
          <FileExplorer
            files={displayFiles}
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
          />
        )}
        {activeTab === "search" && (
          <div className="h-full bg-[#252526] p-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search files..."
                className="w-full bg-[#3c3c3c] border border-[#3c3c3c] rounded px-3 py-1.5 text-sm text-white placeholder-[#858585] focus:outline-none focus:border-[#0078d4]"
              />
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858585]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-[#858585] text-xs mt-4 text-center">
              Type to search across all files
            </p>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-10 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {viewMode !== "preview" && openFiles.length > 0 && (
              <span className="text-[#858585] text-xs">
                {activeFile.split("/").pop()}
                {!isEditable && " (read-only)"}
              </span>
            )}
          </div>
          <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />
        </div>

        {/* Editor/Preview Area */}
        <div className="flex-1 flex min-h-0">
          {/* Code Editor */}
          {(viewMode === "code" || viewMode === "split") && (
            <div
              className={`flex flex-col bg-[#1e1e1e] ${
                viewMode === "split" ? "w-1/2 border-r border-[#3c3c3c]" : "flex-1"
              }`}
            >
              {/* Editor Tabs */}
              {openFiles.length > 0 && (
                <EditorTabs
                  files={openFiles}
                  activeFile={activeFile}
                  onFileSelect={setActiveFile}
                  onFileClose={handleFileClose}
                />
              )}

              {/* Editor */}
              <div className="flex-1 overflow-hidden">
                {openFiles.length > 0 ? (
                  <Suspense
                    fallback={
                      <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
                        <div className="text-[#858585] text-sm">Loading editor...</div>
                      </div>
                    }
                  >
                    <CodeEditor
                      value={displayFiles[activeFile] || "// Select a file"}
                      onChange={handleCodeChange}
                      language={detectLanguage(activeFile)}
                      readOnly={!isEditable}
                    />
                  </Suspense>
                ) : (
                  <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
                    <div className="text-center text-[#858585]">
                      <svg
                        className="w-16 h-16 mx-auto mb-4 opacity-50"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                      >
                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <p>Select a file from the explorer</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className={`flex flex-col ${viewMode === "split" ? "w-1/2" : "flex-1"}`}>
              {/* Preview Header */}
              <div className="h-9 bg-[#252526] border-b border-[#3c3c3c] flex items-center px-4 gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[#858585] text-xs">localhost:5173</span>
                <div className="flex-1" />
                <div className="flex items-center gap-1 text-[#858585]">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px]">Live</span>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 bg-white overflow-hidden">
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">Starting preview...</p>
                      </div>
                    </div>
                  }
                >
                  <WebContainerPreview files={files} />
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
