from fastapi import APIRouter
from .models import SuggestReq, SuggestRes, SuggestItem, LogChoiceReq
from .intents import classify_intent
from .phrasepacks import PHRASEPACKS
from .claude import generate_replies
from . import store

router = APIRouter()

def _fallback(intent: str) -> list[str]:
    pack = PHRASEPACKS.get(intent) or PHRASEPACKS["generic"]
    return pack[:6]

@router.post("/suggest", response_model=SuggestRes)
def suggest(req: SuggestReq):
    text = (req.last_text or "")[:300]  # truncate to keep latency stable
    context = req.context or "generic"
    intent = classify_intent(text)

    # LOG: Print received transcript
    print("=" * 60)
    print("📥 RECEIVED REQUEST:")
    print(f"  Session ID: {req.session_id}")
    print(f"  Context: {context}")
    print(f"  Transcript: {repr(text)}")
    print(f"  Transcript length: {len(text)} characters")
    print(f"  Classified intent: {intent}")
    print("=" * 60)

    # Prefer Claude always; fallback only if Claude fails
    try:
        print("🤖 Sending to Claude AI...")
        replies = generate_replies(text, context)
        print(f"✅ Claude generated {len(replies)} replies")
    except Exception as e:
        print("❌ Claude failed, using fallback:", repr(e))
        replies = _fallback(intent)

    # Rank by emergent weights
    scored = []
    for r in replies:
        w = store.get_weight(context, intent, r)
        score = 1.0 + 0.3 * w
        scored.append((score, r))

    scored.sort(reverse=True, key=lambda x: x[0])

    print("\n📤 SENDING RESPONSE:")
    for i, (score, reply_text) in enumerate(scored[:6]):
        print(f"  {i+1}. [{score:.2f}] {reply_text}")
    print("=" * 60 + "\n")

    return SuggestRes(suggestions=[
        SuggestItem(
            id=f"{context}:{intent}:{i}",
            text=reply_text,
            intent=intent,
            score=float(score),
        )
        for i, (score, reply_text) in enumerate(scored[:6])
    ])

@router.post("/log_choice")
def log_choice(req: LogChoiceReq):
    # Store chosen reply so it rises to the top over time
    print(f"📊 User chose: {repr(req.text)} (context: {req.context}, intent: {req.intent})")
    store.bump(req.context, req.intent, req.text, delta=1)
    store.save()
    return {"ok": True}
