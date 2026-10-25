/**
 * Centralised API client.
 *
 * All requests flow through here so we can:
 *  - Attach auth headers in one place
 *  - Handle 401 / token refresh uniformly
 *  - Provide typed request/response helpers
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, AxiosError } from "axios";
import { type ApiError } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

function createClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: BASE_URL,
    headers: { "Content-Type": "application/json" },
    timeout: 30_000,
  });

  // Attach bearer token from session storage (set by auth provider)
  instance.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("access_token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Uniform error shaping
  instance.interceptors.response.use(
    (res) => res,
    (err: AxiosError) => {
      const apiError: ApiError = {
        code: String(err.response?.status ?? "NETWORK_ERROR"),
        message:
          (err.response?.data as { message?: string })?.message ??
          err.message ??
          "An unexpected error occurred",
        details: err.response?.data,
        requestId: err.response?.headers?.["x-request-id"],
      };
      return Promise.reject(apiError);
    }
  );

  return instance;
}

export const apiClient = createClient();

// ─── Typed helpers ────────────────────────────────────────────

export async function get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.get<T>(path, config);
  return data;
}

export async function post<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await apiClient.post<T>(path, body, config);
  return data;
}

export async function put<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await apiClient.put<T>(path, body, config);
  return data;
}

export async function patch<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await apiClient.patch<T>(path, body, config);
  return data;
}

export async function del<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.delete<T>(path, config);
  return data;
}

export async function uploadFile<T>(
  path: string,
  formData: FormData,
  onProgress?: (pct: number) => void
): Promise<T> {
  const { data } = await apiClient.post<T>(path, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (ev) => {
      if (onProgress && ev.total) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    },
  });
  return data;
}
