"""Subfluxo 2: triagem, acusações, embasamentos e validação com LLM."""

import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any

from decision_engine.chunking.chunker import Chunk, render_chunks
from decision_engine.config_loader import load_prompt, load_weights
from decision_engine.ingest.package import CasePackage
from decision_engine.llm.client import LLMClient
from decision_engine.llm.schemas import (
    Acusacao,
    Embasamento,
    ExtracaoAcusacoes,
    TriagemPeticao,
    ValidacaoSemantica,
    embasamentos_schema,
)

Grounds = dict[str, dict[str, list[Embasamento]]]  # acusação -> categoria -> itens


@dataclass(frozen=True)
class ContentExtraction:
    triagem: TriagemPeticao
    extracao: ExtracaoAcusacoes
    embasamentos: Grounds
    revisoes: dict[str, dict[str, Any]]
    taxa_reprovacao: float
    chunks: dict[str, Chunk]

    @property
    def acusacoes(self) -> list[Acusacao]:
        return [item for item in self.extracao.acusacoes if item.id in self.embasamentos]


def _dump(value: Any) -> str:
    if hasattr(value, "model_dump"):
        value = value.model_dump()
    return json.dumps(value, ensure_ascii=False, indent=1)


def categories_text(accusation_type: str) -> str:
    categories = load_weights()["tipos_acusacao"][accusation_type]["categorias"]
    return "\n".join(
        f"- {name} (favorece o {'BANCO' if spec['peso'] > 0 else 'AUTOR'}): {spec['definicao']}"
        for name, spec in categories.items()
    )


def _documents(package: CasePackage) -> tuple[str, str]:
    codes: dict[str, str] = {}
    for chunk in package.chunks:
        codes.setdefault(chunk.document_id, chunk.id.split(":")[0])
    present = [
        {
            "documento": codes.get(document.id),
            "tipo": document.type,
            "arquivo": next(
                (page.file_name for page in package.pages if page.document_id == document.id), ""
            ),
            "paginas": sum(page.document_id == document.id for page in package.pages),
        }
        for document in package.case.documents
    ]
    missing = [name for name, available in package.flags.items() if not available]
    return _dump(present), _dump(missing)


def _extract_grounds(
    client: LLMClient,
    package: CasePackage,
    extraction: ExtracaoAcusacoes,
    accusation: Acusacao,
) -> tuple[str, dict[str, list[Embasamento]]]:
    categories = tuple(load_weights()["tipos_acusacao"][accusation.tipo]["categorias"])
    principal = next(
        (item for item in extraction.acusacoes if item.tipo == "inexistencia_contratacao"), None
    )
    present, missing = _documents(package)
    prompt = load_prompt("p4_embasamentos")
    user = prompt.render_user(
        acusacao=_dump(accusation),
        acusacao_principal=_dump(principal)
        if principal and principal.id != accusation.id
        else "null",
        documentos_presentes=present,
        tipos_ausentes=missing,
        anexos_citados=_dump([item.model_dump() for item in extraction.anexos_citados]),
        categorias=categories_text(accusation.tipo),
        chunks=render_chunks(package.chunks),
    )
    result = client.parse(prompt, user, embasamentos_schema(accusation.tipo, categories))
    return accusation.id, result.embasamentos.model_dump()  # type: ignore[attr-defined]


def _validate(
    client: LLMClient, extraction: ExtracaoAcusacoes, grounds: Grounds, chunks: dict[str, Chunk]
) -> tuple[Grounds, dict[str, dict[str, Any]], float]:
    by_id = {accusation.id: accusation for accusation in extraction.acusacoes}
    items, cited = [], {}
    for accusation_id, categories in grounds.items():
        for category, entries in categories.items():
            for entry in entries:
                items.append(
                    {
                        "id": entry["id"],
                        "acusacao_id": accusation_id,
                        "tipo_acusacao": by_id[accusation_id].tipo,
                        "categoria": category,
                        "titulo": entry["titulo"],
                        "descricao": entry["descricao"],
                        "referencias": entry["referencias"],
                    }
                )
                for reference in entry["referencias"]:
                    if reference.get("chunk_id") in chunks:
                        cited[reference["chunk_id"]] = chunks[reference["chunk_id"]]
    if not items:
        return grounds, {}, 0.0

    types = sorted(
        {accusation.tipo for accusation in extraction.acusacoes if accusation.id in grounds}
    )
    prompt = load_prompt("p6_validador")
    user = prompt.render_user(
        acusacoes=_dump([accusation.model_dump() for accusation in extraction.acusacoes]),
        categorias_por_tipo="\n\n".join(f"{kind}:\n{categories_text(kind)}" for kind in types),
        itens=f"{_dump(items)}\n\nChunks citados:\n{render_chunks(list(cited.values()))}",
    )
    review = client.parse(prompt, user, ValidacaoSemantica)
    decisions = {entry.id: entry.model_dump() for entry in review.itens}

    weights = load_weights()["tipos_acusacao"]
    validated: Grounds = {}
    rejected = 0
    for accusation_id, categories in grounds.items():
        allowed = weights[by_id[accusation_id].tipo]["categorias"]
        target: dict[str, list] = {category: [] for category in allowed}
        for category, entries in categories.items():
            for entry in entries:
                decision = decisions.get(entry["id"], {"status": "aprovado"})
                if decision["status"] == "reprovado":
                    rejected += 1
                    continue
                suggested = decision.get("categoria_sugerida")
                destination = (
                    suggested
                    if decision["status"] == "reclassificar" and suggested in allowed
                    else category
                )
                target[destination].append(entry)
        validated[accusation_id] = target
    return validated, decisions, round(rejected / len(items), 4)


def extract_content(package: CasePackage, client: LLMClient | None = None) -> ContentExtraction:
    client = client or LLMClient()
    petition = render_chunks([chunk for chunk in package.chunks if chunk.document_type == "AUTOS"])
    triage_prompt, accusations_prompt = (
        load_prompt("p2_triagem_peticao"),
        load_prompt("p3_acusacoes"),
    )
    with ThreadPoolExecutor(max_workers=2) as pool:
        triage_future = pool.submit(
            client.parse, triage_prompt, triage_prompt.render_user(chunks=petition), TriagemPeticao
        )
        extraction_future = pool.submit(
            client.parse,
            accusations_prompt,
            accusations_prompt.render_user(chunks=petition),
            ExtracaoAcusacoes,
        )
        triage, extraction = triage_future.result(), extraction_future.result()

    known_types = load_weights()["tipos_acusacao"]
    accusations = [item for item in extraction.acusacoes if item.tipo in known_types]
    with ThreadPoolExecutor(max_workers=4) as pool:
        grounds = dict(
            pool.map(lambda item: _extract_grounds(client, package, extraction, item), accusations)
        )

    chunks = {chunk.id: chunk for chunk in package.chunks}
    grounds, reviews, rejection_rate = _validate(client, extraction, grounds, chunks)
    return ContentExtraction(
        triagem=triage,
        extracao=extraction,
        embasamentos=grounds,
        revisoes=reviews,
        taxa_reprovacao=rejection_rate,
        chunks=chunks,
    )
