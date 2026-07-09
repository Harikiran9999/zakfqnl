# Bounce — The AI Memory Layer (PRD)

## Original problem statement
The world's first AI Memory Layer. Bounce works like iCloud for AI conversations — users
save structured **project memory, not messages**, and carry that context into any AI. Users
should never explain their project twice. Apple × Arc × Linear × Raycast design.

## User choices (locked)
- First surface: Chrome Extension + Backend
- Auth: Google (Emergent-managed) + GitHub (env-gated, pending creds)
- Database: MongoDB
- AI: OpenRouter → Anthropic Claude (extract=claude-haiku-4.5, reason=claude-sonnet-4.5)
- Search: text/semantic (lexical) for v1

## Architecture
- Backend (the brain): FastAPI + MongoDB. Package `bounce/`: db, models, auth, llm, bmf, deploy, memory.
- **Bounce Memory Format (BMF v1)** — `bounce/bmf.py`: versioned package (metadata, project, current_state,
  decisions[status], architecture, constraints, preferences, knowledge, tasks{completed/pending/blocked/future},
  conversation_intent, next_recommendation, history). Package = msgpack→brotli→base64.
- **Memory Evolution** — `evolve()`: never overwrites; replaced scalars → history.state_changes, superseded
  decisions → history.decisions (Replaced/Rejected/Deprecated). Union+dedup lists. memory_version increments.
- **Deploy Engine** — `bounce/deploy.py`: understands current prompt, selects only relevant sections
  (lexical relevance + always-include core), emits minimal `<context>` package + relevance report.
- **Extension** — Plasmo MV3, production modular architecture under `extension/lib/`:
  types, config (platforms), storage, services (http, memory-interface+backend impl, messaging),
  animations, hooks (useSaveFlow), providers (AppProvider), components. `content.ts` injects the
  Bounce button beside each platform's send button; captures conversation + current prompt; deploys
  context into the prompt. Builds to `extension/build/chrome-mv3-prod`.
- Web dashboard: React (Recent/Folders/Search/Deploy History/Connect Extension/Settings + save panel).

## Implemented
- 2026-07-09 (v1): backend pipeline, dashboard, extension; auth (Google). Tested 100%.
- 2026-07-09 (BMF upgrade): full BMF, evolution+history, relevance Deploy Engine, workspace memory +
  `.bmf` export endpoints; extension rebuilt with clean modular/service architecture (swappable backend);
  send-button injection + prompt capture/deploy. Backend 16/16 pytest + frontend e2e — 100% pass.

## API
- auth: POST /auth/session, GET /auth/me, POST /auth/logout, GitHub (gated)
- folders: GET/POST /folders
- memory: POST /memory/save (evolve BMF), POST /memory/deploy (relevance), POST /memory/search,
  POST /memory/merge, POST /optimize, GET /recent, GET /deployments, GET/DELETE /memory/{id}
- workspace: GET /workspace/{id}/memory (full BMF), GET /workspace/{id}/export (.bmf package)

## Backlog / Next
- P1: GitHub OAuth — needs GITHUB_CLIENT_ID/SECRET.
- P1: Dashboard views for full BMF (decisions timeline, architecture, history/diff viewer, tasks board).
- P1: Load & smoke-test the extension in Chrome on live AI sites; refine per-platform selectors.
- P2: Real vector embeddings; team workspaces; memory health; billing/usage; desktop app.
- Tech debt: split Dashboard.jsx into per-view files; deep-copy BMF in evolve(); indexed Mongo sorts;
  rotate committed OpenRouter key before public push.
