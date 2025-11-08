/// <reference types="astro/client" />
interface ImportMetaEnv {
  readonly VITE_STRAPI_URL: string;
  readonly VITE_STRAPI_API_TOKEN?: string;
  // Add more environment variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}