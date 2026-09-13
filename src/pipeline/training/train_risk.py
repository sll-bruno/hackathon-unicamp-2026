"""Treina o modelo de risco judicial e gera os artefatos da engine.

Uso (na raiz do repositório):
    .venv/bin/python src/pipeline/training/train_risk.py

Gera em `decision_engine/artifacts/`:
- `<versão>.ubj`: XGBoost multiclasse (extinção, improcedência, parcial, procedência);
- `<versão>_meta.json`: UFs, temperatura de calibração, métricas, severidade,
  k do acordo, perfil regional e tamanho das coortes.
"""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from decision_engine.risk.features import (
    CLASSES,
    FLAG_NAMES,
    MICRO_TO_CLASS,
    CaseFeatures,
    encode,
    feature_names,
)
from decision_engine.settings import PACKAGE_DIR
from scipy.optimize import minimize_scalar
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_XLSX = ROOT / "data" / "Hackaton_Enter_Base_Candidatos.xlsx"
DEFAULT_RESULTS_CSV = ROOT / "data" / "Resultados_Dos_Processos.csv"
DEFAULT_DATA = DEFAULT_RESULTS_CSV if DEFAULT_RESULTS_CSV.is_file() else DEFAULT_XLSX
SEED = 42


def _default_subsidies_csv(results_path: Path) -> Path:
    matches = sorted(results_path.parent.glob("Subsi*dio_Disponibilizado.csv"))
    if len(matches) != 1:
        raise ValueError(
            "não foi possível identificar o CSV de subsídios ao lado da base de resultados; "
            "informe --subsidies-data"
        )
    return matches[0]


def load_dataset(path: Path, subsidies_path: Path | None = None) -> pd.DataFrame:
    if path.suffix.lower() in {".xlsx", ".xls"}:
        results = pd.read_excel(path, sheet_name="Resultados dos processos")
        subsidies = pd.read_excel(path, sheet_name="Subsídios disponibilizados", skiprows=1)
    elif path.suffix.lower() == ".csv":
        results = pd.read_csv(path, decimal=",", thousands=".")
        subsidies = pd.read_csv(subsidies_path or _default_subsidies_csv(path), skiprows=1)
    else:
        raise ValueError("data deve ser uma planilha .xlsx/.xls ou o CSV de resultados")
    results.columns = ["processo", "uf", "assunto", "sub", "macro", "micro", "vc", "vd"]
    subsidies.columns = ["processo", *FLAG_NAMES]
    return results.merge(subsidies, on="processo", validate="1:1")


def load_feedback(path: Path) -> pd.DataFrame:
    """Casos reais encerrados, no formato gerado por `training/export_feedback.py`.

    Mesmas colunas de `load_dataset()` (processo, uf, assunto, sub, macro, micro, vc, vd
    + flags), para poder ser concatenado direto com a base histórica antes do split.
    """

    frame = pd.read_csv(path)
    columns = ["processo", "uf", "assunto", "sub", "macro", "micro", "vc", "vd", *FLAG_NAMES]
    missing = set(columns) - set(frame.columns)
    if missing:
        raise ValueError(f"feedback_data sem colunas obrigatórias: {sorted(missing)}")
    invalid_labels = sorted(set(frame["micro"].dropna()) - set(MICRO_TO_CLASS))
    if invalid_labels:
        raise ValueError(f"feedback_data com desfechos judiciais inválidos: {invalid_labels}")
    if frame["processo"].duplicated().any():
        raise ValueError("feedback_data contém processos duplicados")
    return frame[columns]


def to_cases(frame: pd.DataFrame) -> list[CaseFeatures]:
    return [
        CaseFeatures(
            uf=row.uf,
            sub_golpe=row.sub == "Golpe",
            flags=tuple(bool(getattr(row, name)) for name in FLAG_NAMES),
            valor_causa=float(row.vc),
        )
        for row in frame.itertuples(index=False)
    ]


def apply_temperature(probabilities: np.ndarray, temperature: float) -> np.ndarray:
    logits = np.log(np.clip(probabilities, 1e-12, 1.0)) / temperature
    logits -= logits.max(axis=1, keepdims=True)
    exp = np.exp(logits)
    return exp / exp.sum(axis=1, keepdims=True)


def brier(probabilities: np.ndarray, labels: np.ndarray) -> float:
    one_hot = np.eye(len(CLASSES))[labels]
    return float(np.mean(np.sum((probabilities - one_hot) ** 2, axis=1)))


def expected_calibration_error(probabilities: np.ndarray, labels: np.ndarray) -> float:
    confidence = probabilities.max(axis=1)
    correct = probabilities.argmax(axis=1) == labels
    bins = np.linspace(0, 1, 11)
    error = 0.0
    for low, high in zip(bins[:-1], bins[1:], strict=True):
        mask = (confidence > low) & (confidence <= high)
        if mask.any():
            error += mask.mean() * abs(correct[mask].mean() - confidence[mask].mean())
    return float(error)


def train(
    data_path: Path,
    output_dir: Path,
    *,
    subsidies_path: Path | None = None,
    version: str = "risco_v1",
    base_version: str | None = None,
    feedback_path: Path | None = None,
    min_feedback_n: int = 0,
) -> dict:
    if feedback_path is not None:
        if min_feedback_n <= 0:
            raise ValueError("min_feedback_n deve ser positivo quando feedback_data é informado")
        if not base_version:
            raise ValueError("base_version é obrigatória para retreino com feedback")
        if version == base_version:
            raise ValueError("a versão candidata deve ser diferente da versão em produção")

    frame = load_dataset(data_path, subsidies_path)
    feedback_n = 0
    if feedback_path is not None:
        feedback = load_feedback(feedback_path)
        feedback_n = len(feedback)
        if feedback_n < min_feedback_n:
            raise SystemExit(
                f"feedback_data tem {feedback_n} casos maduros; mínimo exigido é "
                f"{min_feedback_n}. Retreino abortado — acumule mais casos encerrados "
                "antes de gerar uma nova versão."
            )
        frame = pd.concat([frame, feedback], ignore_index=True)

    judicial = frame[frame.micro.isin(MICRO_TO_CLASS)].reset_index(drop=True)
    agreements = frame[frame.micro == "Acordo"].reset_index(drop=True)
    ufs = sorted(judicial.uf.unique())

    labels = judicial.micro.map(MICRO_TO_CLASS).map(CLASSES.index).to_numpy()
    features = encode(to_cases(judicial), ufs)
    strata = judicial.micro + "|" + judicial.uf

    x_train, x_rest, y_train, y_rest, _, strata_rest = train_test_split(
        features, labels, strata, test_size=0.30, random_state=SEED, stratify=strata
    )
    x_calib, x_test, y_calib, y_test = train_test_split(
        x_rest, y_rest, test_size=0.50, random_state=SEED, stratify=strata_rest
    )
    x_fit, x_val, y_fit, y_val = train_test_split(
        x_train, y_train, test_size=0.15, random_state=SEED, stratify=y_train
    )

    best = None
    for max_depth in (3, 4, 6):
        model = xgb.XGBClassifier(
            objective="multi:softprob",
            eval_metric="mlogloss",
            tree_method="hist",
            n_estimators=1000,
            learning_rate=0.05,
            max_depth=max_depth,
            min_child_weight=5,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
            early_stopping_rounds=50,
            random_state=SEED,
        )
        model.fit(x_fit, y_fit, eval_set=[(x_val, y_val)], verbose=False)
        score = log_loss(y_val, model.predict_proba(x_val), labels=range(len(CLASSES)))
        if best is None or score < best[0]:
            best = (score, max_depth, model)
    _, best_depth, model = best

    raw_calib = model.predict_proba(x_calib)
    temperature = float(
        minimize_scalar(
            lambda t: log_loss(y_calib, apply_temperature(raw_calib, t), labels=range(4)),
            bounds=(0.5, 3.0),
            method="bounded",
        ).x
    )

    raw_test = model.predict_proba(x_test)
    calibrated_test = apply_temperature(raw_test, temperature)
    prior = np.bincount(y_train, minlength=len(CLASSES)) / len(y_train)
    logistic = make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000))
    logistic.fit(x_train, y_train)
    metrics = {
        "log_loss_prior": log_loss(y_test, np.tile(prior, (len(y_test), 1)), labels=range(4)),
        "log_loss_regressao_logistica": log_loss(
            y_test, logistic.predict_proba(x_test), labels=range(4)
        ),
        "log_loss_xgb": log_loss(y_test, raw_test, labels=range(4)),
        "log_loss_xgb_calibrado": log_loss(y_test, calibrated_test, labels=range(4)),
        "brier_xgb_calibrado": brier(calibrated_test, y_test),
        "ece_xgb_calibrado": expected_calibration_error(calibrated_test, y_test),
        "acuracia_vitoria_derrota": float(
            np.mean((calibrated_test[:, 2:].sum(axis=1) > 0.5) == (y_test >= 2))
        ),
        "n_treino": len(y_train),
        "n_calibracao": len(y_calib),
        "n_teste": len(y_test),
    }
    metrics = {key: round(float(value), 4) for key, value in metrics.items()}

    ratio = judicial.vd / judicial.vc
    severity = {
        "parcial": round(float(ratio[judicial.micro == "Parcial procedência"].mean()), 4),
        "procedencia": round(float(ratio[judicial.micro == "Procedência"].mean()), 4),
        "procedencia_p90": round(float(ratio[judicial.micro == "Procedência"].quantile(0.9)), 4),
    }

    agreement_probs = apply_temperature(
        model.predict_proba(encode(to_cases(agreements), ufs)), temperature
    )
    p_loss = agreement_probs[:, 2] + agreement_probs[:, 3]
    loss_if_condemned = (
        agreements.vc.to_numpy()
        * (
            agreement_probs[:, 2] * severity["parcial"]
            + agreement_probs[:, 3] * severity["procedencia"]
        )
        / p_loss
    )
    k_values = agreements.vd.to_numpy() / loss_if_condemned
    settlement_k = {
        f"p{int(q * 100)}": round(float(np.quantile(k_values, q)), 4)
        for q in (0.10, 0.25, 0.50, 0.75, 0.90)
    }
    settlement_k["n"] = int(len(k_values))

    lost = judicial.micro.isin(["Parcial procedência", "Procedência"])
    national_loss = float(lost.mean())
    by_uf = judicial.assign(lost=lost).groupby("uf")
    loss_by_uf = by_uf.lost.mean().sort_values(ascending=False)
    regional = {
        "taxa_derrota_nacional": round(national_loss, 4),
        "ufs": {
            uf: {
                "n": int(by_uf.size()[uf]),
                "taxa_derrota": round(float(loss_by_uf[uf]), 4),
                "taxa_derrota_golpe": round(
                    float(
                        judicial[(judicial.uf == uf) & (judicial["sub"] == "Golpe")]
                        .micro.isin(["Parcial procedência", "Procedência"])
                        .mean()
                    ),
                    4,
                ),
                "taxa_derrota_generico": round(
                    float(
                        judicial[(judicial.uf == uf) & (judicial["sub"] == "Genérico")]
                        .micro.isin(["Parcial procedência", "Procedência"])
                        .mean()
                    ),
                    4,
                ),
                "ranking_derrota": int(position + 1),
                "diferenca_nacional_pp": round((float(loss_by_uf[uf]) - national_loss) * 100, 1),
            }
            for position, uf in enumerate(loss_by_uf.index)
        },
    }

    cohorts: dict[str, int] = {}
    for case in to_cases(judicial):
        cohorts[case.cohort_key] = cohorts.get(case.cohort_key, 0) + 1

    output_dir.mkdir(parents=True, exist_ok=True)
    model.get_booster().save_model(output_dir / f"{version}.ubj")
    meta = {
        "versao": version,
        "base_version": base_version,
        "feedback_n": feedback_n,
        "treinado_em": datetime.now(UTC).isoformat(timespec="seconds"),
        "classes": list(CLASSES),
        "ufs": ufs,
        "features": feature_names(ufs),
        "max_depth": best_depth,
        "n_arvores": int(model.best_iteration + 1),
        "temperatura": round(temperature, 4),
        "metricas_teste": metrics,
        "severidade": severity,
        "acordo_k": settlement_k,
        "perfil_regional": regional,
        "coortes": cohorts,
    }
    (output_dir / f"{version}_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument(
        "--subsidies-data",
        type=Path,
        default=None,
        help="CSV de subsídios quando --data apontar para o CSV de resultados",
    )
    parser.add_argument("--output", type=Path, default=PACKAGE_DIR / "artifacts")
    parser.add_argument("--version", default="risco_v1", help="Nome dos artefatos gerados")
    parser.add_argument(
        "--base-version",
        default=None,
        help="Versão em produção a partir da qual esta candidata foi gerada (só auditoria)",
    )
    parser.add_argument(
        "--feedback-data",
        type=Path,
        default=None,
        help="CSV de casos reais encerrados (training/export_feedback.py), concatenado à base",
    )
    parser.add_argument(
        "--min-feedback-n",
        type=int,
        default=0,
        help="Aborta o retreino se o feedback tiver menos casos maduros que este mínimo",
    )
    args = parser.parse_args()
    meta = train(
        args.data,
        args.output,
        subsidies_path=args.subsidies_data,
        version=args.version,
        base_version=args.base_version,
        feedback_path=args.feedback_data,
        min_feedback_n=args.min_feedback_n,
    )
    summary = {key: meta[key] for key in ("max_depth", "n_arvores", "temperatura")}
    print(json.dumps({**summary, **meta["metricas_teste"]}, ensure_ascii=False, indent=2))
    print("feedback_n", meta["feedback_n"], "base_version", meta["base_version"])
    print("severidade", meta["severidade"])
    print("acordo_k", meta["acordo_k"])


if __name__ == "__main__":
    main()
