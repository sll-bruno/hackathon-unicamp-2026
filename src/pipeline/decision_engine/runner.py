from collections.abc import Callable

from contracts.pipeline import CaseInput, PipelineOutput

from decision_engine.decision.decisor import build_analysis, decide
from decision_engine.extraction.content import extract_content
from decision_engine.finance.motor import analyze, confidence_percent
from decision_engine.ingest.package import build_package
from decision_engine.llm.client import LLMClient
from decision_engine.output.envelope import build_output
from decision_engine.risk.features import CaseFeatures
from decision_engine.risk.model import load_risk_model
from decision_engine.scoring.probabilidade import estimate_content
from decision_engine.settings import load_settings
from decision_engine.stub import build_stub_output

ProgressCallback = Callable[[str, int], None]


def _full_pipeline(case: CaseInput, on_progress: ProgressCallback) -> PipelineOutput:
    settings = load_settings()
    client = LLMClient(settings)

    on_progress("INGESTAO", 10)
    package = build_package(case)

    on_progress("EXTRACAO", 25)
    extraction = extract_content(package, client)

    on_progress("RISCO", 60)
    model = load_risk_model(settings.artifacts_dir)
    features = CaseFeatures.from_values(
        package.uf, extraction.triagem.subassunto, package.flags, package.valor_causa
    )
    risk = model.predict(features)

    on_progress("FINANCEIRO", 70)
    content = estimate_content(
        extraction.acusacoes,
        extraction.embasamentos,
        package.demonstrativo,
        package.valor_causa,
        model.severity["procedencia"],
    )
    finance = analyze(
        risk, content, model, package.valor_causa, risk.coorte_n, extraction.taxa_reprovacao
    )
    reason_codes = sorted(set(risk.alertas + content.alertas + finance.alertas))
    if extraction.triagem.ambiguo:
        reason_codes.append("SUBASSUNTO_AMBIGUO")
    if not extraction.triagem.no_escopo:
        reason_codes.append("FORA_DO_ESCOPO")

    on_progress("DECISAO", 85)
    case_summary = {
        "cnj": case.cnj,
        "uf": package.uf,
        "subassunto": extraction.triagem.subassunto,
        "valor_causa": package.valor_causa,
        "subsidios_disponiveis": package.flags,
    }
    analysis = build_analysis(
        case_summary,
        risk,
        content,
        extraction.embasamentos,
        finance,
        reason_codes,
        model.meta["perfil_regional"]["taxa_derrota_nacional"],
    )
    decision = decide(analysis, client)
    economic_action = "ACORDO" if finance.vantagem_economica_acordo > 0 else "DEFESA"
    if decision.acao != economic_action:
        reason_codes.append("DECISAO_CONTRARIA_ECONOMIA")
    confidence = confidence_percent(decision.acao, finance, reason_codes)

    on_progress("CONCLUIDO", 100)
    return build_output(
        package,
        model,
        risk,
        extraction,
        content,
        finance,
        decision,
        reason_codes,
        confidence,
        client.model,
    )


def run_pipeline(case: CaseInput, on_progress: ProgressCallback | None = None) -> PipelineOutput:
    """Ponto de entrada da engine.

    `ENGINE_MODE` controla o comportamento: `off` (padrão) mantém a engine desligada,
    `stub` devolve a resposta provisória e `full` executa o pipeline completo.
    """

    settings = load_settings()
    if settings.mode == "stub":
        return build_stub_output(case)
    if settings.mode == "full":
        return _full_pipeline(case, on_progress or (lambda _stage, _progress: None))
    raise NotImplementedError("Engine desligada; defina ENGINE_MODE=stub para testar a integração")
