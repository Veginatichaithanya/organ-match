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
    const isAbsolute = config.url?.startsWith("http://") || config.url?.startsWith("https://");
    const isInternal = !isAbsolute || config.url?.includes("localhost:8000") || config.url?.includes("localhost:5173");
    if (isInternal) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

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
    const detail =
      error.response?.data?.detail ||
      error.response?.data?.error?.message ||
      error.message ||
      "An unexpected error occurred.";
    const code = error.response?.data?.error?.code;

    return Promise.reject(new ApiError(status, detail, code));
  }
);
