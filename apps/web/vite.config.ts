import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./", // static hosting from any path
  server: { port: 5173, fs: { allow: ["../.."] } },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  optimizeDeps: { esbuildOptions: { target: "es2022" } },
});
