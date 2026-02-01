import json
import os
from datetime import datetime
from collections import deque

HISTORY_FILE = "backend/app/conversation_history.json"
MAX_HISTORY_PER_SESSION = 20  # Keep last 20 exchanges per session
MAX_CONTEXT_FOR_LLM = 10      # Send last 10 exchanges to LLM

history = {}

def load():
    """Load conversation history from file."""
    global history
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                history = json.load(f)
        except json.JSONDecodeError:
            history = {}

def save():
    """Save conversation history to file."""
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)

def add_exchange(session_id: str, context: str, transcript: str, chosen_reply: str = None):
    """
    Add a conversation exchange to history.
    
    Args:
        session_id: Unique session identifier
        context: Conversation context (medical, restaurant, etc.)
        transcript: What was heard/spoken
        chosen_reply: The reply the user selected (if any)
    """
    if session_id not in history:
        history[session_id] = {
            "context": context,
            "exchanges": [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    
    exchange = {
        "timestamp": datetime.now().isoformat(),
        "transcript": transcript,
        "chosen_reply": chosen_reply
    }
    
    history[session_id]["exchanges"].append(exchange)
    history[session_id]["updated_at"] = datetime.now().isoformat()
    history[session_id]["context"] = context  # Update context if changed
    
    # Keep only the last N exchanges
    if len(history[session_id]["exchanges"]) > MAX_HISTORY_PER_SESSION:
        history[session_id]["exchanges"] = history[session_id]["exchanges"][-MAX_HISTORY_PER_SESSION:]
    
    save()

def update_last_exchange_with_choice(session_id: str, chosen_reply: str):
    """Update the most recent exchange with the user's chosen reply."""
    if session_id in history and history[session_id]["exchanges"]:
        history[session_id]["exchanges"][-1]["chosen_reply"] = chosen_reply
        history[session_id]["updated_at"] = datetime.now().isoformat()
        save()

def get_history_for_llm(session_id: str, max_exchanges: int = None) -> str:
    """
    Get formatted conversation history for the LLM prompt.
    
    Returns a string formatted for the LLM to understand the conversation flow.
    """
    if max_exchanges is None:
        max_exchanges = MAX_CONTEXT_FOR_LLM
        
    if session_id not in history:
        return ""
    
    exchanges = history[session_id]["exchanges"][-max_exchanges:]
    
    if not exchanges:
        return ""
    
    formatted_lines = []
    for ex in exchanges:
        if ex.get("transcript"):
            formatted_lines.append(f"[Heard]: {ex['transcript']}")
        if ex.get("chosen_reply"):
            formatted_lines.append(f"[User replied]: {ex['chosen_reply']}")
    
    return "\n".join(formatted_lines)

def get_common_replies(context: str, limit: int = 10) -> list[str]:
    """
    Get the most commonly chosen replies across all sessions for a given context.
    This helps the LLM learn what replies work well.
    """
    reply_counts = {}
    
    for session_id, data in history.items():
        if data.get("context") != context:
            continue
        for ex in data.get("exchanges", []):
            reply = ex.get("chosen_reply")
            if reply:
                reply_counts[reply] = reply_counts.get(reply, 0) + 1
    
    # Sort by count and return top replies
    sorted_replies = sorted(reply_counts.items(), key=lambda x: x[1], reverse=True)
    return [reply for reply, count in sorted_replies[:limit]]

def clear_session(session_id: str):
    """Clear history for a specific session."""
    if session_id in history:
        del history[session_id]
        save()

def clear_all():
    """Clear all conversation history."""
    global history
    history = {}
    save()
