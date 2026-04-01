import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5321,
    proxy: {
      "/api": {
        target: "http://localhost:5320",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
});
