"""Exporta casos reais encerrados como dataset de feedback para o retreino do risco.

Uso (na raiz do repositório):
    .venv/bin/python src/pipeline/training/export_feedback.py

Lê o SQLite da API (mesmo `DATABASE_URL` de `app.core.config`) e produz um CSV com as
mesmas colunas de `train_risk.load_dataset()` (processo, uf, assunto, sub, macro, micro,
vc, vd + flags), para ser concatenado à base histórica via `train_risk.py --feedback-data`.

Critério de seleção (docs/RELATORIO_FLUXO_MOTOR_DECISAO.md §10, regras do loop):
- caso `ENCERRADO` com `case_outcomes` registrado;
- desfecho observado em produção (`source_kind=OBSERVED`), nunca fixture de demo;
- desfecho diferente de ACORDO — acordo não é resultado judicial e não entra no treino
  do modelo de risco (mesma exclusão que a base histórica já aplica);
- condenações parciais/procedentes somente quando `court_award` estiver preenchido;
- "maturado": o desfecho foi registrado há pelo menos `--matured-days` dias, para reduzir
  o risco de usar resultados ainda sujeitos a recurso.
"""

import argparse
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd
from app.core.config import get_settings
from app.core.database import get_engine
from app.models import Case, CaseOutcome, CaseStatus, OutcomeType
from decision_engine.risk.features import FLAG_NAMES, OUTCOME_TO_CLASS
from sqlalchemy import or_
from sqlmodel import Session, select

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUTPUT_DIR = ROOT / "data" / "feedback"


def fetch_matured_outcomes(session: Session, matured_days: int) -> list[tuple[Case, CaseOutcome]]:
    cutoff = datetime.now(UTC) - timedelta(days=matured_days)
    statement = (
        select(Case, CaseOutcome)
        .join(CaseOutcome, CaseOutcome.case_id == Case.id)
        .where(Case.status == CaseStatus.ENCERRADO)
        .where(CaseOutcome.source_kind == "OBSERVED")
        .where(CaseOutcome.outcome != OutcomeType.ACORDO)
        .where(
            or_(
                CaseOutcome.outcome.in_((OutcomeType.EXTINCAO, OutcomeType.IMPROCEDENCIA)),
                CaseOutcome.court_award.is_not(None),
            )
        )
        .where(CaseOutcome.created_at <= cutoff)
    )
    return list(session.exec(statement))


def to_frame(rows: list[tuple[Case, CaseOutcome]]) -> pd.DataFrame:
    records = []
    for case, outcome in rows:
        records.append(
            {
                "processo": case.id,
                "uf": case.uf,
                "assunto": case.assunto,
                "sub": "Golpe" if case.subassunto.strip().upper() == "GOLPE" else "Genérico",
                "macro": None,
                "micro": _micro_label(outcome.outcome),
                "vc": case.valor_causa,
                "vd": outcome.court_award if outcome.court_award is not None else 0.0,
                "contrato": case.contrato,
                "extrato": case.extrato,
                "comprovante_credito": case.comprovante_credito,
                "dossie": case.dossie,
                "demonstrativo_divida": case.demonstrativo_divida,
                "laudo_referenciado": case.laudo_referenciado,
            }
        )
    columns = ["processo", "uf", "assunto", "sub", "macro", "micro", "vc", "vd", *FLAG_NAMES]
    return pd.DataFrame.from_records(records, columns=columns)


_CLASS_TO_MICRO = {
    "extincao": "Extinção",
    "improcedencia": "Improcedência",
    "parcial": "Parcial procedência",
    "procedencia": "Procedência",
}


def _micro_label(outcome: OutcomeType) -> str:
    return _CLASS_TO_MICRO[OUTCOME_TO_CLASS[outcome.value]]


def export(output_dir: Path, matured_days: int) -> Path:
    engine = get_engine()
    with Session(engine) as session:
        rows = fetch_matured_outcomes(session, matured_days)
    frame = to_frame(rows)

    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S")
    output_path = output_dir / f"feedback_{timestamp}.csv"
    frame.to_csv(output_path, index=False)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--matured-days",
        type=int,
        default=30,
        help="Só inclui desfechos registrados há pelo menos este número de dias",
    )
    args = parser.parse_args()

    get_settings()  # valida DATABASE_URL cedo, antes de abrir a sessão
    output_path = export(args.output_dir, args.matured_days)
    frame = pd.read_csv(output_path)
    print(f"{len(frame)} casos maduros exportados para {output_path}")


if __name__ == "__main__":
    main()
