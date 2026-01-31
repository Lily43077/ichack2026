from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router
from . import store

store.load()

app = FastAPI(title="ichack2026-backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon mode; tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/health")
def health():
    return {"ok": True}
