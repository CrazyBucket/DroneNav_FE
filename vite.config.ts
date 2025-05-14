import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";
import * as fs from "fs";

// 检查是否存在SSL证书，如果不存在则使用后端的证书
const sslDir = path.resolve(process.cwd(), "../DroneNav_BE/config/ssl");
const certPath = path.join(sslDir, "cert.pem");
const keyPath = path.join(sslDir, "key.pem");

export default defineConfig({
  assetsInclude: ["**/*.glb"],
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      "@components": path.resolve(process.cwd(), "src/components"),
    },
  },
  server: {
    https:
      fs.existsSync(certPath) && fs.existsSync(keyPath)
        ? {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
          }
        : undefined,
    port: 5173,
    host: "localhost",
    strictPort: true,
  },
});
