"""Carrega parâmetros, pesos e prompts versionados de `decision_engine/config/`."""

import hashlib
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import yaml

from decision_engine.settings import PACKAGE_DIR

CONFIG_DIR = PACKAGE_DIR / "config"
PROMPTS_DIR = CONFIG_DIR / "prompts"
PROMPT_IDS = (
    "p1_classificacao_pagina",
    "p2_triagem_peticao",
    "p3_acusacoes",
    "p4_embasamentos",
    "p5_fichamento",
    "p6_validador",
    "p7_decisora",
)

_PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")
_SECTION = re.compile(r"^## (system|user)\s*$", re.MULTILINE)


def _read_yaml(name: str) -> dict[str, Any]:
    path = CONFIG_DIR / f"{name}.yaml"
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict) or data.get("version") != name:
        raise ValueError(f"{path.name} precisa declarar version: {name}")
    return data


@lru_cache
def load_params(version: str = "engine_v1") -> dict[str, Any]:
    return _read_yaml(version)


@lru_cache
def load_weights(version: str = "pesos_embasamento_v1") -> dict[str, Any]:
    return _read_yaml(version)


def category_weight(weights: dict[str, Any], accusation_type: str, category: str) -> int | None:
    """Peso configurado da categoria; `None` quando a categoria não é permitida para o tipo."""

    categories = weights["tipos_acusacao"].get(accusation_type, {}).get("categorias", {})
    entry = categories.get(category)
    return None if entry is None else int(entry["peso"])


@dataclass(frozen=True)
class Prompt:
    id: str
    versao: str
    schema: str
    system: str
    user: str

    @property
    def hash(self) -> str:
        digest = hashlib.sha256(f"{self.system}\n{self.user}".encode()).hexdigest()
        return digest[:12]

    @property
    def version_tag(self) -> str:
        return f"{self.versao}-{self.hash}"

    @property
    def placeholders(self) -> set[str]:
        return set(_PLACEHOLDER.findall(self.user)) | set(_PLACEHOLDER.findall(self.system))

    def render_user(self, **values: str) -> str:
        expected = set(_PLACEHOLDER.findall(self.user))
        missing = expected - values.keys()
        unknown = values.keys() - expected
        if missing or unknown:
            raise KeyError(
                f"{self.id}: placeholders ausentes={sorted(missing)} "
                f"desconhecidos={sorted(unknown)}"
            )
        return _PLACEHOLDER.sub(lambda match: values[match.group(1)], self.user)


def _parse_prompt(prompt_id: str, text: str) -> Prompt:
    if not text.startswith("---\n"):
        raise ValueError(f"{prompt_id}: cabeçalho YAML ausente")
    _, header, body = text.split("---\n", 2)
    meta = yaml.safe_load(header)
    if meta.get("id") != prompt_id:
        raise ValueError(f"{prompt_id}: id do cabeçalho difere do nome do arquivo")
    parts = _SECTION.split(body)
    sections = dict(zip(parts[1::2], (part.strip() for part in parts[2::2]), strict=True))
    if set(sections) != {"system", "user"}:
        raise ValueError(f"{prompt_id}: seções '## system' e '## user' são obrigatórias")
    return Prompt(
        id=prompt_id,
        versao=str(meta["versao"]),
        schema=str(meta["schema"]),
        system=sections["system"],
        user=sections["user"],
    )


@lru_cache
def load_prompt(prompt_id: str) -> Prompt:
    path = PROMPTS_DIR / f"{prompt_id}.md"
    return _parse_prompt(prompt_id, path.read_text(encoding="utf-8"))


def prompt_versions() -> dict[str, str]:
    """Versões para `PipelineOutput.versions`, uma chave por prompt."""

    return {f"prompt_{prompt_id}": load_prompt(prompt_id).version_tag for prompt_id in PROMPT_IDS}
