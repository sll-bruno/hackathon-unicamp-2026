"""Load engine-generated demo snapshots and bind citations to persisted documents."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from contracts.pipeline import PipelineOutput

from app.models import Document

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"
OUTPUT_BY_CNJ = {
    "0801234-56.2024.8.10.0001": FIXTURES_DIR / "demo_case_01_engine.json",
    "0654321-09.2024.8.04.0001": FIXTURES_DIR / "demo_case_02_engine.json",
}
LIVE_REPLAY_CNJ = "0654321-09.2024.8.04.0001"


def _bind_document_ids(value: Any, document_ids: dict[str, str]) -> None:
    if isinstance(value, dict):
        document_id = value.get("document_id")
        if isinstance(document_id, str) and document_id in document_ids:
            value["document_id"] = document_ids[document_id]
        for nested in value.values():
            _bind_document_ids(nested, document_ids)
    elif isinstance(value, list):
        for nested in value:
            _bind_document_ids(nested, document_ids)


def load_precomputed_output(cnj: str, documents: list[Document]) -> PipelineOutput | None:
    """Return a validated real-engine snapshot with database document IDs."""

    path = OUTPUT_BY_CNJ.get(cnj)
    if path is None:
        return None
    payload = deepcopy(json.loads(path.read_text(encoding="utf-8")))
    document_ids = {Path(document.original_name).stem: document.id for document in documents}
    _bind_document_ids(payload, document_ids)
    output = PipelineOutput.model_validate(payload)
    missing = {
        source.document_id
        for evidence in output.evidences
        for source in evidence.sources
        if source.document_id not in set(document_ids.values())
    }
    if missing:
        raise ValueError(f"Demo snapshot cites unknown documents: {sorted(missing)}")
    return output
