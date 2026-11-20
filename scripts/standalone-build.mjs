import fs from "node:fs";
import path from "node:path";

export function loadPublishedProject(root) {
  const config = JSON.parse(fs.readFileSync(path.join(root, "supabase/public-project.json"), "utf8"));
  const url = new URL(config.url);
  const site = new URL(config.siteUrl);
  if (url.protocol !== "https:" || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
    || url.pathname !== "/" || url.search || url.hash || url.username || url.password || url.port
    || !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(config.publishableKey ?? "")
    || site.protocol !== "https:" || site.username || site.password || site.search || site.hash || site.port) {
    throw new Error("Invalid published analytics project");
  }
  return { url: url.origin, publishableKey: config.publishableKey, siteUrl: site.href };
}

export function loadStandaloneConnection(root) {
  const filename = path.join(root, "supabase/standalone-connection.local");
  if (!fs.existsSync(filename)) return null;
  const config = JSON.parse(fs.readFileSync(filename, "utf8"));
  const url = new URL(config.url);
  if (config.format !== "coupang-sales-connection-v1" || url.protocol !== "https:"
    || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) || url.pathname !== "/"
    || url.search || url.hash || url.username || url.password || url.port
    || !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(config.publishableKey ?? "")
    || !/^[a-f0-9]{64}$/.test(config.accessKey ?? "") || config.snapshotMode !== "paged") {
    throw new Error("Invalid standalone analytics connection");
  }
  return { format: config.format, url: url.origin, publishableKey: config.publishableKey,
    accessKey: config.accessKey, snapshotMode: "paged" };
}

export function standaloneBuildPlugin(root, connection) {
  let directory;
  return {
    name: "coupang-standalone-html",
    apply: "build",
    configResolved(config) { directory = path.resolve(config.root, config.build.outDir); },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(/\s*<script\s+data-file-launcher>[\s\S]*?<\/script>/, "");
      },
    },
    closeBundle() {
      if (connection) fs.copyFileSync(path.join(directory, "index.html"), path.join(root, "판매량 분석기.html"));
    },
  };
}
