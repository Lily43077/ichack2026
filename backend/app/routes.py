from fastapi import APIRouter
from .models import SuggestReq, SuggestRes, SuggestItem, LogChoiceReq, ClearHistoryReq
from .intents import classify_intent
from .phrasepacks import PHRASEPACKS
from .claude import generate_replies
from . import store
from . import history

router = APIRouter()

def _fallback(intent: str) -> list[str]:
    pack = PHRASEPACKS.get(intent) or PHRASEPACKS["generic"]
    return pack[:9]

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

    # Get conversation history for this session
    conversation_history = history.get_history_for_llm(req.session_id)
    print(f"📜 Conversation history:\n{conversation_history}\n")

    # Get commonly chosen replies for this context
    common_replies = history.get_common_replies(context)
    print(f"⭐ Common replies for {context}: {common_replies}")

    # Store this exchange in history (without chosen reply yet)
    if text:
        history.add_exchange(req.session_id, context, text)

    # Prefer Claude always; fallback only if Claude fails
    try:
        print("🤖 Sending to Claude AI...")
        replies = generate_replies(text, context, conversation_history, common_replies)
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
    for i, (score, reply_text) in enumerate(scored[:9]):
        print(f"  {i+1}. [{score:.2f}] {reply_text}")
    print("=" * 60 + "\n")

    return SuggestRes(suggestions=[
        SuggestItem(
            id=f"{context}:{intent}:{i}",
            text=reply_text,
            intent=intent,
            score=float(score),
        )
        for i, (score, reply_text) in enumerate(scored[:9])
    ])

@router.post("/log_choice")
def log_choice(req: LogChoiceReq):
    # Store chosen reply so it rises to the top over time
    print(f"📊 User chose: {repr(req.text)} (context: {req.context}, intent: {req.intent})")
    
    # Update weight for scoring
    store.bump(req.context, req.intent, req.text, delta=1)
    store.save()
    
    # Update conversation history with the chosen reply
    history.update_last_exchange_with_choice(req.session_id, req.text)
    
    return {"ok": True}

@router.post("/clear_history")
def clear_history(req: ClearHistoryReq):
    # Clear conversation history for this session
    print(f"🧹 Clearing history for session: {req.session_id}")
    history.clear_session(req.session_id)
    return {"ok": True}
