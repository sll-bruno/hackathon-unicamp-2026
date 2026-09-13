from collections.abc import Callable

from contracts.pipeline import CaseInput, PipelineOutput

from decision_engine.settings import load_settings
from decision_engine.stub import build_stub_output

ProgressCallback = Callable[[str, int], None]


def run_pipeline(case: CaseInput, on_progress: ProgressCallback | None = None) -> PipelineOutput:
    """Ponto de entrada da engine.

    `ENGINE_MODE` controla o comportamento: `off` (padrão) mantém a engine desligada,
    `stub` devolve a resposta provisória e `full` executará o pipeline completo.
    """

    settings = load_settings()
    if settings.mode == "stub":
        return build_stub_output(case)
    if settings.mode == "full":
        raise NotImplementedError("ENGINE_MODE=full ainda não foi implementado")
    raise NotImplementedError("Engine desligada; defina ENGINE_MODE=stub para testar a integração")
