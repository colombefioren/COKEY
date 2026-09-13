import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
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
