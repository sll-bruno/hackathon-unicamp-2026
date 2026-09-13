"""Compara duas versões do modelo de risco antes de promover uma candidata.

Uso (na raiz do repositório):
    .venv/bin/python src/pipeline/training/compare_versions.py \\
        --production risco_v1 --candidate risco_v2

Lê `<versão>_meta.json` de cada versão e compara as métricas de teste já calculadas por
`train_risk.py` (log loss, Brier, ECE e acurácia vitória/derrota). Sinaliza REGRESSÃO
quando a candidata piora além da tolerância.

Limitação conhecida: cada versão calcula suas métricas no próprio holdout de teste
(`train_test_split` com `SEED=42` sobre a base histórica + feedback daquela versão).
Como a candidata inclui casos de feedback que a produção não tinha, os holdouts não são
idênticos ponto a ponto — a comparação é uma aproximação, não um teste estatístico
rigoroso. Suficiente para decidir "promover ou não" com revisão humana; não substitui
uma avaliação formal em um conjunto de teste fixo caso isso vire produção real.
"""

import argparse
import json
from pathlib import Path

from decision_engine.settings import PACKAGE_DIR

METRICS_LOWER_IS_BETTER = (
    "log_loss_xgb_calibrado",
    "brier_xgb_calibrado",
    "ece_xgb_calibrado",
)
METRICS_HIGHER_IS_BETTER = ("acuracia_vitoria_derrota",)


def load_meta(artifacts_dir: Path, version: str) -> dict:
    path = artifacts_dir / f"{version}_meta.json"
    if not path.is_file():
        raise SystemExit(f"artefato não encontrado: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def compare(production: dict, candidate: dict, tolerance: float) -> tuple[dict, bool]:
    prod_metrics = production["metricas_teste"]
    cand_metrics = candidate["metricas_teste"]
    rows = {}
    regressed = False

    for name in METRICS_LOWER_IS_BETTER:
        prod_value, cand_value = prod_metrics[name], cand_metrics[name]
        worse = cand_value > prod_value * (1 + tolerance)
        rows[name] = {"producao": prod_value, "candidata": cand_value, "regrediu": worse}
        regressed = regressed or worse

    for name in METRICS_HIGHER_IS_BETTER:
        prod_value, cand_value = prod_metrics[name], cand_metrics[name]
        worse = cand_value < prod_value * (1 - tolerance)
        rows[name] = {"producao": prod_value, "candidata": cand_value, "regrediu": worse}
        regressed = regressed or worse

    return rows, regressed


def validate_lineage(production: dict, candidate: dict) -> None:
    production_version = production.get("versao")
    candidate_base = candidate.get("base_version")
    if candidate_base != production_version:
        raise SystemExit(
            f"linhagem inválida: candidata declara base_version={candidate_base!r}, "
            f"mas a produção comparada é {production_version!r}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifacts-dir", type=Path, default=PACKAGE_DIR / "artifacts")
    parser.add_argument("--production", default="risco_v1", help="Versão hoje em produção")
    parser.add_argument("--candidate", required=True, help="Versão candidata a promover")
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.02,
        help="Piora tolerada em cada métrica antes de sinalizar REGRESSÃO (padrão 2%%)",
    )
    args = parser.parse_args()

    production = load_meta(args.artifacts_dir, args.production)
    candidate = load_meta(args.artifacts_dir, args.candidate)
    validate_lineage(production, candidate)
    rows, regressed = compare(production, candidate, args.tolerance)

    print(f"produção={args.production} (n_treino={production['metricas_teste']['n_treino']})")
    print(
        f"candidata={args.candidate} (n_treino={candidate['metricas_teste']['n_treino']}, "
        f"feedback_n={candidate.get('feedback_n', 'n/d')})"
    )
    print()
    for name, values in rows.items():
        flag = " <- REGRESSÃO" if values["regrediu"] else ""
        print(
            f"{name:30s} produção={values['producao']:.4f}  "
            f"candidata={values['candidata']:.4f}{flag}"
        )

    print()
    if regressed:
        print(
            f"REGRESSÃO: a candidata {args.candidate} piorou além da tolerância de "
            f"{args.tolerance:.0%} em ao menos uma métrica. Promoção não recomendada."
        )
        raise SystemExit(1)
    print(f"OK: {args.candidate} não regrediu em relação a {args.production}. Promoção é manual —")
    print(f"defina ENGINE_RISK_MODEL_VERSION={args.candidate} para promover.")


if __name__ == "__main__":
    main()
