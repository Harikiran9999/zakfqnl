export type Platform = {
  id: string
  name: string
  hostIncludes: string[]
  // selectors are best-effort; capture falls back to main/body innerText
  inputSelectors: string[]
  conversationSelectors: string[]
}

export const PLATFORMS: Platform[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    hostIncludes: ["chatgpt.com", "chat.openai.com"],
    inputSelectors: ["#prompt-textarea", "div[contenteditable='true']", "textarea"],
    conversationSelectors: ["main", "[role='presentation']"]
  },
  {
    id: "gemini",
    name: "Gemini",
    hostIncludes: ["gemini.google.com"],
    inputSelectors: ["div.ql-editor[contenteditable='true']", "textarea", "div[contenteditable='true']"],
    conversationSelectors: ["main", "chat-window"]
  },
  {
    id: "claude",
    name: "Claude",
    hostIncludes: ["claude.ai"],
    inputSelectors: ["div[contenteditable='true']", "textarea"],
    conversationSelectors: ["main", "div.flex-1"]
  },
  {
    id: "perplexity",
    name: "Perplexity",
    hostIncludes: ["perplexity.ai"],
    inputSelectors: ["textarea", "div[contenteditable='true']"],
    conversationSelectors: ["main"]
  },
  {
    id: "grok",
    name: "Grok",
    hostIncludes: ["grok.com", "x.com/i/grok"],
    inputSelectors: ["textarea", "div[contenteditable='true']"],
    conversationSelectors: ["main"]
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    hostIncludes: ["chat.deepseek.com"],
    inputSelectors: ["textarea#chat-input", "textarea", "div[contenteditable='true']"],
    conversationSelectors: ["main"]
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    hostIncludes: ["openrouter.ai"],
    inputSelectors: ["textarea", "div[contenteditable='true']"],
    conversationSelectors: ["main"]
  }
]

export function detectPlatform(host: string): Platform | null {
  return PLATFORMS.find((p) => p.hostIncludes.some((h) => host.includes(h.split("/")[0]))) || null
}

export const SUPPORTED_MATCHES = [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://gemini.google.com/*",
  "https://claude.ai/*",
  "https://www.perplexity.ai/*",
  "https://perplexity.ai/*",
  "https://grok.com/*",
  "https://x.com/*",
  "https://chat.deepseek.com/*",
  "https://openrouter.ai/*"
]
