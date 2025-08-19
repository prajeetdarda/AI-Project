import numpy as np
import librosa
from .config import SR, CROP_SEC

def center_crop(y: np.ndarray, need: int) -> np.ndarray:
    if len(y) >= need:
        s = (len(y) - need) // 2
        return y[s:s+need]
    pad = need - len(y)
    return np.pad(y, (pad//2, pad - pad//2))

def load_audio_32k(path_str: str) -> np.ndarray:
    # librosa uses audioread/ffmpeg to handle mp3/m4a/webm/etc.
    y, _ = librosa.load(path_str, sr=SR, mono=True)
    return center_crop(y, int(SR * CROP_SEC))