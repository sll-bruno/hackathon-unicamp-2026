import pytest
from decision_engine.config_loader import (
    PROMPT_IDS,
    category_weight,
    load_params,
    load_prompt,
    load_weights,
    prompt_versions,
)

EXPECTED_PLACEHOLDERS = {
    "p1_classificacao_pagina": {"nome_arquivo", "pagina", "total_paginas", "texto_pagina"},
    "p2_triagem_peticao": {"chunks"},
    "p3_acusacoes": {"chunks"},
    "p4_embasamentos": {
        "acusacao",
        "acusacao_principal",
        "documentos_presentes",
        "tipos_ausentes",
        "anexos_citados",
        "candidatos",
        "categorias",
        "chunks",
    },
    "p5_fichamento": {"acusacoes", "categorias_por_tipo", "chunks"},
    "p6_validador": {
        "acusacoes",
        "categorias_por_tipo",
        "chunks_pedidos",
        "reprovados_deterministicos",
        "itens",
    },
    "p7_decisora": {"analise", "erros_da_tentativa_anterior"},
}


def test_params_are_internally_consistent() -> None:
    params = load_params()
    combination = params["combinacao"]
    assert combination["alfa_min"] <= combination["alfa"] <= combination["alfa_max"] <= 1

    low, high = params["scoring"]["clip"]
    assert 0 < low < params["scoring"]["p0_principal"] < high < 1
    assert "margem" not in params["custos"], "a margem só servia à regra de decisão removida"


def test_weights_define_one_principal_and_signed_categories() -> None:
    weights = load_weights()
    types = weights["tipos_acusacao"]
    assert [name for name, spec in types.items() if spec["principal"]] == [
        "inexistencia_contratacao"
    ]
    for spec in types.values():
        for category, entry in spec["categorias"].items():
            assert isinstance(entry["peso"], int) and entry["peso"] != 0, category
            assert entry["definicao"].strip(), category

    principal = types["inexistencia_contratacao"]["categorias"]
    for categories in weights["projecao_workspace"].values():
        assert set(categories) <= principal.keys()

    assert category_weight(weights, "dano_moral", "vulnerabilidade_autor") == -1
    assert category_weight(weights, "dano_moral", "provas_contratacao") is None


@pytest.mark.parametrize("prompt_id", PROMPT_IDS)
def test_prompts_load_with_expected_placeholders(prompt_id: str) -> None:
    prompt = load_prompt(prompt_id)
    assert prompt.system and prompt.user
    assert prompt.placeholders == EXPECTED_PLACEHOLDERS[prompt_id]
    rendered = prompt.render_user(**{name: f"<{name}>" for name in prompt.placeholders})
    assert "{{" not in rendered


def test_prompt_render_rejects_missing_or_unknown_values() -> None:
    prompt = load_prompt("p2_triagem_peticao")
    with pytest.raises(KeyError):
        prompt.render_user()
    with pytest.raises(KeyError):
        prompt.render_user(chunks="x", extra="y")


def test_prompt_versions_fit_the_contract() -> None:
    versions = prompt_versions()
    assert set(versions) == {f"prompt_{prompt_id}" for prompt_id in PROMPT_IDS}
    assert all(isinstance(value, str) and value.startswith("v1-") for value in versions.values())
