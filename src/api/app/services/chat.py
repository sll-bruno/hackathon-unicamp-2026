import json
from typing import Any

from app.schemas import ChatAnswer

CHAT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "maxLength": 280},
        "points": {
            "type": "array",
            "minItems": 1,
            "maxItems": 4,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "maxLength": 80},
                    "text": {"type": "string", "maxLength": 320},
                    "evidence_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "maxItems": 3,
                    },
                },
                "required": ["title", "text", "evidence_ids"],
                "additionalProperties": False,
            },
        },
        "caveat": {"type": ["string", "null"], "maxLength": 280},
    },
    "required": ["summary", "points", "caveat"],
    "additionalProperties": False,
}


class OpenAIChatGateway:
    def __init__(self, api_key: str, model: str, reasoning_effort: str) -> None:
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.reasoning_effort = reasoning_effort

    def answer(self, context: dict[str, Any]) -> ChatAnswer:
        response = self.client.responses.create(
            model=self.model,
            reasoning={"effort": self.reasoning_effort},
            max_output_tokens=2000,
            input=[
                {
                    "role": "system",
                    "content": (
                        "Você é um assistente jurídico de apoio à decisão do banco. Responda "
                        "somente com base no snapshot já processado e nas evidências fornecidas. "
                        "Preencha summary com a conclusão direta. Em points, retorne de 1 a 4 "
                        "argumentos curtos, cada um com título, explicação e até 3 evidence_ids. "
                        "Use caveat para a principal ressalva ou null quando não houver. "
                        "Não repita "
                        "a pergunta, não despeje todas as evidências e não escreva IDs nos textos. "
                        "Priorize os 3 fatos mais relevantes. Diferencie fatos "
                        "favoráveis ao banco, contradições e lacunas. Se o contexto não sustentar "
                        "a resposta, diga isso claramente. Não dê aconselhamento fora do caso."
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
