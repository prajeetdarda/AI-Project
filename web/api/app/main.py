from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .model_loader import get_predictor
from .schemas import InferResponse
from fastapi.middleware.cors import CORSMiddleware

import os, torch
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
try:
    torch.set_num_threads(1)
except Exception:
    pass

origins = [
    "http://localhost:3000",
    "https://ai-project-prajeet.vercel.app",
]


app = FastAPI(title="Audio → Spotify Features API", version="1.0")

# CORS (adjust origins for your frontend later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz")
def healthz():
    # Touch model once to ensure it loads
    _ = get_predictor()
    return {"status": "ok"}

@app.post("/infer", response_model=InferResponse)
async def infer(file: UploadFile = File(...)):
    # Basic validation
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    # Accept common audio types; librosa is flexible but let's help the suffix
    fname = file.filename.lower()
    suffix = ".wav"
    if fname.endswith(".mp3"): suffix = ".mp3"
    elif fname.endswith(".m4a"): suffix = ".m4a"
    elif fname.endswith(".webm"): suffix = ".webm"
    elif fname.endswith(".ogg"): suffix = ".ogg"
    elif fname.endswith(".wav"): suffix = ".wav"

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        predictor = get_predictor()
        result = predictor.predict_from_bytes(content, suffix=suffix)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")