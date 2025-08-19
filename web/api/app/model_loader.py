# web/api/app/model_loader.py

import os
import json
import time
import tempfile
import pathlib
from pathlib import Path
from typing import Dict, Any

import numpy as np
import torch
from panns_inference import AudioTagging
import requests

from .config import (
    HEAD_WEIGHTS,
    SCALERS_JSON,
    CLASSMAP_JSON,
    MODEL_VERSION,
    HIDDEN,
    DROPOUT,
    REG_COLS,           # list of regression target names (must match training)
)
from .audio import load_audio_32k
from .model_def import MTModel

# Keep CPU usage tame on small instances
torch.set_num_threads(max(1, int(os.getenv("TORCH_NUM_THREADS", "1"))))

# --------- Remote checkpoint bootstrap (for Render etc.) ----------
PANN_CKPT = os.getenv("PANN_CHECKPOINT_PATH", "/opt/render/project/src/data/Cnn14.pth")
PANN_URL  = os.getenv("PANN_CHECKPOINT_URL", "")  # e.g. your GitHub Release asset URL

def ensure_checkpoint() -> str:
    """
    Ensure the PANNs checkpoint exists at PANN_CKPT.
    - If missing and PANN_URL is set, download it (streaming, with basic validation).
    - If missing and PANN_URL is not set, raise an actionable error.
    """
    dst = pathlib.Path(PANN_CKPT)
    dst.parent.mkdir(parents=True, exist_ok=True)

    if dst.exists() and dst.stat().st_size > 1024 * 1024:  # >1MB sanity
        return str(dst)

    if not PANN_URL:
        raise RuntimeError(
            "PANN checkpoint missing and PANN_CHECKPOINT_URL is not set.\n"
            f"Expected at: {dst}\n"
            "Set PANN_CHECKPOINT_URL (e.g., your GitHub Release asset URL) or bake the file into the image."
        )

    # Stream download
    print(f"[bootstrap] Downloading PANN checkpoint from {PANN_URL} ...")
    with requests.get(PANN_URL, stream=True, timeout=120) as r:
        r.raise_for_status()
        tmp = dst.with_suffix(".part")
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
        tmp.replace(dst)

    # quick size sanity (PANN Cnn14 is ~300MB)
    sz = dst.stat().st_size
    if sz < 50 * 1024 * 1024:
        raise RuntimeError(f"Downloaded checkpoint looks too small ({sz} bytes): {dst}")

    print(f"[bootstrap] Saved checkpoint -> {dst} ({sz/1024/1024:.1f} MB)")
    return str(dst)


class Predictor:
    """
    Loads:
      - scalers (means/stds) to de-standardize regression outputs
      - class_maps (value <-> index) for classification heads
      - PANNs backbone for embeddings (CPU)
      - Multi-task head (your trained model)

    Adapts runtime embedding dim (e.g., 2048) to head’s expected dim (e.g., 2049).
    """

    def __init__(self):
        # --- 0) Ensure PANNs checkpoint present (download if needed) ---
        ckpt_path = ensure_checkpoint()

        # --- 1) Load scalers & class maps ---
        with open(SCALERS_JSON, "r") as f:
            self.scalers: Dict[str, Dict[str, float]] = json.load(f)  # {"mean": {...}, "std": {...}}

        with open(CLASSMAP_JSON, "r") as f:
            self.class_maps: Dict[str, Dict[str, Any]] = json.load(f)  # {"key": {...}, "mode": {...}, ...}

        # --- 2) Load head weights FIRST to know expected input dim ---
        sd = torch.load(HEAD_WEIGHTS, map_location="cpu")
        if "trunk.0.weight" not in sd:
            raise RuntimeError("Bad head checkpoint: missing 'trunk.0.weight' in state_dict")
        self.expected_d_in: int = int(sd["trunk.0.weight"].shape[1])

        # --- 3) Boot PANNs backbone ONCE using the resolved checkpoint ---
        # (AudioTagging will ensure its label CSV in ~/panns_data; works fine on Render)
        print(f"Checkpoint path: {ckpt_path}")
        print("Using CPU.")
        self.panns = AudioTagging(checkpoint_path=ckpt_path, device="cpu")

        # --- 4) Probe actual runtime embedding dim from PANNs ---
        dummy = np.zeros((1, 32000), dtype=np.float32)
        _, emb = self.panns.inference(dummy)
        self.actual_d_in: int = int(np.asarray(emb).shape[1])

        # --- 5) Build the head using expected dim and load weights ---
        self.model = MTModel(
            d_in=self.expected_d_in,
            hidden=HIDDEN,
            dropout=DROPOUT,
            class_maps=self.class_maps,
            reg_cols=REG_COLS,
        )
        self.model.load_state_dict(sd)
        self.model.eval()

        # --- 6) Adapter to reconcile dims (pad or slice) ---
        def _adapt(x_np: np.ndarray) -> np.ndarray:
            B, D = x_np.shape
            if D == self.expected_d_in:
                return x_np
            if D > self.expected_d_in:
                return x_np[:, : self.expected_d_in]
            pad = self.expected_d_in - D
            return np.pad(x_np, ((0, 0), (0, pad)), mode="constant")

        self._adapt = _adapt

        if self.actual_d_in != self.expected_d_in:
            print(
                f"[Predictor] Embedding dim mismatch: runtime={self.actual_d_in}, "
                f"expected={self.expected_d_in}. Auto-adapting embeddings."
            )

    # ---------- Internal helpers ----------

    def _invert_regression(self, name: str, p_std: float) -> float:
        m = self.scalers["mean"][name]
        s = self.scalers["std"][name]
        val = p_std * s + m
        if name in ("tempo", "duration_ms"):
            val = float(np.expm1(val))
        return float(val)

    def _predict_from_path(self, path: Path) -> Dict[str, Any]:
        t0 = time.time()
        y = load_audio_32k(str(path))

        # PANNs embedding
        _, emb = self.panns.inference(y[None, :])     # (1, D_actual)
        x_np = np.asarray(emb, dtype=np.float32)
        x_np = self._adapt(x_np)                      # (1, D_expected)
        x = torch.from_numpy(x_np)                    # cpu tensor

        with torch.no_grad():
            out = self.model(x)

        # Regressions
        reg = {}
        for c in REG_COLS:
            p_std = float(out[f"reg_{c}"].cpu().numpy()[0])
            reg[c] = self._invert_regression(c, p_std)

        # Classifications (keys of class_maps: "key","mode","time_signature")
        cls = {}
        for c in self.class_maps.keys():
            logits = out[f"cls_{c}"].cpu().numpy()[0]
            idx = int(np.argmax(logits))
            cls_val = self.class_maps[c]["classes"][idx]
            cls[c] = int(cls_val)

        elapsed = int((time.time() - t0) * 1000)
        return {
            "features": {**reg, **cls},
            "meta": {
                "model_version": MODEL_VERSION,
                "embedding_dim": int(x.shape[1]),
                "latency_ms": elapsed
            }
        }

    # ---------- Public entry points ----------

    def predict_from_bytes(self, content: bytes, suffix: str = ".wav") -> Dict[str, Any]:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp.flush()
            p = Path(tmp.name)
        try:
            return self._predict_from_path(p)
        finally:
            try:
                p.unlink()
            except Exception:
                pass


# ---------- Singleton accessor ----------

_predictor = None

def get_predictor() -> Predictor:
    global _predictor
    if _predictor is None:
        _predictor = Predictor()
    return _predictor