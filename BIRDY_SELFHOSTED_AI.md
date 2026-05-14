# Birdy — Self-Hosted AI Architecture

## Vision

Birdy operates as a fully autonomous enterprise AI platform.
Anthropic is an optional last-resort fallback, not a dependency.

---

## Current provider stack (Ollama-first)

```
User message
    │
    ▼
Intent classifier (local, synchronous)
    │
    ├── simple    → phi4 → qwen3
    ├── code      → deepseek-coder → qwen3 → phi4
    ├── reasoning → qwen3 → phi4
    └── strategic → qwen3 → phi4 → [Claude: last resort]
                                        ↑
                              only if ANTHROPIC_API_KEY set
                              and BIRDY_CLAUDE_FALLBACK != false
```

---

## Phase 1 — Ollama (current)

**Models:**

| Model | Size | Role | Quality |
|---|---|---|---|
| `phi4` | 9 GB | Fast utility, summarization | ★★★★☆ |
| `deepseek-coder-v2:16b` | 9 GB | Code generation | ★★★★★ |
| `qwen3:32b` | 20 GB | Reasoning, strategic | ★★★★★ |
| `nomic-embed-text` | 274 MB | RAG embeddings | ★★★★☆ |

**Railway setup:**
```
Service: ollama
Dockerfile: services/ollama/Dockerfile
Volume: /root/.ollama (50 GB)
Env: OLLAMA_HOST=0.0.0.0
```

**After pulling all models:** full self-hosted capability with zero Anthropic dependency.

---

## Phase 2 — vLLM GPU inference

vLLM provides significantly faster inference than Ollama, with:
- Continuous batching (handles concurrent requests efficiently)
- PagedAttention (2-4× throughput vs naive implementation)
- OpenAI-compatible API (Birdy's `VLLMProvider` is already implemented)

### Railway GPU deployment

```bash
# Railway GPU service setup:
# 1. New Service → Docker Image
# 2. Image: vllm/vllm-openai:latest
# 3. Instance type: GPU (H100 80GB or A100 40GB)
# 4. Volume: /root/.cache/huggingface (HF model cache)
```

**docker-compose for local GPU testing:**
```yaml
services:
  vllm:
    image: vllm/vllm-openai:latest
    runtime: nvidia
    environment:
      - HUGGING_FACE_HUB_TOKEN=${HF_TOKEN}
    ports:
      - "8000:8000"
    volumes:
      - hf_cache:/root/.cache/huggingface
    command: >
      --model meta-llama/Llama-3.1-8B-Instruct
      --tensor-parallel-size 1
      --max-model-len 8192
      --dtype bfloat16
      --port 8000
```

**Environment variables to add in Railway:**
```
VLLM_BASE_URL=http://vllm.railway.internal:8000
VLLM_API_KEY=your-secret-key          # optional auth
VLLM_MODEL_REASONING=meta-llama/Llama-3.1-8B-Instruct
VLLM_MODEL_CODE=deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct
BIRDY_CLAUDE_FALLBACK=false           # disable Claude entirely
```

### Recommended model roster for vLLM

| Intent | Model | Size | VRAM |
|---|---|---|---|
| Reasoning/Strategic | `Llama-3.1-8B-Instruct` | 16 GB | 20 GB |
| Code | `DeepSeek-Coder-V2-Lite` | 16 GB | 20 GB |
| Fast utility | `Phi-3.5-mini-instruct` | 4 GB | 8 GB |
| Embeddings | `nomic-embed-text-v1.5` | 274 MB | CPU |

**Single A100 40GB can serve:** Llama-3.1-8B + DeepSeek-Coder-Lite simultaneously.

---

## Phase 3 — Quantization strategy

Quantization reduces model size and memory footprint with minimal quality loss.

### Ollama (GGUF format)

```bash
# Pull quantized variants (lower VRAM, faster inference):
ollama pull qwen3:32b-q4_K_M    # 20 GB → 18 GB, ~2% quality loss
ollama pull phi4:q4_K_M          # 9 GB → 5 GB
ollama pull deepseek-coder-v2:16b-q4_K_M

# Quality ranking: Q8_0 > Q6_K > Q5_K_M > Q4_K_M > Q4_0
# Sweet spot:      Q4_K_M — minimal quality loss, ~50% size reduction
```

### vLLM (bfloat16 → int4 via AWQ/GPTQ)

```bash
# AWQ quantization (preserves quality better than GPTQ):
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --quantization awq \
  --dtype float16

# For A100 40GB: run 70B model with AWQ
vllm serve meta-llama/Llama-3.1-70B-Instruct-AWQ \
  --tensor-parallel-size 2 \
  --quantization awq
```

---

## Phase 4 — LoRA fine-tuning pipeline

Fine-tune models on Rayland-specific operational data to improve:
- Understanding of PeopleBook workflows
- Rayland-specific terminology and style
- Response format preferences

### Data collection (from production usage)

```sql
-- Collect high-quality training pairs from production usage logs
-- These are conversations where users didn't retry or show frustration signals

SELECT
  bm.content AS prompt,
  bm2.content AS completion,
  bu.intent,
  bu.latency_ms,
  bu.tokens_out
FROM birdy_messages bm
JOIN birdy_messages bm2 ON bm2.conversation_id = bm.conversation_id
  AND bm2.role = 'ASSISTANT'
  AND bm2.created_at > bm.created_at
JOIN birdy_usage_logs bu ON bu.conversation_id = bm.conversation_id
WHERE bm.role = 'USER'
  AND bu.status = 'success'
  AND bu.latency_ms < 10000    -- fast responses
  AND LENGTH(bm2.content) > 100 -- substantive responses
ORDER BY bu.created_at DESC
LIMIT 10000;
```

### Fine-tuning with Unsloth (fast LoRA)

```python
# train_birdy_lora.py
from unsloth import FastLanguageModel
import torch

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
    max_seq_length=4096,
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,                    # LoRA rank — higher = more parameters
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
)

# Training data: JSONL with prompt/completion pairs from Birdy usage logs
# Export with: SELECT prompt, completion FROM birdy_training_data
```

### Export to GGUF for Ollama

```bash
# After training, export for Ollama:
python llama.cpp/convert_hf_to_gguf.py ./birdy-lora-merged \
  --outtype q4_k_m \
  --outfile birdy-rayland-q4km.gguf

# Create Ollama Modelfile:
cat > Modelfile << 'EOF'
FROM ./birdy-rayland-q4km.gguf
SYSTEM "You are Birdy, the enterprise AI copilot for Rayland Inc..."
PARAMETER num_predict 2048
PARAMETER temperature 0.7
EOF

ollama create birdy-rayland:latest -f Modelfile
```

---

## Phase 5 — Evaluation pipeline

Run benchmarks via the API to track model quality over time:

```bash
# Run full benchmark suite against qwen3
curl -X POST https://teambase.up.railway.app/api/birdy/admin/benchmark \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:32b","suite":"recruiting"}' \
  | while IFS= read -r line; do
      echo "$line" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
if d['type'] == 'result':
    r = d['data']
    status = '✓' if r['passed'] else '✗'
    print(f\"{status} {r['caseId']}: score={r['score']:.2f}, latency={r['latencyMs']}ms\")
elif d['type'] == 'summary':
    print(f\"\\n=== {d['model']} ({d['suite']}) ===\")
    print(f\"Pass rate: {d['passRate']*100:.0f}%\")
    print(f\"Avg score: {d['avgScore']:.2f}\")
    print(f\"Avg latency: {d['avgLatencyMs']}ms\")
"
    done

# Compare models:
for model in phi4 qwen3:32b deepseek-coder-v2:16b; do
  echo "=== $model ==="
  curl -s -X POST .../benchmark -d "{\"model\":\"$model\",\"suite\":\"recruiting\"}" \
    | tail -1 | python3 -c "..."
done
```

---

## Disabling Claude entirely

Once Ollama models are stable:

```bash
# In Railway web service variables:
BIRDY_CLAUDE_FALLBACK=false

# The router will no longer append Claude to any chain.
# If all Ollama models fail, Birdy returns a clear error:
# "All AI providers unavailable. Please check Ollama is running."

# You can also remove the ANTHROPIC_API_KEY variable entirely.
```

---

## Inference optimization checklist

| Optimization | Ollama | vLLM | Impact |
|---|---|---|---|
| Model quantization (Q4_K_M) | ✅ | ✅ via AWQ | -50% VRAM |
| Batch inference | Limited | ✅ continuous batching | +3× throughput |
| KV cache | Auto | PagedAttention | -40% VRAM |
| Flash Attention 2 | Auto | `--enable-chunked-prefill` | +30% speed |
| Tensor parallelism | ❌ | ✅ multi-GPU | Linear scaling |
| Speculative decoding | ❌ | ✅ | +2× speed small models |
| Response caching | lib/birdy/cache.ts | Redis | Eliminate repeat calls |

---

## Open-source model leaderboard (TeamBase workloads)

Tested via Birdy's eval framework on recruiting + operations tasks:

| Model | Size | Recruiting | Code | Reasoning | Avg latency |
|---|---|---|---|---|---|
| `qwen3:32b` | 20 GB | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ~8s |
| `deepseek-coder-v2:16b` | 9 GB | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ~4s |
| `phi4` | 9 GB | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ~2s |
| `llama3.1:8b` (vLLM) | 16 GB | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ~1.5s |

_Ratings based on Birdy eval suite. Run `/api/birdy/admin/benchmark` for live scores._
