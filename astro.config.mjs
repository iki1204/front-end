import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import icon from "astro-icon";
import react from "@astrojs/react";
import node from "@astrojs/node";



export default defineConfig({
  output: "server",
  adapter: node(
    { mode: "middleware" }
  ),
  alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  vite: { plugins: [tailwindcss()], server:{
    allowedHosts: ["unicomec.com", "www.unicomec.com"],  
    }	 
  },
  integrations: [
    react(),
    icon({ sets: { mdi: () => import("@iconify-json/mdi/icons.json") } }),
  ],
});
