from pydantic import BaseModel
from typing import List, Optional

class SuggestReq(BaseModel):
    session_id: str
    last_text: str
    context: Optional[str] = "generic"
    mode: Optional[str] = "default"

class SuggestItem(BaseModel):
    id: str
    text: str
    intent: str
    score: float

class SuggestRes(BaseModel):
    suggestions: List[SuggestItem]

class LogChoiceReq(BaseModel):
    session_id: str
    suggestion_id: str
    context: str
    intent: str
    text: str
