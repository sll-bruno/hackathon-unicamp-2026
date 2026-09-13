import json

from app.core.config import get_settings
from app.schemas import ChatAnswer
from fastapi.testclient import TestClient


def demo_case(client: TestClient) -> dict:
    return next(item for item in client.get("/api/cases").json()["items"] if item["is_demo"])


def test_chat_persists_messages_and_filters_unknown_citations(
    client: TestClient, monkeypatch
) -> None:
    captured: dict = {}

    class FakeGateway:
        def __init__(self, api_key: str, model: str) -> None:
            assert api_key == "test-key"
            assert model == "gpt-5"

        def answer(self, context: dict) -> ChatAnswer:
            captured.update(context)
            return ChatAnswer(
                answer="A recomendação é sustentada pela documentação disponível.",
                evidence_ids=["demo-evidence-1", "invented-evidence"],
            )

    monkeypatch.setattr("app.routers.chat.OpenAIChatGateway", FakeGateway)
    case = demo_case(client)
    response = client.post(
        f"/api/cases/{case['id']}/chat/messages",
        json={"message": "Por que foi recomendado acordo?"},
    )
    assert response.status_code == 201
    assert response.json()["assistant_message"]["evidence_ids"] == ["demo-evidence-1"]
    assert len(response.json()["sources"]) == 1
    serialized_context = json.dumps(captured, default=str).lower()
    assert ".pdf" not in serialized_context
    assert "stored_path" not in serialized_context

    history = client.get(f"/api/cases/{case['id']}/chat/messages").json()
    assert history["total"] == 2
    assert [message["role"] for message in history["items"]] == ["USER", "ASSISTANT"]
    cited_evidence_id = history["items"][1]["evidence_ids"][0]
    workspace = client.get(f"/api/cases/{case['id']}/workspace").json()
    cited_fact = next(fact for fact in workspace["facts"] if fact["id"] == cited_evidence_id)
    assert cited_fact["sources"] == response.json()["sources"][0]["sources"]


def test_chat_reports_missing_key_and_provider_failure(client: TestClient, monkeypatch) -> None:
    case = demo_case(client)
    settings = get_settings()
    settings.openai_api_key = ""
    missing = client.post(f"/api/cases/{case['id']}/chat/messages", json={"message": "Explique"})
    assert missing.status_code == 503
    assert missing.json()["code"] == "OPENAI_NOT_CONFIGURED"

    settings.openai_api_key = "test-key"

    class BrokenGateway:
        def __init__(self, api_key: str, model: str) -> None:
            pass

        def answer(self, context: dict) -> ChatAnswer:
            raise RuntimeError("provider unavailable")

    monkeypatch.setattr("app.routers.chat.OpenAIChatGateway", BrokenGateway)
    failed = client.post(f"/api/cases/{case['id']}/chat/messages", json={"message": "Explique"})
    assert failed.status_code == 502
    assert failed.json()["code"] == "OPENAI_PROVIDER_ERROR"
    history = client.get(f"/api/cases/{case['id']}/chat/messages").json()["items"]
    assert history[-1]["status"] == "FAILED"
