import json
import os

WEIGHTS_FILE = "backend/weights.json"
weights = {}

def load():
    global weights
    if os.path.exists(WEIGHTS_FILE):
        with open(WEIGHTS_FILE, "r") as f:
            weights = json.load(f)

def save():
    with open(WEIGHTS_FILE, "w") as f:
        json.dump(weights, f, indent=2)

def _key(context, intent, text):
    return f"{context}||{intent}||{text}"

def get_weight(context, intent, text):
    return weights.get(_key(context, intent, text), 0)

def bump(context, intent, text, delta=1):
    k = _key(context, intent, text)
    weights[k] = weights.get(k, 0) + delta
