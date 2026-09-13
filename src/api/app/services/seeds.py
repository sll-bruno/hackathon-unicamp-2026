import json
from pathlib import Path

from sqlmodel import Session, select

from app.core.config import Settings
from app.models import (
    Action,
    Case,
    CaseOutcome,
    CaseStatus,
    CaseStatusHistory,
    Document,
    DocumentOrigin,
    DocumentType,
    EvidenceRecord,
    Lawyer,
    LawyerDecision,
    NegotiationResult,
    Office,
    OutcomeType,
    RecommendationRecord,
)

OFFICE_NAME = "Amaral Advocacia — Demo"
LAWYER_EMAIL = "advogado.demo@enter.local"

CASE_SPECS = (
    {
        "cnj": "0801234-56.2024.8.10.0001",
        "folder": "Caso_01_0801234-56-2024-8-10-0001",
        "uf": "MA",
        "valor_causa": 10_000.0,
        "flags": (True, True, True, True, True, True),
        "documents": (
            (DocumentType.AUTOS, "01_Autos_Processo_0801234-56-2024-8-10-0001.pdf"),
            (DocumentType.CONTRATO, "02_Contrato_502348719.pdf"),
            (DocumentType.EXTRATO, "03_Extrato_Bancario.pdf"),
            (DocumentType.COMPROVANTE_CREDITO, "04_Comprovante_de_Credito_BACEN.pdf"),
            (DocumentType.DOSSIE, "05_Dossie_Veritas.pdf"),
            (DocumentType.DEMONSTRATIVO_DIVIDA, "06_Demonstrativo_Evolucao_Divida.pdf"),
            (DocumentType.LAUDO_REFERENCIADO, "07_Laudo_Referenciado.pdf"),
        ),
        "is_demo": True,
    },
    {
        "cnj": "0654321-09.2024.8.04.0001",
        "folder": "Caso_02_0654321-09-2024-8-04-0001",
        "uf": "AM",
        "valor_causa": 8_000.0,
        "flags": (False, False, True, False, True, True),
        "documents": (
            (DocumentType.AUTOS, "01_Autos_Processo_0654321-09-2024-8-04-0001.pdf"),
            (DocumentType.COMPROVANTE_CREDITO, "02_Comprovante_de_Credito_BACEN.pdf"),
            (DocumentType.DEMONSTRATIVO_DIVIDA, "03_Demonstrativo_Evolucao_Divida.pdf"),
            (DocumentType.LAUDO_REFERENCIADO, "04_Laudo_Referenciado.pdf"),
        ),
        "is_demo": False,
    },
)


def _get_or_create_profile(session: Session) -> Lawyer:
    office = session.exec(select(Office).where(Office.name == OFFICE_NAME)).first()
    if office is None:
        office = Office(name=OFFICE_NAME)
        session.add(office)
        session.flush()
    lawyer = session.exec(select(Lawyer).where(Lawyer.email == LAWYER_EMAIL)).first()
    if lawyer is None:
        lawyer = Lawyer(
            office_id=office.id,
            name="Advogado Demonstrador",
            email=LAWYER_EMAIL,
        )
        session.add(lawyer)
        session.flush()
    return lawyer


def _create_case(session: Session, spec: dict) -> tuple[Case, bool]:
    existing = session.exec(select(Case).where(Case.cnj == spec["cnj"])).first()
    if existing is not None:
        return existing, False
    contrato, extrato, comprovante, dossie, demonstrativo, laudo = spec["flags"]
    case = Case(
        cnj=spec["cnj"],
        uf=spec["uf"],
        assunto="Empréstimo consignado não reconhecido",
        subassunto="Inexistência de relação jurídica",
        valor_causa=spec["valor_causa"],
        contrato=contrato,
        extrato=extrato,
        comprovante_credito=comprovante,
        dossie=dossie,
        demonstrativo_divida=demonstrativo,
        laudo_referenciado=laudo,
        status=CaseStatus.ENCERRADO if spec["is_demo"] else CaseStatus.DOCUMENTOS_ENVIADOS,
        is_demo=spec["is_demo"],
    )
    session.add(case)
    session.flush()
    session.add(
        CaseStatusHistory(
            case_id=case.id,
            from_status=None,
            to_status=case.status,
            actor="DEMO_SEED",
        )
    )
    return case, True


def _seed_documents(session: Session, case: Case, spec: dict, data_dir: Path) -> list[Document]:
    existing = session.exec(select(Document).where(Document.case_id == case.id)).all()
    existing_names = {document.original_name for document in existing}
    documents = list(existing)
    for document_type, filename in spec["documents"]:
        if filename in existing_names:
            continue
        document = Document(
            case_id=case.id,
            type=document_type,
            original_name=filename,
            stored_path=str((data_dir / spec["folder"] / filename).resolve()),
            origin=DocumentOrigin.SEED,
        )
        session.add(document)
        session.flush()
        documents.append(document)
    return documents


def _seed_closed_fixture(
    session: Session, case: Case, lawyer: Lawyer, documents: list[Document]
) -> None:
    contract = next(document for document in documents if document.type == DocumentType.CONTRATO)
    sources = [
        {
            "document_id": contract.id,
            "page": 1,
            "excerpt": (
                "O valor líquido liberado será creditado em conta de titularidade do TOMADOR, "
                "junto ao Banco UFMG S.A., agência 0001, conta corrente 20.348.719-5, na data "
                "prevista de 12/05/2022."
            ),
        }
    ]
    evidence_payload = [
        {
            "id": "demo-evidence-1",
            "text": (
                "O contrato registra crédito de R$ 5.000,00 na conta da titular em 12/05/2022."
            ),
            "type": "DOCUMENTACAO_COMPLETA",
            "weight": 1.0,
            "sources": sources,
        }
    ]
    payload = {
        "versions": {"pipeline": "demo-fixture-v1"},
        "confidence_method_version": "demo-fixture-v1",
        "risk": {
            "probabilities": {
                "extincao": 0.08,
                "improcedencia": 0.12,
                "parcial": 0.51,
                "procedencia": 0.29,
            },
            "cohort_size": 196,
        },
        "recommendation": {
            "action": "ACORDO",
            "confidence_percent": 87.0,
            "summary": "Fixture para demonstrar o ciclo completo de acordo.",
            "reason_codes": ["DEMO_FIXTURE"],
        },
        "financial": {
            "suggested_offer": 3200.0,
            "expected_defense_cost": 6900.0,
            "expected_savings": 3700.0,
        },
        "defense_cost_range": [5700.0, 8100.0],
        "settlement_range": {
            "opening": 2600.0,
            "target": 3200.0,
            "ceiling": 4200.0,
        },
        "what_changes": [
            "Prova nova e autenticada da contratação pode tornar a defesa preferível.",
            "Redução relevante do custo esperado da defesa exige nova comparação econômica.",
        ],
        "assumptions": [
            "Valores e probabilidades deste processo encerrado são um fixture da demonstração.",
            "A oferta-alvo de R$ 3.200 preserva R$ 3.700 frente ao custo esperado da defesa.",
        ],
        "facts": [
            {
                "id": "demo-fact-1",
                "fact_type": "documentacao_disponivel",
                "description": (
                    "O contrato registra crédito de R$ 5.000,00 na conta da titular em 12/05/2022."
                ),
                "weight": 1.0,
                "weights_version": "demo-fixture-v1",
                "relation": "neutral",
                "sources": sources,
            }
        ],
        "contradictions": [],
        "gaps": [],
        "evidences": evidence_payload,
        "source_kind": "DEMO_FIXTURE",
    }
    existing = session.exec(
        select(RecommendationRecord).where(RecommendationRecord.case_id == case.id)
    ).first()
    if existing is not None:
        if existing.source_kind == "DEMO_FIXTURE":
            existing.payload_json = json.dumps(payload, ensure_ascii=False)
            existing.versions_json = json.dumps(payload["versions"], ensure_ascii=False)
            session.add(existing)
            evidence = session.exec(
                select(EvidenceRecord).where(
                    EvidenceRecord.recommendation_id == existing.id,
                    EvidenceRecord.external_id == evidence_payload[0]["id"],
                )
            ).first()
            if evidence is not None:
                evidence.text = evidence_payload[0]["text"]
                evidence.type = evidence_payload[0]["type"]
                evidence.weight = evidence_payload[0]["weight"]
                evidence.sources_json = json.dumps(
                    evidence_payload[0]["sources"], ensure_ascii=False
                )
                session.add(evidence)
        return
    recommendation = RecommendationRecord(
        case_id=case.id,
        action=Action.ACORDO,
        confidence_percent=87.0,
        summary="Fixture para demonstrar o ciclo completo de acordo.",
        reason_codes_json=json.dumps(["DEMO_FIXTURE"]),
        suggested_offer=3200.0,
        expected_defense_cost=6900.0,
        expected_savings=3700.0,
        versions_json=json.dumps({"pipeline": "demo-fixture-v1"}),
        payload_json=json.dumps(payload, ensure_ascii=False),
        source_kind="DEMO_FIXTURE",
    )
    session.add(recommendation)
    session.flush()
    evidence = evidence_payload[0]
    session.add(
        EvidenceRecord(
            recommendation_id=recommendation.id,
            external_id=evidence["id"],
            text=evidence["text"],
            type=evidence["type"],
            weight=evidence["weight"],
            sources_json=json.dumps(evidence["sources"], ensure_ascii=False),
        )
    )
    decision = LawyerDecision(
        case_id=case.id,
        recommendation_id=recommendation.id,
        lawyer_id=lawyer.id,
        action=Action.ACORDO,
        adhered=True,
    )
    session.add(decision)
    session.flush()
    session.add(
        NegotiationResult(
            case_id=case.id,
            decision_id=decision.id,
            accepted=True,
            final_value=3000.0,
        )
    )
    session.add(
        CaseOutcome(
            case_id=case.id,
            outcome=OutcomeType.ACORDO,
            final_value=3000.0,
            legal_costs=250.0,
            notes="Registro demonstrativo criado pelo seed.",
            source_kind="DEMO_FIXTURE",
        )
    )


def seed_demo_data(session: Session, settings: Settings) -> None:
    if not settings.demo_seed:
        return
    lawyer = _get_or_create_profile(session)
    for spec in CASE_SPECS:
        case, _created = _create_case(session, spec)
        documents = _seed_documents(session, case, spec, settings.data_dir)
        if spec["is_demo"]:
            _seed_closed_fixture(session, case, lawyer, documents)
    session.commit()
