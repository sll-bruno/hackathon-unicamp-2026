from collections import Counter, defaultdict
from typing import Any

from sqlmodel import Session, select

from app.models import (
    Case,
    CaseOutcome,
    CaseStatus,
    DivergenceReason,
    LawyerDecision,
    NegotiationResult,
    OutcomeType,
    RecommendationRecord,
)


def _ratio(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


def _observed_cost(outcome: CaseOutcome) -> float:
    legal_costs = outcome.legal_costs or 0.0
    if outcome.outcome == OutcomeType.ACORDO:
        return (outcome.final_value or 0.0) + legal_costs
    return (outcome.defense_cost or 0.0) + (outcome.court_award or 0.0) + legal_costs


def build_dashboard(session: Session) -> dict[str, Any]:
    cases = list(session.exec(select(Case)).all())
    recommendations = list(
        session.exec(
            select(RecommendationRecord).where(RecommendationRecord.is_current.is_(True))
        ).all()
    )
    decisions = list(session.exec(select(LawyerDecision)).all())
    negotiations = list(session.exec(select(NegotiationResult)).all())
    outcomes = list(session.exec(select(CaseOutcome)).all())

    status_counts = Counter(case.status.value for case in cases)
    action_counts = Counter(recommendation.action.value for recommendation in recommendations)
    divergence_counts = Counter(
        decision.divergence_reason.value
        for decision in decisions
        if not decision.adhered and decision.divergence_reason is not None
    )
    agreement_negotiations = [result for result in negotiations]
    accepted = sum(result.accepted for result in agreement_negotiations)
    adhered = sum(decision.adhered for decision in decisions)
    decision_by_case = {decision.case_id: decision for decision in decisions}

    recommendation_by_case = {
        recommendation.case_id: recommendation for recommendation in recommendations
    }
    agreement_comparisons: list[float] = []
    defense_errors: list[float] = []
    observed_disbursement = 0.0
    series: dict[str, dict[str, float | int]] = defaultdict(
        lambda: {"closed_cases": 0, "observed_disbursement": 0.0}
    )
    effectiveness_eligible = 0
    effectiveness_successful = 0
    for outcome in outcomes:
        observed = _observed_cost(outcome)
        observed_disbursement += observed
        day = outcome.created_at.date().isoformat()
        series[day]["closed_cases"] += 1
        series[day]["observed_disbursement"] += observed
        recommendation = recommendation_by_case.get(outcome.case_id)
        decision = decision_by_case.get(outcome.case_id)
        if decision is not None and decision.adhered:
            effectiveness_eligible += 1
            if outcome.outcome in {OutcomeType.IMPROCEDENCIA, OutcomeType.EXTINCAO}:
                effectiveness_successful += 1
        if recommendation is None:
            continue
        if outcome.outcome == OutcomeType.ACORDO:
            agreement_comparisons.append(recommendation.expected_defense_cost - observed)
        else:
            defense_errors.append(observed - recommendation.expected_defense_cost)

    demo_case_ids = {case.id for case in cases if case.is_demo}
    fixture_outcomes = sum(outcome.source_kind == "DEMO_FIXTURE" for outcome in outcomes)
    return {
        "generated_from_persisted_events": True,
        "cases": {
            "total": len(cases),
            "analyzed": len(recommendations),
            "by_status": {status.value: status_counts[status.value] for status in CaseStatus},
            "by_recommended_action": dict(sorted(action_counts.items())),
        },
        "adherence": {
            "decisions": len(decisions),
            "adhered": adhered,
            "rate": _ratio(adhered, len(decisions)),
            "divergence_reasons": {
                reason.value: divergence_counts[reason.value] for reason in DivergenceReason
            },
        },
        "effectiveness": {
            "eligible": effectiveness_eligible,
            "successful": effectiveness_successful,
            "rate": _ratio(effectiveness_successful, effectiveness_eligible),
        },
        "agreements": {
            "negotiations": len(agreement_negotiations),
            "accepted": accepted,
            "acceptance_rate": _ratio(accepted, len(agreement_negotiations)),
        },
        "economics": {
            "observed_disbursement": round(observed_disbursement, 2),
            "expected_savings": round(sum(rec.expected_savings for rec in recommendations), 2),
            "agreement_savings_vs_expected_defense": {
                "cases": len(agreement_comparisons),
                "total": round(sum(agreement_comparisons), 2),
                "average": (
                    round(sum(agreement_comparisons) / len(agreement_comparisons), 2)
                    if agreement_comparisons
                    else None
                ),
            },
            "defense_prediction_error": {
                "cases": len(defense_errors),
                "average_signed": (
                    round(sum(defense_errors) / len(defense_errors), 2) if defense_errors else None
                ),
                "average_absolute": (
                    round(sum(abs(value) for value in defense_errors) / len(defense_errors), 2)
                    if defense_errors
                    else None
                ),
            },
        },
        "time_series": [
            {
                "date": day,
                "closed_cases": values["closed_cases"],
                "observed_disbursement": round(float(values["observed_disbursement"]), 2),
            }
            for day, values in sorted(series.items())
        ],
        "demo_data": {
            "case_count": len(demo_case_ids),
            "fixture_outcome_count": fixture_outcomes,
            "contains_demo_fixture": fixture_outcomes > 0,
        },
    }
