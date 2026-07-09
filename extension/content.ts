import type { PlasmoCSConfig } from "plasmo"
import { detectPlatform } from "~lib/platforms"
import { api, getToken } from "~lib/api"

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

const platform = detectPlatform(location.host)

function findInput(): HTMLElement | null {
  if (!platform) return null
  for (const sel of platform.inputSelectors) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (el) return el
  }
  return null
}

function captureConversation(): string {
  const sel = platform?.conversationSelectors?.[0] || "main"
  const main = document.querySelector(sel) as HTMLElement | null
  const text = (main?.innerText || document.body.innerText || "").trim()
  return text.slice(0, 24000)
}

function getInputText(): string {
  const el = findInput()
  if (!el) return ""
  if (el instanceof HTMLTextAreaElement) return el.value
  return el.innerText || ""
}

function insertText(text: string) {
  const el = findInput()
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

// ---- Popup <-> content messaging ----
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type === "CAPTURE") sendResponse({ text: captureConversation(), platform: platform?.id || "", url: location.href })
  else if (msg?.type === "GET_INPUT") sendResponse({ text: getInputText() })
  else if (msg?.type === "INSERT") { insertText(msg.text); sendResponse({ ok: true }) }
  return true
})

// ---- Floating Bounce button beside the prompt ----
function toast(message: string) {
  let t = document.getElementById("bounce-toast")
  if (!t) {
    t = document.createElement("div")
    t.id = "bounce-toast"
    t.style.cssText =
      "position:fixed;right:20px;bottom:150px;z-index:2147483000;background:rgba(17,24,39,0.92);color:#fff;font:500 12px Inter,sans-serif;padding:6px 12px;border-radius:999px;backdrop-filter:blur(24px);transition:opacity .18s"
    document.body.appendChild(t)
  }
  t.textContent = message
  t.style.opacity = "1"
  setTimeout(() => { if (t) t.style.opacity = "0" }, 1600)
}

async function quickSave() {
  const token = await getToken()
  if (!token) return toast("Open the Bounce popup to connect")
  toast("Understanding…")
  try {
    const folders = await api.folders()
    await api.save({
      conversation: captureConversation(),
      folder_id: folders[0]?.folder_id,
      source_platform: platform?.id,
      source_url: location.href
    })
    toast("Memory Ready")
  } catch (e: any) {
    toast(e?.message || "Save failed")
  }
}

function mountButton() {
  if (!platform || document.getElementById("bounce-fab")) return
  const btn = document.createElement("button")
  btn.id = "bounce-fab"
  btn.innerHTML =
    '<span style="width:8px;height:8px;border-radius:999px;background:#4F46E5;box-shadow:0 0 12px rgba(79,70,229,0.6)"></span> Bounce'
  btn.style.cssText =
    "position:fixed;right:20px;bottom:96px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:10px 16px;border:none;border-radius:999px;background:#111827;color:#fff;font:500 13px Inter,sans-serif;cursor:pointer;box-shadow:0 8px 30px rgba(17,24,39,0.18);transition:transform .18s cubic-bezier(0.22,1,0.36,1)"
  btn.onmouseenter = () => (btn.style.transform = "scale(1.02)")
  btn.onmouseleave = () => (btn.style.transform = "scale(1)")
  btn.onclick = quickSave
  document.body.appendChild(btn)
}

if (platform) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountButton)
  else mountButton()
  // Re-mount on SPA navigations
  new MutationObserver(() => mountButton()).observe(document.documentElement, { childList: true, subtree: true })
}
