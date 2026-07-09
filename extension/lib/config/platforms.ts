// Supported AI platforms — detection + DOM anchors.
// Selectors are best-effort and ordered by preference. Capture falls back gracefully.

export interface PlatformConfig {
  id: string
  name: string
  hosts: string[]
  promptSelectors: string[]
  sendButtonSelectors: string[]
  conversationSelectors: string[]
}

export const PLATFORMS: PlatformConfig[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    hosts: ["chatgpt.com", "chat.openai.com"],
    promptSelectors: ["#prompt-textarea", "div[contenteditable='true']", "textarea"],
    sendButtonSelectors: ["button[data-testid='send-button']", "button[aria-label*='Send']"],
    conversationSelectors: ["main div[role='presentation']", "main"]
  },
  {
    id: "gemini",
    name: "Gemini",
    hosts: ["gemini.google.com"],
    promptSelectors: ["div.ql-editor[contenteditable='true']", "textarea", "div[contenteditable='true']"],
    sendButtonSelectors: ["button.send-button", "button[aria-label*='Send']", "button[mattooltip*='Send']"],
    conversationSelectors: ["chat-window", "main"]
  },
  {
    id: "claude",
    name: "Claude",
    hosts: ["claude.ai"],
    promptSelectors: ["div[contenteditable='true']", "textarea"],
    sendButtonSelectors: ["button[aria-label*='Send']", "button[aria-label*='send']"],
    conversationSelectors: ["main div.flex-1", "main"]
  },
  {
    id: "perplexity",
    name: "Perplexity",
    hosts: ["perplexity.ai"],
    promptSelectors: ["textarea", "div[contenteditable='true']"],
    sendButtonSelectors: ["button[aria-label*='Submit']", "button[aria-label*='Send']"],
    conversationSelectors: ["main"]
  },
  {
    id: "grok",
    name: "Grok",
    hosts: ["grok.com", "x.com"],
    promptSelectors: ["textarea", "div[contenteditable='true']"],
    sendButtonSelectors: ["button[aria-label*='Grok something']", "button[type='submit']"],
    conversationSelectors: ["main"]
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    hosts: ["chat.deepseek.com"],
    promptSelectors: ["textarea#chat-input", "textarea", "div[contenteditable='true']"],
    sendButtonSelectors: ["div[role='button'][aria-disabled]", "button[type='submit']"],
    conversationSelectors: ["main"]
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    hosts: ["openrouter.ai"],
    promptSelectors: ["textarea", "div[contenteditable='true']"],
    sendButtonSelectors: ["button[type='submit']", "button[aria-label*='Send']"],
    conversationSelectors: ["main"]
  }
]

export function detectPlatform(host: string): PlatformConfig | null {
  return PLATFORMS.find((p) => p.hosts.some((h) => host.includes(h))) || null
}
