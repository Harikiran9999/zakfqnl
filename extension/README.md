# Bounce — Chrome Extension

The AI Memory Layer. Save memory, not messages. Built with Plasmo + React + TypeScript + Tailwind + Framer Motion (Manifest V3).

## Load the extension (development)

1. Build (already done): `yarn install && yarn build`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select:
   `/app/extension/build/chrome-mv3-prod`

## Connect your account

1. Open the Bounce web dashboard, sign in, go to **Connect Extension**, and copy the connection code.
2. Click the Bounce extension icon → paste the connection code → **Connect**.

## Use it

- Visit any supported AI site (ChatGPT, Gemini, Claude, Perplexity, Grok, DeepSeek, OpenRouter).
- A **Bounce** button appears near the prompt. Click it to save the current conversation as a memory.
- Open the popup to **Optimize** the current prompt, **Save**, **Save as new folder**, or **Deploy** a folder's memory straight into the prompt box.

## Config

- `PLASMO_PUBLIC_BACKEND_URL` in `.env` points the extension at the Bounce backend.
- Rebuild after changing `.env`.

## Notes

- All AI logic runs through the backend API — the extension never calls models directly.
- Auth uses a bearer session token stored in `chrome.storage.local`.
