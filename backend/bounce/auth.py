import os
import uuid
import secrets
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Response

from . import db
from .models import User, Folder

SESSION_DAYS = 7


def _now():
    return datetime.now(timezone.utc)


async def seed_default_folders(user_id: str):
    existing = await db.folders.count_documents({"user_id": user_id})
    if existing:
        return
    for name in db.DEFAULT_FOLDERS:
        await db.folders.insert_one(Folder(user_id=user_id, name=name).model_dump())


async def upsert_user(info: dict, provider: str) -> dict:
    email = info.get("email", "")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": info.get("name", existing.get("name", "")),
                      "picture": info.get("picture", existing.get("picture", ""))}},
        )
        await seed_default_folders(existing["user_id"])
        return existing
    user = User(
        user_id=f"user_{uuid.uuid4().hex[:12]}",
        email=email,
        name=info.get("name", ""),
        picture=info.get("picture", ""),
        provider=provider,
    )
    await db.users.insert_one(user.model_dump())
    await seed_default_folders(user.user_id)
    return user.model_dump()


async def create_session(user_id: str, token: str | None = None) -> str:
    token = token or secrets.token_urlsafe(32)
    await db.sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (_now() + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": _now().isoformat(),
    })
    return token


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token", value=token, httponly=True, secure=True,
        samesite="none", path="/", max_age=SESSION_DAYS * 24 * 3600,
    )


async def exchange_emergent_session(session_id: str) -> dict:
    url = os.environ["EMERGENT_AUTH_URL"]
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    return r.json()


def _extract_token(request: Request) -> str | None:
    token = request.cookies.get("session_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


async def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = session["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < _now():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
