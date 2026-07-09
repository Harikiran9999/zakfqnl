// Low-level HTTP client. Attaches the bearer token and normalizes errors.
// This is the single seam through which the extension talks to any backend.

import { sessionStore } from "~lib/storage/session"

const BACKEND = process.env.PLASMO_PUBLIC_BACKEND_URL
export const API_BASE = `${BACKEND}/api`

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await sessionStore.get()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      detail = (await res.json())?.detail || detail
    } catch {
      /* noop */
    }
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}
