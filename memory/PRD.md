# Bounce — The AI Memory Layer (PRD)

## Original problem statement
Build the world's first AI Memory Layer. Bounce works like iCloud for AI conversations — users
save structured **memory, not messages**, then deploy that context into any AI. Apple-grade,
quiet, premium design. Product surfaces: Chrome Extension, Web Dashboard, Backend API, AI Memory
Engine, Storage, Memory Compiler, Deploy Engine, Authentication.

## User choices (locked)
- First surface: **Chrome Extension + Backend**
- Auth: **Google (Emergent-managed) + GitHub**
- Database: **MongoDB**
- AI: **OpenRouter → Anthropic Claude** (user key; extract=claude-haiku-4.5, reason=claude-sonnet-4.5)
- Search: text/semantic (lexical scoring) for v1

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) + package `bounce/` (db, models, llm, auth, memory).
- Memory pipeline: extract (Claude JSON) → merge (union) → .bmf package (msgpack→brotli→base64) → deploy `<context>`.
- Auth: Emergent Google session exchange → Mongo `user_sessions`; Bearer token + httpOnly cookie. GitHub OAuth env-gated.
- Frontend: React dashboard (`src/pages`, `src/components`) — Inter, glass, spring animations, 8px system, indigo accent.
- Extension: Plasmo MV3 (`/app/extension`) — popup + vanilla content script, built to `build/chrome-mv3-prod`.

## Implemented (2026-07-09)
- ✅ Backend APIs: auth (me/session/logout, GitHub gated), folders CRUD + default seeding, memory save/deploy/search/merge, optimize, recent, deployments, memory get/delete. Real Claude extraction verified.
- ✅ Web dashboard: Landing, Login (Google+GitHub), auth callback, Dashboard (Recent, Folders, Search, Deploy History, Connect Extension, Settings), New Memory save panel with progress stages, Deploy modal.
- ✅ Chrome extension (built): popup (connect via code, optimize/save/new-folder, deploy folders), content script (Bounce button + capture/insert on ChatGPT/Gemini/Claude/Perplexity/Grok/DeepSeek/OpenRouter).
- ✅ Testing: backend 15/15 pytest, frontend e2e — 100% pass.

## Backlog / Next
- P1: GitHub OAuth — needs user's GitHub OAuth App client id/secret (set GITHUB_CLIENT_ID/SECRET in backend/.env).
- P1: Real vector embeddings for semantic search (currently lexical).
- P2: Memory timeline, diff viewer, memory health, AI recall, team workspaces, billing/usage.
- P2: Merge-on-save into a consolidated per-folder memory; snapshots & deploy history per folder.
- P2: Supabase/Postgres migration option; encrypt-at-rest; Supabase Storage for large files.
- Tech debt: split Dashboard.jsx into per-view files; move Mongo sorts to indexed cursors; rotate committed OpenRouter key before public push.
