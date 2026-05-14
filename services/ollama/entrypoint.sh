#!/bin/bash
# ============================================================
# Birdy — Ollama self-provisioning entrypoint
# Self-managing model lifecycle. Zero manual intervention required.
# ============================================================

set -uo pipefail   # Note: NOT -e so we continue past non-fatal errors

OLLAMA_API="http://localhost:11434"
READY_FILE="/tmp/ollama_ready"
STATUS_FILE="/tmp/ollama_status.json"

# Order matters — smallest first so RAG (nomic) activates within minutes
REQUIRED_MODELS=(
  "nomic-embed-text"
  "phi4"
  "deepseek-coder-v2:16b"
  "qwen3:32b"
)

log()  { echo "[ollama] $(date -u +'%H:%M:%S') $*"; }
warn() { echo "[ollama] $(date -u +'%H:%M:%S') WARN: $*" >&2; }

write_status() {
  local ready=$1 total=$2 failed_list=$3
  printf '{"ready":true,"models_ready":%d,"models_total":%d,"failed":%s,"ts":"%s"}\n' \
    "$ready" "$total" "$failed_list" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > "$STATUS_FILE"
}

# ── Start Ollama server ─────────────────────────────────────────────────────
log "Starting Ollama server (OLLAMA_HOST=${OLLAMA_HOST:-0.0.0.0})"
OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0}" ollama serve &
OLLAMA_PID=$!
log "Ollama server PID: $OLLAMA_PID"

# ── Wait for API (max 3 minutes) ────────────────────────────────────────────
log "Waiting for Ollama API readiness..."
ELAPSED=0
until curl -sf "${OLLAMA_API}/api/tags" > /dev/null 2>&1; do
  if ! kill -0 "$OLLAMA_PID" 2>/dev/null; then
    warn "Ollama server died — restarting"
    OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0}" ollama serve &
    OLLAMA_PID=$!
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  if [ "$ELAPSED" -ge 180 ]; then
    warn "API not ready after 3 minutes — proceeding anyway"
    break
  fi
done
log "Ollama API ready after ${ELAPSED}s"

# ── Provision models ────────────────────────────────────────────────────────
READY=0
TOTAL=${#REQUIRED_MODELS[@]}
FAILED_JSON="[]"

for MODEL in "${REQUIRED_MODELS[@]}"; do
  MODEL_BASE="${MODEL%%:*}"

  # Check if model is already present (persistent volume)
  if ollama list 2>/dev/null | grep -qi "^${MODEL_BASE}"; then
    log "✓ $MODEL — already cached in volume"
    READY=$((READY + 1))
    # Update status file after each model
    write_status "$READY" "$TOTAL" "$FAILED_JSON"
    continue
  fi

  log "⬇  Pulling $MODEL..."
  if ollama pull "$MODEL" 2>&1; then
    log "✓ $MODEL — ready"
    READY=$((READY + 1))
    write_status "$READY" "$TOTAL" "$FAILED_JSON"
  else
    warn "✗ $MODEL — pull failed. Birdy degrades gracefully to Claude."
    FAILED_JSON=$(echo "$FAILED_JSON" | python3 -c \
      "import sys,json; a=json.load(sys.stdin); a.append('$MODEL'); print(json.dumps(a))" 2>/dev/null || echo '["'$MODEL'"]')
    write_status "$READY" "$TOTAL" "$FAILED_JSON"
  fi
done

# Final status
touch "$READY_FILE"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Provisioning complete: $READY/$TOTAL models ready"
if [ "$READY" -eq "$TOTAL" ]; then
  log "🚀 Birdy RAG + memory + routing: FULLY OPERATIONAL"
else
  log "⚠  Birdy operating in degraded mode (Claude handles all routing)"
fi
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Expose readiness via a simple HTTP status endpoint ──────────────────────
# Railway health check hits /api/tags — this is already served by Ollama.
# We also serve /status on port 11435 for Birdy web service to poll.
if command -v python3 &>/dev/null; then
  python3 -c "
import http.server, json, os
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        data = open('$STATUS_FILE').read() if os.path.exists('$STATUS_FILE') else '{}'
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.end_headers()
        self.wfile.write(data.encode())
    def log_message(self, *a): pass
http.server.HTTPServer(('0.0.0.0', 11435), H).serve_forever()
" &
  log "Status endpoint running on :11435"
fi

# ── Keep running ────────────────────────────────────────────────────────────
log "Handing off to Ollama process $OLLAMA_PID"
wait "$OLLAMA_PID"
