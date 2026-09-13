"""Roda a engine completa numa pasta de caso e grava o resultado em JSON.

Uso: .venv/bin/python -m decision_engine data/Caso_02_0654321-09-2024-8-04-0001
     [--saida resultado.json]
"""

import argparse
import json
import os
import time
from pathlib import Path

from decision_engine.ingest.package import case_input_from_folder
from decision_engine.runner import run_pipeline


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pasta", type=Path)
    parser.add_argument("--saida", type=Path)
    args = parser.parse_args()

    os.environ["ENGINE_MODE"] = "full"
    started = time.monotonic()
    output = run_pipeline(
        case_input_from_folder(args.pasta),
        on_progress=lambda stage, progress: print(
            f"[{time.monotonic() - started:6.1f}s] {progress:3d}% {stage}", flush=True
        ),
    )
    payload = output.complete_payload()
    destination = args.saida or Path("resultados") / f"{args.pasta.name}.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    recommendation, finance = payload["recommendation"], payload["financeiro"]
    print(f"\nAção: {recommendation['action']} · confiança {recommendation['confidence_percent']}%")
    print(f"Resumo: {recommendation['summary']}")
    print(f"P(derrota) {finance['p_derrota']}")
    print(f"Custo esperado da defesa {finance['custo_defesa_esperado']}")
    print(f"Faixa de acordo {finance['faixa']} · reason codes {recommendation['reason_codes']}")
    print(f"Resultado completo em {destination}")


if __name__ == "__main__":
    main()
