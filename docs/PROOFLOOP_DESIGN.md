# ProofLoop™ Architecture & Signature AI Investigation Specification

## 1. What is ProofLoop?

**ProofLoop™** is EcoSentinel's signature differentiator for environmental review. Unlike conventional GenAI tools that simply summarize documents or hallucinate legal compliance, ProofLoop performs a **bounded, counter-evidence interrogation** of deterministic satellite measurements.

ProofLoop answers:
- **What was actually measured?** (e.g. ΔNDVI = -0.38 across 18.4 ha)
- **What evidence supports the candidate finding?** (Multi-temporal spectral drop, Dynamic World bare ground expansion)
- **What evidence weakens or contradicts it?** (Sensor noise, cloud shadow edge distortion, absence of thermal burn scars)
- **What alternative explanations are plausible?** (Seasonal agricultural harvest, approved canal infrastructure, drought)
- **Which tests were executed vs blocked?** (Cadastral lease boundaries blocked due to missing provincial survey files)
- **What is the Next-Best Evidence?** (Request official concession boundaries, schedule high-resolution UAV survey)

---

## 2. Gemini 3.8 Flash Configuration

EcoSentinel calls the **Google GenAI SDK** (`google-genai`) using token-efficient parameters:

```env
GEMINI_MODEL=gemini-3.8-flash
GEMINI_THINKING_LEVEL=low
GEMINI_MAX_OUTPUT_TOKENS_PROOFLOOP=1800
```

- **Low Thinking Level:** Preserves rapid latency and concise reasoning without wasteful runaway reasoning tokens.
- **Structured Pydantic Output:** Schema-constrained outputs enforce rigid JSON fields (`supporting_evidence`, `contradictory_evidence`, `next_best_evidence`).
- **Zero Hallucinated GIS:** Gemini is never tasked with computing hectares or polygons; deterministic geospatial math is computed server-side by Shapely/PyProj.
- **Honest Fallback:** If API quota, authentication, or billing limits are reached, the system falls back gracefully to local Ollama or replay mode with visible badges.
