import axios, { AxiosError, type AxiosAdapter, type AxiosRequestConfig, type AxiosResponse } from "axios";

import { handleMockRequest } from "./mockServer";

const API_MODE = String(import.meta.env.VITE_API_MODE ?? "mock").toLowerCase();
const USE_MOCK = API_MODE !== "real";
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000");

const mockAdapter: AxiosAdapter = async (config) => {
  const requestUrl = new URL(config.url ?? "/", config.baseURL ?? "http://mock.local").toString();
  const mockResponse = await handleMockRequest({
    method: String(config.method ?? "get").toUpperCase(),
    url: requestUrl,
    headers: normalizeHeaders(config.headers),
    body: parseBody(config.data),
  });

  const response: AxiosResponse = {
    data: mockResponse.data,
    status: mockResponse.status,
    statusText: String(mockResponse.status),
    headers: {},
    config,
    request: undefined,
  };

  if (mockResponse.status >= 200 && mockResponse.status < 300) {
    return response;
  }

  const data = mockResponse.data as { message?: string } | undefined;
  throw new AxiosError(
    data?.message || `Request failed with status code ${mockResponse.status}`,
    undefined,
    config,
    undefined,
    response,
  );
};

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  adapter: USE_MOCK ? mockAdapter : undefined,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("token");
      if (!location.pathname.includes("/login")) {
        location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

if (import.meta.env.DEV) {
  console.info(`[api] mode=${USE_MOCK ? "mock" : "real"}, baseURL=${API_BASE_URL}`);
}

function parseBody(data: unknown): unknown {
  if (typeof data !== "string") {
    return data;
  }

  if (!data.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function normalizeHeaders(headers: AxiosRequestConfig["headers"]): Record<string, string> {
  if (!headers) {
    return {};
  }

  const withToJson = headers as Record<string, unknown> & { toJSON?: () => Record<string, unknown> };
  const source = typeof withToJson.toJSON === "function" ? withToJson.toJSON() : withToJson;
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.map((item) => String(item)).join(",");
      continue;
    }

    normalized[key.toLowerCase()] = String(value);
  }

  return normalized;
}

export default http;
