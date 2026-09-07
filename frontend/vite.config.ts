import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "fs";
import path from "path";

// Check if custom SSL certificate paths are provided via environment
const customKeyPath = process.env.SSL_KEY_PATH;
const customCertPath = process.env.SSL_CERT_PATH;
const hasCustomSsl = Boolean(
  customKeyPath &&
  customCertPath &&
  fs.existsSync(customKeyPath) &&
  fs.existsSync(customCertPath)
);

const customHttpsConfig = hasCustomSsl
  ? {
      key: fs.readFileSync(customKeyPath!),
      cert: fs.readFileSync(customCertPath!),
    }
  : undefined;

// Enable HTTPS only if explicitly requested (HTTPS=true) with custom certificates or basicSsl
const enableHttps = process.env.HTTPS === "true";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
    tailwindcss(),
    // Use basicSsl plugin only when HTTPS is explicitly enabled and no custom certificate is provided
    ...(enableHttps && !hasCustomSsl ? [basicSsl()] : []),
  ],
  server: {
    host: "0.0.0.0",
    https: customHttpsConfig,
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

