import json
import base64
import re
from typing import List
import msgpack
import brotli

_LIST_KEYS = ["decisions", "constraints", "todos", "files", "technologies", "preferences"]
_SCALAR_KEYS = ["goal", "project", "architecture", "summary"]


# ---------- Bounce Memory Format (.bmf) ----------
# Compressed JSON -> MessagePack -> Brotli -> Base64
def build_bmf(structured: dict) -> str:
    packed = msgpack.packb(structured, use_bin_type=True)
    compressed = brotli.compress(packed, quality=9)
    return base64.b64encode(compressed).decode("ascii")


def read_bmf(bmf: str) -> dict:
    compressed = base64.b64decode(bmf.encode("ascii"))
    packed = brotli.decompress(compressed)
    return msgpack.unpackb(packed, raw=False)


# ---------- Searchable text ----------
def searchable_text(structured: dict) -> str:
    parts: List[str] = []
    for k in _SCALAR_KEYS:
        if structured.get(k):
            parts.append(str(structured[k]))
    for k in _LIST_KEYS:
        parts.extend([str(x) for x in structured.get(k, [])])
    return "  ".join(parts).lower()


def make_title(structured: dict) -> str:
    return (structured.get("project") or structured.get("goal")
            or structured.get("summary") or "Untitled memory")[:80]


# ---------- Merge engine (union without overwrite) ----------
def merge_structured(items: List[dict]) -> dict:
    merged = {k: "" for k in _SCALAR_KEYS}
    for k in _LIST_KEYS:
        merged[k] = []
    for it in items:
        for k in _SCALAR_KEYS:
            new = (it.get(k) or "").strip()
            if new and len(new) > len(merged[k]):
                merged[k] = new
        for k in _LIST_KEYS:
            for v in it.get(k, []):
                v = str(v).strip()
                if v and v.lower() not in {x.lower() for x in merged[k]}:
                    merged[k].append(v)
    return merged


# ---------- Lexical / semantic-ish scoring ----------
_word = re.compile(r"[a-z0-9]+")


def _tokens(text: str):
    return _word.findall(text.lower())


def score(query: str, text: str) -> float:
    q = _tokens(query)
    if not q:
        return 0.0
    doc = _tokens(text)
    if not doc:
        return 0.0
    docset = set(doc)
    hits = sum(1 for t in q if t in docset)
    phrase = 1.0 if query.strip().lower() in text.lower() else 0.0
    return hits / len(q) + 0.25 * phrase


# ---------- Deploy context assembly ----------
def _bullets(items: List[str]) -> str:
    return "\n".join(f"- {x}" for x in items) if items else "- (none)"


def build_context(folder_name: str, structured: dict) -> str:
    return (
        "<context>\n"
        f"Project\n{structured.get('project') or folder_name}\n\n"
        f"Goal\n{structured.get('goal') or '(not specified)'}\n\n"
        f"Current Progress\n{structured.get('summary') or '(not specified)'}\n\n"
        f"Known Decisions\n{_bullets(structured.get('decisions', []))}\n\n"
        f"Constraints\n{_bullets(structured.get('constraints', []))}\n\n"
        f"Architecture\n{structured.get('architecture') or '(not specified)'}\n\n"
        f"Technologies\n{_bullets(structured.get('technologies', []))}\n\n"
        f"Files\n{_bullets(structured.get('files', []))}\n\n"
        f"Developer Preferences\n{_bullets(structured.get('preferences', []))}\n\n"
        f"Next Tasks\n{_bullets(structured.get('todos', []))}\n"
        "</context>"
    )
