import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev: product images are stored as /uploads/... on the Nest server; proxy so <img src="/uploads/..."> works when API_ORIGIN is this dev server.
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      /** Same-origin `/v1/*` in dev — required when not opened as localhost (LAN IP, 127.0.0.1). */
      "/v1": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // Same-origin /api/v1 when frontend uses getEffectiveApiBase() over HTTPS (avoids CORS to :3000).
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    proxy: {
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/v1": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['motion', 'lucide-react', 'sonner'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
