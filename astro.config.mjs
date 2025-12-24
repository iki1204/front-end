import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import icon from "astro-icon";
import react from "@astrojs/react";

export default defineConfig({
  output: "server",
  alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  vite: { plugins: [tailwindcss()] },
  integrations: [
    react(),
    icon({ sets: { mdi: () => import("@iconify-json/mdi/icons.json") } }),
  ],
});
