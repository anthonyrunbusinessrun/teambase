# ============================================================
# Birdy — Ollama service with automatic model provisioning
# ============================================================
# Based on the official Ollama image.
# Adds: self-provisioning startup script, readiness health check.
#
# Railway deployment:
#   - Set root directory = services/ollama/
#   - Add volume: /root/.ollama  (models persist across deploys)
#   - Set OLLAMA_HOST=0.0.0.0
#   - Health check: GET /api/tags → 200 (fast after first boot)
# ============================================================
FROM ollama/ollama:latest

# Install curl for health checks and python3 for JSON formatting in entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Ollama data directory — mount a Railway volume here for model persistence
VOLUME ["/root/.ollama"]

ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_MODELS=/root/.ollama/models

# Ollama API port
EXPOSE 11434

# Health check — passes as soon as the API is up (models may still be pulling)
HEALTHCHECK --interval=15s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -sf http://localhost:11434/api/tags || exit 1

ENTRYPOINT ["/entrypoint.sh"]
