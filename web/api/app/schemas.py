from pydantic import BaseModel, Field
from typing import Dict, Any

class InferResponse(BaseModel):
    features: Dict[str, Any]
    meta: Dict[str, Any]