import json
from typing import Any

from app.schemas import ChatAnswer

CHAT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "evidence_ids": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "evidence_ids"],
    "additionalProperties": False,
}


class OpenAIChatGateway:
    def __init__(self, api_key: str, model: str) -> None:
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key)
        self.model = model

    def answer(self, context: dict[str, Any]) -> ChatAnswer:
        response = self.client.responses.create(
            model=self.model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "Você é um assistente jurídico de apoio. Responda apenas com base no "
                        "snapshot e nas evidências fornecidas. Cite somente IDs existentes. "
                        "Se o contexto não sustentar uma resposta, diga isso claramente."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(context, ensure_ascii=False, default=str),
                },
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "legal_answer",
                    "strict": True,
                    "schema": CHAT_SCHEMA,
                }
            },
        )
        return ChatAnswer.model_validate_json(response.output_text)
