"""Codificação das features tabulares, compartilhada entre treino e previsão."""

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

CLASSES = ("extincao", "improcedencia", "parcial", "procedencia")
FLAG_NAMES = (
    "contrato",
    "extrato",
    "comprovante_credito",
    "dossie",
    "demonstrativo_divida",
    "laudo_referenciado",
)

# Rótulo bruto (base histórica em xlsx, coluna "micro") -> classe do modelo.
MICRO_TO_CLASS = {
    "Extinção": "extincao",
    "Improcedência": "improcedencia",
    "Parcial procedência": "parcial",
    "Procedência": "procedencia",
}

# `OutcomeType` do backend (app.models.domain, casos reais fechados) -> classe do modelo.
# Mesmo espaço de rótulos de MICRO_TO_CLASS; mantido separado porque a origem dos
# dados (base histórica em xlsx vs. casos reais encerrados) usa nomes diferentes.
OUTCOME_TO_CLASS = {
    "EXTINCAO": "extincao",
    "IMPROCEDENCIA": "improcedencia",
    "PARCIAL": "parcial",
    "PROCEDENCIA": "procedencia",
}


@dataclass(frozen=True)
class CaseFeatures:
    uf: str
    sub_golpe: bool
    flags: tuple[bool, bool, bool, bool, bool, bool]
    valor_causa: float

    @classmethod
    def from_values(
        cls, uf: str, sub_assunto: str, flags: dict[str, bool], valor_causa: float
    ) -> "CaseFeatures":
        return cls(
            uf=uf.strip().upper(),
            sub_golpe=sub_assunto.strip().upper() == "GOLPE",
            flags=tuple(bool(flags[name]) for name in FLAG_NAMES),  # type: ignore[arg-type]
            valor_causa=float(valor_causa),
        )

    @property
    def cohort_key(self) -> str:
        bits = "".join("1" if flag else "0" for flag in self.flags)
        return f"{self.uf}|{'GOLPE' if self.sub_golpe else 'GENERICO'}|{bits}"


def feature_names(ufs: Sequence[str]) -> list[str]:
    return [f"uf_{uf}" for uf in ufs] + ["sub_golpe", *FLAG_NAMES, "valor_causa"]


def encode(cases: Sequence[CaseFeatures], ufs: Sequence[str]) -> np.ndarray:
    """One-hot da UF (UF desconhecida fica toda zerada), subassunto, flags e valor da causa."""

    index = {uf: position for position, uf in enumerate(ufs)}
    matrix = np.zeros((len(cases), len(ufs) + 8), dtype=np.float32)
    for row, case in enumerate(cases):
        if case.uf in index:
            matrix[row, index[case.uf]] = 1.0
        matrix[row, len(ufs)] = float(case.sub_golpe)
        matrix[row, len(ufs) + 1 : len(ufs) + 7] = case.flags
        matrix[row, len(ufs) + 7] = case.valor_causa
    return matrix
