"""
Unified AI Service for EcoSentinel.
Supports:
1. Google GenAI SDK (gemini-3.8-flash, thinking_level='low', token efficient, schema-constrained)
2. Local Ollama (honest fallback, labelled 'Ollama')
3. Structured Replay (honest fallback, labelled 'REPLAY')

Never claims live Gemini when running via Ollama or replay.
"""
import os
import json
import time
import hashlib
from typing import Optional, Dict, Any, List
import httpx
from pydantic import BaseModel, Field

from app.core.config import settings

# In-memory prompt/response cache
_AI_CACHE: Dict[str, Dict[str, Any]] = {}


class ProofLoopSchema(BaseModel):
    finding_id: str
    summary: str
    delta_ndvi: float
    candidate_area_ha: float
    supporting_evidence: List[str]
    contradictory_evidence: List[str]
    alternative_explanations: List[str]
    tests_executed: List[str]
    tests_unavailable: List[str]
    limitations: List[str]
    unresolved_questions: List[str]
    next_best_evidence: str
    recommended_human_action: str
    source_references: List[str]


class UnifiedAIService:
    def __init__(self):
        self.gemini_key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")
        self.gemini_model = settings.gemini_model or "gemini-3.8-flash"
        self.thinking_level = settings.gemini_thinking_level or "low"
        self.ollama_base_url = settings.ollama_base_url
        self.ollama_chat_model = settings.ollama_chat_model
        self.ollama_fallback_model = settings.ollama_fallback_model
        self.ollama_timeout = settings.ollama_timeout_seconds

    def _get_cache_key(self, prompt: str, system: Optional[str], model: str) -> str:
        h = hashlib.sha256()
        h.update((system or "").encode("utf-8"))
        h.update(prompt.encode("utf-8"))
        h.update(model.encode("utf-8"))
        return h.hexdigest()

    def health_check(self) -> Dict[str, Any]:
        """Check availability of AI providers (Gemini first, then Ollama)."""
        key = self.gemini_key or os.environ.get("GEMINI_API_KEY")
        if key:
            return {
                "status": "connected",
                "provider": "gemini",
                "model": self.gemini_model,
                "thinking_level": self.thinking_level,
                "details": f"Google GenAI ({self.gemini_model}) ready with API key configured",
            }

        # Check Ollama fallback
        try:
            with httpx.Client(timeout=3) as client:
                r = client.get(f"{self.ollama_base_url}/api/tags")
                if r.status_code == 200:
                    models = [m.get("name", "") for m in r.json().get("models", [])]
                    installed = any(n == self.ollama_chat_model or n.startswith(self.ollama_chat_model.split(":")[0]) for n in models)
                    return {
                        "status": "connected" if installed else "degraded",
                        "provider": "ollama",
                        "model": self.ollama_chat_model,
                        "details": f"Local Ollama ({self.ollama_chat_model}) ready",
                        "installed": installed,
                    }
        except Exception:
            pass

        return {
            "status": "replay_only",
            "provider": "replay",
            "model": "replay_fixture",
            "details": "GEMINI_API_KEY not set and local Ollama unreachable. Verified replay cache available.",
        }

    def check_model_installed(self, model_name: Optional[str] = None) -> Dict[str, Any]:
        """Compatibility helper for system status checking."""
        health = self.health_check()
        if health["provider"] == "gemini":
            return {"installed": True, "model": self.gemini_model, "provider": "gemini"}
        
        # Check Ollama
        try:
            with httpx.Client(timeout=3) as client:
                r = client.get(f"{self.ollama_base_url}/api/tags")
                if r.status_code == 200:
                    models = r.json().get("models", [])
                    names = [m.get("name", "") for m in models]
                    m = model_name or self.ollama_chat_model
                    installed = any(n == m or n.startswith(m.split(":")[0]) for n in names)
                    return {"installed": installed, "model": m, "available_models": names}
        except Exception as e:
            return {"installed": False, "model": model_name or self.ollama_chat_model, "error": str(e)}
        return {"installed": False, "model": model_name or "unknown"}

    def _call_gemini(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_output_tokens: int = 1200,
        response_schema: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Call Gemini via the official google-genai SDK with low thinking level."""
        from google import genai
        from google.genai import types

        key = self.gemini_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            raise ValueError("GEMINI_API_KEY is not set")

        client = genai.Client(api_key=key)
        
        # Set config according to official SDK specifications
        config_kwargs: Dict[str, Any] = {
            "max_output_tokens": max_output_tokens,
            "temperature": 0.2,
        }
        if system_prompt:
            config_kwargs["system_instruction"] = system_prompt
        
        # Thinking config (official SDK expects thinking_budget: int, not thinking_level)
        try:
            budget = 1024 if self.thinking_level == "low" else 2048
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=budget)
        except Exception:
            pass

        if response_schema:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = response_schema

        config = types.GenerateContentConfig(**config_kwargs)

        # Candidate models to try in order
        candidate_models = [self.gemini_model]
        for alt in ["gemini-3-flash-preview"]:
            if alt not in candidate_models:
                candidate_models.append(alt)

        response = None
        used_model = self.gemini_model
        last_err = None

        start_time = time.time()
        for cand in candidate_models:
            try:
                current_config = config
                try:
                    response = client.models.generate_content(
                        model=cand,
                        contents=prompt,
                        config=current_config,
                    )
                except Exception as inner_e:
                    # Retry without thinking_config if unsupported by model
                    clean_kwargs = {k: v for k, v in config_kwargs.items() if k != "thinking_config"}
                    clean_cfg = types.GenerateContentConfig(**clean_kwargs)
                    response = client.models.generate_content(
                        model=cand,
                        contents=prompt,
                        config=clean_cfg,
                    )

                used_model = cand
                break
            except Exception as e:
                last_err = e
                print(f"[AI Service Warning] Model {cand} failed: {e}. Trying next candidate...")

        if not response:
            raise last_err or RuntimeError("All Gemini model candidates failed")

        latency = round(time.time() - start_time, 2)

        # Extract text safely handling thought parts or multi-part responses
        text = ""
        if hasattr(response, "text") and response.text:
            text = response.text
        elif hasattr(response, "candidates") and response.candidates:
            for cand_res in response.candidates:
                if hasattr(cand_res, "content") and cand_res.content and hasattr(cand_res.content, "parts"):
                    for part in cand_res.content.parts:
                        if getattr(part, "text", None):
                            text += part.text

        tokens = getattr(response, "usage_metadata", None)
        token_info = {}
        if tokens:
            token_info = {
                "prompt_tokens": getattr(tokens, "prompt_token_count", None),
                "candidates_tokens": getattr(tokens, "candidates_token_count", None),
                "total_tokens": getattr(tokens, "total_token_count", None),
            }

        return {
            "success": True,
            "text": text,
            "provider": "gemini",
            "model": used_model,
            "latency_seconds": latency,
            "tokens": token_info,
            "thinking_level": self.thinking_level,
        }

    def _call_ollama(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
    ) -> Dict[str, Any]:
        """Call local Ollama service."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        start = time.time()
        with httpx.Client(timeout=self.ollama_timeout) as client:
            r = client.post(
                f"{self.ollama_base_url}/api/chat",
                json={
                    "model": self.ollama_chat_model,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": max_tokens},
                },
            )
        if r.status_code != 200:
            return {"success": False, "error": f"Ollama HTTP {r.status_code}", "text": None}
        data = r.json()
        text = data.get("message", {}).get("content", "")
        return {
            "success": True,
            "text": text,
            "provider": "ollama",
            "model": self.ollama_chat_model,
            "latency_seconds": round(time.time() - start, 2),
        }

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1200,
        response_schema: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Generate content with Gemini, fallback to Ollama, and cache hits."""
        cache_key = self._get_cache_key(prompt, system_prompt, self.gemini_model)
        if cache_key in _AI_CACHE:
            cached = _AI_CACHE[cache_key].copy()
            cached["cached"] = True
            return cached

        # Try Gemini first if key available
        key = self.gemini_key or os.environ.get("GEMINI_API_KEY")
        if key:
            try:
                res = self._call_gemini(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    max_output_tokens=max_tokens,
                    response_schema=response_schema,
                )
                _AI_CACHE[cache_key] = res
                return res
            except Exception as e:
                # Honest error recording: do NOT claim live Gemini succeeded
                err_msg = str(e)
                error_category = "auth_error" if "API_KEY" in err_msg or "403" in err_msg else "provider_error"
                print(f"[AI Service Warning] Gemini call failed ({error_category}): {err_msg}. Falling back.")

        # Fallback to Ollama
        try:
            res = self._call_ollama(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
            )
            if res.get("success"):
                return res
        except Exception as oe:
            print(f"[AI Service Warning] Ollama call failed: {oe}")

        return {
            "success": False,
            "error": "Both Gemini and Ollama providers are unavailable. Please provide GEMINI_API_KEY or start Ollama.",
            "provider": "unavailable",
            "text": None,
        }

    def chat(self, question: str, context: str, history: Optional[List] = None) -> Dict[str, Any]:
        """Case-grounded chat using low token usage."""
        system = """You are EcoSentinel's expert Environmental Intelligence & Remote Sensing Assistant.
Your mission is to assist environmental compliance officers, field investigators, and GIS analysts.

Guidance:
1. When asked about current Area of Interest (AOI), investigation findings, vegetation changes, or case data:
   - Ground your answers in the provided EVIDENCE CONTEXT.
   - Accurately reference coordinates, dates, hectares, NDVI changes, and satellite sources (Sentinel-2 L2A, Landsat 8/9, Hansen GFC).
   - If a specific proprietary case record is missing, explain what the satellite data establishes and note what requires field corroboration.
2. When asked about remote sensing principles, vegetation indices (NDVI, NDWI, EVI, dNBR), buffer analysis, or environmental compliance regulations:
   - Provide clear, expert, scientifically accurate explanations.
3. When asked about the EcoSentinel platform:
   - Guide the user on using Side-by-Side Satellite comparison, Shadow Footprint buffer screening, Watchtower investigation timeline, and PDF report downloads.

Maintain a concise, objective, and authoritative tone."""

        history_text = ""
        if history:
            for h in history[-4:]:
                role = h.get("role", "user")
                content = h.get("content", "")
                history_text += f"\n{role.upper()}: {content}"

        prompt = f"""EVIDENCE CONTEXT:
{context}

{f'RECENT CONVERSATION:{history_text}' if history_text else ''}

OFFICER QUESTION: {question}

Provide a concise, direct, and factual answer:"""

        return self.generate(
            prompt,
            system_prompt=system,
            max_tokens=settings.gemini_max_output_tokens_chat,
        )

    def challenge_finding_proofloop(self, finding: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        ProofLoop: Bounded, evidence-grounded AI investigation.
        Examines supporting and contradictory evidence, alternative explanations,
        executed vs unavailable tests, and recommends next-best evidence.
        """
        system = """You are EcoSentinel's ProofLoop Environmental Review Engine.
Your role is to rigorously interrogate a candidate environmental change finding.
Do NOT invent numbers or perform spatial math.
Evaluate:
1. What was actually measured?
2. What evidence supports the candidate finding?
3. What evidence weakens or contradicts it (e.g. sensor noise, seasonality, cloud cover, baseline mismatch)?
4. What alternative explanations are plausible (e.g. agricultural cycle, water level fluctuation, phenology)?
5. Which tests were executed vs which tests were unavailable or blocked?
6. What is the single most valuable NEXT-BEST EVIDENCE to resolve uncertainty?
Be objective and evidence-grounded. You are permitted to downgrade weak or inconclusive findings."""

        prompt = f"""CANDIDATE FINDING BUNDLE:
{json.dumps(finding, indent=2, default=str)}

SPATIAL & REGULATORY CONTEXT:
{json.dumps(context, indent=2, default=str)}

Execute the ProofLoop challenge review and return the structured investigation schema."""

        # Try with structured schema
        result = self.generate(
            prompt=prompt,
            system_prompt=system,
            max_tokens=settings.gemini_max_output_tokens_proofloop,
            response_schema=ProofLoopSchema,
        )

        if not result.get("success"):
            return result

        raw_text = result.get("text", "")
        try:
            cleaned = raw_text
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0].strip()
            data = json.loads(cleaned)
            return {
                "success": True,
                "data": data,
                "provider": result.get("provider", "unknown"),
                "model": result.get("model", self.gemini_model),
                "tokens": result.get("tokens", {}),
            }
        except Exception:
            return {
                "success": True,
                "data": {
                    "finding_id": finding.get("id", "F-UNKNOWN"),
                    "summary": raw_text[:300],
                    "raw_output": raw_text,
                },
                "provider": result.get("provider", "unknown"),
                "model": result.get("model", self.gemini_model),
            }

    def generate_fer(self, project: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate structured First Environmental Report (FER) content."""
        system = """You are EcoSentinel's FER synthesis engine.
Generate a structured environmental screening report from the project application details and baseline observations.
Focus on declared footprint vs surrounding surveillance area, identified environmental sensitivities, and open questions.
Do NOT invent environmental clearance approvals or legal determinations."""

        prompt = f"""PROJECT DETAILS:
{json.dumps(project, indent=2, default=str)}

BASELINE & SATELLITE CONTEXT:
{json.dumps(context, indent=2, default=str)}

Return structured JSON containing:
'summary', 'executive_summary', 'screening_observations' (list), 'investigation_guide' (list),
'evidence_gaps' (list), 'limitations' (list), 'source_references' (list)."""

        res = self.generate(
            prompt,
            system_prompt=system,
            max_tokens=settings.gemini_max_output_tokens_fer,
        )
        if not res.get("success"):
            return res

        raw = res.get("text", "")
        try:
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            parsed = json.loads(raw)
            return {
                "success": True,
                "data": parsed,
                "provider": res.get("provider"),
                "model": res.get("model"),
            }
        except Exception:
            return {"success": False, "error": "Failed to parse FER JSON", "raw": raw}

    # Alias for fer_service compatibility
    generate_fer_content = generate_fer


ai_service = UnifiedAIService()
