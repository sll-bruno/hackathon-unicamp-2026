import json
from types import SimpleNamespace

from app.core.config import get_settings
from app.schemas import ChatAnswer, ChatAnswerPoint
from fastapi.testclient import TestClient


def demo_case(client: TestClient) -> dict:
    return next(item for item in client.get("/api/cases").json()["items"] if item["is_demo"])


def test_chat_persists_messages_and_filters_unknown_citations(
    client: TestClient, monkeypatch
) -> None:
    captured: dict = {}
    case = demo_case(client)
    workspace = client.get(f"/api/cases/{case['id']}/workspace").json()
    evidence_id = workspace["facts"][0]["id"]

    class FakeGateway:
        def __init__(self, api_key: str, model: str, reasoning_effort: str) -> None:
            assert api_key == "test-key"
            assert model == "gpt-5.6-luna"
            assert reasoning_effort == "medium"

        def answer(self, context: dict) -> ChatAnswer:
            captured.update(context)
            return ChatAnswer(
                summary="A recomendação é sustentada pela documentação disponível.",
                points=[
                    ChatAnswerPoint(
                        title="Prova principal",
                        text="A documentação confirma a contratação.",
                        evidence_ids=[evidence_id, "invented-evidence"],
                    )
                ],
                caveat=None,
            )

    monkeypatch.setattr("app.routers.chat.OpenAIChatGateway", FakeGateway)
    response = client.post(
        f"/api/cases/{case['id']}/chat/messages",
        json={"message": "Por que foi recomendado acordo?"},
    )
    assert response.status_code == 201
    assert response.json()["runtime"] == {
        "provider": "OpenAI",
        "model": "gpt-5.6-luna",
        "reasoning_effort": "medium",
    }
    assert response.json()["assistant_message"]["evidence_ids"] == [evidence_id]
    assert response.json()["assistant_message"]["structured_answer"] == {
        "summary": "A recomendação é sustentada pela documentação disponível.",
        "points": [
            {
                "title": "Prova principal",
                "text": "A documentação confirma a contratação.",
                "evidence_ids": [evidence_id],
            }
        ],
        "caveat": None,
    }
    assert len(response.json()["sources"]) == 1
    serialized_context = json.dumps(captured, default=str).lower()
    assert ".pdf" not in serialized_context
    assert "stored_path" not in serialized_context

    history = client.get(f"/api/cases/{case['id']}/chat/messages").json()
    assert history["total"] == 2
    assert history["runtime"] == response.json()["runtime"]
    assert [message["role"] for message in history["items"]] == ["USER", "ASSISTANT"]
    assert history["items"][1]["structured_answer"] == response.json()["assistant_message"][
        "structured_answer"
    ]
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
        def __init__(self, api_key: str, model: str, reasoning_effort: str) -> None:
            pass

        def answer(self, context: dict) -> ChatAnswer:
            raise RuntimeError("provider unavailable")

    monkeypatch.setattr("app.routers.chat.OpenAIChatGateway", BrokenGateway)
    failed = client.post(f"/api/cases/{case['id']}/chat/messages", json={"message": "Explique"})
    assert failed.status_code == 502
    assert failed.json()["code"] == "OPENAI_PROVIDER_ERROR"
    history = client.get(f"/api/cases/{case['id']}/chat/messages").json()["items"]
    assert history[-1]["status"] == "FAILED"


def test_chat_gateway_uses_luna_medium_and_bounded_structured_output(monkeypatch) -> None:
    captured: dict = {}

    class FakeResponses:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                output_text=json.dumps(
                    {
                        "summary": "Resposta curta.",
                        "points": [
                            {
                                "title": "Síntese",
                                "text": "Sem fatos adicionais.",
                                "evidence_ids": [],
                            }
                        ],
                        "caveat": None,
                    }
                )
            )

    class FakeOpenAI:
        def __init__(self, api_key: str) -> None:
            assert api_key == "test-key"
            self.responses = FakeResponses()

    monkeypatch.setattr("openai.OpenAI", FakeOpenAI)
    from app.services.chat import OpenAIChatGateway

    result = OpenAIChatGateway("test-key", "gpt-5.6-luna", "medium").answer(
        {"question": "Resuma"}
    )

    assert result.summary == "Resposta curta."
    assert captured["model"] == "gpt-5.6-luna"
    assert captured["reasoning"] == {"effort": "medium"}
    assert captured["max_output_tokens"] == 2000
    schema = captured["text"]["format"]["schema"]
    assert schema["properties"]["summary"]["maxLength"] == 280
    assert schema["properties"]["points"]["maxItems"] == 4
