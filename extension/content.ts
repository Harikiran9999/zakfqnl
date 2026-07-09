import type { PlasmoCSConfig } from "plasmo"
import { detectPlatform, type PlatformConfig } from "~lib/config/platforms"
import { memoryService } from "~lib/services/memory"
import { sessionStore } from "~lib/storage/session"

export const config: PlasmoCSConfig = {
  matches: [
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
}

const platform: PlatformConfig | null = detectPlatform(location.host)

// ---------------------------------------------------------------- DOM helpers
function firstMatch(selectors: string[]): HTMLElement | null {
  for (const s of selectors) {
    const el = document.querySelector(s) as HTMLElement | null
    if (el) return el
  }
  return null
}

function promptEl() {
  return platform ? firstMatch(platform.promptSelectors) : null
}

function captureConversation(): string {
  if (!platform) return ""
  const container = firstMatch(platform.conversationSelectors)
  return (container?.innerText || document.body.innerText || "").trim().slice(0, 20000)
}

function capturePrompt(): string {
  const el = promptEl()
  if (!el) return ""
  return el instanceof HTMLTextAreaElement ? el.value : el.innerText || ""
}

function insertPrompt(text: string) {
  const el = promptEl()
  if (!el) return
  el.focus()
  if (el instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
    setter?.call(el, text)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  } else {
    el.innerText = text
    el.dispatchEvent(new InputEvent("input", { bubbles: true }))
  }
}

// ---------------------------------------------------------------- messaging (popup <-> content)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CAPTURE")
    sendResponse({
      conversation: captureConversation(),
      prompt: capturePrompt(),
      platform: platform?.id || "",
      url: location.href
    })
  else if (msg?.type === "GET_PROMPT") sendResponse({ text: capturePrompt() })
  else if (msg?.type === "INSERT") {
    insertPrompt(msg.text)
    sendResponse({ ok: true })
  }
  return true
})

// ---------------------------------------------------------------- injected UI
function toast(message: string) {
  let t = document.getElementById("bounce-toast")
  if (!t) {
    t = document.createElement("div")
    t.id = "bounce-toast"
    t.style.cssText =
      "position:fixed;right:20px;bottom:150px;z-index:2147483000;background:rgba(17,24,39,0.92);color:#fff;font:500 12px Inter,system-ui,sans-serif;padding:6px 12px;border-radius:999px;backdrop-filter:blur(24px);transition:opacity .18s"
    document.body.appendChild(t)
  }
  t.textContent = message
  t.style.opacity = "1"
  window.setTimeout(() => t && (t.style.opacity = "0"), 1600)
}

async function quickSave() {
  const token = await sessionStore.get()
  if (!token) return toast("Open the Bounce popup to connect")
  toast("Understanding…")
  try {
    const workspaces = await memoryService.listWorkspaces()
    const res = await memoryService.save({
      conversation: captureConversation(),
      folder_id: workspaces[0]?.folder_id,
      source_platform: platform?.id,
      source_url: location.href
    })
    toast(`Memory Ready · v${res.memory_version}`)
  } catch (e: any) {
    toast(e?.message || "Save failed")
  }
}

function buildButton(): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.id = "bounce-fab"
  btn.type = "button"
  btn.innerHTML =
    '<span style="width:8px;height:8px;border-radius:999px;background:#4F46E5;box-shadow:0 0 12px rgba(79,70,229,0.6)"></span> Bounce'
  btn.style.cssText =
    "display:inline-flex;align-items:center;gap:6px;padding:8px 12px;margin:0 6px;border:none;border-radius:999px;background:#111827;color:#fff;font:500 13px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(17,24,39,0.16);transition:transform .18s cubic-bezier(0.22,1,0.36,1)"
  btn.onmouseenter = () => (btn.style.transform = "scale(1.02)")
  btn.onmouseleave = () => (btn.style.transform = "scale(1)")
  btn.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    quickSave()
  }
  return btn
}

function buildFloating(): HTMLButtonElement {
  const btn = buildButton()
  btn.style.position = "fixed"
  btn.style.right = "20px"
  btn.style.bottom = "96px"
  btn.style.zIndex = "2147483000"
  return btn
}

// Prefer placing the button beside the send button; fall back to a floating pill.
function mount() {
  if (!platform || document.getElementById("bounce-fab")) return
  const sendBtn = firstMatch(platform.sendButtonSelectors)
  if (sendBtn?.parentElement) {
    sendBtn.parentElement.insertBefore(buildButton(), sendBtn)
  } else {
    document.body.appendChild(buildFloating())
  }
}

if (platform) {
  const start = () => {
    mount()
    // Re-mount across SPA navigations / re-renders.
    new MutationObserver(() => {
      if (!document.getElementById("bounce-fab")) mount()
    }).observe(document.documentElement, { childList: true, subtree: true })
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start)
  else start()
}
