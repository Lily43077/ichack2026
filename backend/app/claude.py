import os
import re
from anthropic import Anthropic

def _clean_lines(text: str) -> list[str]:
    lines = []
    for raw in text.split("\n"):
        s = raw.strip()
        if not s:
            continue
        # strip bullets
        s = s.lstrip("-•").strip()
        # strip numbering like "1." "1)" "1 -"
        s = re.sub(r"^\d+\s*[\.\)\-:]\s*", "", s).strip()

        # hard cap words
        words = s.split()
        if len(words) > 18:
            s = " ".join(words[:18])

        if s:
            lines.append(s)
    return lines

def generate_replies(message: str, context: str, conversation_history: str = "", common_replies: list[str] = None) -> list[str]:
    """
    Generate reply suggestions using Claude.
    
    Args:
        message: The current transcript/message heard
        context: The conversation context (medical, restaurant, etc.)
        conversation_history: Formatted string of past exchanges
        common_replies: List of replies that have worked well in this context
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    client = Anthropic(api_key=api_key)

    # Build the prompt with history context
    history_section = ""
    if conversation_history:
        history_section = f"""
Previous conversation:
{conversation_history}

Based on this conversation flow, generate contextually appropriate replies.
"""

    # Include common replies as hints
    common_replies_section = ""
    if common_replies:
        common_replies_section = f"""
Replies that have worked well in similar {context} situations:
{', '.join(common_replies[:5])}

Use these as inspiration but generate fresh, contextually appropriate options.
"""

    prompt = f"""You are helping generate reply options for a speech-assistance app. The user has difficulty speaking and needs quick tap-to-speak responses.

Generate exactly 9 short reply options for the user to tap. Do not add preamble to your response, get straight to the point with no additions.

Rules:
- Exactly 9 replies
- Each reply under 18 words
- Polite, neutral, clear
- No emojis
- No numbering, no bullet points
- One reply per line
- Replies should be the USER's possible replies (not the conversation partner)
- Replies should not be AI preamble
- Consider the conversation flow and what would be a natural next response

Context: {context}
{history_section}
{common_replies_section}
Current message heard: "{message}"

Generate 9 appropriate replies the user could say next:"""

    print(f"📝 Prompt being sent to Claude:\n{prompt}\n")

    res = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=350,
        temperature=0.6,
        messages=[{"role": "user", "content": prompt}],
    )

    text = res.content[0].text.strip()
    lines = _clean_lines(text)

    if len(lines) < 9:
        raise ValueError(f"Claude returned <9 lines: {lines}")

    return lines[:9 ]
