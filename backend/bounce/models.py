from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime, timezone
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class StructuredMemory(BaseModel):
    goal: str = ""
    project: str = ""
    decisions: List[str] = Field(default_factory=list)
    constraints: List[str] = Field(default_factory=list)
    todos: List[str] = Field(default_factory=list)
    files: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    architecture: str = ""
    preferences: List[str] = Field(default_factory=list)
    summary: str = ""


class User(BaseModel):
    user_id: str
    email: str
    name: str = ""
    picture: str = ""
    provider: str = "google"
    created_at: str = Field(default_factory=_now)


class Folder(BaseModel):
    folder_id: str = Field(default_factory=lambda: f"fld_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    created_at: str = Field(default_factory=_now)


class Memory(BaseModel):
    memory_id: str = Field(default_factory=lambda: f"mem_{uuid.uuid4().hex[:12]}")
    user_id: str
    folder_id: str
    title: str = ""
    structured: dict = Field(default_factory=dict)
    bmf: str = ""
    searchable_text: str = ""
    source_platform: str = ""
    source_url: str = ""
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class Deployment(BaseModel):
    deployment_id: str = Field(default_factory=lambda: f"dep_{uuid.uuid4().hex[:12]}")
    user_id: str
    folder_id: str
    context: str = ""
    memory_ids: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=_now)


# ---- Request payloads ----
class SaveRequest(BaseModel):
    conversation: str
    folder_id: Optional[str] = None
    folder_name: Optional[str] = None
    title: Optional[str] = None
    source_platform: Optional[str] = ""
    source_url: Optional[str] = ""


class DeployRequest(BaseModel):
    folder_id: str


class SearchRequest(BaseModel):
    query: str
    folder_id: Optional[str] = None


class MergeRequest(BaseModel):
    folder_id: str
    memory_ids: List[str]
    delete_sources: bool = False


class OptimizeRequest(BaseModel):
    prompt: str


class SessionRequest(BaseModel):
    session_id: str


class FolderCreate(BaseModel):
    name: str
