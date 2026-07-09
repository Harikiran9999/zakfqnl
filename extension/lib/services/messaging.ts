// Popup <-> content-script messaging contract.

import type { CaptureResult } from "~lib/types"

export type ContentMessage =
  | { type: "CAPTURE" }
  | { type: "GET_PROMPT" }
  | { type: "INSERT"; text: string }

export function sendToActiveTab<T = any>(message: ContentMessage): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return resolve(null)
      chrome.tabs.sendMessage(tab.id, message, (res) => {
        if (chrome.runtime.lastError) return resolve(null)
        resolve(res as T)
      })
    })
  })
}

export const capture = () => sendToActiveTab<CaptureResult>({ type: "CAPTURE" })
export const getPrompt = () => sendToActiveTab<{ text: string }>({ type: "GET_PROMPT" })
export const insert = (text: string) => sendToActiveTab<{ ok: boolean }>({ type: "INSERT", text })
