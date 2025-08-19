from pathlib import Path
import os

# Project root (this file lives at web/api/app/config.py)
ROOT = Path(__file__).resolve().parents[2]

# Artifacts from your training
ART_DIR = ROOT / "model-training" / "output"
HEAD_WEIGHTS = ART_DIR / "multitask_head.pt"
SCALERS_JSON = ART_DIR / "regression_scalers.json"
CLASSMAP_JSON = ART_DIR / "class_maps.json"

# PANNs assets (you downloaded these earlier)
PANN_DATA_DIR = Path(os.environ.get("PANN_DATA_DIR", Path.home() / "panns_data"))
PANN_CHECKPOINT = PANN_DATA_DIR / "Cnn14_mAP=0.431.pth"     # must exist
PANN_LABELS = PANN_DATA_DIR / "class_labels_indices.csv"     # must exist

# Audio preprocessing
SR = 32000
CROP_SEC = 10.0

# Model hyperparams (must match training)
HIDDEN = 512
DROPOUT = 0.2
REG_COLS = [
    "acousticness","danceability","energy","instrumentalness","liveness",
    "loudness","speechiness","tempo","valence","duration_ms"
]
CLS_COLS = ["key","mode","time_signature"]

MODEL_VERSION = "mt-head-v1"