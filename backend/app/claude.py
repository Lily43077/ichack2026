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

def generate_replies(message: str, context: str) -> list[str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    client = Anthropic(api_key=api_key)

    prompt = f"""
Generate exactly 6 short reply options for a user to tap.

Rules:
- Exactly 6 replies
- Each reply under 18 words
- Polite, neutral, clear
- No emojis
- No numbering, no bullet points
- One reply per line

Context: {context}
Incoming message: "{message}"
"""

    res = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=220,
        temperature=0.6,
        messages=[{"role": "user", "content": prompt}],
    )

    text = res.content[0].text.strip()
    lines = _clean_lines(text)

    if len(lines) < 6:
        raise ValueError(f"Claude returned <6 lines: {lines}")

    return lines[:6]
