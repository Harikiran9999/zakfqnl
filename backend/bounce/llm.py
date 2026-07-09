import os
import json
import re
from openai import AsyncOpenAI

_client = AsyncOpenAI(
    base_url=os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    api_key=os.environ["OPENROUTER_API_KEY"],
    default_headers={
        "HTTP-Referer": "https://bounce.app",
        "X-Title": os.environ.get("APP_NAME", "Bounce"),
    },
)

MODEL_EXTRACT = os.environ.get("LLM_MODEL_EXTRACT", "anthropic/claude-3.5-haiku")
MODEL_REASON = os.environ.get("LLM_MODEL_REASON", "anthropic/claude-3.5-sonnet")

EXTRACT_SYSTEM = (
    "You are Bounce's memory extraction engine. You read an AI chat conversation and "
    "distill it into a compact, structured memory. You MUST output ONLY valid JSON with "
    "no markdown fences and no commentary. Use this exact schema, filling every field "
    "(use empty string or empty array when unknown):\n"
    '{"goal":"","project":"","decisions":[],"constraints":[],"todos":[],"files":[],'
    '"technologies":[],"architecture":"","preferences":[],"summary":""}\n'
    "Keep each list item to a short phrase. summary is 2-3 sentences."
)

OPTIMIZE_SYSTEM = (
    "You are Bounce's prompt optimizer. Rewrite the user's prompt so it is clearer, "
    "better structured, and gives the AI more useful context, while preserving intent. "
    "Return ONLY the rewritten prompt text with no preamble, no quotes, no markdown."
)

_SCHEMA_KEYS = [
    "goal", "project", "decisions", "constraints", "todos",
    "files", "technologies", "architecture", "preferences", "summary",
]
_LIST_KEYS = {"decisions", "constraints", "todos", "files", "technologies", "preferences"}


def _empty_structured() -> dict:
    return {k: ([] if k in _LIST_KEYS else "") for k in _SCHEMA_KEYS}


def _coerce(data: dict) -> dict:
    out = _empty_structured()
    for k in _SCHEMA_KEYS:
        v = data.get(k)
        if k in _LIST_KEYS:
            if isinstance(v, list):
                out[k] = [str(x).strip() for x in v if str(x).strip()]
            elif isinstance(v, str) and v.strip():
                out[k] = [v.strip()]
        else:
            out[k] = str(v).strip() if v is not None else ""
    return out


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return {}


async def extract_memory(conversation: str) -> dict:
    conversation = conversation[:24000]
    try:
        resp = await _client.chat.completions.create(
            model=MODEL_EXTRACT,
            temperature=0.2,
            max_tokens=1500,
            messages=[
                {"role": "system", "content": EXTRACT_SYSTEM},
                {"role": "user", "content": conversation},
            ],
        )
        content = resp.choices[0].message.content or ""
        return _coerce(_parse_json(content))
    except Exception as e:
        s = _empty_structured()
        s["summary"] = conversation[:280]
        s["goal"] = "Captured conversation"
        return s


async def optimize_prompt(prompt: str) -> str:
    try:
        resp = await _client.chat.completions.create(
            model=MODEL_EXTRACT,
            temperature=0.3,
            max_tokens=1200,
            messages=[
                {"role": "system", "content": OPTIMIZE_SYSTEM},
                {"role": "user", "content": prompt[:8000]},
            ],
        )
        return (resp.choices[0].message.content or prompt).strip()
    except Exception:
        return prompt
