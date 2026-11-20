import type { IncomingMessage, ServerResponse } from "node:http";

export function createAnalyticsMiddleware(options: {
  root: string;
  fetchImpl?: typeof fetch;
}): (request: IncomingMessage, response: ServerResponse, next?: () => void) => Promise<void>;
