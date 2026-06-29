import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

// Derive version from the latest git tag (e.g., v0.1.3). Falls back to package.json.
function getVersion(): string {
  try {
    const tag = execSync("git describe --tags --abbrev=0", { encoding: "utf-8" }).trim()
    if (tag) return tag.replace(/^v/, "")
  } catch {}
  try {
    return JSON.parse(fs.readFileSync("./package.json", "utf-8")).version
  } catch {
    return "0.0.0"
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
  plugins: [tailwindcss(), react()],
  root: ".",
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist/client",
  },
});
