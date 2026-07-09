"""Bounce Memory Format (BMF) v1 — the complete portable state of a project.

BMF is not a chat export. It is a structured, versioned, future-proof package
describing a project's identity, state, decisions, architecture, constraints,
preferences, knowledge, tasks, intent and next step — plus an evolution history.
"""
from __future__ import annotations
import base64
import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any
import msgpack
import brotli

BMF_VERSION = "1.0"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------- schema
def empty_bmf(workspace_id: str = "", workspace_name: str = "") -> Dict[str, Any]:
    ts = _now()
    return {
        "metadata": {
            "bmf_version": BMF_VERSION,
            "workspace_id": workspace_id,
            "workspace_name": workspace_name,
            "memory_version": 0,
            "created_time": ts,
            "updated_time": ts,
            "source_ai": "",
            "source_model": "",
        },
        "project": {
            "name": "", "goal": "", "vision": "",
            "problem_statement": "", "success_criteria": [],
        },
        "current_state": {
            "current_progress": "", "current_focus": "",
            "current_milestone": "", "completion_status": "",
        },
        "decisions": [],       # {id,title,description,reasoning,status,timestamp}
        "architecture": {
            "system_architecture": "", "folder_structure": "", "data_flow": "",
            "components": [], "services": [], "integrations": [],
            "dependencies": [], "apis": [], "libraries": [], "frameworks": [],
            "environment": [],
        },
        "constraints": [],     # {id,text,status}
        "preferences": {
            "coding_style": [], "design": [], "animation": [],
            "writing": [], "naming": [], "framework": [], "goals": [],
        },
        "knowledge": [],       # list[str]
        "tasks": {"completed": [], "pending": [], "blocked": [], "future": []},
        "conversation_intent": "",
        "next_recommendation": "",
        "history": {
            "state_changes": [],   # {field, old, new, timestamp}
            "decisions": [],       # decisions moved out of current
        },
    }


PROJECT_SCALARS = ["name", "goal", "vision", "problem_statement"]
STATE_SCALARS = ["current_progress", "current_focus", "current_milestone", "completion_status"]
ARCH_SCALARS = ["system_architecture", "folder_structure", "data_flow"]
ARCH_LISTS = ["components", "services", "integrations", "dependencies", "apis", "libraries", "frameworks", "environment"]
PREF_LISTS = ["coding_style", "design", "animation", "writing", "naming", "framework", "goals"]
TASK_LISTS = ["completed", "pending", "blocked", "future"]
DECISION_ACTIVE = {"current", "pending"}


# ---------------------------------------------------------------- helpers
def _norm(s: Any) -> str:
    return str(s or "").strip()


def _dedup_extend(existing: List[str], incoming: List[Any]) -> List[str]:
    seen = {x.lower() for x in existing}
    for v in incoming or []:
        v = _norm(v)
        if v and v.lower() not in seen:
            existing.append(v)
            seen.add(v.lower())
    return existing


def _fuzzy_match(a: str, b: str) -> bool:
    a, b = a.lower().strip(), b.lower().strip()
    if not a or not b:
        return False
    if a == b:
        return True
    aw, bw = set(re.findall(r"[a-z0-9]+", a)), set(re.findall(r"[a-z0-9]+", b))
    if not aw or not bw:
        return False
    return len(aw & bw) / len(aw | bw) >= 0.6


# ---------------------------------------------------------------- evolution
def evolve(current: Dict[str, Any], partial: Dict[str, Any], *, source_ai: str = "",
           source_model: str = "") -> Dict[str, Any]:
    """Merge a freshly-extracted partial BMF into the workspace's current BMF.

    Never overwrites: replaced scalar values are pushed into history.state_changes;
    superseded decisions are moved into history.decisions with a Replaced status.
    """
    bmf = current
    md = bmf["metadata"]
    md["memory_version"] = int(md.get("memory_version", 0)) + 1
    md["updated_time"] = _now()
    if source_ai:
        md["source_ai"] = source_ai
    if source_model:
        md["source_model"] = source_model

    now = _now()

    # ---- project identity (scalar evolution with history) ----
    p_new = partial.get("project", {}) or {}
    for f in PROJECT_SCALARS:
        _apply_scalar(bmf["project"], f, _norm(p_new.get(f)), f"project.{f}", bmf, now)
    _dedup_extend(bmf["project"]["success_criteria"], p_new.get("success_criteria", []))

    # ---- current state ----
    s_new = partial.get("current_state", {}) or {}
    for f in STATE_SCALARS:
        _apply_scalar(bmf["current_state"], f, _norm(s_new.get(f)), f"current_state.{f}", bmf, now)

    # ---- architecture ----
    a_new = partial.get("architecture", {}) or {}
    for f in ARCH_SCALARS:
        _apply_scalar(bmf["architecture"], f, _norm(a_new.get(f)), f"architecture.{f}", bmf, now)
    for f in ARCH_LISTS:
        _dedup_extend(bmf["architecture"][f], a_new.get(f, []))

    # ---- preferences ----
    pref_new = partial.get("preferences", {}) or {}
    for f in PREF_LISTS:
        _dedup_extend(bmf["preferences"][f], pref_new.get(f, []))

    # ---- knowledge (dedup, no duplicates) ----
    _dedup_extend(bmf["knowledge"], partial.get("knowledge", []))

    # ---- tasks ----
    t_new = partial.get("tasks", {}) or {}
    for f in TASK_LISTS:
        _dedup_extend(bmf["tasks"][f], t_new.get(f, []))
    _promote_completed_tasks(bmf)

    # ---- constraints (addressable, with status) ----
    _merge_constraints(bmf, partial.get("constraints", []))

    # ---- decisions (with supersede + history) ----
    _merge_decisions(bmf, partial.get("decisions", []), now)

    # ---- intent + recommendation (latest wins, non-empty) ----
    if _norm(partial.get("conversation_intent")):
        bmf["conversation_intent"] = _norm(partial.get("conversation_intent"))
    if _norm(partial.get("next_recommendation")):
        bmf["next_recommendation"] = _norm(partial.get("next_recommendation"))

    return bmf


def _apply_scalar(container: dict, field: str, new: str, path: str, bmf: dict, ts: str):
    old = _norm(container.get(field))
    if not new:
        return
    if old and not _fuzzy_match(old, new):
        bmf["history"]["state_changes"].append({"field": path, "old": old, "new": new, "timestamp": ts})
        container[field] = new
    elif not old:
        container[field] = new
    elif len(new) > len(old):  # same meaning, richer wording
        container[field] = new


def _promote_completed_tasks(bmf: dict):
    completed = {c.lower() for c in bmf["tasks"]["completed"]}
    for bucket in ("pending", "blocked", "future"):
        bmf["tasks"][bucket] = [t for t in bmf["tasks"][bucket] if t.lower() not in completed]


def _merge_constraints(bmf: dict, incoming: List[Any]):
    existing = bmf["constraints"]
    texts = {c["text"].lower() for c in existing}
    for item in incoming or []:
        text = _norm(item.get("text") if isinstance(item, dict) else item)
        status = _norm(item.get("status")) if isinstance(item, dict) else ""
        if not text or text.lower() in texts:
            continue
        existing.append({"id": f"con_{uuid.uuid4().hex[:8]}", "text": text, "status": status or "active"})
        texts.add(text.lower())


def _merge_decisions(bmf: dict, incoming: List[Any], ts: str):
    current = bmf["decisions"]
    for item in incoming or []:
        if not isinstance(item, dict):
            item = {"title": _norm(item)}
        title = _norm(item.get("title"))
        if not title:
            continue
        status = (_norm(item.get("status")) or "Current").capitalize()
        record = {
            "id": f"dec_{uuid.uuid4().hex[:8]}",
            "title": title,
            "description": _norm(item.get("description")),
            "reasoning": _norm(item.get("reasoning")),
            "status": status,
            "timestamp": ts,
        }
        match = next((d for d in current if _fuzzy_match(d["title"], title)), None)
        if match:
            if status in ("Replaced", "Rejected", "Deprecated"):
                match["status"] = status
                bmf["history"]["decisions"].append(match)
                current.remove(match)
            else:  # refresh existing active decision
                match.update({k: record[k] for k in ("description", "reasoning") if record[k]})
                match["status"] = status
            continue
        # new decision — supersede any active decision it explicitly replaces
        if status == "Current" and _norm(item.get("replaces")):
            old = next((d for d in current if _fuzzy_match(d["title"], _norm(item["replaces"]))), None)
            if old:
                old["status"] = "Replaced"
                bmf["history"]["decisions"].append(old)
                current.remove(old)
        current.append(record)


# ---------------------------------------------------------------- package
def build_package(bmf: Dict[str, Any]) -> str:
    """Compressed JSON -> MessagePack -> Brotli -> Base64."""
    packed = msgpack.packb(bmf, use_bin_type=True)
    compressed = brotli.compress(packed, quality=9)
    return base64.b64encode(compressed).decode("ascii")


def read_package(package: str) -> Dict[str, Any]:
    compressed = base64.b64decode(package.encode("ascii"))
    return msgpack.unpackb(brotli.decompress(compressed), raw=False)


# ---------------------------------------------------------------- compact view (dashboard compatibility)
def to_compact(bmf: Dict[str, Any]) -> dict:
    active = [d["title"] for d in bmf["decisions"] if d["status"].lower() in DECISION_ACTIVE]
    techs = _dedup_extend([], bmf["architecture"]["frameworks"] + bmf["architecture"]["libraries"]
                          + bmf["architecture"]["dependencies"] + bmf["architecture"]["integrations"])
    return {
        "goal": bmf["project"]["goal"],
        "project": bmf["project"]["name"],
        "decisions": active,
        "constraints": [c["text"] for c in bmf["constraints"]],
        "todos": bmf["tasks"]["pending"] + bmf["tasks"]["future"],
        "files": [],
        "technologies": techs,
        "architecture": bmf["architecture"]["system_architecture"],
        "preferences": bmf["preferences"]["design"] + bmf["preferences"]["coding_style"],
        "summary": bmf["current_state"]["current_progress"] or bmf["project"]["goal"],
    }
