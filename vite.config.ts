import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { createAnalyticsMiddleware } from "./scripts/analytics-bridge.mjs";
import { loadPublishedProject, loadStandaloneConnection, standaloneBuildPlugin } from "./scripts/standalone-build.mjs";

export default defineConfig(({ command, mode }) => {
  const root = process.cwd();
  const pages = command === "build" && mode === "pages";
  const published = pages ? loadPublishedProject(root) : null;
  const standalone = command === "build" && !pages ? loadStandaloneConnection(root) : null;
  return {
    base: "./",
    build: { outDir: pages ? "dist-pages" : "dist" },
    define: {
      __ANALYTICS_STANDALONE_CONNECTION__: JSON.stringify(standalone),
      __ANALYTICS_PUBLISHED_PROJECT__: JSON.stringify(published),
    },
    plugins: [react(), viteSingleFile(), standaloneBuildPlugin(root, standalone), {
      name: "coupang-private-server",
      configureServer(server) {
        server.middlewares.use(createAnalyticsMiddleware({ root }));
      },
      configurePreviewServer(server) {
        server.middlewares.use(createAnalyticsMiddleware({ root }));
      },
    }, {
      name: "coupang-release",
      transformIndexHtml() {
        return [{ tag: "meta", attrs: { name: "analytics-release", content: process.env.GITHUB_SHA ?? "local" }, injectTo: "head" }];
      },
    }],
  };
});
