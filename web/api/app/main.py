# web/api/app/main.py

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .model_loader import get_predictor
from .schemas import InferResponse

import os
import torch

# Keep tiny instances stable
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
try:
    torch.set_num_threads(1)
except Exception:
    pass

# Frontend origins (adjust for your prod domain)
origins = [
    "http://localhost:3000",
    "https://ai-project-prajeet.vercel.app",
]

app = FastAPI(title="Audio → Spotify Features API", version="1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz")
def healthz():
    """Warm model and report OK."""
    _ = get_predictor()
    return {"status": "ok"}

@app.post("/infer", response_model=InferResponse)
async def infer(file: UploadFile = File(...)):
    """Accept an audio file, run PANNs+head, return Spotify-style features."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Help downstream loaders by passing a suffix
    name = (file.filename or "").lower()
    suffix = ".wav"
    if name.endswith(".mp3"):
        suffix = ".mp3"
    elif name.endswith(".m4a"):
        suffix = ".m4a"
    elif name.endswith(".webm"):
        suffix = ".webm"
    elif name.endswith(".ogg"):
        suffix = ".ogg"
    elif name.endswith(".wav"):
        suffix = ".wav"

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        predictor = get_predictor()
        result = predictor.predict_from_bytes(content, suffix=suffix)
        return result
    except Exception as e:
        # Surface a concise error while keeping the server logs detailed
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")