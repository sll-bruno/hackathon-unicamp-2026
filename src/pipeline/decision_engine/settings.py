"""Configuração da engine lida do ambiente (e do `.env` da raiz, se existir).

A engine não importa `app.*`: roda dentro da API, em scripts de treino e em testes.
"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

PACKAGE_DIR = Path(__file__).resolve().parent
REPO_ROOT = PACKAGE_DIR.parents[2]

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
    risk_model_version: str


def _dotenv() -> dict[str, str]:
    path = Path.cwd() / ".env"
    if not path.is_file():
        path = REPO_ROOT / ".env"
    if not path.is_file():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _env(name: str, default: str, dotenv: dict[str, str]) -> str:
    return os.getenv(name) or dotenv.get(name) or default


def _choice(name: str, default: str, allowed: set[str], dotenv: dict[str, str]) -> str:
    value = _env(name, default, dotenv).strip().lower()
    if value not in allowed:
        raise ValueError(f"{name}={value!r} inválido; use um de {sorted(allowed)}")
    return value


def load_settings() -> EngineSettings:
    """Lê as variáveis a cada chamada para que testes possam alterar o ambiente."""

    dotenv = _dotenv()
    return EngineSettings(
        mode=_choice("ENGINE_MODE", "off", _ENGINE_MODES, dotenv),  # type: ignore[arg-type]
        openai_api_key=_env("OPENAI_API_KEY", "", dotenv),
        openai_model=_env("OPENAI_MODEL", "gpt-5", dotenv),
        llm_cache=_choice("ENGINE_LLM_CACHE", "record", _CACHE_MODES, dotenv),  # type: ignore[arg-type]
        llm_cache_dir=Path(
            _env("ENGINE_LLM_CACHE_DIR", str(REPO_ROOT / ".engine_llm_cache"), dotenv)
        ),
        artifacts_dir=Path(_env("ENGINE_ARTIFACTS_DIR", str(PACKAGE_DIR / "artifacts"), dotenv)),
        params_version=_env("ENGINE_PARAMS_VERSION", "engine_v1", dotenv),
        weights_version=_env("ENGINE_WEIGHTS_VERSION", "pesos_embasamento_v1", dotenv),
        risk_model_version=_env("ENGINE_RISK_MODEL_VERSION", "risco_v1", dotenv),
    )
