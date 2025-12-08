import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import icon from "astro-icon";

import react from "@astrojs/react";

import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  output: "server",

  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },

  vite: {
    plugins: [tailwindcss()],
    
  },

  integrations: [react(), icon()],


});