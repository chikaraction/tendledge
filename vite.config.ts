import { defineConfig } from "vite";

// Tauri は固定ポートの dev サーバーを前提とする
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "esnext",
  },
});
