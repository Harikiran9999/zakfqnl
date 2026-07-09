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

MODEL_EXTRACT = os.environ.get("LLM_MODEL_EXTRACT", "anthropic/claude-haiku-4.5")
MODEL_REASON = os.environ.get("LLM_MODEL_REASON", "anthropic/claude-sonnet-4.5")

EXTRACT_SYSTEM = """You are Bounce's Conversation Understanding engine.
You read an AI-assistant conversation and distill the PROJECT UNDERSTANDING behind it —
not a summary of messages. Capture durable project state: identity, decisions,
architecture, constraints, preferences, knowledge, tasks, intent and the next step.

Output ONLY valid JSON (no markdown fences, no commentary) with EXACTLY this schema.
Use "" for unknown scalars and [] for unknown lists. Keep list items to short phrases.

{
 "project": {"name":"","goal":"","vision":"","problem_statement":"","success_criteria":[]},
 "current_state": {"current_progress":"","current_focus":"","current_milestone":"","completion_status":""},
 "decisions": [{"title":"","description":"","reasoning":"","status":"Current","replaces":""}],
 "architecture": {"system_architecture":"","folder_structure":"","data_flow":"","components":[],"services":[],"integrations":[],"dependencies":[],"apis":[],"libraries":[],"frameworks":[],"environment":[]},
 "constraints": [{"text":"","status":"active"}],
 "preferences": {"coding_style":[],"design":[],"animation":[],"writing":[],"naming":[],"framework":[],"goals":[]},
 "knowledge": [],
 "tasks": {"completed":[],"pending":[],"blocked":[],"future":[]},
 "conversation_intent": "",
 "next_recommendation": ""
}

Rules:
- decisions.status is one of: Current, Rejected, Replaced, Deprecated, Pending.
- If the conversation changes an earlier choice, set the new decision status "Current" and put the old choice's title in "replaces".
- conversation_intent: WHY this conversation happened, in one sentence.
- next_recommendation: the single most logical next step for the user."""

OPTIMIZE_SYSTEM = (
    "You are Bounce's prompt optimizer. Rewrite the user's prompt so it is clearer, "
    "better structured, and gives the AI more useful context, while preserving intent. "
    "Return ONLY the rewritten prompt text with no preamble, no quotes, no markdown."
)


def _parse_json(text: str) -> dict:
    text = (text or "").strip()
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


def _fallback_partial(conversation: str) -> dict:
    return {
        "project": {"name": "", "goal": "Captured conversation", "vision": "",
                    "problem_statement": "", "success_criteria": []},
        "current_state": {"current_progress": conversation[:280], "current_focus": "",
                          "current_milestone": "", "completion_status": ""},
        "decisions": [], "architecture": {},
        "constraints": [], "preferences": {},
        "knowledge": [], "tasks": {"completed": [], "pending": [], "blocked": [], "future": []},
        "conversation_intent": "", "next_recommendation": "",
    }


async def extract_bmf(conversation: str, current_prompt: str = "") -> dict:
    convo = conversation[:9000]
    user = convo if not current_prompt else f"CURRENT DRAFT PROMPT:\n{current_prompt[:1200]}\n\nCONVERSATION:\n{convo}"
    try:
        resp = await _client.chat.completions.create(
            model=MODEL_EXTRACT,
            temperature=0.2,
            max_tokens=3200,
            messages=[
                {"role": "system", "content": EXTRACT_SYSTEM},
                {"role": "user", "content": user},
            ],
        )
        data = _parse_json(resp.choices[0].message.content or "")
        return data if isinstance(data, dict) and data else _fallback_partial(convo)
    except Exception:
        return _fallback_partial(convo)


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
