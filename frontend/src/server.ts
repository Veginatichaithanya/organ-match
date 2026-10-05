import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {{"unhandled":true,"message":"HTTPError"}} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function getBackendBaseUrl(): string {
  let raw = (
    process.env.BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    // Render free tier does NOT support internal networking — always use public HTTPS URL
    (process.env.NODE_ENV === "development"
      ? "http://localhost:8000"
      : "https://organmatch-backend-rwjz.onrender.com")
  ).trim();

  // If a bare hostname or hostport was injected (e.g. Render blueprint fromService.hostport),
  // normalise it to a full URL.
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    if (raw.includes("localhost") || raw.includes("127.0.0.1")) {
      raw = `http://${raw}`;
    } else {
      // Any external hostname → force HTTPS
      raw = `https://${raw}`;
    }
  }

  // If the env var accidentally points to the internal Render service name
  // (only available on paid private networking plans), fall back to public URL.
  if (
    raw.includes("organmatch-backend:10000") ||
    raw === "http://organmatch-backend:10000"
  ) {
    raw = "https://organmatch-backend-rwjz.onrender.com";
  }

  return raw.replace(/\/+$/, "");
}

async function handleApiProxy(request: Request, url: URL): Promise<Response> {
  const backendBase = getBackendBaseUrl();
  const targetUrl = `${backendBase}${url.pathname}${url.search}`;

  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const k = key.toLowerCase();
    if (k === "host" || k === "connection" || k === "content-length") {
      continue;
    }
    forwardHeaders.set(key, value);
  }

  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  if (clientIp) {
    forwardHeaders.set("x-forwarded-for", clientIp);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
  let body: BodyInit | null = null;
  if (hasBody) {
    body = await request.arrayBuffer();
  }

  // Determine if this request is safe / critical for cold-start retry.
  // - All GET / HEAD requests are idempotent and safe to retry.
  // - Auth login / refresh / health endpoints returning 502/503/504 have NOT been executed
  //   by FastAPI (the 502 comes from the Render edge proxy), so retrying is 100% safe.
  const isColdStartRetryable =
    ["GET", "HEAD"].includes(request.method.toUpperCase()) ||
    ["/api/auth/login", "/api/auth/refresh", "/api/health", "/api/auth/me"].some((p) =>
      url.pathname.startsWith(p)
    );

  const maxAttempts = isColdStartRetryable ? 6 : 2;
  let backendRes: Response | null = null;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      backendRes = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body,
        redirect: "manual",
      });

      // If backend is booting from cold sleep, Render edge router returns 502/503/504.
      // Retry progressively so the user connection stays open until the backend is up.
      if ([502, 503, 504].includes(backendRes.status) && attempt < maxAttempts) {
        const delayMs = Math.min(attempt * 2500, 5000);
        console.warn(
          `[API Proxy] Upstream returned HTTP ${backendRes.status} for ${request.method} ${url.pathname} (Render spin-up). Retrying attempt ${attempt}/${maxAttempts} in ${delayMs}ms...`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      break;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = Math.min(attempt * 2500, 5000);
        console.warn(
          `[API Proxy] Upstream network error for ${request.method} ${url.pathname} (${err?.message}). Retrying attempt ${attempt}/${maxAttempts} in ${delayMs}ms...`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      break;
    }
  }

  if (!backendRes) {
    console.error(
      `[API Proxy] All ${maxAttempts} retry attempts failed forwarding ${request.method} ${url.pathname} to ${targetUrl}:`,
      lastError
    );
    return new Response(
      JSON.stringify({
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: `Backend service is unreachable at ${backendBase}. If running on Render free tier, the backend may be booting up from cold sleep (takes ~45s). Please retry in a few moments.`,
          detail: lastError?.message || String(lastError),
        },
      }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }

  // Hop-by-hop and encoding/length headers that MUST NOT be forwarded from upstream.
  // In particular:
  // - content-encoding: Node fetch() transparently decompresses brotli/gzip responses.
  // - content-length: upstream was the compressed/chunked size, NOT the decompressed body size.
  // Forwarding either header causes the browser / CDN to truncate or fail to parse JSON.
  const STRIP_RESPONSE_HEADERS = new Set([
    "content-length",
    "content-encoding",
    "transfer-encoding",
    "connection",
    "keep-alive",
    "public-key-pins",
    "upgrade",
    "trailer",
    "set-cookie", // Set-Cookie headers are preserved individually below
  ]);

  const responseHeaders = new Headers();
  for (const [key, value] of backendRes.headers.entries()) {
    if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      continue;
    }
    responseHeaders.set(key, value);
  }

  // Preserve multiple Set-Cookie headers properly
  if (typeof (backendRes.headers as any).getSetCookie === "function") {
    const cookies = (backendRes.headers as any).getSetCookie();
    for (const cookie of cookies) {
      responseHeaders.append("set-cookie", cookie);
    }
  } else {
    const cookieHeader = backendRes.headers.get("set-cookie");
    if (cookieHeader) {
      responseHeaders.set("set-cookie", cookieHeader);
    }
  }

  // Safely buffer the body as an ArrayBuffer to avoid stream piping / truncation issues
  const responseBody = [204, 304].includes(backendRes.status)
    ? null
    : await backendRes.arrayBuffer();

  return new Response(responseBody, {
    status: backendRes.status,
    statusText: backendRes.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        return await handleApiProxy(request, url);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

