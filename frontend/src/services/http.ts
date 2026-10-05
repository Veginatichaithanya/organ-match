import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";

// In-memory and session-scoped access token storage (does not persist across browser sessions)
let inMemoryAccessToken: string | null =
  typeof window !== "undefined"
    ? window.sessionStorage.getItem("access_token")
    : null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.sessionStorage.setItem("access_token", token);
      // Ensure any legacy localStorage token is cleaned up
      window.localStorage.removeItem("access_token");
    } else {
      window.sessionStorage.removeItem("access_token");
      window.localStorage.removeItem("access_token");
    }
  }
}

export function getAccessToken(): string | null {
  if (!inMemoryAccessToken && typeof window !== "undefined") {
    inMemoryAccessToken = window.sessionStorage.getItem("access_token");
  }
  return inMemoryAccessToken;
}


export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    if (code) this.code = code;
  }
}

// On browser, always use relative "/api" to route through Nitro/Vite/Nginx reverse proxy.
// This ensures instant same-origin delivery without external DNS resolution delays or CORS preflights.
export const http = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Single-flight refresh control
let refreshPromise: Promise<string> | null = null;

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
      _gatewayRetry?: boolean;
      _rateLimitRetry?: boolean;
    };

    // ── 429 Rate Limit: auto-retry after Retry-After delay (Render platform throttle) ──
    if (error.response?.status === 429 && originalRequest && !originalRequest._rateLimitRetry) {
      originalRequest._rateLimitRetry = true;
      // Honour the Retry-After header (in seconds), fallback to 65s for Render's free tier window
      const retryAfterHeader = error.response.headers?.["retry-after"];
      const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 65;
      const waitMs = (isNaN(retryAfterSec) ? 65 : retryAfterSec) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return http(originalRequest);
    }

    // ── 429 with no auto-retry (second hit): surface a clear user message ──
    if (error.response?.status === 429) {
      const retryAfterHeader = error.response.headers?.["retry-after"];
      const retrySec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
      const waitStr = isNaN(retrySec) ? "a minute" : `${retrySec} second${retrySec !== 1 ? "s" : ""}`;
      return Promise.reject(
        new ApiError(
          429,
          `Too many requests. The server is rate-limiting this IP. Please wait ${waitStr} and try again.`,
          "RATE_LIMITED"
        )
      );
    }

    // Automatic transparent multi-attempt retry on 502/503/504 gateway spin-up delays (Render free tier cold start)
    const isGatewaySpinUp =
      error.response?.status === 502 ||
      error.response?.status === 503 ||
      error.response?.status === 504 ||
      error.code === "ECONNABORTED";

    if (isGatewaySpinUp && originalRequest) {
      const currentAttempt = ((originalRequest as any)._gatewayRetryCount || 0) + 1;
      (originalRequest as any)._gatewayRetryCount = currentAttempt;

      if (currentAttempt <= 4) {
        const delayMs = Math.min(currentAttempt * 2500, 6000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return http(originalRequest);
      }
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes("/auth/login") || originalRequest.url?.includes("/auth/refresh")) {
        const detail = error.response.data?.detail || error.response.data?.error?.message || "Invalid credentials.";
        return Promise.reject(new ApiError(401, detail));
      }

      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = http
            .post<{ access_token: string; expires_in: number }>("/auth/refresh")
            .then((res) => {
              const newToken = res.data.access_token;
              setAccessToken(newToken);
              return newToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return http(originalRequest);
      } catch (refreshErr) {
        setAccessToken(null);
        return Promise.reject(new ApiError(401, "Session expired. Please sign in again."));
      }
    }

    const status = error.response?.status || 500;
    let detail =
      error.response?.data?.detail ||
      error.response?.data?.error?.message;

    if (!detail) {
      if (status === 502 || status === 503 || status === 504) {
        detail = `Backend server is spinning up from cold sleep (HTTP ${status}). Please allow 30–60 seconds and try again.`;
      } else {
        detail = error.message || "An unexpected error occurred.";
      }
    }
    const code = error.response?.data?.error?.code;

    return Promise.reject(new ApiError(status, detail, code));
  }
);
