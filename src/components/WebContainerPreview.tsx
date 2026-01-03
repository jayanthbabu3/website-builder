"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WebContainer } from "@webcontainer/api";
import { convertFilesToWebContainer } from "@/lib/webcontainer-files";

interface WebContainerPreviewProps {
  files: Record<string, string>;
}

// Singleton WebContainer instance - persists across re-renders
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let isContainerInitialized = false; // Track if we've done full init
let serverRunning = false; // Track if dev server is running

// Track the preview URL globally so it persists across remounts
let cachedPreviewUrl: string | null = null;

export default function WebContainerPreview({
  files,
}: WebContainerPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<string>(isContainerInitialized ? "Ready" : "Initializing...");
  const [isReady, setIsReady] = useState(isContainerInitialized);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(cachedPreviewUrl);

  const bootWebContainer = useCallback(async () => {
    if (webcontainerInstance) {
      return webcontainerInstance;
    }

    if (bootPromise) {
      return bootPromise;
    }

    bootPromise = WebContainer.boot();
    webcontainerInstance = await bootPromise;
    return webcontainerInstance;
  }, []);

  const runDevServer = useCallback(async (container: WebContainer) => {
    if (serverRunning) return; // Don't start if already running

    setStatus("Starting dev server...");
    serverRunning = true;

    const devProcess = await container.spawn("npm", ["run", "dev"]);

    // Wait for server to be ready
    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log("[Vite]", data);
          if (data.includes("Local:") || data.includes("ready in")) {
            setStatus("Ready");
            setIsReady(true);
            isContainerInitialized = true;
          }
        },
      })
    );

    // Listen for server-ready event
    container.on("server-ready", (port, url) => {
      console.log("Server ready on port", port, "URL:", url);
      cachedPreviewUrl = url; // Cache the URL globally
      setPreviewUrl(url);
      setIsReady(true);
      setStatus("Ready");
      isContainerInitialized = true;
    });
  }, []);

  const installDependencies = useCallback(async (container: WebContainer) => {
    setStatus("Installing dependencies...");

    const installProcess = await container.spawn("npm", ["install"]);

    const exitCode = await installProcess.exit;

    if (exitCode !== 0) {
      throw new Error("npm install failed");
    }
  }, []);

  const mountFiles = useCallback(
    async (container: WebContainer, filesToMount: Record<string, string>) => {
      const fileTree = convertFilesToWebContainer(filesToMount);
      await container.mount(fileTree);
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        // If already initialized, just update files and restore state
        if (isContainerInitialized && webcontainerInstance) {
          console.log("WebContainer already initialized, updating files...");
          setStatus("Updating files...");
          await mountFiles(webcontainerInstance, files);
          setStatus("Ready");
          setIsReady(true);
          // Restore cached preview URL if available
          if (cachedPreviewUrl && !previewUrl) {
            setPreviewUrl(cachedPreviewUrl);
          }
          return;
        }

        setError(null);
        setIsReady(false);
        setStatus("Booting WebContainer...");

        const container = await bootWebContainer();

        if (!isMounted) return;

        setStatus("Setting up project...");
        await mountFiles(container, files);

        if (!isMounted) return;

        await installDependencies(container);

        if (!isMounted) return;

        await runDevServer(container);
      } catch (err) {
        if (isMounted) {
          console.error("WebContainer error:", err);
          setError(err instanceof Error ? err.message : "Failed to initialize");
          setStatus("Error");
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []); // Only run once on mount

  // Update files when they change (without full reboot)
  useEffect(() => {
    const updateFiles = async () => {
      if (!webcontainerInstance || !isReady) return;

      try {
        await mountFiles(webcontainerInstance, files);
      } catch (err) {
        console.error("Error updating files:", err);
      }
    };

    if (isReady) {
      updateFiles();
    }
  }, [files, isReady, mountFiles]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Preview Error
          </h2>
          <p className="text-slate-500 text-sm max-w-md">{error}</p>
          <p className="text-slate-400 text-xs mt-4">
            WebContainers require a modern browser with SharedArrayBuffer support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {!isReady && (
        <div className="absolute inset-0 bg-slate-50 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-slate-700 font-medium text-sm">{status}</p>
            <p className="text-slate-400 text-xs mt-1">
              First load may take a moment...
            </p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={previewUrl || "about:blank"}
        className="w-full h-full border-0"
        title="Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
