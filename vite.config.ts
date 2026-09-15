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
      
      
      
      "/api/": "http://127.0.0.1:8787",
      "/v1/": "http://127.0.0.1:8787",
    },
  },
});
