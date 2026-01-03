"use client";

import { useState, useMemo } from "react";

interface FileExplorerProps {
  files: Record<string, string>;
  activeFile: string;
  onFileSelect: (filePath: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

// File icon component
function FileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  const iconConfig: Record<string, { color: string; label: string }> = {
    js: { color: "#f7df1e", label: "JS" },
    jsx: { color: "#61dafb", label: "⚛" },
    ts: { color: "#3178c6", label: "TS" },
    tsx: { color: "#3178c6", label: "⚛" },
    json: { color: "#cbcb41", label: "{}" },
    css: { color: "#563d7c", label: "#" },
    html: { color: "#e34c26", label: "<>" },
    svg: { color: "#ffb13b", label: "◇" },
    md: { color: "#519aba", label: "M" },
    config: { color: "#6d8086", label: "⚙" },
  };

  // Special cases
  if (fileName === "package.json") {
    return <span className="text-[10px] font-bold text-[#8bc34a]">npm</span>;
  }
  if (fileName.includes("config")) {
    return <span className="text-[10px]" style={{ color: "#6d8086" }}>⚙</span>;
  }

  const config = iconConfig[ext] || { color: "#6d8086", label: "📄" };

  return (
    <span className="text-[10px] font-medium" style={{ color: config.color }}>
      {config.label}
    </span>
  );
}

// Folder icon component
function FolderIcon({ isOpen, name }: { isOpen: boolean; name: string }) {
  // Special folder colors
  const folderColors: Record<string, string> = {
    src: "#42a5f5",
    components: "#ab47bc",
    public: "#66bb6a",
    node_modules: "#8d6e63",
  };

  const color = folderColors[name] || "#dcb67a";

  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill={color}
      style={{ minWidth: "16px" }}
    >
      {isOpen ? (
        <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2zM5 8v10h14V8H5z" />
      ) : (
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
      )}
    </svg>
  );
}

// Build file tree from flat file list
function buildFileTree(files: Record<string, string>): FileNode[] {
  const root: FileNode[] = [];
  const pathMap = new Map<string, FileNode>();

  // Sort paths to ensure parent folders are created first
  const sortedPaths = Object.keys(files).sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split("/").filter(Boolean);
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;

      if (!pathMap.has(currentPath)) {
        const node: FileNode = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };

        pathMap.set(currentPath, node);

        if (parentPath && pathMap.has(parentPath)) {
          pathMap.get(parentPath)!.children!.push(node);
        } else if (!parentPath) {
          root.push(node);
        }
      }
    }
  }

  // Sort: folders first, then files, alphabetically
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }).map(node => ({
      ...node,
      children: node.children ? sortNodes(node.children) : undefined,
    }));
  };

  return sortNodes(root);
}

// Tree node component
function TreeNode({
  node,
  depth,
  activeFile,
  expandedFolders,
  onFileSelect,
  onToggleFolder,
}: {
  node: FileNode;
  depth: number;
  activeFile: string;
  expandedFolders: Set<string>;
  onFileSelect: (path: string) => void;
  onToggleFolder: (path: string) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isActive = node.path === activeFile;

  const handleClick = () => {
    if (node.type === "folder") {
      onToggleFolder(node.path);
    } else {
      onFileSelect(node.path);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-1 py-[3px] pr-2 text-left text-[13px] hover:bg-[#2a2d2e] transition-colors ${
          isActive ? "bg-[#37373d] text-white" : "text-[#cccccc]"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Expand/collapse chevron for folders */}
        {node.type === "folder" && (
          <svg
            className={`w-3 h-3 text-[#cccccc] transition-transform ${isExpanded ? "rotate-90" : ""}`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
          </svg>
        )}
        {node.type === "file" && <span className="w-3" />}

        {/* Icon */}
        {node.type === "folder" ? (
          <FolderIcon isOpen={isExpanded} name={node.name} />
        ) : (
          <FileIcon fileName={node.name} />
        )}

        {/* Name */}
        <span className="truncate flex-1">{node.name}</span>
      </button>

      {/* Children */}
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              expandedFolders={expandedFolders}
              onFileSelect={onFileSelect}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer({
  files,
  activeFile,
  onFileSelect,
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["/src", "/src/components"])
  );

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const handleToggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Expand all folders
  const handleExpandAll = () => {
    const allFolders = new Set<string>();
    const collectFolders = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === "folder") {
          allFolders.add(node.path);
          if (node.children) collectFolders(node.children);
        }
      }
    };
    collectFolders(fileTree);
    setExpandedFolders(allFolders);
  };

  // Collapse all folders
  const handleCollapseAll = () => {
    setExpandedFolders(new Set());
  };

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc]">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 text-[11px] font-medium uppercase tracking-wider text-[#bbbbbb] border-b border-[#3c3c3c]">
        <span>Explorer</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExpandAll}
            className="p-1 hover:bg-[#3c3c3c] rounded"
            title="Expand All"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z" />
            </svg>
          </button>
          <button
            onClick={handleCollapseAll}
            className="p-1 hover:bg-[#3c3c3c] rounded"
            title="Collapse All"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 18.59L8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zm9.18-13.18L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10l4.59-4.59z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Project name */}
      <div className="px-2 py-1">
        <button className="w-full flex items-center gap-1 py-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#cccccc] hover:bg-[#2a2d2e] rounded">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
          </svg>
          <span>GENERATED PROJECT</span>
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {fileTree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            activeFile={activeFile}
            expandedFolders={expandedFolders}
            onFileSelect={onFileSelect}
            onToggleFolder={handleToggleFolder}
          />
        ))}
      </div>
    </div>
  );
}
