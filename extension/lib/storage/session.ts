// Thin, testable wrapper around chrome.storage.local for the session token.

const TOKEN_KEY = "bounce_token"

export const sessionStore = {
  get(): Promise<string | null> {
    return new Promise((resolve) =>
      chrome.storage.local.get(TOKEN_KEY, (r) => resolve(r?.[TOKEN_KEY] || null))
    )
  },
  set(token: string): Promise<void> {
    return new Promise((resolve) => chrome.storage.local.set({ [TOKEN_KEY]: token }, () => resolve()))
  },
  clear(): Promise<void> {
    return new Promise((resolve) => chrome.storage.local.remove(TOKEN_KEY, () => resolve()))
  }
}
