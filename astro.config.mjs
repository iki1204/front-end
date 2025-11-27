import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// https://astro.build/config
export default defineConfig({
  output: "server",
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
