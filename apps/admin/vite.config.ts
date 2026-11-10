import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: "admin",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App.tsx",
      },
      dts: false,
      shared: {
        react: { singleton: true },
        "react-dom": { singleton: true },
      },
    }),
  ],
  server: {
    port: 3011,
    strictPort: true,
    origin: "http://localhost:3011",
  },
  preview: {
    port: 3011,
    strictPort: true,
  },
  build: {
    target: "esnext",
  },
});
