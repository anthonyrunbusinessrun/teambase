# ============================================================
# Birdy — Ollama service with automatic model provisioning
# ============================================================
# Railway deployment:
#   - Root directory: services/ollama/
#   - Volume: add /root/.ollama via Railway dashboard (Settings → Volumes)
#   - Env: OLLAMA_HOST=0.0.0.0
#   - Health check: /api/tags
# NOTE: VOLUME instruction is not supported by Railway — add via dashboard
# ============================================================
FROM ollama/ollama:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV OLLAMA_HOST=0.0.0.0

EXPOSE 11434

HEALTHCHECK --interval=15s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -sf http://localhost:11434/api/tags || exit 1

ENTRYPOINT ["/entrypoint.sh"]
