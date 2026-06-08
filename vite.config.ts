import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const proxy: Record<string, {
    target: string;
    changeOrigin: boolean;
    rewrite: (path: string) => string;
    headers?: Record<string, string>;
  }> = {
    "/api/twse": {
      target: "https://openapi.twse.com.tw/v1",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/twse/, "")
    },
    "/api/twse-mis": {
      target: "https://mis.twse.com.tw",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/twse-mis/, "")
    },
    "/api/google-news": {
      target: "https://news.google.com",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/google-news/, "")
    },
    "/api/fred": {
      target: "https://api.stlouisfed.org",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/fred/, "")
    }
  };

  if (env.OPENAI_API_KEY) {
    proxy["/api/ai-sentiment"] = {
      target: "https://api.openai.com",
      changeOrigin: true,
      rewrite: () => "/v1/responses",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      }
    };
  }

  if (env.FUGLE_API_KEY) {
    proxy["/api/fugle"] = {
      target: "https://api.fugle.tw/marketdata/v1.0/stock",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/fugle/, ""),
      headers: {
        "X-API-KEY": env.FUGLE_API_KEY
      }
    };
  }

  return {
    plugins: [react()],
    server: {
      proxy
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts"
    }
  };
});
