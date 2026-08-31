import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        app: resolve(__dirname, "app/index.html"),
        appDirect: resolve(__dirname, "app.html"),
        dossier: resolve(__dirname, "dossier.html"),
        website: resolve(__dirname, "website/index.html"),
        websiteDossier: resolve(__dirname, "website/dossier.html"),
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
