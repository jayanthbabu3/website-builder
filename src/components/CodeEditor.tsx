"use client";

import { useCallback, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { EditorView } from "@codemirror/view";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
}

// Get language extension based on file extension or language name
function getLanguageExtension(language: string) {
  const lang = language.toLowerCase();

  if (lang.includes("jsx") || lang.includes("tsx")) {
    return javascript({ jsx: true, typescript: lang.includes("tsx") });
  }
  if (lang.includes("js") || lang.includes("javascript")) {
    return javascript();
  }
  if (lang.includes("ts") || lang.includes("typescript")) {
    return javascript({ typescript: true });
  }
  if (lang.includes("json")) {
    return json();
  }
  if (lang.includes("css")) {
    return css();
  }
  if (lang.includes("html")) {
    return html();
  }

  // Default to JavaScript for unknown types
  return javascript({ jsx: true });
}

// Detect language from file path
export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    case "js":
      return "javascript";
    case "jsx":
      return "jsx";
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    default:
      return "javascript";
  }
}

// Custom theme extensions for VS Code-like appearance
const customTheme = EditorView.theme({
  "&": {
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
  },
  ".cm-content": {
    padding: "12px 0",
    caretColor: "#fff",
  },
  ".cm-line": {
    padding: "0 16px",
  },
  ".cm-gutters": {
    backgroundColor: "#1e1e1e",
    color: "#858585",
    border: "none",
    paddingRight: "8px",
  },
  ".cm-gutter": {
    minWidth: "48px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#282828",
    color: "#c6c6c6",
  },
  ".cm-activeLine": {
    backgroundColor: "#282828",
  },
  ".cm-selectionBackground": {
    backgroundColor: "#264f78 !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "#264f78 !important",
  },
  ".cm-cursor": {
    borderLeftColor: "#fff",
    borderLeftWidth: "2px",
  },
  ".cm-matchingBracket": {
    backgroundColor: "#3a3a3a",
    outline: "1px solid #888",
  },
  ".cm-searchMatch": {
    backgroundColor: "#613214",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#9e6a03",
  },
  // Scrollbar styling
  ".cm-scroller": {
    overflow: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "#424242 #1e1e1e",
  },
  ".cm-scroller::-webkit-scrollbar": {
    width: "10px",
    height: "10px",
  },
  ".cm-scroller::-webkit-scrollbar-track": {
    backgroundColor: "#1e1e1e",
  },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    backgroundColor: "#424242",
    borderRadius: "5px",
    border: "2px solid #1e1e1e",
  },
  ".cm-scroller::-webkit-scrollbar-thumb:hover": {
    backgroundColor: "#555",
  },
});

export default function CodeEditor({
  value,
  onChange,
  language = "javascript",
  readOnly = false,
  height = "100%",
}: CodeEditorProps) {
  const handleChange = useCallback(
    (val: string) => {
      if (onChange) {
        onChange(val);
      }
    },
    [onChange]
  );

  const extensions = useMemo(() => {
    const langExtension = getLanguageExtension(language);
    return [
      langExtension,
      customTheme,
      EditorView.lineWrapping,
    ];
  }, [language]);

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={vscodeDark}
      extensions={extensions}
      onChange={handleChange}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightSpecialChars: true,
        history: true,
        foldGutter: true,
        drawSelection: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        syntaxHighlighting: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        closeBracketsKeymap: true,
        defaultKeymap: true,
        searchKeymap: true,
        historyKeymap: true,
        foldKeymap: true,
        completionKeymap: true,
        lintKeymap: true,
      }}
      className="h-full"
    />
  );
}
