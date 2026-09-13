"""Configuração da engine lida do ambiente.

A engine não importa `app.*`: roda dentro da API, em scripts de treino e em testes.
"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

PACKAGE_DIR = Path(__file__).resolve().parent

EngineMode = Literal["off", "stub", "full"]
LLMCacheMode = Literal["live", "record", "replay"]

_ENGINE_MODES = {"off", "stub", "full"}
_CACHE_MODES = {"live", "record", "replay"}


@dataclass(frozen=True)
class EngineSettings:
    mode: EngineMode
    openai_api_key: str
    openai_model: str
    llm_cache: LLMCacheMode
    llm_cache_dir: Path
    artifacts_dir: Path
    params_version: str
    weights_version: str


def _choice(name: str, default: str, allowed: set[str]) -> str:
    value = os.getenv(name, default).strip().lower()
    if value not in allowed:
        raise ValueError(f"{name}={value!r} inválido; use um de {sorted(allowed)}")
    return value


def load_settings() -> EngineSettings:
    """Lê as variáveis a cada chamada para que testes possam alterar o ambiente."""

    return EngineSettings(
        mode=_choice("ENGINE_MODE", "off", _ENGINE_MODES),  # type: ignore[arg-type]
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-5"),
        llm_cache=_choice("ENGINE_LLM_CACHE", "live", _CACHE_MODES),  # type: ignore[arg-type]
        llm_cache_dir=Path(os.getenv("ENGINE_LLM_CACHE_DIR", PACKAGE_DIR / "llm_cache")),
        artifacts_dir=Path(os.getenv("ENGINE_ARTIFACTS_DIR", PACKAGE_DIR / "artifacts")),
        params_version=os.getenv("ENGINE_PARAMS_VERSION", "engine_v1"),
        weights_version=os.getenv("ENGINE_WEIGHTS_VERSION", "pesos_embasamento_v1"),
    )
