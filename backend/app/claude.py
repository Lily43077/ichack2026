import os
from anthropic import Anthropic

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def generate_replies(message: str, context: str):
    prompt = f"""
Generate exactly 6 short reply options for a user to tap.

Rules:
- Each reply under 18 words
- Polite and neutral
- No emojis
- No numbering or bullets
- One reply per line

Context: {context}
Message: "{message}"
"""

    res = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=200,
        temperature=0.6,
        messages=[{"role": "user", "content": prompt}],
    )

    lines = []
    for line in res.content[0].text.split("\n"):
        line = line.strip().lstrip("-•0123456789. ").strip()
        if line:
            lines.append(line)

    if len(lines) < 6:
        raise ValueError("Claude output invalid")

    return lines[:6]
