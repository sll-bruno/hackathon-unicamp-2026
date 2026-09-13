"""Generate the deterministic demo snapshots by running the real decision engine.

The snapshots are production artifacts, not hand-authored legal fixtures. They are
regenerated from the two PDF packages using the recorded responses of the same LLM
pipeline used by the application.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from decision_engine.ingest.package import case_input_from_folder
from decision_engine.runner import run_pipeline

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "src" / "api" / "app" / "fixtures"
CASES = {
    "Caso_01_0801234-56-2024-8-10-0001": "demo_case_01_engine.json",
    "Caso_02_0654321-09-2024-8-04-0001": "demo_case_02_engine.json",
}


def main() -> None:
    os.environ.setdefault("ENGINE_MODE", "full")
    os.environ.setdefault("ENGINE_LLM_CACHE", "replay")
    os.environ.setdefault(
        "ENGINE_LLM_CACHE_DIR", str(ROOT / "tests" / "engine" / "fixtures" / "llm_cache")
    )
    os.environ.setdefault("OPENAI_MODEL", "gpt-5")

    for folder_name, output_name in CASES.items():
        case_input = case_input_from_folder(ROOT / "data" / folder_name)
        payload = run_pipeline(case_input).complete_payload()
        payload["demo_provenance"] = {
            "generated_by": "decision_engine.run_pipeline",
            "input_folder": folder_name,
            "llm_responses": "recorded-engine-run",
        }
        destination = OUTPUT_DIR / output_name
        destination.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(
            f"{destination.relative_to(ROOT)}: {payload['recommendation']['action']}, "
            f"{len(payload['facts'])} fatos, "
            f"{len(payload['contradictions'])} contradições, "
            f"{len(payload['gaps'])} lacunas"
        )


if __name__ == "__main__":
    main()
