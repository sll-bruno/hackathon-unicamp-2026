"""Previsão do risco judicial com o XGBoost treinado em `training/train_risk.py`."""

import json
from dataclasses import dataclass, field, replace
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import xgboost as xgb

from decision_engine.risk.features import CLASSES, FLAG_NAMES, CaseFeatures, encode
from decision_engine.settings import load_settings


@dataclass(frozen=True)
class RiskPrediction:
    probabilidades: dict[str, float]
    p_derrota: float
    perda_se_condenado: float
    certeza_modelo: float
    coorte_n: int
    efeitos_pp: dict[str, float]
    perfil_uf: dict[str, Any] | None
    alertas: list[str] = field(default_factory=list)


class RiskModel:
    def __init__(self, artifacts_dir: Path) -> None:
        self.meta = json.loads((artifacts_dir / "risco_v1_meta.json").read_text(encoding="utf-8"))
        self.booster = xgb.Booster()
        self.booster.load_model(artifacts_dir / "risco_v1.ubj")
        self.ufs: list[str] = self.meta["ufs"]
        self.temperature: float = self.meta["temperatura"]
        self.severity: dict[str, float] = self.meta["severidade"]

    @property
    def version(self) -> str:
        return self.meta["versao"]

    def _probabilities(self, cases: list[CaseFeatures]) -> np.ndarray:
        raw = self.booster.predict(xgb.DMatrix(encode(cases, self.ufs)))
        logits = np.log(np.clip(raw, 1e-12, 1.0)) / self.temperature
        exp = np.exp(logits - logits.max(axis=1, keepdims=True))
        return exp / exp.sum(axis=1, keepdims=True)

    def _p_loss(self, cases: list[CaseFeatures]) -> np.ndarray:
        probabilities = self._averaged_over_unknown_uf(cases)
        return probabilities[:, 2] + probabilities[:, 3]

    def _averaged_over_unknown_uf(self, cases: list[CaseFeatures]) -> np.ndarray:
        rows = []
        for case in cases:
            if case.uf in self.ufs:
                rows.append(self._probabilities([case])[0])
            else:
                variants = [replace(case, uf=uf) for uf in self.ufs]
                rows.append(self._probabilities(variants).mean(axis=0))
        return np.array(rows)

    def predict(self, case: CaseFeatures) -> RiskPrediction:
        probabilities = self._averaged_over_unknown_uf([case])[0]
        p_partial, p_full = float(probabilities[2]), float(probabilities[3])
        p_loss = p_partial + p_full
        severity = (
            p_partial * self.severity["parcial"] + p_full * self.severity["procedencia"]
        ) / max(p_loss, 1e-9)
        entropy = -float(np.sum(probabilities * np.log(np.clip(probabilities, 1e-12, 1.0))))

        alerts = []
        if case.uf not in self.ufs:
            alerts.append("FORA_DA_DISTRIBUICAO")
        cohort = int(self.meta["coortes"].get(case.cohort_key, 0))
        if cohort < 30:
            alerts.append("COORTE_PEQUENA")

        return RiskPrediction(
            probabilidades={name: round(float(p), 4) for name, p in zip(CLASSES, probabilities)},
            p_derrota=round(p_loss, 4),
            perda_se_condenado=round(case.valor_causa * severity, 2),
            certeza_modelo=round(1 - entropy / np.log(len(CLASSES)), 4),
            coorte_n=cohort,
            efeitos_pp=self._effects(case, p_loss),
            perfil_uf=self.meta["perfil_regional"]["ufs"].get(case.uf),
            alertas=alerts,
        )

    def _effects(self, case: CaseFeatures, p_loss: float) -> dict[str, float]:
        """Quanto cada característica move P(derrota), em pontos percentuais."""

        effects = {}
        if case.uf in self.ufs:
            all_ufs = self._probabilities([replace(case, uf=uf) for uf in self.ufs])
            effects["uf"] = round((p_loss - float((all_ufs[:, 2] + all_ufs[:, 3]).mean())) * 100, 1)
        alternatives = [("subassunto", replace(case, sub_golpe=not case.sub_golpe))]
        for index, name in enumerate(FLAG_NAMES):
            flags = list(case.flags)
            flags[index] = not flags[index]
            alternatives.append((name, replace(case, flags=tuple(flags))))
        alternative_losses = self._p_loss([alternative for _, alternative in alternatives])
        for (name, _), alternative_loss in zip(alternatives, alternative_losses, strict=True):
            effects[name] = round((p_loss - float(alternative_loss)) * 100, 1)
        return effects


@lru_cache
def load_risk_model(artifacts_dir: Path | None = None) -> RiskModel:
    return RiskModel(artifacts_dir or load_settings().artifacts_dir)
