from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .model_loader import get_predictor
from .schemas import InferResponse

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- NEW: super‑cheap root + health endpoints ---
@app.get("/")
def root():
    return {"ok": True, "service": "audio-features", "hint": "use /infer (POST file=)"}

@app.get("/healthz")
def healthz():
    # do NOT load the model here; just prove the process is alive
    return {"status": "ok"}

# Optional: a readiness probe that checks env & filesystem, still light
@app.get("/readyz")
def readyz():
    return {
        "status": "ready-ish",
        "python": os.sys.version.split()[0],
        "has_open_port": True,
        "env": {
            "PANN_CHECKPOINT_URL": bool(os.getenv("PANN_CHECKPOINT_URL")),
            "PANN_CHECKPOINT_PATH": os.getenv("PANN_CHECKPOINT_PATH"),
        },
    }

@app.post("/infer", response_model=InferResponse)
async def infer(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # pick suffix to help decoder
    fname = (file.filename or "").lower()
    suffix = ".wav"
    for ext in (".mp3", ".m4a", ".webm", ".ogg", ".wav"):
        if fname.endswith(ext):
            suffix = ext
            break

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        predictor = get_predictor()  # model loads on-demand here only
        result = predictor.predict_from_bytes(content, suffix=suffix)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")