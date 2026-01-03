"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WebContainer } from "@webcontainer/api";
import { convertFilesToWebContainer } from "@/lib/webcontainer-files";

interface WebContainerPreviewProps {
  files: Record<string, string>;
}

// Singleton WebContainer instance
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export default function WebContainerPreview({
  files,
}: WebContainerPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<string>("Initializing...");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    setStatus("Starting dev server...");

    const devProcess = await container.spawn("npm", ["run", "dev"]);

    // Wait for server to be ready
    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log("[Vite]", data);
          if (data.includes("Local:") || data.includes("ready in")) {
            setStatus("Ready");
            setIsReady(true);
          }
        },
      })
    );

    // Listen for server-ready event
    container.on("server-ready", (port, url) => {
      console.log("Server ready on port", port, "URL:", url);
      setPreviewUrl(url);
      setIsReady(true);
      setStatus("Ready");
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
    async (container: WebContainer, files: Record<string, string>) => {
      setStatus("Setting up project...");
      const fileTree = convertFilesToWebContainer(files);
      await container.mount(fileTree);
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setError(null);
        setIsReady(false);
        setStatus("Booting WebContainer...");

        const container = await bootWebContainer();

        if (!isMounted) return;

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
        setStatus("Updating files...");
        await mountFiles(webcontainerInstance, files);
        setStatus("Ready");
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
    <div className="h-full flex flex-col">
      {!isReady && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">{status}</p>
            <p className="text-slate-400 text-sm mt-1">
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
