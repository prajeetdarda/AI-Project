# ---- base image ----
FROM python:3.11-slim

# ---- system deps for audio ----
# add curl to use in HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg libsndfile1 ca-certificates git curl && \
    rm -rf /var/lib/apt/lists/*

# ---- pull your repo at build time ----
ARG REPO_URL=https://github.com/prajeetdarda/AI-Project
ARG REPO_REF=main
RUN git clone --depth=1 --branch ${REPO_REF} ${REPO_URL} /src
WORKDIR /src

# ---- python deps (use your FastAPI reqs) ----
RUN pip install --no-cache-dir -r web/api/requirements.txt

# ---- bake PANN weights into the image (from your GH Release) ----
ADD https://github.com/prajeetdarda/AI-Project/releases/download/v1.0.0/Cnn14_mAP.0.431.pth /app/data/Cnn14_mAP.0.431.pth

# ---- runtime env ----
ENV PANN_CHECKPOINT_PATH=/app/data/Cnn14_mAP.0.431.pth
ENV PANN_CHECKPOINT_URL=
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV PYTHONPATH=/src/web/api
ENV PORT=7860
EXPOSE 7860

# ---- simple healthcheck (no heredoc; avoids editor warnings) ----
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD curl -fsS "http://127.0.0.1:${PORT}/healthz" || exit 1

# ---- launch ----
# app is at web/api/app/main.py -> app.main:app  (PYTHONPATH points to /src/web/api)
CMD ["bash","-lc","uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]