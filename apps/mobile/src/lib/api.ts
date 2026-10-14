import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { ApiErrorBody } from "@sukkot/shared";

/** Base URL of the web app that serves /api/v1. Set EXPO_PUBLIC_API_URL per build. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

const TOKEN_KEY = "sukkot.session";
let memoryToken: string | null = null;

// SecureStore is native-only; the web preview keeps the token in memory for the tab's lifetime.
export async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web") return memoryToken;
  memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return memoryToken;
}

export async function saveToken(token: string | null) {
  memoryToken = token;
  if (Platform.OS === "web") return;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/** Turn a relative URL from the API (e.g. an image path) into an absolute one. */
export function absoluteUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {}): Promise<T> {
  const qs = opts.query
    ? new URLSearchParams(Object.entries(opts.query).filter((e): e is [string, string] => !!e[1])).toString()
    : "";
  const headers: Record<string, string> = { Accept: "application/json", "X-Client": "mobile" };
  if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}${qs ? `?${qs}` : ""}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("Could not reach Sukkot Salone. Check your connection and try again.", 0, "NETWORK");
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    if (res.status === 401 && memoryToken) onUnauthorized?.();
    const err = data?.error;
    throw new ApiError(err?.message ?? `Request failed (${res.status})`, res.status, err?.code ?? "ERROR", err?.fields ?? {});
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

/** A random key so a retried payment record is not duplicated. */
export function idempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
