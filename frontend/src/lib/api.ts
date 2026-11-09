"use client";

import { auth } from "@/lib/firebase";

const rawBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000/api/v1";

const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean;
  timeoutMs?: number;
}

async function getErrorMessage(response: Response): Promise<{
  message: string;
  detail: unknown;
}> {
  const text = await response.text();

  if (!text) {
    return {
      message: response.statusText || "Request failed.",
      detail: null,
    };
  }

  try {
    const data: unknown = JSON.parse(text);

    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data
    ) {
      const detail = (data as { detail: unknown }).detail;

      return {
        message:
          typeof detail === "string"
            ? detail
            : "The request could not be completed.",
        detail,
      };
    }

    return {
      message: "The request could not be completed.",
      detail: data,
    };
  } catch {
    return {
      message: "The server returned an unexpected response.",
      detail: text,
    };
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    requireAuth = true,
    headers: requestHeaders,
    body,
    timeoutMs = 45000,
    ...fetchOptions
  } = options;

  const headers = new Headers(requestHeaders);

  headers.set("Accept", "application/json");

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  if (body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (requireAuth) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new ApiError("Authentication required.", 401);
    }

    const idToken = await currentUser.getIdToken();

    headers.set("Authorization", `Bearer ${idToken}`);
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = `${API_BASE_URL}${normalizedPath}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(fullUrl, {
      ...fetchOptions,
      body,
      headers,
      signal: fetchOptions.signal || controller.signal,
      cache: fetchOptions.cache ?? "no-store",
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        `Server request timed out after ${Math.round(timeoutMs / 1000)}s. The backend may be waking up from sleep (cold start). Please try again.`,
        408,
      );
    }
    throw new ApiError(
      `Unable to connect to server at ${API_BASE_URL}. Please verify your network and backend status.`,
      0,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = await getErrorMessage(response);

    throw new ApiError(
      error.message,
      response.status,
      error.detail,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();

  if (!responseText) {
    return undefined as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new ApiError(
      "The server returned an invalid response.",
      response.status,
    );
  }
}
