const BACKEND = process.env.PLASMO_PUBLIC_BACKEND_URL
export const API = `${BACKEND}/api`

export function getToken(): Promise<string | null> {
  return new Promise((resolve) =>
    chrome.storage.local.get("bounce_token", (r) => resolve(r?.bounce_token || null))
  )
}
export function setToken(token: string): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.set({ bounce_token: token }, () => resolve()))
}
export function clearToken(): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.remove("bounce_token", () => resolve()))
}

async function req(path: string, options: RequestInit = {}) {
  const token = await getToken()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || `HTTP ${res.status}`)
  return res.json()
}

export const api = {
  me: () => req("/auth/me"),
  folders: () => req("/folders"),
  recent: () => req("/recent"),
  save: (body: any) => req("/memory/save", { method: "POST", body: JSON.stringify(body) }),
  deploy: (folder_id: string) => req("/memory/deploy", { method: "POST", body: JSON.stringify({ folder_id }) }),
  optimize: (prompt: string) => req("/optimize", { method: "POST", body: JSON.stringify({ prompt }) })
}
