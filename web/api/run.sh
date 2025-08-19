#!/usr/bin/env bash
set -euo pipefail

# Ensure PANNs assets exist
if [ ! -f "$HOME/panns_data/Cnn14_mAP=0.431.pth" ]; then
  echo "Missing PANNs checkpoint at ~/panns_data/Cnn14_mAP=0.431.pth"; exit 1
fi
if [ ! -f "$HOME/panns_data/class_labels_indices.csv" ]; then
  echo "Missing labels csv at ~/panns_data/class_labels_indices.csv"; exit 1
fi

cd "$(dirname "$0")"

# Activate your existing venv
source ../data-pipeline/.venv/bin/activate

# Start FastAPI
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload