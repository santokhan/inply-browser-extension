import { defaultAllowedOrigins, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  server: {
    cors: {
      origin: [
        /^chrome-extension:\/\/[a-p]{32}$/,
        defaultAllowedOrigins,
        new URL(manifest.host_permissions[0].replace(/\*$/, "")).origin,
      ],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest: {
      ...manifest,
      // Keep every content script scoped to the root host permission.
      content_scripts: manifest.content_scripts.map((entry) => ({
        ...entry, matches: manifest.host_permissions,
      })),
    } })
  ]
});
