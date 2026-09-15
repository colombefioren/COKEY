import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // React and GSAP change only when a dependency is bumped, while the
        // app chunk changes on every release. Splitting them lets a browser
        // that already has last release's vendor chunk cached skip
        // re-downloading and re-parsing it after an update that only
        // touched app code — the common case for a self-hosted dashboard
        // someone reloads across many small releases.
        manualChunks: {
          vendor: ["react", "react-dom"],
          motion: ["gsap"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Trailing slashes: a bare "/api" prefix also matches this app's own
      // "/api.ts" module and forwards it to the gateway, which 404s and takes
      // the whole dev bundle down with it.
      "/api/": "http://127.0.0.1:8787",
      "/v1/": "http://127.0.0.1:8787",
    },
  },
});
