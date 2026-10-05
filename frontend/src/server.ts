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
    if (key.toLowerCase() !== "host") {
      forwardHeaders.set(key, value);
    }
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

  try {
    const backendRes = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body,
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    for (const [key, value] of backendRes.headers.entries()) {
      if (key.toLowerCase() === "set-cookie") {
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

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(`[API Proxy] Error forwarding ${request.method} ${url.pathname} to ${targetUrl}:`, err);
    return new Response(
      JSON.stringify({
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: `Backend service is unreachable at ${backendBase}. If running on Render free tier, the backend may be booting up from cold sleep (takes ~45s). Please retry in a few moments.`,
          detail: err?.message || String(err),
        },
      }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }
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

