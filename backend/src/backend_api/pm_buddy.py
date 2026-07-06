from __future__ import annotations

import json
import time
from typing import Any

import httpx

from backend_api.config import Settings
from backend_api.db import InsightsDatabase

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

REPETITIVE_KEYWORDS = [
    "repeat",
    "same songs",
    "same song",
    "same artists",
    "same artist",
    "same music",
    "same playlist",
    "again and again",
    "over and over",
    "keep playing",
    "always play",
    "repetitive",
    "familiar",
    "playlist i already",
    "heard before",
]

SEGMENT_KEYWORDS: dict[str, list[str]] = {
    "free_tier": [
        "free version",
        "free user",
        "free tier",
        "without premium",
        "too many ads",
        "ads every",
        "hate ads",
    ],
    "premium_subscribers": ["premium", "subscription", "paying for", "worth it", "upgrade"],
    "students": ["student", "student discount", "university"],
    "family_plan": ["family plan", "kids", "children", "child"],
    "power_users": ["power user", "audiophile", "heavy user"],
}

PM_BUDDY_SYSTEM = """You are PM Buddy, a product-strategy copilot for Spotify's music discovery team.

PRIMARY RESEARCH AGENDA — this is why you exist:
Understand why Spotify users struggle with meaningful music discovery, and why a significant
share of listening still comes from repeat playlists, familiar artists, and previously
discovered tracks. Every answer should primarily serve this agenda — directly when the evidence
supports it, indirectly when users describe adjacent issues (recommendations, UI friction, habit
loops, catalog fatigue, segment differences) that plausibly explain discovery failure or
repetitive fallback. Other topics are fine when they clearly connect back to these core questions.

Rules:
- Answer ONLY using the evidence context provided below. Do not invent statistics, quotes, or user segments.
- When citing numbers, use exact counts from the context.
- Quote user reviews verbatim when supporting a point (short excerpts only).
- Default answer structure (unless the user asks otherwise): a direct answer tied to the research agenda, then supporting evidence with quotes and counts. Add a brief caveat only when data is thin.
- Do NOT include a "Segment breakdown" section, segment comparison, or user-segment analysis unless the user explicitly asks about segments, user segments, segment differences, or a named segment (e.g. free tier, premium, students).
- Do NOT include a "Testable hypotheses" section or numbered hypotheses unless the user explicitly asks for hypotheses, testable ideas, experiments, or A/B tests.
- When the user does ask for segments or hypotheses, you may add those as clearly labeled sections after the main answer.
- If the question is outside the evidence, say what is missing and what synthesis run or data would be needed.
- Write in plain English for a product manager audience — no jargon.
- When a question is broad, reframe it toward root causes of discovery struggle or repetitive listening before answering."""


def _topics_list(item: dict[str, Any]) -> list[str]:
    topics = item.get("topics_matched") or []
    if isinstance(topics, str):
        return [topics]
    return list(topics)


def _is_repetitive_item(item: dict[str, Any]) -> bool:
    if "repeated_listening" in _topics_list(item):
        return True
    text = (item.get("cleaned_text") or "").lower()
    return any(kw in text for kw in REPETITIVE_KEYWORDS)


def _detect_segments(text: str) -> list[str]:
    text_lower = text.lower()
    return [name for name, keywords in SEGMENT_KEYWORDS.items() if any(kw in text_lower for kw in keywords)]


def _quote_score_for_context(item: dict[str, Any]) -> tuple[int, int]:
    rating = item.get("rating")
    text_len = len(item.get("cleaned_text") or "")
    rating_sort = int(rating) if rating is not None else 99
    return (rating_sort, -text_len)


def _sample_quotes(items: list[dict[str, Any]], limit: int = 4) -> list[dict[str, Any]]:
    seen: set[str] = set()
    quotes: list[dict[str, Any]] = []
    for item in sorted(items, key=_quote_score_for_context):
        text = (item.get("cleaned_text") or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        quotes.append(
            {
                "text": text[:400],
                "source": item.get("source"),
                "rating": item.get("rating"),
            }
        )
        if len(quotes) >= limit:
            break
    return quotes


def build_pm_buddy_context(db: InsightsDatabase) -> dict[str, Any]:
    dataset = db.get_dataset_stats()
    bundle = db.get_latest_bundle()
    items = db._fetch_all_clean_items()

    repetitive_items = [i for i in items if _is_repetitive_item(i)]
    discovery_items = [i for i in items if "struggle_discovery" in _topics_list(i)]

    segment_stats: dict[str, dict[str, Any]] = {}
    for name in SEGMENT_KEYWORDS:
        segment_stats[name] = {
            "mentions_in_repetitive_reviews": 0,
            "mentions_total": 0,
            "avg_rating": None,
            "ratings": [],
        }

    for item in items:
        text = item.get("cleaned_text") or ""
        segments = _detect_segments(text)
        rating = item.get("rating")
        is_rep = _is_repetitive_item(item)
        for seg in segments:
            segment_stats[seg]["mentions_total"] += 1
            if is_rep:
                segment_stats[seg]["mentions_in_repetitive_reviews"] += 1
            if rating is not None:
                segment_stats[seg]["ratings"].append(int(rating))

    segment_breakdown: list[dict[str, Any]] = []
    for name, stats in segment_stats.items():
        ratings = stats["ratings"]
        rep_items = [
            i
            for i in repetitive_items
            if name in _detect_segments(i.get("cleaned_text") or "")
        ]
        segment_breakdown.append(
            {
                "segment": name.replace("_", " ").title(),
                "segment_id": name,
                "mentions_in_repetitive_reviews": stats["mentions_in_repetitive_reviews"],
                "mentions_total": stats["mentions_total"],
                "avg_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
                "sample_quotes": _sample_quotes(rep_items, limit=3),
            }
        )
    segment_breakdown.sort(
        key=lambda s: s["mentions_in_repetitive_reviews"],
        reverse=True,
    )

    synthesis_summary: dict[str, Any] | None = None
    if bundle:
        synthesis_summary = {
            "run_id": bundle["run"].get("id"),
            "completed_at": bundle["run"].get("completed_at"),
            "executive_summary": bundle.get("executive_summary"),
            "questions": [
                {
                    "question_id": a.get("question_id"),
                    "question_text": a.get("question_text"),
                    "answer_narrative": (a.get("answer_narrative") or "")[:1200],
                    "top_themes": (a.get("top_themes") or [])[:5],
                    "stats": {
                        "total_mentions": (a.get("stats") or {}).get("total_mentions"),
                        "avg_rating": (a.get("stats") or {}).get("avg_rating"),
                        "by_source": (a.get("stats") or {}).get("by_source"),
                    },
                }
                for a in bundle.get("question_answers", [])
            ],
        }

    rep_ratings = [int(i["rating"]) for i in repetitive_items if i.get("rating") is not None]

    return {
        "strategic_focus": (
            "Primary research agenda: understand why users struggle with meaningful music discovery "
            "and why a significant share of listening still comes from repeat playlists, familiar "
            "artists, and previously discovered tracks — including indirect signals (recommendations, "
            "UX friction, habits, segments) that explain these patterns."
        ),
        "dataset": dataset,
        "repetitive_listening": {
            "total_reviews": len(items),
            "repetitive_mention_count": len(repetitive_items),
            "repetitive_share_pct": round(len(repetitive_items) / len(items) * 100, 1) if items else 0,
            "discovery_barrier_mention_count": len(discovery_items),
            "avg_rating_repetitive_reviews": (
                round(sum(rep_ratings) / len(rep_ratings), 2) if rep_ratings else None
            ),
            "sample_quotes": _sample_quotes(repetitive_items, limit=8),
        },
        "segment_breakdown": segment_breakdown,
        "latest_synthesis": synthesis_summary,
    }


_CONTEXT_CACHE: tuple[float, dict[str, Any]] | None = None
_CONTEXT_TTL = 60


def get_cached_context(db: InsightsDatabase) -> dict[str, Any]:
    global _CONTEXT_CACHE
    now = time.time()
    if _CONTEXT_CACHE and now - _CONTEXT_CACHE[0] < _CONTEXT_TTL:
        return _CONTEXT_CACHE[1]
    ctx = build_pm_buddy_context(db)
    _CONTEXT_CACHE = (now, ctx)
    return ctx


def chat(
    settings: Settings,
    db: InsightsDatabase,
    *,
    message: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is required for PM Buddy")

    context = get_cached_context(db)
    context_block = json.dumps(context, indent=2, default=str)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": PM_BUDDY_SYSTEM},
        {
            "role": "user",
            "content": (
                "Use this evidence context for all answers. It is refreshed from the live review database.\n\n"
                f"{context_block}"
            ),
        },
        {
            "role": "assistant",
            "content": (
                "Understood. I will answer using only this evidence, tying insights back to "
                "why discovery is hard and why users fall back to repeat playlists, familiar artists, "
                "and previously discovered tracks. I will keep answers concise — segment breakdowns "
                "and testable hypotheses only when you ask for them. What would you like to explore?"
            ),
        },
    ]

    for turn in history or []:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message.strip()})

    payload = {
        "model": settings.groq_model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 2048,
    }

    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Groq API error {response.status_code}: {response.text}")
        body = response.json()

    reply = body["choices"][0]["message"]["content"]
    tokens = int(body.get("usage", {}).get("total_tokens", 0))
    return {
        "reply": reply,
        "tokens_used": tokens,
        "context_snapshot": {
            "total_reviews": context["dataset"].get("total_reviews"),
            "repetitive_mention_count": context["repetitive_listening"]["repetitive_mention_count"],
            "synthesis_run_id": (context.get("latest_synthesis") or {}).get("run_id"),
        },
    }
