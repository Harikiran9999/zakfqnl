"""Deploy Engine — builds a minimal, relevant context package from a workspace BMF.

Never pastes the whole memory. Understands the user's current prompt, selects only
the relevant knowledge, and produces a compact <context> block: minimal tokens,
maximal relevance.
"""
from __future__ import annotations
import re
from typing import Dict, Any, List, Tuple

from .bmf import DECISION_ACTIVE, _dedup_extend

_WORD = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> set:
    return set(_WORD.findall((text or "").lower()))


def _score(query_tokens: set, text: str) -> float:
    if not query_tokens:
        return 0.0
    dt = _tokens(text)
    if not dt:
        return 0.0
    overlap = len(query_tokens & dt)
    return overlap / (len(query_tokens) ** 0.5)


def _rank(items: List[str], q: set, limit: int, floor: float) -> List[str]:
    if not q:  # no prompt -> keep most recent/first `limit`
        return items[:limit]
    scored: List[Tuple[float, str]] = [(_score(q, it), it) for it in items]
    scored = [s for s in scored if s[0] > floor]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [it for _, it in scored[:limit]] or items[:2]


def _bullets(items: List[str]) -> str:
    return "\n".join(f"- {x}" for x in items) if items else "- (none)"


def build_context(bmf: Dict[str, Any], current_prompt: str = "") -> Dict[str, Any]:
    q = _tokens(current_prompt)
    proj = bmf["project"]
    state = bmf["current_state"]
    arch = bmf["architecture"]

    active_decisions = [d for d in bmf["decisions"] if d["status"].lower() in DECISION_ACTIVE]
    decision_titles = [d["title"] for d in active_decisions]
    constraints = [c["text"] for c in bmf["constraints"]]
    tech = _dedup_extend([], arch["frameworks"] + arch["libraries"] + arch["dependencies"] + arch["integrations"])
    prefs = _dedup_extend([], bmf["preferences"]["design"] + bmf["preferences"]["coding_style"]
                          + bmf["preferences"]["framework"])
    pending = bmf["tasks"]["pending"] + bmf["tasks"]["blocked"] + bmf["tasks"]["future"]

    # Relevance selection (always-include core: project + state + next step)
    sel_decisions = _rank(decision_titles, q, 6, 0.0)
    sel_constraints = _rank(constraints, q, 6, 0.0)
    sel_tech = _rank(tech, q, 8, 0.0)
    sel_knowledge = _rank(bmf["knowledge"], q, 6, 0.5)  # knowledge must be relevant
    sel_prefs = _rank(prefs, q, 5, 0.0)
    sel_tasks = _rank(pending, q, 6, 0.0)

    ctx = (
        "<context>\n"
        f"Project\n{proj['name'] or bmf['metadata']['workspace_name']}\n\n"
        f"Goal\n{proj['goal'] or '(not specified)'}\n\n"
        + (f"Problem\n{proj['problem_statement']}\n\n" if proj["problem_statement"] else "")
        + f"Current Progress\n{state['current_progress'] or '(not specified)'}\n\n"
        + (f"Current Focus\n{state['current_focus']}\n\n" if state["current_focus"] else "")
        + f"Known Decisions\n{_bullets(sel_decisions)}\n\n"
        f"Constraints\n{_bullets(sel_constraints)}\n\n"
        + (f"Architecture\n{arch['system_architecture']}\n\n" if arch["system_architecture"] else "")
        + f"Technologies\n{_bullets(sel_tech)}\n\n"
        f"Developer Preferences\n{_bullets(sel_prefs)}\n\n"
        + (f"Relevant Knowledge\n{_bullets(sel_knowledge)}\n\n" if sel_knowledge else "")
        + f"Next Tasks\n{_bullets(sel_tasks)}\n"
        + (f"\nRecommended Next Step\n{bmf['next_recommendation']}\n" if bmf["next_recommendation"] else "")
        + "</context>"
    )

    return {
        "context": ctx,
        "relevance": {
            "matched_prompt": bool(q),
            "decisions": len(sel_decisions),
            "constraints": len(sel_constraints),
            "technologies": len(sel_tech),
            "knowledge": len(sel_knowledge),
            "tasks": len(sel_tasks),
        },
    }
