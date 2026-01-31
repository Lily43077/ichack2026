from fastapi import APIRouter
from .models import SuggestReq, SuggestRes, SuggestItem, LogChoiceReq
from .intents import classify_intent
from .phrasepacks import PHRASEPACKS
from .claude import generate_replies
from . import store

router = APIRouter()

@router.post("/suggest", response_model=SuggestRes)
def suggest(req: SuggestReq):
    text = req.last_text[:300]
    context = req.context or "generic"
    intent = classify_intent(text)

    try:
        replies = generate_replies(text, context)
    except Exception:
        replies = PHRASEPACKS[intent][:6]

    scored = []
    for r in replies:
        w = store.get_weight(context, intent, r)
        score = 1.0 + 0.3 * w
        scored.append((score, r))

    scored.sort(reverse=True)

    return SuggestRes(suggestions=[
        SuggestItem(
            id=f"{i}",
            text=text,
            intent=intent,
            score=score
        )
        for i, (score, text) in enumerate(scored[:6])
    ])

@router.post("/log_choice")
def log_choice(req: LogChoiceReq):
    store.bump(req.context, req.intent, req.text)
    store.save()
    return {"ok": True}
