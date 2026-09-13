import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd
import pytest
from app.models import Case, CaseOutcome, CaseStatus, OutcomeType
from decision_engine.risk.features import FLAG_NAMES
from decision_engine.risk.model import RiskModel
from sqlmodel import Session, SQLModel, create_engine
from training.compare_versions import compare, validate_lineage
from training.export_feedback import fetch_matured_outcomes, to_frame
from training.train_risk import load_dataset, load_feedback, train


def _case(cnj: str) -> Case:
    return Case(
        cnj=cnj,
        uf="SP",
        assunto="Empréstimo não reconhecido",
        subassunto="Golpe",
        valor_causa=10_000,
        status=CaseStatus.ENCERRADO,
    )


def test_feedback_export_keeps_only_mature_complete_observations() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    matured = datetime.now(UTC) - timedelta(days=40)
    recent = datetime.now(UTC) - timedelta(days=2)

    specs = [
        ("0000001-00.2026.8.26.0001", OutcomeType.IMPROCEDENCIA, None, "OBSERVED", matured),
        ("0000002-00.2026.8.26.0001", OutcomeType.PARCIAL, 4_000, "OBSERVED", matured),
        ("0000003-00.2026.8.26.0001", OutcomeType.PROCEDENCIA, None, "OBSERVED", matured),
        ("0000004-00.2026.8.26.0001", OutcomeType.ACORDO, None, "OBSERVED", matured),
        ("0000005-00.2026.8.26.0001", OutcomeType.IMPROCEDENCIA, None, "DEMO_FIXTURE", matured),
        ("0000006-00.2026.8.26.0001", OutcomeType.EXTINCAO, None, "OBSERVED", recent),
    ]
    with Session(engine) as session:
        for cnj, outcome_type, award, source, created_at in specs:
            case = _case(cnj)
            session.add(case)
            session.flush()
            session.add(
                CaseOutcome(
                    case_id=case.id,
                    outcome=outcome_type,
                    court_award=award,
                    source_kind=source,
                    created_at=created_at,
                )
            )
        session.commit()
        rows = fetch_matured_outcomes(session, matured_days=30)

    assert [outcome.outcome for _, outcome in rows] == [
        OutcomeType.IMPROCEDENCIA,
        OutcomeType.PARCIAL,
    ]
    frame = to_frame(rows)
    assert frame["micro"].tolist() == ["Improcedência", "Parcial procedência"]
    assert frame["vd"].tolist() == [0.0, 4_000]


def test_feedback_loader_validates_labels_and_duplicate_processes(tmp_path: Path) -> None:
    columns = ["processo", "uf", "assunto", "sub", "macro", "micro", "vc", "vd", *FLAG_NAMES]
    valid = {name: False for name in FLAG_NAMES}
    valid.update(
        processo="case-1",
        uf="SP",
        assunto="Empréstimo",
        sub="Golpe",
        macro="Não Êxito",
        micro="Procedência",
        vc=10_000,
        vd=8_000,
    )
    path = tmp_path / "feedback.csv"
    pd.DataFrame([valid], columns=columns).to_csv(path, index=False)
    assert load_feedback(path)["processo"].tolist() == ["case-1"]

    invalid = {**valid, "micro": "ACORDO"}
    pd.DataFrame([invalid], columns=columns).to_csv(path, index=False)
    with pytest.raises(ValueError, match="desfechos judiciais inválidos"):
        load_feedback(path)

    pd.DataFrame([valid, valid], columns=columns).to_csv(path, index=False)
    with pytest.raises(ValueError, match="processos duplicados"):
        load_feedback(path)


def test_historical_dataset_can_be_loaded_from_distributed_csvs(tmp_path: Path) -> None:
    results = tmp_path / "Resultados_Dos_Processos.csv"
    subsidies = tmp_path / "Subsidio_Disponibilizado.csv"
    results.write_text(
        "Número do processo,UF,Assunto,Sub-assunto,Resultado macro,Resultado micro,"
        "Valor da causa,Valor da condenação/indenização\n"
        '123,SP,Não reconhece operação,Golpe,Não Êxito,Procedência,"10.500,20","8.100,10"\n',
        encoding="utf-8",
    )
    subsidies.write_text(
        "1 = fornecido,0 = ausente,,,,,\n"
        "Número do processos,Contrato,Extrato,Comprovante,Dossiê,Demonstrativo,Laudo\n"
        "123,1,0,1,0,1,0\n",
        encoding="utf-8",
    )

    frame = load_dataset(results, subsidies)
    assert frame.loc[0, "vc"] == pytest.approx(10_500.20)
    assert frame.loc[0, "vd"] == pytest.approx(8_100.10)
    assert frame.loc[0, list(FLAG_NAMES)].tolist() == [1, 0, 1, 0, 1, 0]


def test_retraining_requires_safe_candidate_parameters(tmp_path: Path) -> None:
    feedback = tmp_path / "feedback.csv"
    feedback.touch()
    with pytest.raises(ValueError, match="min_feedback_n"):
        train(tmp_path / "base.xlsx", tmp_path, feedback_path=feedback)
    with pytest.raises(ValueError, match="base_version"):
        train(
            tmp_path / "base.xlsx",
            tmp_path,
            version="risco_v2",
            feedback_path=feedback,
            min_feedback_n=1,
        )
    with pytest.raises(ValueError, match="deve ser diferente"):
        train(
            tmp_path / "base.xlsx",
            tmp_path,
            version="risco_v1",
            base_version="risco_v1",
            feedback_path=feedback,
            min_feedback_n=1,
        )


def test_candidate_comparison_and_versioned_model_loading(tmp_path: Path) -> None:
    production = {
        "versao": "risco_v1",
        "metricas_teste": {
            "log_loss_xgb_calibrado": 0.50,
            "brier_xgb_calibrado": 0.30,
            "ece_xgb_calibrado": 0.05,
            "acuracia_vitoria_derrota": 0.80,
        }
    }
    candidate = {
        "base_version": "risco_v1",
        "metricas_teste": {
            "log_loss_xgb_calibrado": 0.49,
            "brier_xgb_calibrado": 0.29,
            "ece_xgb_calibrado": 0.05,
            "acuracia_vitoria_derrota": 0.81,
        }
    }
    rows, regressed = compare(production, candidate, tolerance=0.02)
    validate_lineage(production, candidate)
    assert not regressed
    assert not any(row["regrediu"] for row in rows.values())

    with pytest.raises(SystemExit, match="linhagem inválida"):
        validate_lineage(production, {**candidate, "base_version": "risco_v0"})

    artifacts = Path(__file__).resolve().parents[2] / "src/pipeline/decision_engine/artifacts"
    source_meta = json.loads((artifacts / "risco_v1_meta.json").read_text(encoding="utf-8"))
    source_meta["versao"] = "risco_test"
    (tmp_path / "risco_test_meta.json").write_text(
        json.dumps(source_meta), encoding="utf-8"
    )
    (tmp_path / "risco_test.ubj").write_bytes((artifacts / "risco_v1.ubj").read_bytes())
    assert RiskModel(tmp_path, "risco_test").version == "risco_test"
