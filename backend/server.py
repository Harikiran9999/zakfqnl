import os
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, Query
from fastapi.responses import RedirectResponse
from starlette.middleware.cors import CORSMiddleware
import httpx
import secrets

from bounce import db, llm, memory as mem, bmf as bmf_mod, deploy as deploy_mod
from bounce.models import (
    User, Folder, Memory, Deployment,
    SaveRequest, DeployRequest, SearchRequest, MergeRequest, OptimizeRequest,
    SessionRequest, FolderCreate,
)
from bounce import auth

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("bounce")

app = FastAPI(title="Bounce API")
api = APIRouter(prefix="/api")

FRONTEND_URL = os.environ.get("APP_URL", "")


# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"service": "bounce", "status": "ok"}


# ---------------- Auth ----------------
@api.post("/auth/session")
async def auth_session(payload: SessionRequest, response: Response):
    info = await auth.exchange_emergent_session(payload.session_id)
    user = await auth.upsert_user(info, provider="google")
    token = await auth.create_session(user["user_id"], info.get("session_token"))
    auth.set_session_cookie(response, token)
    return {"user": {k: user.get(k) for k in ("user_id", "email", "name", "picture", "provider")},
            "session_token": token}


@api.get("/auth/me")
async def auth_me(current=Depends(auth.get_current_user)):
    return {k: current.get(k) for k in ("user_id", "email", "name", "picture", "provider")}


@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token") or ""
    if token:
        await db.sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# GitHub OAuth (env-gated)
@api.get("/auth/github/login")
async def github_login(redirect: str = Query("")):
    cid = os.environ.get("GITHUB_CLIENT_ID", "")
    if not cid:
        raise HTTPException(status_code=503, detail="GitHub login not configured")
    state = redirect or FRONTEND_URL
    url = (f"https://github.com/login/oauth/authorize?client_id={cid}"
           f"&scope=read:user%20user:email&state={state}")
    return RedirectResponse(url)


@api.get("/auth/github/callback")
async def github_callback(code: str, state: str = ""):
    cid = os.environ.get("GITHUB_CLIENT_ID", "")
    secret = os.environ.get("GITHUB_CLIENT_SECRET", "")
    if not cid or not secret:
        raise HTTPException(status_code=503, detail="GitHub login not configured")
    async with httpx.AsyncClient(timeout=15) as client:
        tok = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={"client_id": cid, "client_secret": secret, "code": code},
        )
        access = tok.json().get("access_token")
        if not access:
            raise HTTPException(status_code=401, detail="GitHub auth failed")
        h = {"Authorization": f"Bearer {access}", "Accept": "application/json"}
        prof = (await client.get("https://api.github.com/user", headers=h)).json()
        emails = (await client.get("https://api.github.com/user/emails", headers=h)).json()
    email = next((e["email"] for e in emails if e.get("primary")), prof.get("email") or f"{prof.get('login')}@users.noreply.github.com")
    info = {"email": email, "name": prof.get("name") or prof.get("login"), "picture": prof.get("avatar_url", "")}
    user = await auth.upsert_user(info, provider="github")
    token = await auth.create_session(user["user_id"])
    dest = (state or FRONTEND_URL).rstrip("/") + f"/dashboard#session_token={token}"
    return RedirectResponse(dest)


# ---------------- Folders ----------------
@api.get("/folders")
async def list_folders(current=Depends(auth.get_current_user)):
    uid = current["user_id"]
    docs = await db.folders.find({"user_id": uid}, {"_id": 0}).to_list(500)
    out = []
    for f in docs:
        count = await db.memories.count_documents({"user_id": uid, "folder_id": f["folder_id"]})
        f["memory_count"] = count
        out.append(f)
    out.sort(key=lambda x: x["created_at"])
    return out


@api.post("/folders")
async def create_folder(payload: FolderCreate, current=Depends(auth.get_current_user)):
    folder = Folder(user_id=current["user_id"], name=payload.name.strip() or "Untitled")
    await db.folders.insert_one(folder.model_dump())
    d = folder.model_dump()
    d["memory_count"] = 0
    return d


async def _get_or_create_folder(uid, folder_id, folder_name):
    if folder_id:
        f = await db.folders.find_one({"user_id": uid, "folder_id": folder_id}, {"_id": 0})
        if not f:
            raise HTTPException(status_code=404, detail="Folder not found")
        return f
    if folder_name:
        f = await db.folders.find_one({"user_id": uid, "name": folder_name}, {"_id": 0})
        if f:
            return f
        folder = Folder(user_id=uid, name=folder_name.strip())
        await db.folders.insert_one(folder.model_dump())
        return folder.model_dump()
    raise HTTPException(status_code=400, detail="folder_id or folder_name required")


# ---------------- Memory pipeline ----------------
@api.post("/memory/save")
async def save_memory(payload: SaveRequest, current=Depends(auth.get_current_user)):
    uid = current["user_id"]
    folder = await _get_or_create_folder(uid, payload.folder_id, payload.folder_name)

    # 1. Conversation Understanding -> partial BMF
    partial = await llm.extract_bmf(payload.conversation)

    # 2. Evolve the workspace's Project Memory (never overwrite; move changes to history)
    doc = await db.workspace_memories.find_one(
        {"user_id": uid, "folder_id": folder["folder_id"]}, {"_id": 0})
    current_bmf = doc["bmf"] if doc else bmf_mod.empty_bmf(folder["folder_id"], folder["name"])
    evolved = bmf_mod.evolve(current_bmf, partial,
                             source_ai=payload.source_platform or "", source_model="")
    package = bmf_mod.build_package(evolved)
    await db.workspace_memories.update_one(
        {"user_id": uid, "folder_id": folder["folder_id"]},
        {"$set": {"user_id": uid, "folder_id": folder["folder_id"], "bmf": evolved,
                  "package": package, "updated_at": bmf_mod._now()},
         "$setOnInsert": {"created_at": bmf_mod._now()}},
        upsert=True,
    )

    # 3. Save-event log (compact snapshot) powers Recent + Search + dashboard cards
    compact = bmf_mod.to_compact(evolved)
    m = Memory(
        user_id=uid, folder_id=folder["folder_id"],
        title=payload.title or mem.make_title(compact),
        structured=compact, bmf=package,
        searchable_text=mem.searchable_text(compact),
        source_platform=payload.source_platform or "", source_url=payload.source_url or "",
    )
    await db.memories.insert_one(m.model_dump())

    return {
        "memory": _clean_memory(m.model_dump()),
        "folder": {"folder_id": folder["folder_id"], "name": folder["name"]},
        "memory_version": evolved["metadata"]["memory_version"],
        "next_recommendation": evolved.get("next_recommendation", ""),
        "conversation_intent": evolved.get("conversation_intent", ""),
    }


@api.post("/memory/deploy")
async def deploy_memory(payload: DeployRequest, current=Depends(auth.get_current_user)):
    uid = current["user_id"]
    folder = await db.folders.find_one({"user_id": uid, "folder_id": payload.folder_id}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    doc = await db.workspace_memories.find_one(
        {"user_id": uid, "folder_id": payload.folder_id}, {"_id": 0})
    if not doc or doc["bmf"]["metadata"]["memory_version"] == 0:
        raise HTTPException(status_code=400, detail="No memory in this workspace yet")

    built = deploy_mod.build_context(doc["bmf"], payload.current_prompt or "")
    dep = Deployment(user_id=uid, folder_id=payload.folder_id, context=built["context"], memory_ids=[])
    await db.deployments.insert_one(dep.model_dump())
    return {
        "context": built["context"],
        "deployment_id": dep.deployment_id,
        "relevance": built["relevance"],
        "memory_version": doc["bmf"]["metadata"]["memory_version"],
    }


@api.get("/workspace/{folder_id}/memory")
async def workspace_memory(folder_id: str, current=Depends(auth.get_current_user)):
    doc = await db.workspace_memories.find_one(
        {"user_id": current["user_id"], "folder_id": folder_id}, {"_id": 0})
    if not doc:
        folder = await db.folders.find_one(
            {"user_id": current["user_id"], "folder_id": folder_id}, {"_id": 0})
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        return {"bmf": bmf_mod.empty_bmf(folder_id, folder["name"])}
    return {"bmf": doc["bmf"]}


@api.get("/workspace/{folder_id}/export")
async def workspace_export(folder_id: str, current=Depends(auth.get_current_user)):
    doc = await db.workspace_memories.find_one(
        {"user_id": current["user_id"], "folder_id": folder_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No memory to export")
    name = doc["bmf"]["metadata"]["workspace_name"] or "workspace"
    return {
        "filename": f"{name.lower().replace(' ', '_')}.bmf",
        "bmf_version": bmf_mod.BMF_VERSION,
        "package": doc["package"],
    }


@api.post("/memory/search")
async def search_memory(payload: SearchRequest, current=Depends(auth.get_current_user)):
    uid = current["user_id"]
    q = {"user_id": uid}
    if payload.folder_id:
        q["folder_id"] = payload.folder_id
    docs = await db.memories.find(q, {"_id": 0}).to_list(2000)
    scored = []
    for d in docs:
        s = mem.score(payload.query, d.get("searchable_text", "") + " " + d.get("title", ""))
        if s > 0:
            scored.append((s, d))
    scored.sort(key=lambda x: x[0], reverse=True)
    return {"results": [_clean_memory(d) | {"score": round(s, 3)} for s, d in scored[:25]]}


@api.post("/memory/merge")
async def merge_memory(payload: MergeRequest, current=Depends(auth.get_current_user)):
    uid = current["user_id"]
    docs = await db.memories.find(
        {"user_id": uid, "folder_id": payload.folder_id, "memory_id": {"$in": payload.memory_ids}},
        {"_id": 0}).to_list(1000)
    if len(docs) < 2:
        raise HTTPException(status_code=400, detail="Select at least two memories to merge")
    merged = mem.merge_structured([d["structured"] for d in docs])
    m = Memory(
        user_id=uid, folder_id=payload.folder_id,
        title="Merged: " + mem.make_title(merged),
        structured=merged, bmf=mem.build_bmf(merged),
        searchable_text=mem.searchable_text(merged),
    )
    await db.memories.insert_one(m.model_dump())
    if payload.delete_sources:
        await db.memories.delete_many({"user_id": uid, "memory_id": {"$in": payload.memory_ids}})
    return {"memory": _clean_memory(m.model_dump())}


@api.post("/optimize")
async def optimize(payload: OptimizeRequest, current=Depends(auth.get_current_user)):
    optimized = await llm.optimize_prompt(payload.prompt)
    return {"optimized": optimized}


@api.get("/recent")
async def recent(current=Depends(auth.get_current_user), limit: int = 20):
    uid = current["user_id"]
    docs = await db.memories.find({"user_id": uid}, {"_id": 0}).to_list(2000)
    docs.sort(key=lambda x: x["created_at"], reverse=True)
    folders = {f["folder_id"]: f["name"] for f in await db.folders.find({"user_id": uid}, {"_id": 0}).to_list(500)}
    out = []
    for d in docs[:limit]:
        c = _clean_memory(d)
        c["folder_name"] = folders.get(d["folder_id"], "")
        out.append(c)
    return {"recent": out}


@api.get("/memory/{memory_id}")
async def get_memory(memory_id: str, current=Depends(auth.get_current_user)):
    d = await db.memories.find_one({"user_id": current["user_id"], "memory_id": memory_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Memory not found")
    return _clean_memory(d)


@api.delete("/memory/{memory_id}")
async def delete_memory(memory_id: str, current=Depends(auth.get_current_user)):
    res = await db.memories.delete_one({"user_id": current["user_id"], "memory_id": memory_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"ok": True}


@api.get("/deployments")
async def list_deployments(current=Depends(auth.get_current_user), limit: int = 30):
    docs = await db.deployments.find({"user_id": current["user_id"]}, {"_id": 0}).to_list(1000)
    docs.sort(key=lambda x: x["created_at"], reverse=True)
    return {"deployments": docs[:limit]}


def _clean_memory(d: dict) -> dict:
    return {
        "memory_id": d["memory_id"],
        "folder_id": d["folder_id"],
        "title": d.get("title", ""),
        "structured": d.get("structured", {}),
        "source_platform": d.get("source_platform", ""),
        "created_at": d.get("created_at", ""),
    }


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    db.close()
