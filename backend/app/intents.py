import re

RULES = [
    ("emergency", re.compile(r"(help|emergency|doctor|police|ambulance|999)", re.I)),
    ("directions", re.compile(r"(where|direction|station|bus|train|map)", re.I)),
    ("payment", re.compile(r"(pay|price|card|cash|£|pound)", re.I)),
    ("clarify", re.compile(r"(repeat|again|sorry|clarify|what)", re.I)),
]

def classify_intent(text: str) -> str:
    for name, rule in RULES:
        if rule.search(text):
            return name
    return "generic"
