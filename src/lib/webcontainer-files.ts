import { FileSystemTree } from "@webcontainer/api";

// Create a complete Vite + React + Tailwind project
export function createProjectFiles(
  userFiles: Record<string, string>
): FileSystemTree {
  // Build components directory from user files
  const componentsDir: FileSystemTree = {};

  for (const [path, content] of Object.entries(userFiles)) {
    if (path.startsWith("/components/")) {
      const fileName = path.replace("/components/", "");
      const jsxFileName = fileName.endsWith(".js")
        ? fileName.replace(".js", ".jsx")
        : fileName;
      componentsDir[jsxFileName] = {
        file: { contents: content },
      };
    }
  }

  // Get App.js content or use default
  const appContent = userFiles["/App.js"] || `export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900">Ready to Build</h1>
        <p className="text-slate-600 mt-2">Describe what you want to create</p>
      </div>
    </div>
  )
}`;

  // Get custom CSS if provided, or use empty
  const customCSS = userFiles["/styles.css"] || userFiles["/App.css"] || "";

  const files: FileSystemTree = {
    "package.json": {
      file: {
        contents: JSON.stringify(
          {
            name: "vite-react-app",
            private: true,
            version: "0.0.0",
            type: "module",
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
            },
            devDependencies: {
              "@vitejs/plugin-react": "^4.2.1",
              autoprefixer: "^10.4.18",
              postcss: "^8.4.35",
              tailwindcss: "^3.4.1",
              vite: "^5.1.4",
            },
          },
          null,
          2
        ),
      },
    },
    "vite.config.js": {
      file: {
        contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})`,
      },
    },
    "index.html": {
      file: {
        contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
      },
    },
    "tailwind.config.js": {
      file: {
        contents: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}`,
      },
    },
    "postcss.config.js": {
      file: {
        contents: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
      },
    },
    src: {
      directory: {
        "main.jsx": {
          file: {
            contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
          },
        },
        "index.css": {
          file: {
            contents: `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
${customCSS}

/* Base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`,
          },
        },
        "App.jsx": {
          file: {
            contents: fixImports(appContent),
          },
        },
        components: {
          directory: componentsDir,
        },
      },
    },
    public: {
      directory: {
        "vite.svg": {
          file: {
            contents: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFBD4F"></stop><stop offset="100%" stop-color="#FF980E"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>`,
          },
        },
      },
    },
  };

  return files;
}

// Fix imports to use .jsx extension and correct paths
function fixImports(code: string): string {
  // Fix component imports to use correct path
  let fixed = code.replace(
    /from ['"]\.\/components\/(\w+)['"]/g,
    "from './components/$1.jsx'"
  );

  // Fix imports that already have .js extension
  fixed = fixed.replace(
    /from ['"]\.\/components\/(\w+)\.js['"]/g,
    "from './components/$1.jsx'"
  );

  return fixed;
}

// Convert user files from API format to WebContainer format
export function convertFilesToWebContainer(
  files: Record<string, string>
): FileSystemTree {
  return createProjectFiles(files);
}

// Get expanded files for display in UI (shows full project structure)
export function getExpandedProjectFiles(
  userFiles: Record<string, string>
): Record<string, string> {
  const customCSS = userFiles["/styles.css"] || userFiles["/App.css"] || "";
  const appContent = userFiles["/App.js"] || "";

  const expanded: Record<string, string> = {
    "/package.json": JSON.stringify(
      {
        name: "vite-react-app",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          "@vitejs/plugin-react": "^4.2.1",
          autoprefixer: "^10.4.18",
          postcss: "^8.4.35",
          tailwindcss: "^3.4.1",
          vite: "^5.1.4",
        },
      },
      null,
      2
    ),
    "/vite.config.js": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})`,
    "/index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
    "/tailwind.config.js": `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,
    "/src/main.jsx": `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
    "/src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

${customCSS}`,
    "/src/App.jsx": fixImports(appContent),
  };

  // Add component files
  for (const [path, content] of Object.entries(userFiles)) {
    if (path.startsWith("/components/")) {
      const fileName = path.replace("/components/", "");
      const jsxFileName = fileName.endsWith(".js")
        ? fileName.replace(".js", ".jsx")
        : fileName;
      expanded[`/src/components/${jsxFileName}`] = fixImports(content);
    }
  }

  return expanded;
}
