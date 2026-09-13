"""Cliente OpenAI (Responses API com saída estruturada) e cache em disco.

Modos de cache (`ENGINE_LLM_CACHE`):
- `live`: sempre chama a API;
- `record` (padrão): reutiliza respostas já gravadas e grava as novas;
- `replay`: só usa o cache (testes offline).
"""

import hashlib
import json
from typing import TypeVar

from pydantic import BaseModel

from decision_engine.config_loader import Prompt
from decision_engine.settings import EngineSettings, load_settings

T = TypeVar("T", bound=BaseModel)


class LLMClient:
    def __init__(self, settings: EngineSettings | None = None) -> None:
        self.settings = settings or load_settings()
        self._client = None

    @property
    def model(self) -> str:
        return self.settings.openai_model

    def _openai(self):
        if self._client is None:
            from openai import OpenAI

            if not self.settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY não configurada")
            self._client = OpenAI(api_key=self.settings.openai_api_key)
        return self._client

    def parse(self, prompt: Prompt, user: str, schema: type[T]) -> T:
        key = hashlib.sha256(
            json.dumps(
                [self.model, prompt.version_tag, schema.__name__, prompt.system, user],
                ensure_ascii=False,
            ).encode()
        ).hexdigest()[:24]
        path = self.settings.llm_cache_dir / prompt.id / f"{key}.json"
        mode = self.settings.llm_cache

        if mode != "live" and path.is_file():
            return schema.model_validate_json(path.read_text(encoding="utf-8"))
        if mode == "replay":
            raise FileNotFoundError(f"Resposta de LLM ausente no cache: {path}")

        response = self._openai().responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": prompt.system},
                {"role": "user", "content": user},
            ],
            text_format=schema,
        )
        parsed = response.output_parsed
        if parsed is None:
            raise RuntimeError(f"{prompt.id}: resposta sem conteúdo estruturado")
        if mode == "record":
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(parsed.model_dump_json(indent=1), encoding="utf-8")
        return parsed
